import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createLinkToken } from '@/lib/plaid-utils'
import type { CreateLinkTokenResponse } from '@/types/account'

export async function POST(request: Request) {
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

    // Create link token
    const { linkToken, expiration } = await createLinkToken(
      user.id,
      user.email || 'User'
    )

    const response: CreateLinkTokenResponse = {
      linkToken,
      expiration,
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error in create-link-token:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create link token' },
      { status: 500 }
    )
  }
}
