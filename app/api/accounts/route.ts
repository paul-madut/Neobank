import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import type { GetAccountsResponse } from '@/types/account'

export async function GET(request: Request) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find user in database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: {
        accounts: {
          where: {
            status: 'ACTIVE',
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        externalAccounts: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    if (!dbUser) {
      return NextResponse.json({
        internalAccount: null,
        externalAccounts: [],
      })
    }

    // Get the first (primary) internal account
    const internalAccount = dbUser.accounts[0] || null

    // Serialize accounts (convert Decimal to string)
    const serializedInternalAccount = internalAccount
      ? {
          ...internalAccount,
          balance: internalAccount.balance.toString(),
        }
      : null

    const serializedExternalAccounts = dbUser.externalAccounts.map((account) => ({
      ...account,
      availableBalance: account.availableBalance?.toString() || null,
      currentBalance: account.currentBalance?.toString() || null,
      // Don't expose access token to client
      plaidAccessToken: undefined,
    }))

    const response: GetAccountsResponse = {
      internalAccount: serializedInternalAccount,
      externalAccounts: serializedExternalAccounts,
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error in get accounts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get accounts' },
      { status: 500 }
    )
  }
}
