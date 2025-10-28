import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function listUsers() {
  const users = await prisma.user.findMany({
    include: {
      accounts: {
        where: { status: 'ACTIVE' },
      },
    },
  })

  if (users.length === 0) {
    console.log('No users found in database.')
    console.log('Please register a user first at /register')
    return
  }

  console.log(`\nFound ${users.length} user(s):\n`)

  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email}`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Supabase ID: ${user.supabaseId}`)
    console.log(`   Name: ${user.firstName || 'N/A'} ${user.lastName || ''}`)
    console.log(`   Accounts: ${user.accounts.length}`)
    if (user.accounts.length > 0) {
      user.accounts.forEach((acc) => {
        console.log(
          `     - ${acc.accountType}: ${acc.accountNumber} (Balance: $${acc.balance})`
        )
      })
    }
    console.log('')
  })
}

async function main() {
  try {
    await listUsers()
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
