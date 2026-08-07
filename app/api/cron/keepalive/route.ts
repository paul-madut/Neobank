import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { serverError, unauthorized } from '@/lib/api-utils'

/**
 * Keeps the free-tier Supabase project awake.
 *
 * Supabase pauses a free project after 7 days with no database activity, and a
 * paused project means the deployed demo answers with connection errors. For a
 * portfolio app the failure lands exactly when it matters: a recruiter opens
 * the link weeks after it was sent. A daily cron (declared in vercel.json)
 * calls this route, and this route runs real SQL, which is what resets the
 * inactivity clock. Returning JSON without querying would keep the route green
 * and let the database pause anyway.
 */

/**
 * Vercel's cron scheduler sends `Authorization: Bearer $CRON_SECRET` on every
 * invocation once CRON_SECRET is set as a project environment variable.
 *
 * This FAILS CLOSED when CRON_SECRET is missing. An unset secret leaves nothing
 * to verify against, and the alternative - running unauthenticated - would put
 * a public URL on the internet that opens a database connection on every hit,
 * which is a free rate-limit-free way to burn the project's connection pool.
 * A 401 while misconfigured is a cheap, loud failure; an open endpoint is not.
 */
function isAuthorizedCronRequest(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return false
  }

  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) {
    return false
  }

  return secureCompare(header.slice('Bearer '.length), expected)
}

/**
 * `timingSafeEqual` throws when the two buffers differ in length, and guarding
 * that with a plain length check would leak the secret's length through timing.
 * Hashing both sides first sidesteps both problems: SHA-256 digests are always
 * 32 bytes, so the comparison is length-safe by construction and stays constant
 * time for every input.
 */
function secureCompare(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a).digest()
  const digestB = createHash('sha256').update(b).digest()
  return timingSafeEqual(digestA, digestB)
}

/**
 * Route handlers are already dynamic by default in App Router 16, and reading
 * the Authorization header would opt this one out of any caching regardless.
 * `force-dynamic` is therefore belt and braces - but it is the cheap kind: it
 * pins the one property this route cannot afford to lose, so that a later
 * refactor (dropping the header read, turning on cacheComponents) cannot
 * silently turn the cron into a cached response that never reaches Postgres.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return unauthorized()
  }

  try {
    // Two touches on purpose. `SELECT 1` is the cheapest possible round trip
    // and proves the connection is genuinely live. The count then reads a real
    // table through the query planner, so Supabase records actual database
    // activity rather than just a connection handshake.
    await prisma.$queryRaw`SELECT 1`
    await prisma.user.count()

    // Deliberately bare. Anyone can guess this URL, so a response says only
    // that something answered - no row counts, table names, timings or
    // connection details.
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
  } catch (error) {
    return serverError('cron/keepalive', error)
  }
}
