import { describe, expect, it } from 'vitest'
import { randomUUID } from 'crypto'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/prisma'
import {
  cleanupExpiredDemoAccounts,
  createDemoCustomer,
  ensureDemoContacts,
  seedDemoDataFor,
} from '@/lib/demo'
import { executeP2PTransfer } from '@/lib/transfer-utils'
import { totalOfAllBalances } from './helpers/factories'

/**
 * Demo seeding writes money, so it is held to the same standard as the live
 * transfer paths. A seed script that quietly wrote single-sided entries would
 * be a counterexample sitting in the repo.
 */
describe('demo seeding', () => {
  it('produces a balanced ledger and a solvent account', async () => {
    const demo = await createDemoCustomer({
      supabaseId: randomUUID(),
      email: `demo-${randomUUID()}@demo.neobank.invalid`,
    })

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: demo.accountId },
    })

    // Plausible, positive, and never overdrawn at any point in the history.
    expect(account.balance.gt(0)).toBe(true)

    const entries = await prisma.ledgerEntry.findMany({
      where: { transaction: { userId: demo.userId } },
    })

    expect(entries.length).toBeGreaterThan(0)

    const debits = entries
      .filter((e) => e.entryType === 'DEBIT')
      .reduce((sum, e) => sum.add(e.amount), new Decimal(0))
    const credits = entries
      .filter((e) => e.entryType === 'CREDIT')
      .reduce((sum, e) => sum.add(e.amount), new Decimal(0))

    expect(debits.equals(credits)).toBe(true)

    // Every posting has both sides, so the whole system still nets to zero.
    expect((await totalOfAllBalances()).toFixed(2)).toBe('0.00')
  })

  it('writes two ledger entries for every transaction', async () => {
    const demo = await createDemoCustomer({
      supabaseId: randomUUID(),
      email: `demo-${randomUUID()}@demo.neobank.invalid`,
    })

    const transactions = await prisma.transaction.findMany({
      where: { userId: demo.userId },
      include: { ledgerEntries: true },
    })

    expect(transactions.length).toBeGreaterThan(20)
    for (const transaction of transactions) {
      expect(transaction.ledgerEntries).toHaveLength(2)
      const [a, b] = transaction.ledgerEntries
      expect(a.amount.equals(b.amount)).toBe(true)
      expect(new Set([a.entryType, b.entryType])).toEqual(
        new Set(['DEBIT', 'CREDIT'])
      )
    }
  })

  it('backdates history so transactions are not all stamped now', async () => {
    const demo = await createDemoCustomer({
      supabaseId: randomUUID(),
      email: `demo-${randomUUID()}@demo.neobank.invalid`,
    })

    const [oldest] = await prisma.transaction.findMany({
      where: { userId: demo.userId },
      orderBy: { createdAt: 'asc' },
      take: 1,
    })

    const ageDays =
      (Date.now() - oldest.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    expect(ageDays).toBeGreaterThan(30)

    // Ledger entries are backdated to match their transaction.
    const entry = await prisma.ledgerEntry.findFirstOrThrow({
      where: { transactionId: oldest.id },
    })
    expect(
      Math.abs(entry.createdAt.getTime() - oldest.createdAt.getTime())
    ).toBeLessThan(1000)
  })

  it('is idempotent, so re-seeding posts nothing twice', async () => {
    const demo = await createDemoCustomer({
      supabaseId: randomUUID(),
      email: `demo-${randomUUID()}@demo.neobank.invalid`,
    })

    const before = await prisma.transaction.count({
      where: { userId: demo.userId },
    })
    const balanceBefore = (
      await prisma.account.findUniqueOrThrow({ where: { id: demo.accountId } })
    ).balance

    const result = await seedDemoDataFor({
      userId: demo.userId,
      accountId: demo.accountId,
    })

    expect(result.skipped).toBe(true)
    expect(await prisma.transaction.count({ where: { userId: demo.userId } })).toBe(
      before
    )
    const balanceAfter = (
      await prisma.account.findUniqueOrThrow({ where: { id: demo.accountId } })
    ).balance
    expect(balanceAfter.equals(balanceBefore)).toBe(true)
  })

  it('gives each visitor an isolated account', async () => {
    const first = await createDemoCustomer({
      supabaseId: randomUUID(),
      email: `demo-${randomUUID()}@demo.neobank.invalid`,
    })
    const second = await createDemoCustomer({
      supabaseId: randomUUID(),
      email: `demo-${randomUUID()}@demo.neobank.invalid`,
    })

    expect(first.userId).not.toBe(second.userId)
    expect(first.accountId).not.toBe(second.accountId)

    // Draining one demo account leaves the other untouched. This is the whole
    // argument for per-visitor accounts over a shared demo login.
    const contact = await prisma.user.findFirstOrThrow({
      where: { email: { startsWith: 'maya@' } },
      include: { accounts: { take: 1 } },
    })

    const firstBalance = (
      await prisma.account.findUniqueOrThrow({ where: { id: first.accountId } })
    ).balance
    const secondBefore = (
      await prisma.account.findUniqueOrThrow({ where: { id: second.accountId } })
    ).balance

    const drain = await executeP2PTransfer(
      first.userId,
      contact.email,
      firstBalance.gt(1000) ? new Decimal('1000.00') : firstBalance,
      randomUUID()
    )
    expect(drain.success).toBe(true)

    const secondAfter = (
      await prisma.account.findUniqueOrThrow({ where: { id: second.accountId } })
    ).balance
    expect(secondAfter.equals(secondBefore)).toBe(true)
  })

  it('seeds contacts a demo visitor can actually pay', async () => {
    await ensureDemoContacts()

    const contacts = await prisma.user.findMany({
      where: { email: { endsWith: '@demo.neobank.invalid' }, isDemo: false },
      include: { accounts: true },
    })

    expect(contacts.length).toBeGreaterThanOrEqual(4)
    for (const contact of contacts) {
      expect(contact.kycStatus).toBe('VERIFIED')
      expect(contact.accounts.length).toBeGreaterThan(0)
    }
  })

  it('ensureDemoContacts is idempotent', async () => {
    await ensureDemoContacts()
    const first = await prisma.user.count({
      where: { email: { endsWith: '@demo.neobank.invalid' } },
    })

    await ensureDemoContacts()
    const second = await prisma.user.count({
      where: { email: { endsWith: '@demo.neobank.invalid' } },
    })

    expect(second).toBe(first)
  })
})

describe('demo cleanup', () => {
  it('removes expired accounts and keeps the ledger balanced', async () => {
    const demo = await createDemoCustomer({
      supabaseId: randomUUID(),
      email: `demo-${randomUUID()}@demo.neobank.invalid`,
      ttlHours: -1, // already expired
    })

    expect((await totalOfAllBalances()).toFixed(2)).toBe('0.00')

    const removed = await cleanupExpiredDemoAccounts()
    expect(removed.length).toBe(1)

    expect(
      await prisma.user.findUnique({ where: { id: demo.userId } })
    ).toBeNull()

    // Cascades took the account, transactions and ledger entries with it, and
    // the settlement account was rebalanced, so the books still net to zero.
    expect((await totalOfAllBalances()).toFixed(2)).toBe('0.00')
  })

  it('leaves unexpired demo accounts alone', async () => {
    const live = await createDemoCustomer({
      supabaseId: randomUUID(),
      email: `demo-${randomUUID()}@demo.neobank.invalid`,
      ttlHours: 12,
    })

    const removed = await cleanupExpiredDemoAccounts()
    expect(removed).toHaveLength(0)
    expect(
      await prisma.user.findUnique({ where: { id: live.userId } })
    ).not.toBeNull()
  })
})
