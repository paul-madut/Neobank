-- ============================================================================
-- Row-Level Security
-- ============================================================================
--
-- THREAT MODEL
--
-- Nothing in this app reads data through supabase-js. Every read and every
-- write goes through Prisma, over the Postgres connection string, as the
-- database owner. Supabase Auth is used for identity and sessions only.
--
-- Supabase, however, also publishes the `public` schema over PostgREST to the
-- `anon` and `authenticated` roles, and the anon key is not a secret: it ships
-- inside the client JavaScript bundle. So the attack that actually matters here
-- is not "a bug in our API route" - it is someone lifting the anon key out of
-- the bundle and going straight at the REST endpoint:
--
--     GET https://<ref>.supabase.co/rest/v1/Account?select=*
--         apikey: <the anon key from the bundle>
--
-- These tables were created by Prisma, not by the Supabase SQL editor, so they
-- arrive with no RLS at all and with whatever Supabase's default privileges
-- handed to `anon` / `authenticated`. That is the hole this migration closes.
--
-- The defence is two independent layers:
--
--   1. Privileges. Revoke every grant those two roles hold on this schema.
--      This is the PRIMARY control. RLS only filters rows a role is already
--      allowed to read; a role holding no SELECT grant at all is refused before
--      any policy is consulted, so PostgREST returns an error and never a row.
--
--   2. RLS. Enable it on every table anyway, and add ownership-scoped SELECT
--      policies. This is DEFENCE IN DEPTH, and it is the layer that matters on
--      the day someone restores a grant by hand in the Supabase dashboard
--      ("Enable read access for authenticated users" is two clicks) or a future
--      feature starts reading a table from the browser. With RLS on, the
--      failure mode of that mistake is "you can see your own rows" instead of
--      "you can see the entire ledger".
--
-- The policies below are therefore deliberately unreachable today. They are
-- there to bound the blast radius of a future mistake, not to enable anything.
--
-- ----------------------------------------------------------------------------
-- ON `FORCE ROW LEVEL SECURITY`: DELIBERATELY NOT USED.
--
-- A table's owner bypasses RLS entirely unless the table is also marked FORCE.
-- The application connects as the owner (`postgres` on Supabase), so plain
-- ENABLE ROW LEVEL SECURITY constrains every other role while leaving Prisma
-- untouched. That is exactly the shape we want: the server is the trusted path,
-- and it is where the invariants that actually protect the money live - the
-- double-entry ledger, the balance guard, the transfer limits, the idempotency
-- keys, and the per-request authorization checks.
--
-- Turning FORCE on would subject Prisma to the policies below, and that breaks
-- the application completely, not subtly:
--
--   * Prisma connects with no PostgREST JWT, so `auth.uid()` is NULL, every
--     USING clause evaluates to NULL, and every SELECT returns zero rows.
--   * There are no INSERT / UPDATE / DELETE policies at all (see below), so
--     every write the server performs would be rejected outright.
--
-- FORCE would be the correct call for an architecture where untrusted clients
-- share the same connection as trusted code, or where the app role is not the
-- owner and RLS is the only authorization layer. Neither is true here. This is
-- a decision, not an omission.
--
-- `service_role` is intentionally left alone: it is a server-only secret, it
-- carries BYPASSRLS, and Supabase's own internals depend on it.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. PRIVILEGES - the primary control.
--
-- `anon` and `authenticated` exist only on Supabase. On a plain Postgres (the
-- postgres:16-alpine service container in CI) and on PGlite (the local test
-- suite) they do not exist, and an unguarded REVOKE naming them is a hard
-- error that would fail `prisma migrate deploy` and every test run. Hence the
-- pg_roles guard: on Supabase this block does its work, everywhere else it is
-- a no-op.
--
-- ALTER DEFAULT PRIVILEGES is included so that tables and sequences created by
-- FUTURE Prisma migrations do not silently arrive world-readable again. It
-- applies to objects created by the role running this migration, which is the
-- same role Prisma Migrate always runs as.
-- ----------------------------------------------------------------------------

DO $do$
DECLARE
  client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      -- Existing objects.
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', client_role);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', client_role);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', client_role);

      -- Objects created from here on.
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', client_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', client_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', client_role);
    END IF;
  END LOOP;
END
$do$;


-- ----------------------------------------------------------------------------
-- 2. ENABLE RLS on every table - defence in depth.
--
-- Portable, so unguarded: no role names, no `auth` schema, runs identically on
-- Supabase, on the CI Postgres and on PGlite. With RLS enabled and no
-- permissive policy that matches, a non-owner role gets deny-by-default.
-- ----------------------------------------------------------------------------

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExternalAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LedgerEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ACHTransfer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Card" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcessedWebhookEvent" ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- 3. OWNERSHIP-SCOPED SELECT POLICIES for `authenticated`.
--
-- Guarded twice over, because both dependencies are Supabase-only: the
-- `authenticated` role, and the `auth` schema that provides auth.uid(). On a
-- plain Postgres this whole block is skipped and the tables are left in the
-- deny-by-default state established in section 2, which is strictly safer.
--
-- The ownership join is always the same: `User.supabaseId` holds the Supabase
-- Auth user id, so `auth.uid()::text = "supabaseId"` identifies the caller's
-- row, and every other table reaches it through its `userId` foreign key.
--
-- The statements are dollar-quoted ($pol$) rather than single-quoted so the
-- double-quoted PascalCase identifiers Prisma generates ("User", "userId",
-- "supabaseId") survive verbatim without escaping.
--
-- NOTE on the subqueries: a policy expression is evaluated as the calling role,
-- so these EXISTS clauses assume that if SELECT is ever re-granted on, say,
-- "Account", it is also granted on "User". Supabase's dashboard grants
-- schema-wide, so that holds in practice. The alternative - a SECURITY DEFINER
-- helper that maps auth.uid() to a User.id - was rejected because a function in
-- `public` is itself published by PostgREST as an RPC, which is one more piece
-- of surface area to reason about for no gain here.
-- ----------------------------------------------------------------------------

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth')
  THEN

    -- User: the caller's own profile row, and nothing else. In particular this
    -- keeps every other customer's email and KYC status out of reach.
    EXECUTE $pol$ DROP POLICY IF EXISTS "User_select_own" ON "User" $pol$;
    EXECUTE $pol$
      CREATE POLICY "User_select_own" ON "User"
        FOR SELECT
        TO authenticated
        USING (auth.uid()::text = "supabaseId")
    $pol$;

    -- Account: the caller's own accounts.
    --
    -- The `"userId" IS NOT NULL` term is load-bearing, not defensive noise. A
    -- NULL userId marks an internal SYSTEM house account (ACH_SETTLEMENT,
    -- CARD_SETTLEMENT) - the contra accounts that make every movement of money
    -- balance to zero. Those hold the neobank's own position and must never be
    -- readable by a customer. The EXISTS clause alone would already exclude
    -- them (NULL never joins), but stating it explicitly means the guarantee
    -- does not quietly depend on that.
    EXECUTE $pol$ DROP POLICY IF EXISTS "Account_select_own" ON "Account" $pol$;
    EXECUTE $pol$
      CREATE POLICY "Account_select_own" ON "Account"
        FOR SELECT
        TO authenticated
        USING (
          "userId" IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM "User" u
            WHERE u."id" = "Account"."userId"
              AND u."supabaseId" = auth.uid()::text
          )
        )
    $pol$;

    -- Transaction: rows owned by the caller. A P2P transfer writes one row per
    -- side, so each participant sees their own side and never the counterparty's.
    EXECUTE $pol$ DROP POLICY IF EXISTS "Transaction_select_own" ON "Transaction" $pol$;
    EXECUTE $pol$
      CREATE POLICY "Transaction_select_own" ON "Transaction"
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM "User" u
            WHERE u."id" = "Transaction"."userId"
              AND u."supabaseId" = auth.uid()::text
          )
        )
    $pol$;

    -- LedgerEntry: entries posted against an account the caller owns. Reached
    -- through "Account", which also re-applies the system-account exclusion, so
    -- the house side of every double-entry pair stays invisible.
    EXECUTE $pol$ DROP POLICY IF EXISTS "LedgerEntry_select_own" ON "LedgerEntry" $pol$;
    EXECUTE $pol$
      CREATE POLICY "LedgerEntry_select_own" ON "LedgerEntry"
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM "Account" a
            JOIN "User" u ON u."id" = a."userId"
            WHERE a."id" = "LedgerEntry"."accountId"
              AND a."userId" IS NOT NULL
              AND u."supabaseId" = auth.uid()::text
          )
        )
    $pol$;

    -- Card: the caller's own virtual cards. The row holds only last4, brand,
    -- expiry and limits - the PAN and CVC never touch this database, they stay
    -- with Stripe Issuing.
    EXECUTE $pol$ DROP POLICY IF EXISTS "Card_select_own" ON "Card" $pol$;
    EXECUTE $pol$
      CREATE POLICY "Card_select_own" ON "Card"
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM "User" u
            WHERE u."id" = "Card"."userId"
              AND u."supabaseId" = auth.uid()::text
          )
        )
    $pol$;

    -- ACHTransfer: the caller's own transfers. This table references an
    -- ExternalAccount by id but stores no Plaid credential itself.
    EXECUTE $pol$ DROP POLICY IF EXISTS "ACHTransfer_select_own" ON "ACHTransfer" $pol$;
    EXECUTE $pol$
      CREATE POLICY "ACHTransfer_select_own" ON "ACHTransfer"
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM "User" u
            WHERE u."id" = "ACHTransfer"."userId"
              AND u."supabaseId" = auth.uid()::text
          )
        )
    $pol$;

  END IF;
END
$do$;


-- ----------------------------------------------------------------------------
-- 4. TABLES DELIBERATELY LEFT WITH NO POLICY AT ALL.
--
-- "ExternalAccount" holds `plaidAccessToken` in PLAINTEXT. That token is a
-- long-lived credential to a customer's real bank account at Plaid: leaking it
-- is categorically worse than leaking any balance in this database, and it is
-- not something a client should ever be one dashboard misclick away from.
--
-- RLS is a ROW filter, not a COLUMN filter. A permissive SELECT policy here
-- would say "your own linked banks", but the moment a table-wide SELECT grant
-- reappeared it would hand the caller their own token along with the rest of
-- the row. So this table gets RLS enabled and zero policies: deny-by-default
-- for every non-owner role, forever.
--
-- If a browser-side read is ever genuinely needed, the correct shape is a
-- COLUMN-level grant that cannot name the token at all, paired with a policy -
-- never a table-wide grant:
--
--     GRANT SELECT (id, "userId", "institutionName", mask, type, subtype,
--                   "verificationStatus", "currentBalance")
--       ON "ExternalAccount" TO authenticated;
--
-- Until then the server keeps returning a redacted projection, which is both
-- simpler and strictly safer.
--
-- "ProcessedWebhookEvent" is pure infrastructure - the at-least-once webhook
-- dedupe ledger. It has no customer-facing rows, so there is nothing for a
-- client to be allowed to read, and it gets no policy either.
--
-- `anon` gets no policy anywhere in this file. An unauthenticated caller has no
-- identity to scope anything to, so there is no such thing as a correct row for
-- it to see.
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- 5. NO INSERT / UPDATE / DELETE POLICIES FOR ANY CLIENT ROLE. EVER.
--
-- Every write in this system has to hold invariants that live in application
-- code and in transactions, not in a row predicate:
--
--   * double-entry: a transfer posts a balanced DEBIT/CREDIT pair, and the sum
--     across all accounts stays zero;
--   * the balance guard: the debited account is locked FOR UPDATE and checked
--     for sufficient funds inside the same transaction;
--   * limits and review: per-transfer maximum, rolling daily total, and the
--     hold-for-review threshold;
--   * idempotency: the unique idempotency key that makes a retried request a
--     no-op instead of a second movement of money.
--
-- A client-side write policy would let a caller with the anon key bypass all of
-- it and UPDATE "Account" SET balance directly. No USING clause can express
-- "and the ledger still balances". Writes go through the server, full stop.
-- ----------------------------------------------------------------------------
