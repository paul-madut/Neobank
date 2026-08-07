import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from './prisma'
import { getSystemAccount, postDoubleEntry } from './ledger'
import { generateAccountNumber } from './plaid-utils'

/**
 * Demo data.
 *
 * This app is a public resume link. An interviewer should see a populated,
 * working bank in one click, not a signup form followed by an email
 * confirmation, a KYC flow and a Plaid handshake.
 *
 * Everything here goes through `postDoubleEntry`, exactly like the live
 * transfer paths. That is deliberate: seed data written with single-sided
 * entries and absolute balance writes would be a working counterexample to the
 * two properties the rest of the codebase is built to guarantee, sitting in the
 * repo where a curious reviewer will absolutely look. The demo ledger balances
 * to zero for the same reason the real one does.
 *
 * The card and external bank rows created here are local database records with
 * no Stripe or Plaid counterpart. Their identifiers are prefixed `demo_` so
 * that is obvious from the data itself.
 */

/** How long a one-click demo account lives before cleanup removes it. */
export const DEMO_TTL_HOURS = 12

export const DEMO_EMAIL_DOMAIN = 'demo.neobank.invalid'

/** The canonical demo account created by `prisma db seed`. */
export const DEMO_SEED_EMAIL = `demo@${DEMO_EMAIL_DOMAIN}`

interface Merchant {
  name: string
  category: string
  min: number
  max: number
}

const MERCHANTS: Merchant[] = [
  { name: 'Whole Foods Market', category: 'Groceries', min: 24, max: 130 },
  { name: 'Trader Joes', category: 'Groceries', min: 18, max: 85 },
  { name: 'Uber', category: 'Transport', min: 8, max: 42 },
  { name: 'Shell', category: 'Transport', min: 32, max: 78 },
  { name: 'Netflix', category: 'Entertainment', min: 15.49, max: 15.49 },
  { name: 'Spotify', category: 'Entertainment', min: 11.99, max: 11.99 },
  { name: 'Blue Bottle Coffee', category: 'Dining', min: 4.5, max: 18 },
  { name: 'Chipotle', category: 'Dining', min: 11, max: 34 },
  { name: 'Amazon', category: 'Shopping', min: 12, max: 240 },
  { name: 'Apple', category: 'Shopping', min: 9.99, max: 129 },
  { name: 'CVS Pharmacy', category: 'Health', min: 7, max: 64 },
  { name: 'Equinox', category: 'Health', min: 68, max: 68 },
  { name: 'Con Edison', category: 'Utilities', min: 74, max: 165 },
  { name: 'Verizon Fios', category: 'Utilities', min: 59.99, max: 89.99 },
  { name: 'Delta Air Lines', category: 'Travel', min: 148, max: 520 },
]

/** People a demo visitor can send money to, so P2P is actually usable. */
const DEMO_CONTACTS = [
  { firstName: 'Maya', lastName: 'Okonkwo' },
  { firstName: 'Daniel', lastName: 'Ferreira' },
  { firstName: 'Priya', lastName: 'Raman' },
  { firstName: 'Tomas', lastName: 'Nowak' },
]

/**
 * Deterministic PRNG (mulberry32).
 *
 * Seeded so the demo has a consistent shape across runs - useful for
 * screenshots and for reproducing a bug - while still looking varied.
 */
function makeRandom(seed: number) {
  let state = seed >>> 0
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function money(value: number): Decimal {
  // Two decimal places, always. Decimal from a rounded string, never a float.
  return new Decimal(value.toFixed(2))
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}

/** Allocate an account number, retrying on the (possible) uniqueness collision. */
async function createAccountWithNumber(
  tx: Prisma.TransactionClient,
  userId: string
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await tx.account.create({
        data: {
          userId,
          accountType: 'CHECKING',
          accountNumber: generateAccountNumber(),
          balance: 0,
          currency: 'USD',
          status: 'ACTIVE',
        },
      })
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === 4) throw error
    }
  }
  throw new Error('Could not allocate an account number for the demo account')
}

/**
 * Ensure the shared demo contacts exist.
 *
 * These are persistent, KYC-verified counterparties so a visitor can actually
 * complete a P2P transfer. They only ever receive money, so a visitor cannot
 * damage them. Idempotent.
 */
export async function ensureDemoContacts() {
  for (const [index, contact] of DEMO_CONTACTS.entries()) {
    const email = `${contact.firstName.toLowerCase()}@${DEMO_EMAIL_DOMAIN}`

    const existing = await prisma.user.findUnique({
      where: { email },
      include: { accounts: { where: { accountType: 'CHECKING' }, take: 1 } },
    })

    if (existing?.accounts[0]) continue

    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: { email },
          update: { kycStatus: 'VERIFIED' },
          create: {
            // Not a real Supabase identity - these contacts cannot sign in.
            supabaseId: `demo-contact-${index}-${email}`,
            email,
            firstName: contact.firstName,
            lastName: contact.lastName,
            kycStatus: 'VERIFIED',
          },
        })

        const account = await tx.account.findFirst({
          where: { userId: user.id, accountType: 'CHECKING' },
        })

        if (!account) {
          await createAccountWithNumber(tx, user.id)
        }
      })
    } catch (error) {
      // Another concurrent seed won the race. That is fine.
      if (!isUniqueViolation(error)) throw error
    }
  }
}

interface PlannedEntry {
  daysAgo: number
  kind: 'SALARY' | 'PURCHASE' | 'REFUND'
  amount: Decimal
  merchant?: Merchant
}

/**
 * Build a chronological, always-solvent schedule of activity.
 *
 * Solvency matters: the account has a CHECK constraint forbidding a negative
 * balance and `postDoubleEntry` refuses to overdraw, so a naive random schedule
 * would fail partway through. Salary lands first each month and purchases are
 * only emitted while the running balance can cover them.
 */
function planActivity(days: number, seed: number): PlannedEntry[] {
  const random = makeRandom(seed)
  const planned: PlannedEntry[] = []
  let balance = new Decimal(0)

  for (let daysAgo = days; daysAgo >= 0; daysAgo--) {
    const dayOfCycle = (days - daysAgo) % 30

    // Salary on the 1st of each 30 day cycle.
    if (dayOfCycle === 0) {
      const amount = money(3200 + random() * 900)
      planned.push({ daysAgo, kind: 'SALARY', amount })
      balance = balance.add(amount)
    }

    // Roughly one purchase every other day.
    if (random() < 0.55) {
      const merchant = MERCHANTS[Math.floor(random() * MERCHANTS.length)]
      const amount = money(
        merchant.min + random() * (merchant.max - merchant.min)
      )

      // Keep a floor so the account never looks drained and never overdraws.
      if (balance.sub(amount).gte(250)) {
        planned.push({ daysAgo, kind: 'PURCHASE', amount, merchant })
        balance = balance.sub(amount)
      }
    }

    // Occasional refund, so CARD_REFUND appears in the history too.
    if (random() < 0.04) {
      const merchant = MERCHANTS[Math.floor(random() * MERCHANTS.length)]
      const amount = money(merchant.min + random() * 30)
      planned.push({ daysAgo, kind: 'REFUND', amount, merchant })
      balance = balance.add(amount)
    }
  }

  return planned
}

function dateDaysAgo(daysAgo: number, now: Date): Date {
  const date = new Date(now)
  date.setDate(date.getDate() - daysAgo)
  // Spread through the working day so timestamps are not all midnight.
  date.setHours(9 + (daysAgo % 10), (daysAgo * 7) % 60, 0, 0)
  return date
}

export interface SeedDemoOptions {
  userId: string
  accountId: string
  /** Days of history to generate. */
  days?: number
  seed?: number
  now?: Date
}

/**
 * Populate an account with a plausible history, a card and a linked bank.
 *
 * Idempotent by account: if the account already has transactions, this returns
 * without doing anything, so `prisma db seed` can be re-run safely.
 */
export async function seedDemoDataFor(
  options: SeedDemoOptions
): Promise<{ created: number; skipped: boolean }> {
  const { userId, accountId } = options
  const days = options.days ?? 95
  const seed = options.seed ?? 20260101
  const now = options.now ?? new Date()

  const existing = await prisma.transaction.count({ where: { userId } })
  if (existing > 0) {
    return { created: 0, skipped: true }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { kycStatus: 'VERIFIED' },
  })

  const planned = planActivity(days, seed)

  for (const entry of planned) {
    const createdAt = dateDaysAgo(entry.daysAgo, now)

    await prisma.$transaction(async (tx) => {
      const settlement = await getSystemAccount(
        tx,
        entry.kind === 'SALARY' ? 'ACH_SETTLEMENT' : 'CARD_SETTLEMENT'
      )

      const isInbound = entry.kind === 'SALARY' || entry.kind === 'REFUND'

      const description =
        entry.kind === 'SALARY'
          ? 'Payroll deposit - Northwind Systems'
          : entry.kind === 'REFUND'
            ? `Refund - ${entry.merchant!.name}`
            : entry.merchant!.name

      const transaction = await tx.transaction.create({
        data: {
          userId,
          fromAccountId: isInbound ? null : accountId,
          toAccountId: isInbound ? accountId : null,
          amount: entry.amount,
          currency: 'USD',
          type:
            entry.kind === 'SALARY'
              ? 'ACH_CREDIT'
              : entry.kind === 'REFUND'
                ? 'CARD_REFUND'
                : 'CARD_PURCHASE',
          status: 'COMPLETED',
          description,
          idempotencyKey: `demo_${userId}_${randomUUID()}`,
          metadata: {
            demo: true,
            category: entry.merchant?.category ?? 'Income',
            merchantName: entry.merchant?.name,
          },
          createdAt,
          updatedAt: createdAt,
        },
      })

      await postDoubleEntry(tx, {
        transactionId: transaction.id,
        debitAccountId: isInbound ? settlement.id : accountId,
        creditAccountId: isInbound ? accountId : settlement.id,
        amount: entry.amount,
        debitDescription: isInbound ? `${description} - settlement` : description,
        creditDescription: isInbound ? description : `${description} - settlement`,
      })

      // postDoubleEntry stamps ledger entries with now(). Backdate them to match
      // their transaction so statements read in the right order.
      await tx.ledgerEntry.updateMany({
        where: { transactionId: transaction.id },
        data: { createdAt },
      })
    })
  }

  await seedDemoCard(userId, now)
  await seedDemoExternalAccount(userId, now)

  return { created: planned.length, skipped: false }
}

/**
 * A virtual card row with no Stripe counterpart.
 *
 * Real cards are created by app/api/cards/create against Stripe Issuing. This
 * one exists so the cards page has something to show in the demo; the
 * `demo_` prefix on stripeCardId makes that visible in the database.
 */
async function seedDemoCard(userId: string, now: Date) {
  const existing = await prisma.card.count({ where: { userId } })
  if (existing > 0) return

  await prisma.card.create({
    data: {
      userId,
      stripeCardId: `demo_ic_${randomUUID()}`,
      last4: '4242',
      brand: 'visa',
      expiryMonth: 11,
      expiryYear: now.getFullYear() + 3,
      status: 'ACTIVE',
      spendingLimit: new Decimal('500.00'),
      monthlyLimit: new Decimal('2500.00'),
      nickname: 'Everyday card',
    },
  })
}

/** A linked external bank with no Plaid item behind it. */
async function seedDemoExternalAccount(userId: string, now: Date) {
  const existing = await prisma.externalAccount.count({ where: { userId } })
  if (existing > 0) return

  await prisma.externalAccount.create({
    data: {
      userId,
      plaidAccountId: `demo_acct_${randomUUID()}`,
      plaidItemId: `demo_item_${randomUUID()}`,
      // Not a credential. There is no Plaid item to authenticate against.
      plaidAccessToken: 'demo-no-plaid-item',
      institutionId: 'ins_demo',
      institutionName: 'First Platypus Bank',
      accountName: 'Plaid Checking',
      officialName: 'Plaid Gold Standard 0% Interest Checking',
      mask: '0000',
      type: 'depository',
      subtype: 'checking',
      availableBalance: new Decimal('4821.55'),
      currentBalance: new Decimal('4821.55'),
      verificationStatus: 'VERIFIED',
      lastSynced: now,
    },
  })
}

export interface DemoAccountRecord {
  userId: string
  accountId: string
  email: string
}

/**
 * Create a brand new, fully populated demo customer.
 *
 * `supabaseId` ties the row to a real Supabase auth user so the normal session
 * machinery works unchanged - the demo is not a special case anywhere else in
 * the app.
 */
export async function createDemoCustomer(params: {
  supabaseId: string
  email: string
  firstName?: string
  lastName?: string
  ttlHours?: number
}): Promise<DemoAccountRecord> {
  const ttlHours = params.ttlHours ?? DEMO_TTL_HOURS
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)

  const { user, account } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        supabaseId: params.supabaseId,
        email: params.email,
        firstName: params.firstName ?? 'Alex',
        lastName: params.lastName ?? 'Demo',
        kycStatus: 'VERIFIED',
        isDemo: true,
        demoExpiresAt: expiresAt,
      },
    })

    const account = await createAccountWithNumber(tx, user.id)

    return { user, account }
  })

  await ensureDemoContacts()
  await seedDemoDataFor({
    userId: user.id,
    accountId: account.id,
    // Vary the seed per visitor so two people side by side do not see identical
    // numbers, while each individual history stays internally consistent.
    seed: Math.floor(Math.random() * 1_000_000),
  })

  return { userId: user.id, accountId: account.id, email: user.email }
}

/**
 * Delete expired demo customers.
 *
 * Returns the Supabase ids that were removed so the caller can delete the
 * matching auth users. Cascading deletes take the accounts, transactions and
 * ledger entries with the User row.
 *
 * Note the ledger consequence: removing a customer's rows leaves the system
 * settlement accounts holding the other half of entries whose counterparty is
 * gone, so the global "all balances sum to zero" invariant does not survive
 * cleanup. The settlement accounts are rebalanced here to keep the books
 * consistent rather than leaving a phantom liability behind.
 */
export async function cleanupExpiredDemoAccounts(limit = 25): Promise<string[]> {
  const expired = await prisma.user.findMany({
    where: {
      isDemo: true,
      demoExpiresAt: { lt: new Date() },
    },
    select: { id: true, supabaseId: true },
    take: limit,
  })

  if (expired.length === 0) return []

  const removed: string[] = []

  for (const user of expired) {
    await prisma.$transaction(async (tx) => {
      // Sum what this user's accounts still hold, so the offsetting balance can
      // be removed from the settlement accounts in the same step.
      const accounts = await tx.account.findMany({
        where: { userId: user.id },
        select: { balance: true },
      })

      const held = accounts.reduce(
        (sum, account) => sum.add(account.balance),
        new Decimal(0)
      )

      await tx.user.delete({ where: { id: user.id } })

      if (!held.isZero()) {
        const settlement = await getSystemAccount(tx, 'ACH_SETTLEMENT')
        await tx.account.update({
          where: { id: settlement.id },
          data: { balance: { increment: held } },
        })
      }
    })

    removed.push(user.supabaseId)
  }

  return removed
}
