import { prisma } from './prisma'
import { requireKYC } from './kyc-utils'
import { v4 as uuidv4 } from 'uuid'
import { Decimal } from '@prisma/client/runtime/library'
import {
  authorizeACHTransfer,
  createACHTransfer,
  getACHTransferStatus,
} from './plaid-utils'

// Transfer limits from environment variables
const MAX_TRANSFER_AMOUNT = parseFloat(
  process.env.MAX_TRANSFER_AMOUNT || '10000'
)
const DAILY_TRANSFER_LIMIT = parseFloat(
  process.env.DAILY_TRANSFER_LIMIT || '25000'
)
const PENDING_REVIEW_THRESHOLD = parseFloat(
  process.env.PENDING_REVIEW_THRESHOLD || '5000'
)

export interface RecipientInfo {
  id: string
  email: string
  firstName: string
  lastName: string
  accountId: string
  accountNumber: string
  accountStatus: string
}

export interface TransferValidation {
  isValid: boolean
  error?: string
  senderAccount?: any
  recipientAccount?: any
}

export interface TransferResult {
  success: boolean
  transactionId?: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  error?: string
}

/**
 * Find a recipient by email or account number
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
 * Check if user has exceeded daily transfer limits
 */
export async function checkTransferLimits(
  userId: string,
  accountId: string,
  amount: number
): Promise<{ allowed: boolean; error?: string }> {
  // Check per-transaction limit
  if (amount > MAX_TRANSFER_AMOUNT) {
    return {
      allowed: false,
      error: `Transfer amount exceeds maximum limit of $${MAX_TRANSFER_AMOUNT.toLocaleString()}`,
    }
  }

  // Get today's transfers
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todaysTransfers = await prisma.transaction.aggregate({
    where: {
      userId: userId,
      fromAccountId: accountId,
      type: 'P2P_TRANSFER',
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

  const totalTransferredToday = parseFloat(
    todaysTransfers._sum.amount?.toString() || '0'
  )
  const newTotal = totalTransferredToday + amount

  if (newTotal > DAILY_TRANSFER_LIMIT) {
    const remainingLimit = DAILY_TRANSFER_LIMIT - totalTransferredToday
    return {
      allowed: false,
      error: `Daily transfer limit exceeded. You have $${remainingLimit.toFixed(2)} remaining today.`,
    }
  }

  return { allowed: true }
}

/**
 * Validate a P2P transfer before execution
 */
export async function validateTransfer(
  senderId: string,
  recipientIdentifier: string,
  amount: number
): Promise<TransferValidation> {
  // Validate amount
  if (amount <= 0) {
    return {
      isValid: false,
      error: 'Transfer amount must be greater than zero',
    }
  }

  // Check sender KYC status
  try {
    await requireKYC(senderId)
  } catch (error) {
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

  // Check recipient KYC status
  try {
    await requireKYC(recipient.id)
  } catch (error) {
    return {
      isValid: false,
      error: 'Recipient must complete KYC verification',
    }
  }

  // Prevent self-transfer
  if (senderId === recipient.id) {
    return {
      isValid: false,
      error: 'Cannot transfer to yourself',
    }
  }

  // Check sender balance
  const senderBalance = parseFloat(senderAccount.balance.toString())
  if (senderBalance < amount) {
    return {
      isValid: false,
      error: `Insufficient funds. Available balance: $${senderBalance.toFixed(2)}`,
    }
  }

  // Check transfer limits
  const limitCheck = await checkTransferLimits(
    senderId,
    senderAccount.id,
    amount
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

/**
 * Execute a P2P transfer with double-entry bookkeeping
 */
export async function executeP2PTransfer(
  senderId: string,
  recipientIdentifier: string,
  amount: number,
  description?: string
): Promise<TransferResult> {
  try {
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

    const { senderAccount, recipientAccount } = validation

    // Determine if transfer needs pending review
    const requiresReview = amount >= PENDING_REVIEW_THRESHOLD
    const transferStatus: 'PENDING' | 'COMPLETED' = requiresReview
      ? 'PENDING'
      : 'COMPLETED'

    // Generate idempotency key
    const idempotencyKey = uuidv4()

    // Execute transfer in atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      const senderBalance = parseFloat(senderAccount.balance.toString())
      const recipientBalance = parseFloat(recipientAccount.balance.toString())

      const newSenderBalance = senderBalance - amount
      const newRecipientBalance = recipientBalance + amount

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId: senderId,
          fromAccountId: senderAccount.id,
          toAccountId: recipientAccount.id,
          amount: new Decimal(amount),
          currency: 'USD',
          type: 'P2P_TRANSFER',
          status: transferStatus,
          description: description || 'P2P Transfer',
          idempotencyKey,
          metadata: {
            recipientEmail: recipientAccount.userId,
            requiresReview,
          },
        },
      })

      // Only update balances and create ledger entries if not pending review
      if (transferStatus === 'COMPLETED') {
        // Create DEBIT ledger entry for sender
        await tx.ledgerEntry.create({
          data: {
            accountId: senderAccount.id,
            transactionId: transaction.id,
            entryType: 'DEBIT',
            amount: new Decimal(amount),
            balanceAfter: new Decimal(newSenderBalance),
            description: description || 'P2P Transfer - Sent',
          },
        })

        // Create CREDIT ledger entry for recipient
        await tx.ledgerEntry.create({
          data: {
            accountId: recipientAccount.id,
            transactionId: transaction.id,
            entryType: 'CREDIT',
            amount: new Decimal(amount),
            balanceAfter: new Decimal(newRecipientBalance),
            description: description || 'P2P Transfer - Received',
          },
        })

        // Update sender balance
        await tx.account.update({
          where: { id: senderAccount.id },
          data: { balance: new Decimal(newSenderBalance) },
        })

        // Update recipient balance
        await tx.account.update({
          where: { id: recipientAccount.id },
          data: { balance: new Decimal(newRecipientBalance) },
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
    console.error('P2P transfer error:', error)
    return {
      success: false,
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Transfer failed',
    }
  }
}

/**
 * Get recent recipients for a user (for quick transfer)
 */
export async function getRecentRecipients(
  userId: string,
  limit: number = 5
): Promise<RecipientInfo[]> {
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

  const recipients: RecipientInfo[] = []
  const seenUserIds = new Set<string>()

  for (const tx of recentTransactions) {
    if (tx.toAccount && tx.toAccount.user) {
      const user = tx.toAccount.user
      if (!seenUserIds.has(user.id)) {
        seenUserIds.add(user.id)
        recipients.push({
          id: user.id,
          email: user.email,
          firstName: user.firstName || 'Unknown',
          lastName: user.lastName || 'User',
          accountId: tx.toAccount.id,
          accountNumber: tx.toAccount.accountNumber,
          accountStatus: tx.toAccount.status,
        })
      }
    }
  }

  return recipients
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
}

/**
 * Validate an ACH transfer request
 */
export async function validateACHTransfer(
  userId: string,
  externalAccountId: string,
  amount: number,
  direction: 'DEPOSIT' | 'WITHDRAWAL'
): Promise<{ isValid: boolean; error?: string; externalAccount?: any; internalAccount?: any }> {
  // Validate amount
  if (amount <= 0) {
    return { isValid: false, error: 'Transfer amount must be greater than zero' }
  }

  // Check KYC status
  try {
    await requireKYC(userId)
  } catch (error) {
    return { isValid: false, error: 'KYC verification required for ACH transfers' }
  }

  // Get external account
  const externalAccount = await prisma.externalAccount.findUnique({
    where: { id: externalAccountId },
    include: { user: true },
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

  // For withdrawals, check internal account balance
  if (direction === 'WITHDRAWAL') {
    const balance = parseFloat(internalAccount.balance.toString())
    if (balance < amount) {
      return {
        isValid: false,
        error: `Insufficient funds. Available balance: $${balance.toFixed(2)}`,
      }
    }
  }

  // Check transfer limits
  const limitCheck = await checkTransferLimits(userId, internalAccount.id, amount)
  if (!limitCheck.allowed) {
    return { isValid: false, error: limitCheck.error }
  }

  return { isValid: true, externalAccount, internalAccount }
}

/**
 * Execute an ACH transfer (deposit or withdrawal)
 */
export async function executeACHTransfer(
  userId: string,
  externalAccountId: string,
  amount: number,
  direction: 'DEPOSIT' | 'WITHDRAWAL',
  description?: string
): Promise<ACHTransferResult> {
  try {
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

    const { externalAccount, internalAccount } = validation

    // Generate idempotency key
    const idempotencyKey = uuidv4()

    // Determine transaction type
    const transactionType = direction === 'DEPOSIT' ? 'ACH_CREDIT' : 'ACH_DEBIT'

    // Check if we're in sandbox/development mode
    const isSandbox = process.env.PLAID_ENV !== 'production'
    let plaidTransferId: string
    let transferStatus: 'PENDING' | 'PROCESSING' = 'PROCESSING'

    if (isSandbox) {
      // Simulate Plaid transfer in sandbox mode
      // Plaid Transfer API requires special access, so we simulate it in sandbox
      console.log('Simulating ACH transfer in sandbox mode')
      plaidTransferId = `sandbox_transfer_${uuidv4()}`
      transferStatus = 'PROCESSING'
    } else {
      // Production: Use actual Plaid Transfer API
      try {
        const plaidType = direction === 'DEPOSIT' ? 'credit' : 'debit'
        const authorization = await authorizeACHTransfer(
          externalAccount.plaidAccessToken,
          externalAccount.plaidAccountId,
          amount,
          plaidType
        )

        if (authorization.decision !== 'approved') {
          return {
            success: false,
            status: 'FAILED',
            error: `ACH transfer not approved: ${authorization.decisionRationale?.description || 'Unknown reason'}`,
          }
        }

        const plaidTransfer = await createACHTransfer(
          authorization.authorizationId,
          description || `${direction} - ${amount}`,
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

    // Step 3: Create database records in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create internal transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId,
          fromAccountId: direction === 'WITHDRAWAL' ? internalAccount.id : null,
          toAccountId: direction === 'DEPOSIT' ? internalAccount.id : null,
          amount: new Decimal(amount),
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

      // Create ACHTransfer record
      const achTransfer = await tx.aCHTransfer.create({
        data: {
          userId,
          externalAccountId,
          internalAccountId: internalAccount.id,
          transactionId: transaction.id,
          direction,
          amount: new Decimal(amount),
          currency: 'USD',
          status: transferStatus,
          plaidTransferId: plaidTransferId,
          metadata: {
            sandbox: isSandbox,
          },
        },
      })

      // In sandbox mode, immediately complete the transfer (simulate instant ACH)
      if (isSandbox) {
        const currentBalance = parseFloat(internalAccount.balance.toString())
        let newBalance: number
        let entryType: 'DEBIT' | 'CREDIT'
        let ledgerDescription: string

        if (direction === 'DEPOSIT') {
          newBalance = currentBalance + amount
          entryType = 'CREDIT'
          ledgerDescription = 'ACH Deposit (Sandbox)'
        } else {
          newBalance = currentBalance - amount
          entryType = 'DEBIT'
          ledgerDescription = 'ACH Withdrawal (Sandbox)'
        }

        // Create ledger entry
        await tx.ledgerEntry.create({
          data: {
            accountId: internalAccount.id,
            transactionId: transaction.id,
            entryType,
            amount: new Decimal(amount),
            balanceAfter: new Decimal(newBalance),
            description: ledgerDescription,
          },
        })

        // Update account balance
        await tx.account.update({
          where: { id: internalAccount.id },
          data: { balance: new Decimal(newBalance) },
        })

        // Update transaction and ACH transfer to COMPLETED
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
    console.error('ACH transfer error:', error)
    return {
      success: false,
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'ACH transfer failed',
    }
  }
}

/**
 * Update ACH transfer status based on Plaid webhook
 * This will be called from the webhook handler
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

    // Update in transaction
    await prisma.$transaction(async (tx) => {
      // Update ACH transfer
      await tx.aCHTransfer.update({
        where: { id: achTransfer.id },
        data: {
          status,
          failureReason,
        },
      })

      // Update transaction
      await tx.transaction.update({
        where: { id: achTransfer.transactionId! },
        data: { status: transactionStatus },
      })

      // If completed, update balances and create ledger entries
      if (status === 'COMPLETED' && achTransfer.transaction) {
        const amount = parseFloat(achTransfer.amount.toString())
        const currentBalance = parseFloat(achTransfer.internalAccount.balance.toString())

        let newBalance: number
        let entryType: 'DEBIT' | 'CREDIT'
        let description: string

        if (achTransfer.direction === 'DEPOSIT') {
          newBalance = currentBalance + amount
          entryType = 'CREDIT'
          description = 'ACH Deposit'
        } else {
          newBalance = currentBalance - amount
          entryType = 'DEBIT'
          description = 'ACH Withdrawal'
        }

        // Create ledger entry
        await tx.ledgerEntry.create({
          data: {
            accountId: achTransfer.internalAccountId,
            transactionId: achTransfer.transactionId!,
            entryType,
            amount: new Decimal(amount),
            balanceAfter: new Decimal(newBalance),
            description,
          },
        })

        // Update account balance
        await tx.account.update({
          where: { id: achTransfer.internalAccountId },
          data: { balance: new Decimal(newBalance) },
        })
      }
    })

    console.log(`ACH transfer ${plaidTransferId} updated to ${status}`)
  } catch (error) {
    console.error('Error updating ACH transfer status:', error)
    throw error
  }
}
