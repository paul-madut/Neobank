import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client.
 *
 * The service role key bypasses Row Level Security and can create and delete
 * auth users, so this module must only ever be imported from server code. It is
 * built lazily for the same reason `lib/stripe.ts` is: `next build` imports
 * every route module to collect page data, and constructing a client with an
 * absent key at module scope would make a production build require runtime
 * secrets.
 */

let client: ReturnType<typeof createClient> | null = null

export function createAdminClient() {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for admin operations'
    )
  }

  client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return client
}

/** Whether the service role key is configured. Lets callers degrade gracefully. */
export function hasAdminCredentials(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}
