// Quick script to test database connection
// Run with: node scripts/test-db-connection.js

const { PrismaClient } = require('@prisma/client')

async function testConnection() {
  console.log('🔍 Testing database connection...\n')

  const prisma = new PrismaClient()

  try {
    // Try to connect
    await prisma.$connect()
    console.log('✅ Database connection successful!\n')

    // Try a simple query
    const userCount = await prisma.user.count()
    console.log(`📊 Database has ${userCount} users\n`)

    console.log('✅ Everything is working correctly!')
  } catch (error) {
    console.error('❌ Database connection failed!\n')
    console.error('Error:', error.message, '\n')

    if (error.message.includes('Authentication failed')) {
      console.log('💡 Fix: Your database credentials are incorrect.')
      console.log('   Check your DATABASE_URL in .env file\n')
    } else if (error.message.includes('Can\'t reach database')) {
      console.log('💡 Fix: Database server is not running or unreachable.')
      console.log('   - For local PostgreSQL: Start the PostgreSQL service')
      console.log('   - For Supabase: Check your internet connection\n')
    } else {
      console.log('💡 See DATABASE_SETUP_FIX.md for help\n')
    }
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
