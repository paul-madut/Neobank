import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import type { SystemAccountType } from '@prisma/client'

/**
 * Double-entry ledger primitives.
 *
 * Two rules are enforced here rather than at every call site, because every
 * place that moves money has to obey both of them and it only takes one
 * forgetful caller to corrupt the books:
 *
 *   1. Money is never created or destroyed. Every posting debits one account
 *      and credits another for the same amount, so the sum of all account
 *      balances is invariant (and starts at zero).
 *   2. A customer account can never be overdrawn. The balance check is part of
 *      the UPDATE predicate, not a separate read, so two concurrent transfers
 *      cannot both observe the same balance and both succeed.
 *
 * Note on (2): Postgres runs at READ COMMITTED by default. Reading a balance
 * and later writing an absolute value is a lost-update bug - both writers read
 * 100, both write 50, and 100 has been spent twice. `UPDATE ... WHERE id = $1
 * AND balance >= $2` avoids this because Postgres re-evaluates the predicate
 * after acquiring the row lock, so the second writer sees the first writer's
 * committed balance and matches zero rows.
 */

export class InsufficientFundsError extends Error {
  readonly code = 'INSUFFICIENT_FUNDS'

  constructor(message = 'Insufficient funds') {
    super(message)
    this.name = 'InsufficientFundsError'
  }
}

export class AccountNotFoundError extends Error {
  readonly code = 'ACCOUNT_NOT_FOUND'

  constructor(message = 'Account not found') {
    super(message)
    this.name = 'AccountNotFoundError'
  }
}

/** Prisma transaction client, as handed to the callback of prisma.$transaction. */
export type TxClient = Prisma.TransactionClient

export interface PostingParams {
  transactionId: string
  /** Account money leaves. Must have sufficient balance unless it is a system account. */
  debitAccountId: string
  /** Account money arrives in. */
  creditAccountId: string
  amount: Decimal
  debitDescription: string
  creditDescription: string
}

export interface PostingResult {
  debitBalanceAfter: Decimal
  creditBalanceAfter: Decimal
}

function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  )
}

/**
 * Post a balanced pair of ledger entries and move the balances to match.
 *
 * Must be called inside prisma.$transaction so the two sides commit together.
 * Throws InsufficientFundsError if the debited customer account cannot cover
 * the amount. System accounts are allowed to go negative: a house settlement
 * account holding a claim against an external rail is a liability, and forcing
 * it non-negative would just push the imbalance somewhere less visible.
 */
export async function postDoubleEntry(
  tx: TxClient,
  params: PostingParams
): Promise<PostingResult> {
  const {
    transactionId,
    debitAccountId,
    creditAccountId,
    amount,
    debitDescription,
    creditDescription,
  } = params

  if (amount.lte(0)) {
    throw new Error('Ledger postings must be for a positive amount')
  }

  if (debitAccountId === creditAccountId) {
    throw new Error('Ledger postings must debit and credit different accounts')
  }

  const debitAccount = await tx.account.findUnique({
    where: { id: debitAccountId },
    select: { id: true, systemType: true },
  })

  if (!debitAccount) {
    throw new AccountNotFoundError(`Debit account ${debitAccountId} not found`)
  }

  const mayGoNegative = debitAccount.systemType !== null

  let debited
  try {
    debited = await tx.account.update({
      // The balance guard lives in the WHERE clause on purpose. See note above.
      where: mayGoNegative
        ? { id: debitAccountId }
        : { id: debitAccountId, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
      select: { balance: true },
    })
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new InsufficientFundsError()
    }
    throw error
  }

  let credited
  try {
    credited = await tx.account.update({
      where: { id: creditAccountId },
      data: { balance: { increment: amount } },
      select: { balance: true },
    })
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new AccountNotFoundError(
        `Credit account ${creditAccountId} not found`
      )
    }
    throw error
  }

  await tx.ledgerEntry.createMany({
    data: [
      {
        accountId: debitAccountId,
        transactionId,
        entryType: 'DEBIT',
        amount,
        balanceAfter: debited.balance,
        description: debitDescription,
      },
      {
        accountId: creditAccountId,
        transactionId,
        entryType: 'CREDIT',
        amount,
        balanceAfter: credited.balance,
        description: creditDescription,
      },
    ],
  })

  return {
    debitBalanceAfter: debited.balance,
    creditBalanceAfter: credited.balance,
  }
}

const SYSTEM_ACCOUNT_NUMBERS: Record<SystemAccountType, string> = {
  ACH_SETTLEMENT: 'SYS-ACH-SETTLEMENT',
  CARD_SETTLEMENT: 'SYS-CARD-SETTLEMENT',
}

const SYSTEM_ACCOUNT_DESCRIPTIONS: Record<SystemAccountType, string> = {
  ACH_SETTLEMENT: 'ACH settlement (house account)',
  CARD_SETTLEMENT: 'Card network settlement (house account)',
}

/**
 * Get the house account for an external rail, creating it on first use.
 *
 * These have no owner (Account.userId is null) because they are the neobank's
 * own books, not a customer's. They are the counterparty for every movement of
 * money in or out of the system, which is what lets the ledger sum to zero even
 * though funds genuinely originate outside it.
 */
export async function getSystemAccount(tx: TxClient, type: SystemAccountType) {
  return tx.account.upsert({
    where: { systemType: type },
    update: {},
    create: {
      systemType: type,
      accountType: 'SYSTEM',
      accountNumber: SYSTEM_ACCOUNT_NUMBERS[type],
      balance: new Decimal(0),
      currency: 'USD',
      status: 'ACTIVE',
    },
  })
}

export function describeSystemAccount(type: SystemAccountType): string {
  return SYSTEM_ACCOUNT_DESCRIPTIONS[type]
}
