import { Prisma, type Account, type User } from '@prisma/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { prisma } from './prisma'
import { generateAccountNumber } from './plaid-utils'

/**
 * Turning a Supabase auth user into a NeoBank customer.
 *
 * Supabase owns identity; Postgres owns the money. A session with no matching
 * `User` row is the worst of both worlds - the app looks signed in and then
 * every API call 404s - so provisioning has to happen at the one moment both
 * facts are true: the session exists and the request is on the server. That
 * moment is `app/auth/callback/route.ts`, which both the email-confirmation
 * link and the OAuth redirect pass through.
 *
 * It therefore runs on every sign-in, not just the first, and must be a no-op
 * the other 99% of the time.
 */

/** Mock routing number. Every internal account shares it. */
const ROUTING_NUMBER = '021000021'

/** `generateAccountNumber` is timestamp + random, so a collision is possible. */
const ACCOUNT_NUMBER_ATTEMPTS = 5

/** Namespace for the per-user advisory lock, so it cannot collide with another feature's. */
const PROVISIONING_LOCK_NAMESPACE = BigInt(0x9e01)

/** Account types a customer can actually own. `SYSTEM` accounts have no owner. */
const CUSTOMER_ACCOUNT_TYPES: Account['accountType'][] = ['CHECKING', 'SAVINGS']

export interface ProvisionedUser {
  user: User
  account: Account
  /** True only when this call created the account. Useful for logging, not for control flow. */
  created: boolean
}

/**
 * Derive a stable 63-bit advisory lock key from a Supabase user id.
 *
 * FNV-1a over the id, namespaced. Two tabs signing in at once then serialise on
 * the same key instead of racing to create two checking accounts for one user.
 */
function provisioningLockKey(supabaseId: string): bigint {
  let hash = 0x811c9dc5
  for (let i = 0; i < supabaseId.length; i++) {
    hash ^= supabaseId.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (PROVISIONING_LOCK_NAMESPACE << BigInt(32)) | BigInt(hash >>> 0)
}

/** Split an OAuth `full_name` into the two columns the schema actually has. */
function splitName(fullName: unknown): {
  firstName: string | null
  lastName: string | null
} {
  if (typeof fullName !== 'string') return { firstName: null, lastName: null }

  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: null, lastName: null }

  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
  }
}

function isUniqueViolation(error: unknown, field?: string) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false
  }

  if (!field) return true

  const target = error.meta?.target
  if (Array.isArray(target)) return target.includes(field)
  return typeof target === 'string' && target.includes(field)
}

/** Read back an already-provisioned user, or null if there is nothing to read. */
async function findProvisioned(
  supabaseId: string
): Promise<ProvisionedUser | null> {
  const user = await prisma.user.findUnique({
    where: { supabaseId },
    include: {
      accounts: {
        where: { accountType: { in: CUSTOMER_ACCOUNT_TYPES } },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  })

  if (!user?.accounts[0]) return null

  const { accounts, ...rest } = user
  return { user: rest, account: accounts[0], created: false }
}

/**
 * Ensure the Supabase user has a `User` row and a customer checking account.
 *
 * Idempotent: safe to call on every sign-in and safe to call concurrently.
 * Throws only when provisioning genuinely could not complete - callers should
 * treat that as a failed sign-in rather than letting the user through.
 */
export async function provisionUser(
  supabaseUser: SupabaseUser
): Promise<ProvisionedUser> {
  const email = supabaseUser.email

  if (!email) {
    throw new Error(
      `Cannot provision Supabase user ${supabaseUser.id}: no email address`
    )
  }

  const { firstName, lastName } = splitName(
    supabaseUser.user_metadata?.full_name ?? supabaseUser.user_metadata?.name
  )
  const lockKey = provisioningLockKey(supabaseUser.id)

  for (let attempt = 1; attempt <= ACCOUNT_NUMBER_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Serialise every concurrent provisioning attempt for this one user.
        // Transaction-scoped, so it is released on commit or rollback and is
        // safe behind a transaction-pooling connection pooler.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lockKey})`

        const user = await tx.user.upsert({
          where: { supabaseId: supabaseUser.id },
          update: { email },
          create: {
            supabaseId: supabaseUser.id,
            email,
            firstName,
            lastName,
          },
        })

        // Never match a SYSTEM house account here - those have no owner, but a
        // filter on userId alone would still be one schema change away from
        // handing a customer the ACH settlement account.
        const existingAccount = await tx.account.findFirst({
          where: {
            userId: user.id,
            accountType: { in: CUSTOMER_ACCOUNT_TYPES },
          },
          orderBy: { createdAt: 'asc' },
        })

        if (existingAccount) {
          return { user, account: existingAccount, created: false }
        }

        const account = await tx.account.create({
          data: {
            userId: user.id,
            accountType: 'CHECKING',
            accountNumber: generateAccountNumber(),
            routingNumber: ROUTING_NUMBER,
            balance: 0,
            currency: 'USD',
            status: 'ACTIVE',
          },
        })

        return { user, account, created: true }
      })
    } catch (error) {
      // Two different account numbers happened to land in the same millisecond
      // with the same random suffix. Draw another one.
      if (
        isUniqueViolation(error, 'accountNumber') &&
        attempt < ACCOUNT_NUMBER_ATTEMPTS
      ) {
        continue
      }

      // Belt and braces: if anything still slipped past the advisory lock, the
      // row the other writer committed is the correct answer.
      if (isUniqueViolation(error)) {
        const existing = await findProvisioned(supabaseUser.id)
        if (existing) return existing
      }

      throw error
    }
  }

  throw new Error(
    `Could not allocate a unique account number for user ${supabaseUser.id} after ${ACCOUNT_NUMBER_ATTEMPTS} attempts`
  )
}
