import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { exchangePublicToken, getAccounts, getInstitution } from '@/lib/plaid-utils'
import type { ExchangePublicTokenRequest, ExchangePublicTokenResponse } from '@/types/account'

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

    // Get request body
    const body: ExchangePublicTokenRequest = await request.json()
    const { publicToken } = body

    if (!publicToken) {
      return NextResponse.json({ error: 'Public token is required' }, { status: 400 })
    }

    // Exchange public token for access token
    const { accessToken, itemId } = await exchangePublicToken(publicToken)

    // Get accounts from Plaid
    const { accounts, item } = await getAccounts(accessToken)

    // Get institution details
    const institutionId = item.institution_id || 'unknown'
    const institution = await getInstitution(institutionId)

    // Find or create user in database
    let dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    })

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          supabaseId: user.id,
          email: user.email!,
          firstName: user.user_metadata?.full_name?.split(' ')[0] || null,
          lastName: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || null,
        },
      })
    }

    // Save external accounts to database
    const createdAccounts = await Promise.all(
      accounts.map(async (account) => {
        return prisma.externalAccount.upsert({
          where: { plaidAccountId: account.account_id },
          update: {
            availableBalance: account.balances.available?.toString() || null,
            currentBalance: account.balances.current?.toString() || null,
            lastSynced: new Date(),
          },
          create: {
            userId: dbUser!.id,
            plaidAccountId: account.account_id,
            plaidItemId: itemId,
            plaidAccessToken: accessToken,
            institutionId: institutionId,
            institutionName: institution?.name || 'Unknown Bank',
            accountName: account.name,
            officialName: account.official_name || null,
            mask: account.mask || '0000',
            type: account.type,
            subtype: account.subtype || null,
            availableBalance: account.balances.available?.toString() || null,
            currentBalance: account.balances.current?.toString() || null,
            currency: account.balances.iso_currency_code || 'USD',
          },
        })
      })
    )

    const response: ExchangePublicTokenResponse = {
      success: true,
      accountsCreated: createdAccounts.length,
      message: `Successfully linked ${createdAccounts.length} account(s)`,
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error in exchange-public-token:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to exchange public token' },
      { status: 500 }
    )
  }
}
