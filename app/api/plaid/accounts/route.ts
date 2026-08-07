import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { getBalances } from '@/lib/plaid-utils'
import { serverError } from '@/lib/api-utils'

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
        externalAccounts: true,
      },
    })

    if (!dbUser) {
      return NextResponse.json({ externalAccounts: [] })
    }

    // Optionally refresh balances from Plaid
    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get('refresh') === 'true'

    let accounts = dbUser.externalAccounts

    if (refresh && accounts.length > 0) {
      // One Plaid item can back several accounts, and accountsGet returns all
      // of them, so hit each distinct access token once.
      const accessTokens = [
        ...new Set(accounts.map((account) => account.plaidAccessToken)),
      ]

      // Refresh balances for each token
      for (const accessToken of accessTokens) {
        try {
          const balances = await getBalances(accessToken)

          // Update balances in database
          await Promise.all(
            balances.map((balance) =>
              prisma.externalAccount.updateMany({
                where: {
                  plaidAccountId: balance.accountId,
                  userId: dbUser.id,
                },
                data: {
                  availableBalance: balance.availableBalance?.toString() || null,
                  currentBalance: balance.currentBalance?.toString() || null,
                  lastSynced: new Date(),
                },
              })
            )
          )
        } catch (error) {
          console.error('Error refreshing balances for token:', error)
        }
      }

      // Refetch accounts with updated balances
      const updatedUser = await prisma.user.findUnique({
        where: { supabaseId: user.id },
        include: {
          externalAccounts: true,
        },
      })

      accounts = updatedUser?.externalAccounts || []
    }

    // Convert Decimal to string for JSON serialization
    const serializedAccounts = accounts.map((account) => ({
      ...account,
      availableBalance: account.availableBalance?.toString() || null,
      currentBalance: account.currentBalance?.toString() || null,
      // Don't expose access token to client
      plaidAccessToken: undefined,
    }))

    return NextResponse.json({ externalAccounts: serializedAccounts })
  } catch (error) {
    return serverError('plaid/accounts', error)
  }
}
