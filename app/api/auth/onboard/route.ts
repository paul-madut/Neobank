import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { provisionUser } from '@/lib/provisioning'
import { serverError, unauthorized } from '@/lib/api-utils'

/**
 * Manual re-provisioning hook.
 *
 * The primary path is `app/auth/callback/route.ts`, which provisions on every
 * sign-in. This endpoint exists for sessions that predate that fix and for
 * support tooling; it shares the same idempotent implementation, so calling it
 * on an already-provisioned user is a no-op.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return unauthorized()
    }

    const { user: dbUser, account, created } = await provisionUser(user)

    return NextResponse.json({
      success: true,
      message: created ? 'User onboarded successfully' : 'User already onboarded',
      user: dbUser,
      account: {
        ...account,
        balance: account.balance.toString(),
      },
    })
  } catch (error) {
    return serverError('auth/onboard', error)
  }
}
