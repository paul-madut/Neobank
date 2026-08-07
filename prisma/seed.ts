import { prisma } from '../lib/prisma'
import {
  DEMO_SEED_EMAIL,
  ensureDemoContacts,
  seedDemoDataFor,
} from '../lib/demo'
import { getSystemAccount } from '../lib/ledger'
import { generateAccountNumber } from '../lib/plaid-utils'

/**
 * Database seed, run by `pnpm prisma db seed`.
 *
 * Idempotent: every step checks before it writes, so re-running is safe and
 * will not duplicate anything or double-post the ledger.
 *
 * Creates:
 *   - both system (house) settlement accounts
 *   - a set of KYC-verified demo contacts to send money to
 *   - a canonical demo customer with ~3 months of history, a card and a linked
 *     external bank
 *
 * The one-click demo on the landing page does NOT use the canonical customer -
 * it clones this same data into a throwaway per-visitor account. This one exists
 * so a freshly cloned repo has something to look at immediately, and so the
 * seed path itself is exercised.
 */
async function main() {
  console.log('Seeding NeoBank demo data')

  // House accounts. Created lazily by the app too, but seeding them means a
  // fresh database has a complete, inspectable chart of accounts from the off.
  await prisma.$transaction(async (tx) => {
    await getSystemAccount(tx, 'ACH_SETTLEMENT')
    await getSystemAccount(tx, 'CARD_SETTLEMENT')
  })
  console.log('  system settlement accounts ready')

  await ensureDemoContacts()
  console.log('  demo contacts ready')

  const existing = await prisma.user.findUnique({
    where: { email: DEMO_SEED_EMAIL },
    include: {
      accounts: {
        where: { accountType: { in: ['CHECKING', 'SAVINGS'] } },
        take: 1,
      },
    },
  })

  let userId: string
  let accountId: string

  if (existing?.accounts[0]) {
    userId = existing.id
    accountId = existing.accounts[0].id
    console.log('  canonical demo customer already exists')
  } else {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: DEMO_SEED_EMAIL },
        update: { kycStatus: 'VERIFIED' },
        create: {
          // Not a Supabase identity. This customer is for inspection and for
          // the scripts; visitors get their own account via /api/demo/login.
          supabaseId: `demo-seed-${DEMO_SEED_EMAIL}`,
          email: DEMO_SEED_EMAIL,
          firstName: 'Alex',
          lastName: 'Demo',
          kycStatus: 'VERIFIED',
        },
      })

      const account =
        (await tx.account.findFirst({
          where: { userId: user.id, accountType: 'CHECKING' },
        })) ??
        (await tx.account.create({
          data: {
            userId: user.id,
            accountType: 'CHECKING',
            accountNumber: generateAccountNumber(),
            balance: 0,
            currency: 'USD',
            status: 'ACTIVE',
          },
        }))

      return { userId: user.id, accountId: account.id }
    })

    userId = result.userId
    accountId = result.accountId
    console.log('  canonical demo customer created')
  }

  const { created, skipped } = await seedDemoDataFor({ userId, accountId })

  if (skipped) {
    console.log('  history already present, nothing to post')
  } else {
    console.log(`  posted ${created} transactions with balanced ledger entries`)
  }

  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
  })
  console.log(`  demo balance: $${account.balance.toFixed(2)}`)

  // The invariant this whole codebase is built around, asserted at seed time.
  const all = await prisma.account.findMany({ select: { balance: true } })
  const total = all.reduce((sum, a) => sum.add(a.balance), account.balance.sub(account.balance))
  console.log(`  sum of all balances (must be 0): ${total.toFixed(2)}`)

  if (!total.isZero()) {
    throw new Error(
      `Ledger does not balance after seeding: total is ${total.toFixed(4)}`
    )
  }

  console.log('Seed complete')
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
