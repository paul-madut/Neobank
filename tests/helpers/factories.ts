import { randomUUID } from 'crypto'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/prisma'

let accountSeq = 0

function nextAccountNumber() {
  accountSeq += 1
  return String(100000000 + accountSeq)
}

export async function createCustomer(options?: {
  email?: string
  balance?: string
  kycStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REQUIRES_REVIEW'
  isAdmin?: boolean
}) {
  const email = options?.email ?? `user-${randomUUID()}@example.test`

  const user = await prisma.user.create({
    data: {
      supabaseId: randomUUID(),
      email,
      firstName: 'Test',
      lastName: 'Customer',
      kycStatus: options?.kycStatus ?? 'VERIFIED',
      isAdmin: options?.isAdmin ?? false,
    },
  })

  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: 'CHECKING',
      accountNumber: nextAccountNumber(),
      balance: new Decimal(options?.balance ?? '0'),
    },
  })

  return { user, account }
}

export async function createVerifiedExternalAccount(userId: string) {
  return prisma.externalAccount.create({
    data: {
      userId,
      plaidAccountId: `plaid-acct-${randomUUID()}`,
      plaidItemId: `plaid-item-${randomUUID()}`,
      plaidAccessToken: 'access-sandbox-token',
      institutionId: 'ins_1',
      institutionName: 'Test Bank',
      mask: '4321',
      type: 'depository',
      subtype: 'checking',
      verificationStatus: 'VERIFIED',
    },
  })
}

export async function getBalance(accountId: string): Promise<Decimal> {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
  })
  return account.balance
}

/**
 * The ledger's central invariant: money is conserved.
 *
 * Sums every account balance including the system (house) accounts. Because
 * every posting debits one account and credits another for the same amount,
 * and every account starts at zero, the total must always be exactly zero.
 * A non-zero total means some flow created or destroyed money.
 */
export async function totalOfAllBalances(): Promise<Decimal> {
  const accounts = await prisma.account.findMany({ select: { balance: true } })
  return accounts.reduce((sum, a) => sum.add(a.balance), new Decimal(0))
}

/** Per-transaction check: debits and credits must match exactly. */
export async function ledgerIsBalancedFor(
  transactionId: string
): Promise<boolean> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { transactionId },
  })

  if (entries.length === 0) return true

  const debits = entries
    .filter((e) => e.entryType === 'DEBIT')
    .reduce((sum, e) => sum.add(e.amount), new Decimal(0))

  const credits = entries
    .filter((e) => e.entryType === 'CREDIT')
    .reduce((sum, e) => sum.add(e.amount), new Decimal(0))

  return debits.equals(credits) && debits.gt(0)
}

/** Fund a customer account from the ACH settlement house account. */
export async function fundAccount(accountId: string, amount: string) {
  const { getSystemAccount, postDoubleEntry } = await import('@/lib/ledger')
  const value = new Decimal(amount)

  await prisma.$transaction(async (tx) => {
    const settlement = await getSystemAccount(tx, 'ACH_SETTLEMENT')
    const account = await tx.account.findUniqueOrThrow({
      where: { id: accountId },
    })

    const transaction = await tx.transaction.create({
      data: {
        userId: account.userId!,
        toAccountId: accountId,
        amount: value,
        type: 'DEPOSIT',
        status: 'COMPLETED',
        idempotencyKey: `seed-${randomUUID()}`,
      },
    })

    await postDoubleEntry(tx, {
      transactionId: transaction.id,
      debitAccountId: settlement.id,
      creditAccountId: accountId,
      amount: value,
      debitDescription: 'Test funding - settlement',
      creditDescription: 'Test funding',
    })
  })
}
