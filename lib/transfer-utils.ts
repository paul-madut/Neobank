import { prisma } from './prisma'
import { requireKYC } from './kyc-utils'
import { v4 as uuidv4 } from 'uuid'
import { Decimal } from '@prisma/client/runtime/library'

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
