import { describe, expect, it } from 'vitest'
import { randomUUID } from 'crypto'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/prisma'
import {
  executeACHTransfer,
  updateACHTransferStatus,
} from '@/lib/transfer-utils'
import {
  createCustomer,
  createVerifiedExternalAccount,
  fundAccount,
  getBalance,
  ledgerIsBalancedFor,
  totalOfAllBalances,
} from './helpers/factories'

const key = () => randomUUID()

async function settlementBalance() {
  const account = await prisma.account.findUnique({
    where: { systemType: 'ACH_SETTLEMENT' },
  })
  return account?.balance ?? new Decimal(0)
}

describe('ACH transfers', () => {
  it('posts a deposit against the settlement house account', async () => {
    const customer = await createCustomer()
    const external = await createVerifiedExternalAccount(customer.user.id)

    const result = await executeACHTransfer(
      customer.user.id,
      external.id,
      new Decimal('250.00'),
      'DEPOSIT',
      key(),
      'Payday'
    )

    expect(result.success).toBe(true)
    expect(result.status).toBe('COMPLETED')

    expect((await getBalance(customer.account.id)).toFixed(2)).toBe('250.00')

    // The other side of the entry. Money genuinely came from outside the bank,
    // so the house account carries the claim and goes negative.
    expect((await settlementBalance()).toFixed(2)).toBe('-250.00')

    expect(await ledgerIsBalancedFor(result.transactionId!)).toBe(true)
    expect((await totalOfAllBalances()).toFixed(2)).toBe('0.00')
  })

  it('posts a withdrawal against the settlement house account', async () => {
    const customer = await createCustomer()
    const external = await createVerifiedExternalAccount(customer.user.id)
    await fundAccount(customer.account.id, '500.00')

    const before = await settlementBalance()

    const result = await executeACHTransfer(
      customer.user.id,
      external.id,
      new Decimal('200.00'),
      'WITHDRAWAL',
      key()
    )

    expect(result.success).toBe(true)
    expect((await getBalance(customer.account.id)).toFixed(2)).toBe('300.00')
    expect((await settlementBalance()).toFixed(2)).toBe(
      before.add(new Decimal('200.00')).toFixed(2)
    )
    expect(await ledgerIsBalancedFor(result.transactionId!)).toBe(true)
    expect((await totalOfAllBalances()).toFixed(2)).toBe('0.00')
  })

  it('refuses a withdrawal larger than the balance', async () => {
    const customer = await createCustomer()
    const external = await createVerifiedExternalAccount(customer.user.id)
    await fundAccount(customer.account.id, '100.00')

    const result = await executeACHTransfer(
      customer.user.id,
      external.id,
      new Decimal('100.01'),
      'WITHDRAWAL',
      key()
    )

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/insufficient funds/i)
    expect((await getBalance(customer.account.id)).toFixed(2)).toBe('100.00')
  })

  it('refuses transfers against an unverified external account', async () => {
    const customer = await createCustomer()
    const external = await createVerifiedExternalAccount(customer.user.id)
    await prisma.externalAccount.update({
      where: { id: external.id },
      data: { verificationStatus: 'FAILED' },
    })

    const result = await executeACHTransfer(
      customer.user.id,
      external.id,
      new Decimal('10.00'),
      'DEPOSIT',
      key()
    )

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/verified/i)
  })

  it('refuses to use another customer external account', async () => {
    const owner = await createCustomer()
    const attacker = await createCustomer()
    const external = await createVerifiedExternalAccount(owner.user.id)

    const result = await executeACHTransfer(
      attacker.user.id,
      external.id,
      new Decimal('10.00'),
      'DEPOSIT',
      key()
    )

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not found or unauthorized/i)
  })

  it('applies the daily limit to ACH, which used to bypass it entirely', async () => {
    process.env.DAILY_TRANSFER_LIMIT = '25000'

    const customer = await createCustomer()
    const external = await createVerifiedExternalAccount(customer.user.id)
    await fundAccount(customer.account.id, '60000.00')

    for (let i = 0; i < 3; i += 1) {
      const ok = await executeACHTransfer(
        customer.user.id,
        external.id,
        new Decimal('8000.00'),
        'WITHDRAWAL',
        key()
      )
      expect(ok.success).toBe(true)
    }

    // 24000 already withdrawn today; another 8000 breaks the 25000 cap.
    const blocked = await executeACHTransfer(
      customer.user.id,
      external.id,
      new Decimal('8000.00'),
      'WITHDRAWAL',
      key()
    )

    expect(blocked.success).toBe(false)
    expect(blocked.error).toMatch(/daily/i)
  })

  it('is idempotent on a repeated key', async () => {
    const customer = await createCustomer()
    const external = await createVerifiedExternalAccount(customer.user.id)
    const idempotencyKey = key()

    const first = await executeACHTransfer(
      customer.user.id,
      external.id,
      new Decimal('75.00'),
      'DEPOSIT',
      idempotencyKey
    )
    const second = await executeACHTransfer(
      customer.user.id,
      external.id,
      new Decimal('75.00'),
      'DEPOSIT',
      idempotencyKey
    )

    expect(second.replayed).toBe(true)
    expect(second.transactionId).toBe(first.transactionId)
    expect((await getBalance(customer.account.id)).toFixed(2)).toBe('75.00')
    expect(await prisma.aCHTransfer.count()).toBe(1)
  })
})

describe('ACH webhook settlement', () => {
  /** Build a PROCESSING transfer the way the non-sandbox path would. */
  async function createProcessingTransfer(direction: 'DEPOSIT' | 'WITHDRAWAL') {
    const customer = await createCustomer()
    const external = await createVerifiedExternalAccount(customer.user.id)
    if (direction === 'WITHDRAWAL') {
      await fundAccount(customer.account.id, '500.00')
    }

    const plaidTransferId = `plaid-transfer-${randomUUID()}`

    const transaction = await prisma.transaction.create({
      data: {
        userId: customer.user.id,
        fromAccountId: direction === 'WITHDRAWAL' ? customer.account.id : null,
        toAccountId: direction === 'DEPOSIT' ? customer.account.id : null,
        amount: new Decimal('100.00'),
        type: direction === 'DEPOSIT' ? 'ACH_CREDIT' : 'ACH_DEBIT',
        status: 'PROCESSING',
        idempotencyKey: key(),
        externalId: plaidTransferId,
      },
    })

    await prisma.aCHTransfer.create({
      data: {
        userId: customer.user.id,
        externalAccountId: external.id,
        internalAccountId: customer.account.id,
        transactionId: transaction.id,
        direction,
        amount: new Decimal('100.00'),
        status: 'PROCESSING',
        plaidTransferId,
      },
    })

    return { customer, transaction, plaidTransferId }
  }

  it('settles a posted deposit exactly once even if redelivered', async () => {
    const { customer, plaidTransferId } = await createProcessingTransfer('DEPOSIT')

    await updateACHTransferStatus(plaidTransferId, 'posted')
    expect((await getBalance(customer.account.id)).toFixed(2)).toBe('100.00')

    // Providers deliver at-least-once. The same webhook again must be a no-op.
    await updateACHTransferStatus(plaidTransferId, 'posted')
    await updateACHTransferStatus(plaidTransferId, 'posted')

    expect((await getBalance(customer.account.id)).toFixed(2)).toBe('100.00')
    expect((await totalOfAllBalances()).toFixed(2)).toBe('0.00')

    const transfer = await prisma.aCHTransfer.findUniqueOrThrow({
      where: { plaidTransferId },
    })
    expect(
      await prisma.ledgerEntry.count({
        where: { transactionId: transfer.transactionId! },
      })
    ).toBe(2)
  })

  it('marks a failed transfer without moving money', async () => {
    const { customer, plaidTransferId } = await createProcessingTransfer('DEPOSIT')

    await updateACHTransferStatus(plaidTransferId, 'failed', 'R01')

    expect((await getBalance(customer.account.id)).toFixed(2)).toBe('0.00')

    const transfer = await prisma.aCHTransfer.findUniqueOrThrow({
      where: { plaidTransferId },
    })
    expect(transfer.status).toBe('FAILED')
    expect(transfer.failureReason).toBe('R01')
  })

  it('does not settle a transfer that already failed', async () => {
    const { customer, plaidTransferId } = await createProcessingTransfer('DEPOSIT')

    await updateACHTransferStatus(plaidTransferId, 'failed')
    // A late, out-of-order "posted" must not resurrect a terminal transfer.
    await updateACHTransferStatus(plaidTransferId, 'posted')

    expect((await getBalance(customer.account.id)).toFixed(2)).toBe('0.00')
  })

  it('returns a withdrawal that can no longer be covered at settlement', async () => {
    const { customer, plaidTransferId } =
      await createProcessingTransfer('WITHDRAWAL')

    // Drain the account before the ACH settles.
    const other = await createCustomer()
    const { executeP2PTransfer } = await import('@/lib/transfer-utils')
    await executeP2PTransfer(
      customer.user.id,
      other.user.email,
      new Decimal('500.00'),
      key()
    )
    expect((await getBalance(customer.account.id)).toFixed(2)).toBe('0.00')

    await updateACHTransferStatus(plaidTransferId, 'posted')

    const transfer = await prisma.aCHTransfer.findUniqueOrThrow({
      where: { plaidTransferId },
    })
    expect(transfer.status).toBe('RETURNED')
    expect((await getBalance(customer.account.id)).toFixed(2)).toBe('0.00')
    expect((await totalOfAllBalances()).toFixed(2)).toBe('0.00')
  })
})
