import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient, hasAdminCredentials } from '@/lib/supabase-admin'
import {
  DEMO_EMAIL_DOMAIN,
  DEMO_TTL_HOURS,
  cleanupExpiredDemoAccounts,
  createDemoCustomer,
} from '@/lib/demo'
import { serverError, tooManyRequests } from '@/lib/api-utils'
import { rateLimit } from '@/lib/rate-limit'

/**
 * One-click demo sign-in.
 *
 * WHY A FRESH ACCOUNT PER VISITOR, RATHER THAN ONE SHARED DEMO LOGIN:
 *
 * A shared demo account cannot be made safe. It is either read-only, in which
 * case the visitor cannot try the thing the app is actually about, or it is
 * writable, in which case the first person to drain the balance or freeze the
 * card leaves the next recruiter looking at a broken dashboard. Resetting on a
 * schedule only narrows that window, it does not close it - the damage lasts
 * until the next reset.
 *
 * So each visitor gets their own throwaway customer, seeded from the same
 * generator as `prisma db seed`. Mutations are scoped by construction: there is
 * no shared row to corrupt, because the ordinary per-user authorization that
 * protects every other account protects this one too. No endpoint needs a
 * special case. The cost is a real Supabase auth user per visit, which is why
 * they carry a TTL and are cleaned up here.
 */

/** Demo creation is expensive (auth user + ~50 ledger postings). Keep it slow. */
const DEMO_RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 }

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(request: NextRequest) {
  try {
    if (!hasAdminCredentials()) {
      console.error(
        'Demo login requires SUPABASE_SERVICE_ROLE_KEY to create the throwaway user'
      )
      return NextResponse.json(
        { error: 'Demo mode is not configured on this deployment.' },
        { status: 503 }
      )
    }

    // Keyed on IP, because there is no session yet by definition.
    const limit = rateLimit(`demo:login:${clientIp(request)}`, DEMO_RATE_LIMIT)
    if (!limit.allowed) {
      return tooManyRequests(limit.retryAfterSeconds)
    }

    const admin = createAdminClient()

    // Opportunistic cleanup. Cheap, bounded, and keeps the auth table from
    // growing without a separate scheduled job.
    try {
      const expired = await cleanupExpiredDemoAccounts()
      for (const supabaseId of expired) {
        await admin.auth.admin.deleteUser(supabaseId).catch(() => undefined)
      }
      if (expired.length > 0) {
        console.log(`Cleaned up ${expired.length} expired demo account(s)`)
      }
    } catch (cleanupError) {
      // Never let cleanup failure block a visitor from seeing the demo.
      console.error('Demo cleanup failed:', cleanupError)
    }

    const email = `demo-${randomUUID()}@${DEMO_EMAIL_DOMAIN}`
    const password = randomBytes(24).toString('base64url')

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: 'Alex Demo', demo: true },
      })

    if (createError || !created.user) {
      console.error('Demo user creation failed:', createError)
      return NextResponse.json(
        { error: 'Could not start a demo session. Please try again.' },
        { status: 502 }
      )
    }

    try {
      await createDemoCustomer({
        supabaseId: created.user.id,
        email,
        firstName: 'Alex',
        lastName: 'Demo',
      })
    } catch (seedError) {
      // Do not leave an auth user behind with no customer record.
      await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined)
      throw seedError
    }

    // Sign in through the SSR client so the session cookies land on the
    // response exactly as they would for a normal login.
    const supabase = await createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      console.error('Demo sign-in failed:', signInError)
      await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined)
      return NextResponse.json(
        { error: 'Could not start a demo session. Please try again.' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      expiresInHours: DEMO_TTL_HOURS,
      redirectTo: '/dashboard',
    })
  } catch (error) {
    return serverError('demo/login', error)
  }
}
