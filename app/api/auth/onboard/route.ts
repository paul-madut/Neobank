import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { generateAccountNumber } from '@/lib/plaid-utils'

export async function POST(request: Request) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: { accounts: true },
    })

    if (existingUser && existingUser.accounts.length > 0) {
      return NextResponse.json({
        message: 'User already onboarded',
        user: existingUser,
      })
    }

    // Create user and internal account in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create or update user
      const dbUser = await tx.user.upsert({
        where: { supabaseId: user.id },
        update: {
          email: user.email!,
        },
        create: {
          supabaseId: user.id,
          email: user.email!,
          firstName: user.user_metadata?.full_name?.split(' ')[0] || null,
          lastName: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || null,
        },
      })

      // Check if account already exists
      const existingAccount = await tx.account.findFirst({
        where: { userId: dbUser.id },
      })

      if (existingAccount) {
        return { user: dbUser, account: existingAccount }
      }

      // Create internal checking account
      const account = await tx.account.create({
        data: {
          userId: dbUser.id,
          accountType: 'CHECKING',
          accountNumber: generateAccountNumber(),
          routingNumber: '021000021', // Mock routing number
          balance: 0,
          currency: 'USD',
          status: 'ACTIVE',
        },
      })

      return { user: dbUser, account }
    })

    return NextResponse.json({
      success: true,
      message: 'User onboarded successfully',
      user: result.user,
      account: {
        ...result.account,
        balance: result.account.balance.toString(),
      },
    })
  } catch (error: any) {
    console.error('Error in onboard:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to onboard user' },
      { status: 500 }
    )
  }
}
