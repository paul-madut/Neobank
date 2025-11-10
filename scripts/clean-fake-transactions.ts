import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// These are the fake transaction descriptions from seed-transactions.ts
const FAKE_TRANSACTION_DESCRIPTIONS = [
  'Initial Account Opening Deposit',
  'Payroll Deposit - Employer Inc',
  'ATM Withdrawal - Chase Bank',
  'Coffee Roasters - Debit Card Purchase',
  'Rent Payment - Property Management',
  'Freelance Payment - Client Services',
  'Grocery Store - Debit Card Purchase',
  'Venmo Transfer In',
  'Netflix Subscription',
  'Restaurant - Dinner',
  'Tax Refund',
  'Transfer from External Account',
]

async function cleanFakeTransactions(userEmail?: string) {
  console.log('🧹 Starting cleanup of fake/seeded transactions...\n')

  try {
    // Build the where clause
    const whereClause: any = {
      description: {
        in: FAKE_TRANSACTION_DESCRIPTIONS,
      },
    }

    // If user email provided, only delete for that user
    if (userEmail) {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
      })

      if (!user) {
        console.error(`❌ User with email ${userEmail} not found`)
        return
      }

      whereClause.userId = user.id
      console.log(`🎯 Targeting user: ${userEmail}`)
    } else {
      console.log('🎯 Targeting ALL users')
    }

    // Find fake transactions
    const fakeTransactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        ledgerEntries: true,
      },
    })

    if (fakeTransactions.length === 0) {
      console.log('✅ No fake transactions found. Database is clean!')
      return
    }

    console.log(`📊 Found ${fakeTransactions.length} fake transactions to delete\n`)

    // Delete transactions and related data
    for (const tx of fakeTransactions) {
      console.log(`  🗑️  Deleting: ${tx.description} ($${tx.amount})`)

      await prisma.$transaction(async (prismaClient) => {
        // Delete ledger entries first (foreign key constraint)
        await prismaClient.ledgerEntry.deleteMany({
          where: { transactionId: tx.id },
        })

        // Delete the transaction
        await prismaClient.transaction.delete({
          where: { id: tx.id },
        })
      })
    }

    console.log(`\n✅ Successfully deleted ${fakeTransactions.length} fake transactions!`)

    // Recalculate account balances based on remaining ledger entries
    console.log('\n📊 Recalculating account balances...')

    const accounts = await prisma.account.findMany({
      include: {
        ledgerEntries: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    for (const account of accounts) {
      if (account.ledgerEntries.length > 0) {
        const correctBalance = account.ledgerEntries[0].balanceAfter

        await prisma.account.update({
          where: { id: account.id },
          data: { balance: correctBalance },
        })

        console.log(
          `  ✅ Updated account ${account.accountNumber}: $${correctBalance}`
        )
      } else {
        // No ledger entries, reset to 0
        await prisma.account.update({
          where: { id: account.id },
          data: { balance: 0 },
        })

        console.log(`  ✅ Reset account ${account.accountNumber} to $0.00`)
      }
    }

    console.log('\n🎉 Cleanup complete! All fake transactions removed.\n')
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  }
}

// Main execution
async function main() {
  const userEmail = process.argv[2]

  try {
    await cleanFakeTransactions(userEmail)
  } catch (error) {
    console.error('❌ Cleanup failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
