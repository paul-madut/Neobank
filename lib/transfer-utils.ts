import { prisma } from './prisma'
import { requireKYC } from './kyc-utils'
import { v4 as uuidv4 } from 'uuid'
import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import type { Account, Transaction, TransactionType } from '@prisma/client'
import type { PublicRecipient } from '@/types/account'
import {
  InsufficientFundsError,
  getSystemAccount,
  postDoubleEntry,
} from './ledger'
import { authorizeACHTransfer, createACHTransfer } from './plaid-utils'

// Transfer limits from environment variables. Parsed once at module load; these
// are configuration, not money, so a float here is fine. Everything downstream
// of this point is Decimal.
const MAX_TRANSFER_AMOUNT = new Decimal(
  process.env.MAX_TRANSFER_AMOUNT || '10000'
)
const DAILY_TRANSFER_LIMIT = new Decimal(
  process.env.DAILY_TRANSFER_LIMIT || '25000'
)
const PENDING_REVIEW_THRESHOLD = new Decimal(
  process.env.PENDING_REVIEW_THRESHOLD || '5000'
)

/** Money leaving an account. Counts against the daily outflow cap. */
const OUTBOUND_TYPES: TransactionType[] = [
  'P2P_TRANSFER',
  'ACH_DEBIT',
  'CARD_PURCHASE',
  'CARD_CAPTURE',
  'WITHDRAWAL',
  'FEE',
]

/** Money arriving in an account. Capped separately, since large unexplained
 *  inflows are their own AML signal rather than a spending risk. */
const INBOUND_TYPES: TransactionType[] = [
  'ACH_CREDIT',
  'CARD_REFUND',
  'REFUND',
  'DEPOSIT',
]

/** Full recipient record. Internal only - never serialize this to a client. */
export interface RecipientInfo {
  id: string
  email: string
  firstName: string
  lastName: string
  accountId: string
  accountNumber: string
  accountStatus: string
}

/**
 * What a recipient lookup is allowed to tell the searcher.
 *
 * Recipient search is an account enumeration surface: anyone authenticated can
 * probe an email and learn whether it belongs to a customer. That cannot be
 * removed without breaking send-by-email, so it is instead reduced to the
 * minimum needed to confirm you are paying the right person, and rate limited.
 * A full name, email and account number would let an attacker harvest the
 * customer list.
 */
export type { PublicRecipient }

export interface TransferValidation {
  isValid: boolean
  error?: string
  senderAccount?: Account
  recipientAccount?: Account
}

export interface TransferResult {
  success: boolean
  transactionId?: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  error?: string
  /** True when an existing transaction was returned for a repeated idempotency key. */
  replayed?: boolean
}

export function toPublicRecipient(
  recipient: RecipientInfo,
  identifier: string
): PublicRecipient {
  const lastInitial = recipient.lastName
    ? `${recipient.lastName.charAt(0).toUpperCase()}.`
    : ''

  return {
    identifier,
    displayName: `${recipient.firstName} ${lastInitial}`.trim(),
    maskedAccountNumber: `••••${recipient.accountNumber.slice(-4)}`,
    accountStatus: recipient.accountStatus,
  }
}

/**
 * Find a recipient by email or account number.
 *
 * Returns the full internal record. Route handlers must pass the result through
 * toPublicRecipient before responding.
 */
export async function findRecipient(
  identifier: string
): Promise<RecipientInfo | null> {
  // Determine if identifier is email or account number
  const isEmail = identifier.includes('@')

  const user = await prisma.user.findFirst({
    where: isEmail
      ? { email: identifier.toLowerCase() }
      : {
          accounts: {
            some: {
              accountNumber: identifier,
            },
          },
        },
    include: {
      accounts: {
        where: {
          status: 'ACTIVE',
          accountType: {
            in: ['CHECKING', 'SAVINGS'],
          },
        },
        take: 1,
      },
    },
  })

  if (!user || !user.accounts[0]) {
    return null
  }

  const account = user.accounts[0]

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName || 'Unknown',
    lastName: user.lastName || 'User',
    accountId: account.id,
    accountNumber: account.accountNumber,
    accountStatus: account.status,
  }
}

/**
 * Check per-transaction and daily transfer limits.
 *
 * `flow` decides which side of the account the daily cap is measured on, so an
 * ACH deposit does not consume a customer's daily spending allowance and an
 * ACH withdrawal does. Both directions are capped; neither used to be.
 */
export async function checkTransferLimits(
  userId: string,
  accountId: string,
  amount: Decimal,
  flow: 'OUTBOUND' | 'INBOUND' = 'OUTBOUND'
): Promise<{ allowed: boolean; error?: string }> {
  // Check per-transaction limit
  if (amount.gt(MAX_TRANSFER_AMOUNT)) {
    return {
      allowed: false,
      error: `Transfer amount exceeds maximum limit of $${MAX_TRANSFER_AMOUNT.toFixed(2)}`,
    }
  }

  // Get today's transfers
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const isOutbound = flow === 'OUTBOUND'

  const todaysTransfers = await prisma.transaction.aggregate({
    where: {
      userId: userId,
      ...(isOutbound
        ? { fromAccountId: accountId }
        : { toAccountId: accountId }),
      type: {
        in: isOutbound ? OUTBOUND_TYPES : INBOUND_TYPES,
      },
      status: {
        in: ['PENDING', 'PROCESSING', 'COMPLETED'],
      },
      createdAt: {
        gte: today,
      },
    },
    _sum: {
      amount: true,
    },
  })

  const totalToday = todaysTransfers._sum.amount ?? new Decimal(0)
  const newTotal = totalToday.add(amount)

  if (newTotal.gt(DAILY_TRANSFER_LIMIT)) {
    const remainingLimit = DAILY_TRANSFER_LIMIT.sub(totalToday)
    const direction = isOutbound ? 'outgoing' : 'incoming'
    return {
      allowed: false,
      error: `Daily ${direction} transfer limit exceeded. You have $${remainingLimit.toFixed(2)} remaining today.`,
    }
  }

  return { allowed: true }
}

/**
 * Validate a P2P transfer before execution.
 *
 * The balance check here exists to produce a useful error message, not to make
 * the transfer safe. It reads outside the transaction and is therefore stale by
 * the time it is used. The authoritative check is the guarded UPDATE inside
 * postDoubleEntry.
 */
export async function validateTransfer(
  senderId: string,
  recipientIdentifier: string,
  amount: Decimal
): Promise<TransferValidation> {
  // Validate amount
  if (amount.lte(0)) {
    return {
      isValid: false,
      error: 'Transfer amount must be greater than zero',
    }
  }

  // Check sender KYC status
  try {
    await requireKYC(senderId)
  } catch {
    return {
      isValid: false,
      error: 'KYC verification required to send transfers',
    }
  }

  // Get sender's account
  const senderAccount = await prisma.account.findFirst({
    where: {
      userId: senderId,
      status: 'ACTIVE',
      accountType: {
        in: ['CHECKING', 'SAVINGS'],
      },
    },
  })

  if (!senderAccount) {
    return {
      isValid: false,
      error: 'No active account found for sender',
    }
  }

  // Find recipient
  const recipient = await findRecipient(recipientIdentifier)
  if (!recipient) {
    return {
      isValid: false,
      error: 'Recipient not found',
    }
  }

  // Prevent self-transfer
  if (senderId === recipient.id) {
    return {
      isValid: false,
      error: 'Cannot transfer to yourself',
    }
  }

  // Check recipient KYC status
  try {
    await requireKYC(recipient.id)
  } catch {
    return {
      isValid: false,
      error: 'Recipient must complete KYC verification',
    }
  }

  // Advisory balance check, for the error message only
  if (senderAccount.balance.lt(amount)) {
    return {
      isValid: false,
      error: `Insufficient funds. Available balance: $${senderAccount.balance.toFixed(2)}`,
    }
  }

  // Check transfer limits
  const limitCheck = await checkTransferLimits(
    senderId,
    senderAccount.id,
    amount,
    'OUTBOUND'
  )
  if (!limitCheck.allowed) {
    return {
      isValid: false,
      error: limitCheck.error,
    }
  }

  // Get recipient account
  const recipientAccount = await prisma.account.findUnique({
    where: { id: recipient.accountId },
  })

  if (!recipientAccount || recipientAccount.status !== 'ACTIVE') {
    return {
      isValid: false,
      error: 'Recipient account is not active',
    }
  }

  return {
    isValid: true,
    senderAccount,
    recipientAccount,
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}

function replayResult(existing: Transaction): TransferResult {
  return {
    success: existing.status !== 'FAILED' && existing.status !== 'CANCELLED',
    transactionId: existing.id,
    status: existing.status,
    replayed: true,
    error:
      existing.status === 'FAILED' || existing.status === 'CANCELLED'
        ? 'Transfer previously failed'
        : undefined,
  }
}

/**
 * Execute a P2P transfer with double-entry bookkeeping.
 *
 * `idempotencyKey` must be supplied by the caller and must be stable across
 * retries of the same logical request - generating one here would make every
 * retry a fresh transfer, which is the opposite of what idempotency means.
 */
export async function executeP2PTransfer(
  senderId: string,
  recipientIdentifier: string,
  amount: Decimal,
  idempotencyKey: string,
  description?: string
): Promise<TransferResult> {
  try {
    // Idempotent replay: a repeated key returns the original transaction rather
    // than moving money a second time.
    const existing = await prisma.transaction.findUnique({
      where: { idempotencyKey },
    })
    if (existing) {
      return replayResult(existing)
    }

    // Validate transfer
    const validation = await validateTransfer(
      senderId,
      recipientIdentifier,
      amount
    )

    if (!validation.isValid) {
      return {
        success: false,
        status: 'FAILED',
        error: validation.error,
      }
    }

    const senderAccount = validation.senderAccount!
    const recipientAccount = validation.recipientAccount!

    // Transfers at or above the review threshold are held. They post no ledger
    // entries until an admin approves them, so the money stays in the sender's
    // balance and remains spendable until then.
    const requiresReview = amount.gte(PENDING_REVIEW_THRESHOLD)
    const transferStatus: 'PENDING' | 'COMPLETED' = requiresReview
      ? 'PENDING'
      : 'COMPLETED'

    // Execute transfer in atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId: senderId,
          fromAccountId: senderAccount.id,
          toAccountId: recipientAccount.id,
          amount,
          currency: 'USD',
          type: 'P2P_TRANSFER',
          status: transferStatus,
          description: description || 'P2P Transfer',
          idempotencyKey,
          metadata: {
            recipientUserId: recipientAccount.userId,
            requiresReview,
          },
        },
      })

      if (transferStatus === 'COMPLETED') {
        await postDoubleEntry(tx, {
          transactionId: transaction.id,
          debitAccountId: senderAccount.id,
          creditAccountId: recipientAccount.id,
          amount,
          debitDescription: description || 'P2P Transfer - Sent',
          creditDescription: description || 'P2P Transfer - Received',
        })
      }

      return {
        transactionId: transaction.id,
        status: transferStatus,
      }
    })

    return {
      success: true,
      transactionId: result.transactionId,
      status: result.status,
    }
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return {
        success: false,
        status: 'FAILED',
        error: 'Insufficient funds',
      }
    }

    // Two concurrent requests with the same idempotency key: the loser reads
    // back the winner's transaction instead of failing.
    if (isUniqueViolation(error)) {
      const existing = await prisma.transaction.findUnique({
        where: { idempotencyKey },
      })
      if (existing) {
        return replayResult(existing)
      }
    }

    console.error('P2P transfer error:', error)
    return {
      success: false,
      status: 'FAILED',
      error: 'Transfer failed',
    }
  }
}

/**
 * Get recent recipients for a user (for quick transfer)
 */
export async function getRecentRecipients(
  userId: string,
  limit: number = 5
): Promise<PublicRecipient[]> {
  const recentTransactions = await prisma.transaction.findMany({
    where: {
      userId: userId,
      type: 'P2P_TRANSFER',
      fromAccountId: { not: null },
      toAccountId: { not: null },
      status: 'COMPLETED',
    },
    include: {
      toAccount: {
        include: {
          user: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    distinct: ['toAccountId'],
  })

  const recipients: PublicRecipient[] = []
  const seenUserIds = new Set<string>()

  for (const tx of recentTransactions) {
    if (tx.toAccount && tx.toAccount.user) {
      const user = tx.toAccount.user
      if (!seenUserIds.has(user.id)) {
        seenUserIds.add(user.id)
        recipients.push(
          toPublicRecipient(
            {
              id: user.id,
              email: user.email,
              firstName: user.firstName || 'Unknown',
              lastName: user.lastName || 'User',
              accountId: tx.toAccount.id,
              accountNumber: tx.toAccount.accountNumber,
              accountStatus: tx.toAccount.status,
            },
            user.email
          )
        )
      }
    }
  }

  return recipients
}

// ============================================
// PENDING TRANSFER REVIEW
// ============================================

export interface ReviewResult {
  success: boolean
  status?: 'COMPLETED' | 'CANCELLED'
  error?: string
}

/**
 * Approve a held transfer and post it to the ledger.
 *
 * The balance guard runs now, not at submission time, so a transfer approved
 * after the sender has spent the money correctly fails instead of overdrawing.
 */
export async function approvePendingTransfer(
  transactionId: string,
  reviewerUserId: string,
  note?: string
): Promise<ReviewResult> {
  try {
    await prisma.$transaction(async (tx) => {
      // Claim the row: only a still-PENDING transaction can be approved, so two
      // admins clicking approve at the same time post the transfer once.
      const claimed = await tx.transaction.updateMany({
        where: { id: transactionId, status: 'PENDING' },
        data: {
          status: 'COMPLETED',
          reviewedByUserId: reviewerUserId,
          reviewedAt: new Date(),
          reviewNote: note,
        },
      })

      if (claimed.count === 0) {
        throw new Error('Transfer is not awaiting review')
      }

      const transaction = await tx.transaction.findUniqueOrThrow({
        where: { id: transactionId },
      })

      if (!transaction.fromAccountId || !transaction.toAccountId) {
        throw new Error('Transfer is missing an account side')
      }

      await postDoubleEntry(tx, {
        transactionId: transaction.id,
        debitAccountId: transaction.fromAccountId,
        creditAccountId: transaction.toAccountId,
        amount: transaction.amount,
        debitDescription: transaction.description || 'P2P Transfer - Sent',
        creditDescription: transaction.description || 'P2P Transfer - Received',
      })
    })

    return { success: true, status: 'COMPLETED' }
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return {
        success: false,
        error: 'Sender no longer has sufficient funds for this transfer',
      }
    }
    console.error('Transfer approval error:', error)
    return {
      success: false,
      error:
        error instanceof Error && error.message === 'Transfer is not awaiting review'
          ? error.message
          : 'Failed to approve transfer',
    }
  }
}

/** Reject a held transfer. No ledger entries were ever posted, so nothing unwinds. */
export async function rejectPendingTransfer(
  transactionId: string,
  reviewerUserId: string,
  note?: string
): Promise<ReviewResult> {
  const rejected = await prisma.transaction.updateMany({
    where: { id: transactionId, status: 'PENDING' },
    data: {
      status: 'CANCELLED',
      reviewedByUserId: reviewerUserId,
      reviewedAt: new Date(),
      reviewNote: note,
    },
  })

  if (rejected.count === 0) {
    return { success: false, error: 'Transfer is not awaiting review' }
  }

  return { success: true, status: 'CANCELLED' }
}

// ============================================
// ACH TRANSFER FUNCTIONS
// ============================================

export interface ACHTransferResult {
  success: boolean
  achTransferId?: string
  transactionId?: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  error?: string
  replayed?: boolean
}

/**
 * Validate an ACH transfer request
 */
export async function validateACHTransfer(
  userId: string,
  externalAccountId: string,
  amount: Decimal,
  direction: 'DEPOSIT' | 'WITHDRAWAL'
): Promise<{
  isValid: boolean
  error?: string
  externalAccount?: Prisma.ExternalAccountGetPayload<object>
  internalAccount?: Account
}> {
  // Validate amount
  if (amount.lte(0)) {
    return { isValid: false, error: 'Transfer amount must be greater than zero' }
  }

  // Check KYC status
  try {
    await requireKYC(userId)
  } catch {
    return { isValid: false, error: 'KYC verification required for ACH transfers' }
  }

  // Get external account
  const externalAccount = await prisma.externalAccount.findUnique({
    where: { id: externalAccountId },
  })

  if (!externalAccount || externalAccount.userId !== userId) {
    return { isValid: false, error: 'External account not found or unauthorized' }
  }

  if (externalAccount.verificationStatus !== 'VERIFIED') {
    return { isValid: false, error: 'External account must be verified before transfers' }
  }

  // Get user's internal account
  const internalAccount = await prisma.account.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      accountType: 'CHECKING',
    },
  })

  if (!internalAccount) {
    return { isValid: false, error: 'No active internal account found' }
  }

  // Advisory balance check for withdrawals, for the error message only
  if (direction === 'WITHDRAWAL' && internalAccount.balance.lt(amount)) {
    return {
      isValid: false,
      error: `Insufficient funds. Available balance: $${internalAccount.balance.toFixed(2)}`,
    }
  }

  // Check transfer limits. ACH used to bypass the daily cap entirely because
  // the aggregate filtered on type: 'P2P_TRANSFER'.
  const limitCheck = await checkTransferLimits(
    userId,
    internalAccount.id,
    amount,
    direction === 'WITHDRAWAL' ? 'OUTBOUND' : 'INBOUND'
  )
  if (!limitCheck.allowed) {
    return { isValid: false, error: limitCheck.error }
  }

  return { isValid: true, externalAccount, internalAccount }
}

/**
 * Execute an ACH transfer (deposit or withdrawal).
 *
 * `idempotencyKey` is supplied by the caller and is also the key handed to
 * Plaid, so a retry does not create a second ACH transfer at the provider.
 */
export async function executeACHTransfer(
  userId: string,
  externalAccountId: string,
  amount: Decimal,
  direction: 'DEPOSIT' | 'WITHDRAWAL',
  idempotencyKey: string,
  description?: string
): Promise<ACHTransferResult> {
  try {
    const existing = await prisma.transaction.findUnique({
      where: { idempotencyKey },
      include: { achTransfer: true },
    })
    if (existing) {
      return {
        success: existing.status !== 'FAILED' && existing.status !== 'CANCELLED',
        achTransferId: existing.achTransfer?.id,
        transactionId: existing.id,
        status:
          existing.status === 'CANCELLED'
            ? 'FAILED'
            : (existing.status as ACHTransferResult['status']),
        replayed: true,
      }
    }

    // Validate transfer
    const validation = await validateACHTransfer(
      userId,
      externalAccountId,
      amount,
      direction
    )

    if (!validation.isValid) {
      return {
        success: false,
        status: 'FAILED',
        error: validation.error,
      }
    }

    const externalAccount = validation.externalAccount!
    const internalAccount = validation.internalAccount!

    // Determine transaction type
    const transactionType = direction === 'DEPOSIT' ? 'ACH_CREDIT' : 'ACH_DEBIT'

    // Check if we're in sandbox/development mode
    const isSandbox = process.env.PLAID_ENV !== 'production'
    let plaidTransferId: string
    const transferStatus = 'PROCESSING' as const

    if (isSandbox) {
      // Plaid's Transfer product requires separate approval, so sandbox runs
      // simulate the rail. The ledger side below is real either way.
      console.log('Simulating ACH transfer in sandbox mode')
      plaidTransferId = `sandbox_transfer_${uuidv4()}`
    } else {
      // Production: Use actual Plaid Transfer API
      try {
        const plaidType = direction === 'DEPOSIT' ? 'credit' : 'debit'
        // Plaid scores the authorization partly on whether legal_name matches
        // the name on the external account, so send the real one.
        const holder = await prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true },
        })
        const legalName = [holder?.firstName, holder?.lastName]
          .filter(Boolean)
          .join(' ')

        const authorization = await authorizeACHTransfer(
          externalAccount.plaidAccessToken,
          externalAccount.plaidAccountId,
          amount.toNumber(),
          plaidType,
          legalName || undefined
        )

        if (authorization.decision !== 'approved') {
          return {
            success: false,
            status: 'FAILED',
            error: `ACH transfer not approved: ${authorization.decisionRationale?.description || 'Unknown reason'}`,
          }
        }

        const plaidTransfer = await createACHTransfer(
          externalAccount.plaidAccessToken,
          externalAccount.plaidAccountId,
          authorization.authorizationId,
          description || `${direction} - ${amount.toFixed(2)}`,
          idempotencyKey
        )

        plaidTransferId = plaidTransfer.transferId
      } catch (error) {
        console.error('Plaid Transfer API error:', error)
        return {
          success: false,
          status: 'FAILED',
          error: 'Plaid Transfer API error. Please contact support.',
        }
      }
    }

    // Create database records in one transaction
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          fromAccountId: direction === 'WITHDRAWAL' ? internalAccount.id : null,
          toAccountId: direction === 'DEPOSIT' ? internalAccount.id : null,
          amount,
          currency: 'USD',
          type: transactionType,
          status: transferStatus,
          description: description || `${direction} from ${externalAccount.institutionName}`,
          idempotencyKey,
          externalId: plaidTransferId,
          metadata: {
            direction,
            externalAccountId,
            plaidTransferId: plaidTransferId,
            institutionName: externalAccount.institutionName,
            sandbox: isSandbox,
          },
        },
      })

      const achTransfer = await tx.aCHTransfer.create({
        data: {
          userId,
          externalAccountId,
          internalAccountId: internalAccount.id,
          transactionId: transaction.id,
          direction,
          amount,
          currency: 'USD',
          status: transferStatus,
          plaidTransferId: plaidTransferId,
          metadata: {
            sandbox: isSandbox,
          },
        },
      })

      // In sandbox mode there is no rail to wait on, so settle immediately.
      if (isSandbox) {
        await settleACHTransfer(tx, {
          transactionId: transaction.id,
          internalAccountId: internalAccount.id,
          direction,
          amount,
          sandbox: true,
        })

        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: 'COMPLETED' },
        })

        await tx.aCHTransfer.update({
          where: { id: achTransfer.id },
          data: { status: 'COMPLETED' },
        })
      }

      return {
        achTransferId: achTransfer.id,
        transactionId: transaction.id,
        status: isSandbox ? ('COMPLETED' as const) : ('PROCESSING' as const),
      }
    })

    return {
      success: true,
      achTransferId: result.achTransferId,
      transactionId: result.transactionId,
      status: result.status,
    }
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      return {
        success: false,
        status: 'FAILED',
        error: 'Insufficient funds',
      }
    }

    if (isUniqueViolation(error)) {
      const existing = await prisma.transaction.findUnique({
        where: { idempotencyKey },
        include: { achTransfer: true },
      })
      if (existing) {
        return {
          success: true,
          achTransferId: existing.achTransfer?.id,
          transactionId: existing.id,
          status: existing.status as ACHTransferResult['status'],
          replayed: true,
        }
      }
    }

    console.error('ACH transfer error:', error)
    return {
      success: false,
      status: 'FAILED',
      error: 'ACH transfer failed',
    }
  }
}

/**
 * Post the balanced pair for an ACH settlement.
 *
 * Money genuinely enters or leaves the system over ACH, so the counterparty is
 * the ACH settlement house account. Without it a deposit would credit a
 * customer with no matching debit anywhere and the ledger would stop summing
 * to zero, which is what the schema's "double-entry" heading claimed but the
 * ACH path did not actually do.
 */
async function settleACHTransfer(
  tx: Prisma.TransactionClient,
  params: {
    transactionId: string
    internalAccountId: string
    direction: 'DEPOSIT' | 'WITHDRAWAL'
    amount: Decimal
    sandbox?: boolean
  }
) {
  const settlement = await getSystemAccount(tx, 'ACH_SETTLEMENT')
  const suffix = params.sandbox ? ' (Sandbox)' : ''

  if (params.direction === 'DEPOSIT') {
    await postDoubleEntry(tx, {
      transactionId: params.transactionId,
      debitAccountId: settlement.id,
      creditAccountId: params.internalAccountId,
      amount: params.amount,
      debitDescription: `ACH Deposit - settlement${suffix}`,
      creditDescription: `ACH Deposit${suffix}`,
    })
  } else {
    await postDoubleEntry(tx, {
      transactionId: params.transactionId,
      debitAccountId: params.internalAccountId,
      creditAccountId: settlement.id,
      amount: params.amount,
      debitDescription: `ACH Withdrawal${suffix}`,
      creditDescription: `ACH Withdrawal - settlement${suffix}`,
    })
  }
}

/**
 * Update ACH transfer status based on a Plaid webhook.
 *
 * Called from the webhook handler after signature verification and event
 * deduplication.
 */
export async function updateACHTransferStatus(
  plaidTransferId: string,
  newStatus: string,
  failureReason?: string
) {
  try {
    const achTransfer = await prisma.aCHTransfer.findUnique({
      where: { plaidTransferId },
      include: {
        internalAccount: true,
        transaction: true,
      },
    })

    if (!achTransfer) {
      console.error('ACH transfer not found:', plaidTransferId)
      return
    }

    // Map Plaid status to our status
    let status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'RETURNED'
    let transactionStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

    switch (newStatus) {
      case 'posted':
      case 'settled':
        status = 'COMPLETED'
        transactionStatus = 'COMPLETED'
        break
      case 'failed':
      case 'cancelled':
        status = 'FAILED'
        transactionStatus = 'FAILED'
        break
      case 'returned':
        status = 'RETURNED'
        transactionStatus = 'FAILED'
        break
      default:
        status = 'PROCESSING'
        transactionStatus = 'PROCESSING'
    }

    if (!achTransfer.transactionId) {
      console.error('ACH transfer has no linked transaction:', plaidTransferId)
      return
    }

    const transactionId = achTransfer.transactionId

    await prisma.$transaction(async (tx) => {
      // Claim the transition. Settlement only posts on the edge into COMPLETED,
      // so a redelivered "posted" webhook cannot credit the account twice.
      const claimed = await tx.aCHTransfer.updateMany({
        where: {
          id: achTransfer.id,
          status: { notIn: ['COMPLETED', 'FAILED', 'RETURNED'] },
        },
        data: {
          status,
          failureReason,
        },
      })

      if (claimed.count === 0) {
        console.log(
          `ACH transfer ${plaidTransferId} already in a terminal state, ignoring ${newStatus}`
        )
        return
      }

      await tx.transaction.update({
        where: { id: transactionId },
        data: { status: transactionStatus },
      })

      if (status === 'COMPLETED') {
        await settleACHTransfer(tx, {
          transactionId,
          internalAccountId: achTransfer.internalAccountId,
          direction: achTransfer.direction,
          amount: achTransfer.amount,
        })
      }
    })

    console.log(`ACH transfer ${plaidTransferId} updated to ${status}`)
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      // A withdrawal that settles after the balance is gone. Mark it returned
      // rather than silently overdrawing the customer.
      console.error(
        `ACH transfer ${plaidTransferId} could not settle: insufficient funds`
      )
      await prisma.aCHTransfer.update({
        where: { plaidTransferId },
        data: { status: 'RETURNED', failureReason: 'Insufficient funds at settlement' },
      })
      return
    }
    console.error('Error updating ACH transfer status:', error)
    throw error
  }
}
