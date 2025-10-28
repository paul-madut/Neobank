import { PrismaClient } from '@prisma/client'
import { generateAccountNumber } from '../lib/plaid-utils'

const prisma = new PrismaClient()

async function ensureAccount(userEmail: string) {
  console.log(`🔍 Checking account for user: ${userEmail}`)

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: {
      accounts: {
        where: { status: 'ACTIVE' },
      },
    },
  })

  if (!user) {
    throw new Error(`User with email ${userEmail} not found`)
  }

  if (user.accounts.length > 0) {
    console.log(`✅ User already has ${user.accounts.length} account(s)`)
    user.accounts.forEach((acc) => {
      console.log(
        `   - ${acc.accountType}: ${acc.accountNumber} (Balance: $${acc.balance})`
      )
    })
    return
  }

  console.log(`📝 Creating checking account for user...`)

  const account = await prisma.account.create({
    data: {
      userId: user.id,
      accountType: 'CHECKING',
      accountNumber: generateAccountNumber(),
      routingNumber: '021000021', // Mock routing number
      balance: 0,
      currency: 'USD',
      status: 'ACTIVE',
    },
  })

  console.log(`✅ Created account: ${account.accountNumber}`)
  console.log(`💰 Initial balance: $${account.balance}`)
  console.log(`\n🎉 Account setup complete!\n`)
}

async function main() {
  const userEmail = process.argv[2]

  if (!userEmail) {
    console.error('❌ Error: Please provide a user email address')
    console.log('\nUsage: pnpm tsx scripts/ensure-account.ts <user-email>')
    console.log('Example: pnpm tsx scripts/ensure-account.ts user@example.com\n')
    process.exit(1)
  }

  try {
    await ensureAccount(userEmail)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
