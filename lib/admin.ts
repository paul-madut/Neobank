import { prisma } from './prisma'
import { createClient } from './supabase-server'
import type { User } from '@prisma/client'

/**
 * Resolve the signed-in admin, or null.
 *
 * `isAdmin` existed on the User model from the start and was read nowhere, so
 * transfers held for review had no way to ever be approved. Every admin surface
 * goes through this one function; there is no client-side-only admin check
 * anywhere, because that would not be a check.
 */
export async function getAdminUser(): Promise<User | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  })

  if (!dbUser || !dbUser.isAdmin) return null

  return dbUser
}
