import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'

/**
 * Row Level Security drift guard.
 *
 * The RLS migration enables RLS on every table that existed when it was
 * written. A table added by a LATER migration gets nothing: `ALTER DEFAULT
 * PRIVILEGES` keeps anon and authenticated from being granted on it, but
 * nothing turns RLS on, so it would ship as the one unprotected table in an
 * otherwise locked-down schema.
 *
 * That is exactly the kind of gap nobody notices, so it is asserted here rather
 * than written down as a checklist item. If this fails, add the missing
 * `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` to the migration that created the
 * table.
 */
describe('row level security coverage', () => {
  it('has RLS enabled on every table in the public schema', async () => {
    const rows = await prisma.$queryRaw<
      { tablename: string; rowsecurity: boolean }[]
    >`
      SELECT c.relname AS tablename, c.relrowsecurity AS rowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname NOT LIKE '\\_prisma%'
      ORDER BY c.relname
    `

    expect(rows.length).toBeGreaterThan(0)

    const unprotected = rows
      .filter((row) => !row.rowsecurity)
      .map((row) => row.tablename)

    expect(unprotected).toEqual([])
  })

  it('does not force RLS, because the app connects as the table owner', async () => {
    // Prisma connects as owner and carries no PostgREST JWT, so auth.uid() is
    // NULL for it. Forcing RLS would make every policy predicate evaluate to
    // NULL and every read return zero rows. The owner bypass is load bearing.
    const rows = await prisma.$queryRaw<
      { tablename: string; forced: boolean }[]
    >`
      SELECT c.relname AS tablename, c.relforcerowsecurity AS forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname NOT LIKE '\\_prisma%'
    `

    expect(rows.filter((row) => row.forced).map((r) => r.tablename)).toEqual([])
  })

  it('still lets the application read and write as owner', async () => {
    // The counterpart to the assertion above: prove the owner bypass actually
    // works, so a future FORCE would fail loudly here rather than in production.
    const account = await prisma.account.findFirst()
    expect(account === null || typeof account.id === 'string').toBe(true)

    const probe = await prisma.processedWebhookEvent.create({
      data: { provider: 'plaid', eventId: `rls-probe-${Date.now()}` },
    })
    expect(probe.id).toBeTruthy()
  })
})
