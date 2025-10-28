import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

interface SeedTransactionData {
  amount: number
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'FEE'
  description: string
  daysAgo: number
  status?: 'PENDING' | 'COMPLETED' | 'FAILED'
}

const SAMPLE_TRANSACTIONS: SeedTransactionData[] = [
  {
    amount: 1000.0,
    type: 'DEPOSIT',
    description: 'Initial Account Opening Deposit',
    daysAgo: 30,
    status: 'COMPLETED',
  },
  {
    amount: 500.0,
    type: 'DEPOSIT',
    description: 'Payroll Deposit - Employer Inc',
    daysAgo: 25,
    status: 'COMPLETED',
  },
  {
    amount: 50.0,
    type: 'WITHDRAWAL',
    description: 'ATM Withdrawal - Chase Bank',
    daysAgo: 22,
    status: 'COMPLETED',
  },
  {
    amount: 25.99,
    type: 'WITHDRAWAL',
    description: 'Coffee Roasters - Debit Card Purchase',
    daysAgo: 20,
    status: 'COMPLETED',
  },
  {
    amount: 100.0,
    type: 'WITHDRAWAL',
    description: 'Rent Payment - Property Management',
    daysAgo: 18,
    status: 'COMPLETED',
  },
  {
    amount: 200.0,
    type: 'DEPOSIT',
    description: 'Freelance Payment - Client Services',
    daysAgo: 15,
    status: 'COMPLETED',
  },
  {
    amount: 75.5,
    type: 'WITHDRAWAL',
    description: 'Grocery Store - Debit Card Purchase',
    daysAgo: 12,
    status: 'COMPLETED',
  },
  {
    amount: 150.0,
    type: 'DEPOSIT',
    description: 'Venmo Transfer In',
    daysAgo: 10,
    status: 'COMPLETED',
  },
  {
    amount: 12.99,
    type: 'WITHDRAWAL',
    description: 'Netflix Subscription',
    daysAgo: 8,
    status: 'COMPLETED',
  },
  {
    amount: 45.0,
    type: 'WITHDRAWAL',
    description: 'Restaurant - Dinner',
    daysAgo: 5,
    status: 'COMPLETED',
  },
  {
    amount: 300.0,
    type: 'DEPOSIT',
    description: 'Tax Refund',
    daysAgo: 3,
    status: 'COMPLETED',
  },
  {
    amount: 100.0,
    type: 'DEPOSIT',
    description: 'Transfer from External Account',
    daysAgo: 1,
    status: 'PENDING',
  },
]

async function seedTransactions(userEmail: string) {
  console.log(`🌱 Starting transaction seed for user: ${userEmail}`)

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: {
      accounts: {
        where: { status: 'ACTIVE' },
        take: 1,
      },
    },
  })

  if (!user) {
    throw new Error(`User with email ${userEmail} not found`)
  }

  if (!user.accounts[0]) {
    throw new Error(`No active account found for user ${userEmail}`)
  }

  const account = user.accounts[0]
  console.log(`✅ Found user: ${user.email}`)
  console.log(`✅ Found account: ${account.accountNumber}`)
  console.log(`💰 Current balance: $${account.balance}`)

  // Check if transactions already exist
  const existingTransactions = await prisma.transaction.count({
    where: {
      userId: user.id,
      description: {
        in: SAMPLE_TRANSACTIONS.map((t) => t.description),
      },
    },
  })

  if (existingTransactions > 0) {
    console.log(
      `⚠️  Found ${existingTransactions} existing seed transactions. Skipping seed.`
    )
    console.log(
      `💡 To re-seed, delete existing transactions first or use different descriptions.`
    )
    return
  }

  console.log(`\n📝 Creating ${SAMPLE_TRANSACTIONS.length} transactions...\n`)

  let runningBalance = parseFloat(account.balance.toString())

  // Create transactions one by one to avoid transaction timeout
  for (const txData of SAMPLE_TRANSACTIONS) {
    const transactionDate = new Date()
    transactionDate.setDate(transactionDate.getDate() - txData.daysAgo)

    // Calculate balance change
    const isDeposit = txData.type === 'DEPOSIT'
    const balanceChange = isDeposit ? txData.amount : -txData.amount
    const newBalance = runningBalance + balanceChange

    // Generate idempotency key
    const idempotencyKey = uuidv4()

    console.log(
      `  ${isDeposit ? '💵' : '💸'} ${txData.type}: ${txData.description}`
    )
    console.log(
      `     Amount: $${txData.amount.toFixed(2)} | Balance: $${runningBalance.toFixed(2)} → $${newBalance.toFixed(2)}`
    )

    // Use individual transaction for each entry to avoid timeout
    await prisma.$transaction(async (tx) => {
      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          fromAccountId: isDeposit ? null : account.id,
          toAccountId: isDeposit ? account.id : null,
          amount: txData.amount,
          currency: 'USD',
          type: txData.type,
          status: txData.status || 'COMPLETED',
          description: txData.description,
          idempotencyKey,
          createdAt: transactionDate,
          updatedAt: transactionDate,
        },
      })

      // Create ledger entry (double-entry bookkeeping)
      if (isDeposit) {
        // DEPOSIT: Credit the account (increases balance)
        await tx.ledgerEntry.create({
          data: {
            accountId: account.id,
            transactionId: transaction.id,
            entryType: 'CREDIT',
            amount: txData.amount,
            balanceAfter: newBalance,
            description: txData.description,
            createdAt: transactionDate,
          },
        })
      } else {
        // WITHDRAWAL/FEE: Debit the account (decreases balance)
        await tx.ledgerEntry.create({
          data: {
            accountId: account.id,
            transactionId: transaction.id,
            entryType: 'DEBIT',
            amount: txData.amount,
            balanceAfter: newBalance,
            description: txData.description,
            createdAt: transactionDate,
          },
        })
      }

      // Update account balance
      await tx.account.update({
        where: { id: account.id },
        data: { balance: newBalance },
      })
    })

    runningBalance = newBalance
  }

  console.log(`\n✅ Successfully created ${SAMPLE_TRANSACTIONS.length} transactions!`)
  console.log(`💰 Final balance: $${runningBalance.toFixed(2)}`)
  console.log(`\n🎉 Seed complete!\n`)
}

// Main execution
async function main() {
  const userEmail = process.argv[2]

  if (!userEmail) {
    console.error('❌ Error: Please provide a user email address')
    console.log('\nUsage: pnpm tsx scripts/seed-transactions.ts <user-email>')
    console.log('Example: pnpm tsx scripts/seed-transactions.ts user@example.com\n')
    process.exit(1)
  }

  try {
    await seedTransactions(userEmail)
  } catch (error) {
    console.error('❌ Error seeding transactions:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
