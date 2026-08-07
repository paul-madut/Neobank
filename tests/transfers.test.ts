import { describe, expect, it } from 'vitest'
import { randomUUID } from 'crypto'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/prisma'
import {
  approvePendingTransfer,
  executeP2PTransfer,
  rejectPendingTransfer,
} from '@/lib/transfer-utils'
import { InsufficientFundsError, postDoubleEntry } from '@/lib/ledger'
import { supportsConcurrentConnections } from './setup'
import {
  createCustomer,
  fundAccount,
  getBalance,
  ledgerIsBalancedFor,
  totalOfAllBalances,
} from './helpers/factories'

const key = () => randomUUID()

describe('P2P transfers', () => {
  it('moves money and posts a balanced pair of ledger entries', async () => {
    const sender = await createCustomer()
    const recipient = await createCustomer()
    await fundAccount(sender.account.id, '100.00')

    const result = await executeP2PTransfer(
      sender.user.id,
      recipient.user.email,
      new Decimal('40.00'),
      key(),
      'Lunch'
    )

    expect(result.success).toBe(true)
    expect(result.status).toBe('COMPLETED')

    expect((await getBalance(sender.account.id)).toFixed(2)).toBe('60.00')
    expect((await getBalance(recipient.account.id)).toFixed(2)).toBe('40.00')

    expect(await ledgerIsBalancedFor(result.transactionId!)).toBe(true)

    const entries = await prisma.ledgerEntry.findMany({
      where: { transactionId: result.transactionId! },
    })
    expect(entries).toHaveLength(2)
    expect(entries.map((e) => e.entryType).sort()).toEqual(['CREDIT', 'DEBIT'])
  })

  it('rejects a transfer larger than the balance', async () => {
    const sender = await createCustomer()
    const recipient = await createCustomer()
    await fundAccount(sender.account.id, '50.00')

    const result = await executeP2PTransfer(
      sender.user.id,
      recipient.user.email,
      new Decimal('50.01'),
      key()
    )

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/insufficient funds/i)
    expect((await getBalance(sender.account.id)).toFixed(2)).toBe('50.00')
    expect((await getBalance(recipient.account.id)).toFixed(2)).toBe('0.00')
  })

  it('rejects a transfer to yourself', async () => {
    const sender = await createCustomer()
    await fundAccount(sender.account.id, '100.00')

    const result = await executeP2PTransfer(
      sender.user.id,
      sender.user.email,
      new Decimal('10.00'),
      key()
    )

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/yourself/i)
    expect((await getBalance(sender.account.id)).toFixed(2)).toBe('100.00')
  })

  it('requires the sender to have completed KYC', async () => {
    const sender = await createCustomer({ kycStatus: 'PENDING' })
    const recipient = await createCustomer()
    await fundAccount(sender.account.id, '100.00')

    const result = await executeP2PTransfer(
      sender.user.id,
      recipient.user.email,
      new Decimal('10.00'),
      key()
    )

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/kyc/i)
  })

  it('enforces the daily outbound limit across several transfers', async () => {
    process.env.DAILY_TRANSFER_LIMIT = '25000'

    const sender = await createCustomer()
    const recipient = await createCustomer()
    await fundAccount(sender.account.id, '60000.00')

    // Five transfers of 4900 stay under both the per-transaction cap (10000)
    // and the review threshold (5000), and total 24500.
    for (let i = 0; i < 5; i += 1) {
      const ok = await executeP2PTransfer(
        sender.user.id,
        recipient.user.email,
        new Decimal('4900.00'),
        key()
      )
      expect(ok.success).toBe(true)
    }

    // 24500 + 4900 = 29400, over the 25000 daily cap.
    const blocked = await executeP2PTransfer(
      sender.user.id,
      recipient.user.email,
      new Decimal('4900.00'),
      key()
    )

    expect(blocked.success).toBe(false)
    expect(blocked.error).toMatch(/daily/i)
    expect((await getBalance(recipient.account.id)).toFixed(2)).toBe('24500.00')
  })

  it('rejects a transfer above the per-transaction maximum', async () => {
    const sender = await createCustomer()
    const recipient = await createCustomer()
    await fundAccount(sender.account.id, '50000.00')

    const result = await executeP2PTransfer(
      sender.user.id,
      recipient.user.email,
      new Decimal('10000.01'),
      key()
    )

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/maximum limit/i)
  })

  it('keeps sub-cent precision exact across many transfers', async () => {
    const sender = await createCustomer()
    const recipient = await createCustomer()
    await fundAccount(sender.account.id, '10.00')

    // 0.10 is not representable in binary floating point. Ten of them under
    // float arithmetic drift off 1.00; under Decimal they do not.
    for (let i = 0; i < 10; i += 1) {
      const ok = await executeP2PTransfer(
        sender.user.id,
        recipient.user.email,
        new Decimal('0.10'),
        key()
      )
      expect(ok.success).toBe(true)
    }

    expect((await getBalance(recipient.account.id)).toFixed(4)).toBe('1.0000')
    expect((await getBalance(sender.account.id)).toFixed(4)).toBe('9.0000')
  })
})

describe('idempotency', () => {
  it('returns the original transaction when the same key is retried', async () => {
    const sender = await createCustomer()
    const recipient = await createCustomer()
    await fundAccount(sender.account.id, '100.00')

    const idempotencyKey = key()

    const first = await executeP2PTransfer(
      sender.user.id,
      recipient.user.email,
      new Decimal('25.00'),
      idempotencyKey
    )
    const second = await executeP2PTransfer(
      sender.user.id,
      recipient.user.email,
      new Decimal('25.00'),
      idempotencyKey
    )

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    expect(second.transactionId).toBe(first.transactionId)
    expect(second.replayed).toBe(true)

    // The money moved exactly once.
    expect((await getBalance(sender.account.id)).toFixed(2)).toBe('75.00')
    expect((await getBalance(recipient.account.id)).toFixed(2)).toBe('25.00')

    expect(await prisma.transaction.count({ where: { type: 'P2P_TRANSFER' } })).toBe(1)
    expect(
      await prisma.ledgerEntry.count({
        where: { transactionId: first.transactionId! },
      })
    ).toBe(2)
  })

  it('does not let a different amount reuse a spent key', async () => {
    const sender = await createCustomer()
    const recipient = await createCustomer()
    await fundAccount(sender.account.id, '100.00')

    const idempotencyKey = key()

    await executeP2PTransfer(
      sender.user.id,
      recipient.user.email,
      new Decimal('10.00'),
      idempotencyKey
    )
    const replay = await executeP2PTransfer(
      sender.user.id,
      recipient.user.email,
      new Decimal('90.00'),
      idempotencyKey
    )

    expect(replay.replayed).toBe(true)
    // The replay returns the original 10.00 transfer, it does not move 90.00.
    expect((await getBalance(recipient.account.id)).toFixed(2)).toBe('10.00')
  })
})

describe('double-spend prevention', () => {
  it('lets only one of two competing debits succeed', async () => {
    const sender = await createCustomer()
    const recipientA = await createCustomer()
    const recipientB = await createCustomer()
    await fundAccount(sender.account.id, '100.00')

    const results = await Promise.all([
      executeP2PTransfer(
        sender.user.id,
        recipientA.user.email,
        new Decimal('100.00'),
        key()
      ),
      executeP2PTransfer(
        sender.user.id,
        recipientB.user.email,
        new Decimal('100.00'),
        key()
      ),
    ])

    const succeeded = results.filter((r) => r.success)
    const failed = results.filter((r) => !r.success)

    expect(succeeded).toHaveLength(1)
    expect(failed).toHaveLength(1)
    expect(failed[0].error).toMatch(/insufficient funds/i)

    // The account is drained exactly once and never goes negative.
    expect((await getBalance(sender.account.id)).toFixed(2)).toBe('0.00')
    expect((await totalOfAllBalances()).toFixed(2)).toBe('0.00')
  })

  it(
    'holds under genuinely parallel transactions',
    { skip: !supportsConcurrentConnections },
    async () => {
      // Only meaningful against a backend that serves several connections at
      // once. PGlite is single-connection, so this runs in CI against real
      // Postgres. It is the test that actually proves the guarded UPDATE
      // survives two transactions interleaving under READ COMMITTED.
      const sender = await createCustomer()
      const recipients = await Promise.all(
        Array.from({ length: 8 }, () => createCustomer())
      )
      await fundAccount(sender.account.id, '100.00')

      const results = await Promise.all(
        recipients.map((recipient) =>
          executeP2PTransfer(
            sender.user.id,
            recipient.user.email,
            new Decimal('100.00'),
            key()
          )
        )
      )

      expect(results.filter((r) => r.success)).toHaveLength(1)
      expect((await getBalance(sender.account.id)).toFixed(2)).toBe('0.00')
      expect((await totalOfAllBalances()).toFixed(2)).toBe('0.00')
    }
  )

  it('refuses to overdraw at the ledger primitive itself', async () => {
    const a = await createCustomer()
    const b = await createCustomer()
    await fundAccount(a.account.id, '10.00')

    const transaction = await prisma.transaction.create({
      data: {
        userId: a.user.id,
        fromAccountId: a.account.id,
        toAccountId: b.account.id,
        amount: new Decimal('10.01'),
        type: 'P2P_TRANSFER',
        status: 'PENDING',
        idempotencyKey: key(),
      },
    })

    await expect(
      prisma.$transaction((tx) =>
        postDoubleEntry(tx, {
          transactionId: transaction.id,
          debitAccountId: a.account.id,
          creditAccountId: b.account.id,
          amount: new Decimal('10.01'),
          debitDescription: 'over',
          creditDescription: 'over',
        })
      )
    ).rejects.toBeInstanceOf(InsufficientFundsError)

    expect((await getBalance(a.account.id)).toFixed(2)).toBe('10.00')
  })

  it('is enforced by the database even if application code is bypassed', async () => {
    const a = await createCustomer()
    await fundAccount(a.account.id, '10.00')

    // The CHECK constraint is the last line of defence. Application code can be
    // bypassed by a script, a migration, or a future code path that forgets the
    // rule; the database cannot.
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "Account" SET balance = -1 WHERE id = '${a.account.id}'`
      )
    ).rejects.toThrow()

    // PGlite drops the socket when a statement-level error escapes a raw query,
    // so take a fresh connection before reading back.
    await prisma.$disconnect()

    expect((await getBalance(a.account.id)).toFixed(2)).toBe('10.00')
  })

  it('rejects a negative or zero ledger posting', async () => {
    const a = await createCustomer()
    const b = await createCustomer()
    await fundAccount(a.account.id, '10.00')

    const transaction = await prisma.transaction.create({
      data: {
        userId: a.user.id,
        amount: new Decimal('1.00'),
        type: 'P2P_TRANSFER',
        status: 'PENDING',
        idempotencyKey: key(),
      },
    })

    await expect(
      prisma.$transaction((tx) =>
        postDoubleEntry(tx, {
          transactionId: transaction.id,
          debitAccountId: a.account.id,
          creditAccountId: b.account.id,
          amount: new Decimal('0'),
          debitDescription: 'zero',
          creditDescription: 'zero',
        })
      )
    ).rejects.toThrow(/positive amount/i)

    await expect(
      prisma.$transaction((tx) =>
        postDoubleEntry(tx, {
          transactionId: transaction.id,
          debitAccountId: a.account.id,
          creditAccountId: a.account.id,
          amount: new Decimal('1.00'),
          debitDescription: 'self',
          creditDescription: 'self',
        })
      )
    ).rejects.toThrow(/different accounts/i)
  })
})

describe('held transfers above the review threshold', () => {
  it('holds the transfer and moves no money until approved', async () => {
    const sender = await createCustomer()
    const recipient = await createCustomer()
    await fundAccount(sender.account.id, '9000.00')

    const held = await executeP2PTransfer(
      sender.user.id,
      recipient.user.email,
      new Decimal('6000.00'),
      key()
    )

    expect(held.status).toBe('PENDING')
    expect((await getBalance(sender.account.id)).toFixed(2)).toBe('9000.00')
    expect(
      await prisma.ledgerEntry.count({
        where: { transactionId: held.transactionId! },
      })
    ).toBe(0)

    const admin = await createCustomer({ isAdmin: true })
    const approval = await approvePendingTransfer(
      held.transactionId!,
      admin.user.id,
      'Looks fine'
    )

    expect(approval.success).toBe(true)
    expect((await getBalance(sender.account.id)).toFixed(2)).toBe('3000.00')
    expect((await getBalance(recipient.account.id)).toFixed(2)).toBe('6000.00')
    expect(await ledgerIsBalancedFor(held.transactionId!)).toBe(true)

    const reviewed = await prisma.transaction.findUniqueOrThrow({
      where: { id: held.transactionId! },
    })
    expect(reviewed.status).toBe('COMPLETED')
    expect(reviewed.reviewedByUserId).toBe(admin.user.id)
    expect(reviewed.reviewedAt).not.toBeNull()
  })

  it('cannot be approved twice', async () => {
    const sender = await createCustomer()
    const recipient = await createCustomer()
    const admin = await createCustomer({ isAdmin: true })
    await fundAccount(sender.account.id, '9000.00')

    const held = await executeP2PTransfer(
      sender.user.id,
      recipient.user.email,
      new Decimal('6000.00'),
      key()
    )

    const first = await approvePendingTransfer(held.transactionId!, admin.user.id)
    const second = await approvePendingTransfer(held.transactionId!, admin.user.id)

    expect(first.success).toBe(true)
    expect(second.success).toBe(false)
    expect((await getBalance(recipient.account.id)).toFixed(2)).toBe('6000.00')
  })

  it('fails approval if the sender spent the money while it was held', async () => {
    const sender = await createCustomer()
    const recipient = await createCustomer()
    const other = await createCustomer()
    const admin = await createCustomer({ isAdmin: true })
    await fundAccount(sender.account.id, '6000.00')

    const held = await executeP2PTransfer(
      sender.user.id,
      recipient.user.email,
      new Decimal('6000.00'),
      key()
    )
    expect(held.status).toBe('PENDING')

    // Funds were never reserved, so the sender can still spend them.
    const spent = await executeP2PTransfer(
      sender.user.id,
      other.user.email,
      new Decimal('4000.00'),
      key()
    )
    expect(spent.success).toBe(true)

    const approval = await approvePendingTransfer(
      held.transactionId!,
      admin.user.id
    )

    expect(approval.success).toBe(false)
    expect(approval.error).toMatch(/sufficient funds/i)
    expect((await getBalance(sender.account.id)).toFixed(2)).toBe('2000.00')
    expect((await totalOfAllBalances()).toFixed(2)).toBe('0.00')
  })

  it('can be rejected, leaving the balance untouched', async () => {
    const sender = await createCustomer()
    const recipient = await createCustomer()
    const admin = await createCustomer({ isAdmin: true })
    await fundAccount(sender.account.id, '9000.00')

    const held = await executeP2PTransfer(
      sender.user.id,
      recipient.user.email,
      new Decimal('6000.00'),
      key()
    )

    const rejection = await rejectPendingTransfer(
      held.transactionId!,
      admin.user.id,
      'Suspicious'
    )

    expect(rejection.success).toBe(true)
    expect((await getBalance(sender.account.id)).toFixed(2)).toBe('9000.00')
    expect((await getBalance(recipient.account.id)).toFixed(2)).toBe('0.00')

    const reviewed = await prisma.transaction.findUniqueOrThrow({
      where: { id: held.transactionId! },
    })
    expect(reviewed.status).toBe('CANCELLED')
  })
})
