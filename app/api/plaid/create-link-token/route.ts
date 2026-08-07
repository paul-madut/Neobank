import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { createLinkToken } from '@/lib/plaid-utils'
import type { CreateLinkTokenResponse } from '@/types/account'
import { serverError } from '@/lib/api-utils'

export async function POST() {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check KYC status
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      select: { kycStatus: true, firstName: true, lastName: true },
    })

    if (!dbUser || dbUser.kycStatus !== 'VERIFIED') {
      return NextResponse.json(
        { error: 'KYC verification required', code: 'KYC_REQUIRED' },
        { status: 403 }
      )
    }

    // Plaid matches legal_name against the name on the bank account being
    // linked, so send the name we hold on file rather than the email address.
    const legalName = [dbUser.firstName, dbUser.lastName]
      .filter(Boolean)
      .join(' ')

    const { linkToken, expiration } = await createLinkToken(
      user.id,
      legalName || undefined
    )

    const response: CreateLinkTokenResponse = {
      linkToken,
      expiration,
    }

    return NextResponse.json(response)
  } catch (error) {
    return serverError('plaid/create-link-token', error)
  }
}
