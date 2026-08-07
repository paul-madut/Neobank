import { readdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { afterAll, beforeAll, beforeEach } from 'vitest'

/**
 * Test database.
 *
 * These are integration tests, not unit tests with a mocked Prisma client. The
 * bugs they exist to catch - lost updates, constraint violations, idempotency
 * races - live in the database's concurrency semantics, and a mock that returns
 * whatever the test author expected would prove nothing about any of them.
 *
 * Two backends:
 *
 *   TEST_DATABASE_URL set  -> a real Postgres. This is what CI uses, and it is
 *                             the only backend that can run the true-concurrency
 *                             test, since it supports more than one connection.
 *   unset                  -> PGlite, a WASM build of Postgres that runs in
 *                             process. Real Postgres semantics including CHECK
 *                             constraints and row locking, no Docker, no
 *                             install. It serves a single connection, so the
 *                             connection pool is pinned to 1 and genuinely
 *                             parallel transactions are skipped.
 */

const MIGRATIONS_DIR = resolve(process.cwd(), 'prisma/migrations')

/**
 * Every migration, in the order Prisma would apply them.
 *
 * Applying only the initial migration would mean later ones are never
 * exercised by the suite, so a migration that fails on a plain (non-Supabase)
 * Postgres - the Row Level Security one is the obvious candidate, since anon,
 * authenticated and auth.uid() do not exist here - would sail through CI and
 * only break on a real deploy.
 */
function loadMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => join(MIGRATIONS_DIR, name, 'migration.sql'))
    .map((path) => readFileSync(path, 'utf8'))
}

const externalUrl = process.env.TEST_DATABASE_URL

/** True when the backend can serve more than one simultaneous connection. */
export const supportsConcurrentConnections = Boolean(externalUrl)

// Pick the port before anything imports lib/prisma, because PrismaClient reads
// DATABASE_URL when it is constructed at module load, not when it first queries.
const port = 5500 + Math.floor(Math.random() * 400)

if (externalUrl) {
  process.env.DATABASE_URL = externalUrl
  process.env.DIRECT_URL = externalUrl
} else {
  const url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?connection_limit=1`
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = url
}

// Values the transfer code reads at module load.
process.env.MAX_TRANSFER_AMOUNT ??= '10000'
process.env.DAILY_TRANSFER_LIMIT ??= '25000'
process.env.PENDING_REVIEW_THRESHOLD ??= '5000'
process.env.PLAID_ENV ??= 'sandbox'

type Teardown = () => Promise<void>
let teardown: Teardown = async () => {}

beforeAll(async () => {
  const migrations = loadMigrations()

  if (externalUrl) {
    const { prisma } = await import('@/lib/prisma')
    await resetSchema(prisma)
    for (const sql of migrations) {
      await prisma.$executeRawUnsafe(sql)
    }
    teardown = async () => {
      await prisma.$disconnect()
    }
    return
  }

  const { PGlite } = await import('@electric-sql/pglite')
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket')

  const db = await PGlite.create()
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' })
  await server.start()
  for (const sql of migrations) {
    await db.exec(sql)
  }

  teardown = async () => {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$disconnect()
    await server.stop()
    await db.close()
  }
}, 60_000)

beforeEach(async () => {
  const { prisma } = await import('@/lib/prisma')
  // Truncate rather than drop and recreate: much faster, and RESTART IDENTITY
  // plus CASCADE leaves the schema and its constraints intact, which is the
  // whole point of testing against a real engine.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "LedgerEntry", "ACHTransfer", "Transaction", "Card",
      "ExternalAccount", "Account", "User", "ProcessedWebhookEvent"
    RESTART IDENTITY CASCADE
  `)

  const { __resetRateLimits } = await import('@/lib/rate-limit')
  __resetRateLimits()
})

afterAll(async () => {
  await teardown()
})

async function resetSchema(prisma: {
  $executeRawUnsafe: (sql: string) => Promise<unknown>
}) {
  await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE')
  await prisma.$executeRawUnsafe('CREATE SCHEMA public')
}
