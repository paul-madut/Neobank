NeoBank - Digital Banking Platform
Technical Design Document
Version: 1.0
 Date: October 24, 2025
 Project Type: Portfolio / demo project (not a production financial service)

DEMO DISCLOSURE - READ FIRST
NeoBank is a portfolio and demo application built to showcase full-stack engineering work.
It is not a bank, it is not a licensed or regulated financial institution, and it is not affiliated with one.
It moves no real money and holds no customer funds.
Stripe runs in test mode (test keys only), which covers Stripe Identity and Stripe Issuing.
Plaid runs in sandbox mode, so the only banks that can be linked are Plaid's sandbox test institutions.
ACH transfers are simulated locally in sandbox mode rather than sent over the ACH network.
Balances, account numbers, routing numbers, cards, and transactions in this app are demo data and have no value.
Do not enter real personal, financial, or identity documents into this application.
Nothing in this document should be read as a compliance claim, a certification, a service level commitment, or a measured production benchmark.
Statements about behaviour that is not built yet are labelled as goals or as not implemented.

Table of Contents
Project Overview
Goals & Objectives
Tech Stack
System Architecture
Core Features
Database Schema
Development Phases
Technical Challenges
Money Safety
Security & Compliance
Future Enhancements

Project Overview
NeoBank is a full-stack demo banking application that explores how fintech infrastructure is put together: account management, a double-entry ledger, P2P transfers, external bank linking via Plaid, virtual card issuance via Stripe Issuing, and identity verification via Stripe Identity.
Every integration runs against provider test/sandbox environments.
Target Audience: Hiring managers, technical recruiters, and potential clients evaluating full-stack development capabilities in fintech. Students in tech who want to make Fintech related projects.


Goals & Objectives
Primary Goals
Build a realistic banking demo that shows how these systems fit together end to end
Showcase understanding of financial systems and double-entry accounting
Integrate with real payment provider APIs in their test and sandbox environments
Explore security-conscious architecture and the compliance surface a real product would have to cover
Non-Goals
Handling real money, real customer funds, or real identity documents
Meeting any regulatory, licensing, or certification requirement
Serving production traffic or offering any availability guarantee
What "Done" Looks Like Here
Transfers debit and credit the ledger through a single atomic database transaction
Balances shown in the UI are read from the database, not hardcoded
Provider integrations work end to end against Stripe test mode and Plaid sandbox
Clean, readable codebase suitable for portfolio presentation
Every money path is covered by integration tests that run against a real Postgres engine, not a mocked client
Note: there has been no load testing and no security audit, so there are no measured latency, uptime, or fraud detection numbers to report. The test suite asserts correctness, not performance.

Tech Stack
Frontend & Backend
Framework: Next.js 16 (App Router)
Language: TypeScript
Styling: TailwindCSS, Shadcn, Aceternity/MagicUI components
Data fetching: TanStack Query
Authentication
Provider: Supabase Auth
Implemented: email/password, OAuth social login
Not implemented: multi-factor authentication, biometric authentication
Session Management: Server-side with secure cookies
Database & ORM
Database: Supabase (PostgreSQL)
ORM: Prisma
Not implemented: Redis caching, Supabase Storage usage
External Services
Identity Verification: Stripe Identity (test mode)
Card Issuing: Stripe Issuing (test mode)
Bank Connectivity: Plaid (sandbox mode)
Note: Stripe Treasury is not used. Internal balances live in this app's own Postgres ledger.
Infrastructure
Hosting: Vercel is the intended target, and no deployment configuration is committed yet
Not implemented: error monitoring wiring (the Sentry SDK is a dependency but no Sentry config is present), analytics, CI/CD pipeline

System Architecture
High-Level Architecture
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│              Next.js 16 + TailwindCSS                    │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │ HTTPS
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js API Routes (Backend)                │
│         • Authentication Middleware                      │
│         • Business Logic                                 │
│         • Webhook Handlers                               │
└───┬─────────────┬──────────────┬────────────────────────┘
    │             │              │
    │             │              │
    ▼             ▼              ▼
┌──────────┐ ┌──────────┐ ┌─────────────────┐
│ Supabase │ │  Prisma  │ │ External APIs   │
│   Auth   │ │    +     │ │ • Stripe        │
│          │ │ Supabase │ │   (test mode)   │
│          │ │   (DB)   │ │ • Plaid         │
│          │ │          │ │   (sandbox)     │
└──────────┘ └──────────┘ └─────────────────┘

Key Architectural Patterns
1. Double-Entry Ledger
Every transfer writes offsetting ledger entries (debit + credit)
Gives each transaction an auditable trail with a running balance per entry
Intended to make reconciliation and balance verification possible
2. Event-Driven Webhooks
Webhooks from Stripe and Plaid drive async status updates
Handlers are written to be idempotent so a redelivered event does not double-apply
3. API Route Protection
Supabase Auth check on protected routes and API handlers
Request validation in the route handlers
Not implemented: database-level Row-Level Security policies (no policy definitions live in this repo, so authorization is enforced in application code only)
4. Transaction Safety
Prisma interactive transactions for atomic debit/credit pairs
Unique idempotency keys on transaction records
Not implemented: optimistic locking for concurrent balance updates

Core Features
1. User Authentication & Onboarding
Implemented: email/password registration with Supabase Auth, social login (OAuth), account provisioning on first login
Not implemented: multi-factor authentication, profile editing
2. KYC/Identity Verification
Implemented: Stripe Identity hosted document verification, status webhook, feature gating until verification succeeds
Runs in Stripe test mode, so it accepts Stripe's test documents only
Documents are uploaded directly to Stripe. This app never receives or stores them, it only stores the resulting status.
3. Account Management
Implemented: checking account creation, balance display read from the database, transaction history, per-month transaction aggregates
Not implemented: PDF account statements, scheduled balance reconciliation job
4. Peer-to-Peer (P2P) Transfers
Implemented: transfers between NeoBank demo users, recipient lookup by email, idempotency keys, atomic execution inside a Prisma transaction, configurable transfer limits
Not implemented: transfer confirmation emails, push/in-app notifications
5. External Bank Transfers (ACH)
Implemented: Plaid Link integration, bank account linking, balance refresh, ACH transfer records with status tracking
Sandbox behaviour: the Plaid Transfer API requires separate access, so in sandbox mode ACH transfers are simulated in application code and settle instantly. No money moves and nothing is sent to the ACH network.
Not implemented: microdeposit verification, real settlement timelines, return handling against live rails
6. Virtual Card Issuance
Implemented: Stripe Issuing cardholder and virtual card creation, card details display, freeze/unfreeze, spending limit fields, authorization webhook handling
Runs in Stripe test mode. Cards cannot be used for real purchases.
7. Transaction Monitoring & Fraud Detection
Not implemented. There is no fraud scoring, no velocity checking, no geolocation anomaly detection, and no review queue in the codebase.
The only related controls that exist today are per-transaction and daily transfer limits driven by environment variables.
Treat this section as roadmap, not as a feature.
8. Admin Dashboard
Not implemented. There is an isAdmin flag on the user model, but no admin routes, no admin UI, and no audit log storage exist yet.

Database Schema
The authoritative schema is prisma/schema.prisma. The excerpts below are illustrative and may lag behind it.

users
model User {
  id              String    @id @default(uuid())
  supabaseId      String    @unique // Supabase Auth user ID
  email           String    @unique
  firstName       String?
  lastName        String?
  kycStatus       KycStatus @default(PENDING)
  kycProviderId   String?   // Stripe Identity verification ID
  isAdmin         Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  accounts        Account[]
  transactions    Transaction[]
  cards           Card[]
}

enum KycStatus {
  PENDING
  VERIFIED
  REJECTED
  REQUIRES_REVIEW
}

accounts
model Account {
  id              String        @id @default(uuid())
  userId          String
  accountType     AccountType   @default(CHECKING)
  accountNumber   String        @unique
  routingNumber   String        // Mock routing number, not a real bank routing number
  balance         Decimal       @default(0.00) @db.Decimal(19, 4)
  currency        String        @default("USD")
  status          AccountStatus @default(ACTIVE)
  stripeAccountId String?       // Reserved for a future Stripe Treasury integration, unused today
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  user            User          @relation(fields: [userId], references: [id])
  ledgerEntries   LedgerEntry[]
  transactions    Transaction[]
}

enum AccountType {
  CHECKING
  SAVINGS
}

enum AccountStatus {
  ACTIVE
  FROZEN
  CLOSED
}

ledger_entries (Double-Entry Bookkeeping)
model LedgerEntry {
  id              String          @id @default(uuid())
  accountId       String
  transactionId   String
  entryType       EntryType
  amount          Decimal         @db.Decimal(19, 4)
  balanceAfter    Decimal         @db.Decimal(19, 4)
  description     String
  createdAt       DateTime        @default(now())

  account         Account         @relation(fields: [accountId], references: [id])
  transaction     Transaction     @relation(fields: [transactionId], references: [id])

  @@index([accountId, createdAt])
  @@index([transactionId])
}

enum EntryType {
  DEBIT
  CREDIT
}

transactions
model Transaction {
  id                String            @id @default(uuid())
  userId            String
  fromAccountId     String?
  toAccountId       String?
  amount            Decimal           @db.Decimal(19, 4)
  currency          String            @default("USD")
  type              TransactionType
  status            TransactionStatus @default(PENDING)
  description       String?
  metadata          Json?             // Stripe/Plaid metadata
  idempotencyKey    String            @unique
  externalId        String?           // Stripe/Plaid transaction ID
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  user              User              @relation(fields: [userId], references: [id])
  fromAccount       Account?          @relation("FromAccount", fields: [fromAccountId], references: [id])
  toAccount         Account?          @relation("ToAccount", fields: [toAccountId], references: [id])
  ledgerEntries     LedgerEntry[]

  @@index([userId, createdAt])
  @@index([status])
}

enum TransactionType {
  P2P_TRANSFER
  ACH_DEBIT
  ACH_CREDIT
  CARD_AUTHORIZATION
  CARD_CAPTURE
  CARD_PURCHASE
  CARD_REFUND
  REFUND
  FEE
  DEPOSIT
  WITHDRAWAL
}

enum TransactionStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}

cards
model Card {
  id              String      @id @default(uuid())
  userId          String
  stripeCardId    String      @unique // Stripe Issuing card ID (test mode)
  last4           String
  brand           String      @default("visa")
  expiryMonth     Int
  expiryYear      Int
  status          CardStatus  @default(ACTIVE)
  spendingLimit   Decimal?    @db.Decimal(19, 4)
  monthlyLimit    Decimal?    @db.Decimal(19, 4)
  nickname        String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  user            User        @relation(fields: [userId], references: [id])
}

enum CardStatus {
  ACTIVE
  FROZEN
  CANCELLED
}

external_accounts (Plaid-linked banks)
model ExternalAccount {
  id                  String   @id @default(uuid())
  userId              String
  plaidAccountId      String   @unique
  plaidItemId         String
  plaidAccessToken    String   // KNOWN GAP: stored in plaintext today. A real deployment must encrypt this at rest.
  institutionId       String
  institutionName     String
  accountName         String?
  mask                String   // Last 4 digits
  type                String   // checking, savings, etc.
  availableBalance    Decimal? @db.Decimal(19, 4)
  currentBalance      Decimal? @db.Decimal(19, 4)
  verificationStatus  VerificationStatus @default(PENDING)
  lastSynced          DateTime @default(now())
  createdAt           DateTime @default(now())

  @@index([userId])
}

ach_transfers
model ACHTransfer {
  id                String       @id @default(uuid())
  userId            String
  externalAccountId String
  internalAccountId String
  transactionId     String?      @unique
  direction         ACHDirection
  amount            Decimal      @db.Decimal(19, 4)
  status            ACHStatus    @default(PENDING)
  plaidTransferId   String?      @unique // Simulated identifier in sandbox mode
  failureReason     String?
  expectedDate      DateTime?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
}

Planned models not in the schema today: FraudCheck (risk scoring and review queue) and AuditLog.


Development Phases
Status markers below reflect what is actually in the repository.

Phase 1: Foundation - done
Goal: Set up authentication and database infrastructure
Next.js project setup with TypeScript
Supabase project creation and configuration
Supabase Auth integration (email/password, social providers)
Prisma schema design and initial migration
Protected route handling
User registration and login flows
Deliverable: Users can sign up, log in, and reach a dashboard

Phase 2: Core Banking - done
Goal: Implement account creation and ledger system
Checking account creation on user onboarding
Double-entry ledger implementation
Balance calculation logic
Transaction history display
Seed script for demo transactions
Not done: automated balance reconciliation validation
Deliverable: Users have demo accounts with balances and transaction history

Phase 3: P2P Transfers - done
Goal: Enable transfers between NeoBank demo users
Transfer form with amount validation
Recipient lookup by email
Idempotency key generation
Atomic transfer execution with Prisma transactions
Transfer limit enforcement from environment configuration
Not done: transfer confirmation emails
Deliverable: Demo users can send balance to other demo users

Phase 4: External Bank Integration (Plaid sandbox) - partly done
Goal: Connect external banks via Plaid and model ACH transfers
Done: Plaid Link token generation, bank account linking, balance refresh, ACH transfer records and status tracking, Plaid webhook handler
Simulated: sandbox ACH transfers settle instantly in application code because the Plaid Transfer API requires separate access
Not done: microdeposit verification, real settlement timelines, ACH return handling
Deliverable: Users can link Plaid sandbox banks and run simulated ACH transfers

Phase 5: Virtual Cards (Stripe Issuing test mode) - done
Goal: Issue virtual cards via Stripe Issuing
Stripe Issuing cardholder and card creation
Card details display
Card controls (spending limits, freeze/unfreeze)
Authorization webhook handler
Deliverable: Users can create test-mode virtual cards

Phase 6: KYC - done. Fraud detection - not started
Goal: Identity verification and, later, fraud detection
Done: Stripe Identity integration, verification flow, feature gating until KYC is approved
Not done: velocity checks, geolocation anomaly detection, fraud alert generation, manual review queue

Phase 7: Admin Dashboard - not started
Goal: Build operations tooling
Admin authentication and authorization
User account management interface
Transaction monitoring dashboard
KYC status management
Audit log viewer

Phase 8: Hardening & Polish - not started
Goal: The work that would be required before this could be taken seriously as software, let alone as a financial product
Automated test suite (unit, integration, and ledger invariant tests)
Encryption at rest for the Plaid access token
Row-Level Security policies in the database
Error monitoring wiring and CI/CD
Documentation and demo walkthrough

Technical Challenges
The "Approach" notes below describe the design intent. Items marked as not implemented are roadmap, not shipped behaviour.

1. Double-Entry Ledger Accuracy
Challenge: Ensuring every transaction maintains ledger balance integrity
Approach:
Prisma transactions for atomic debit/credit pairs (implemented)
Balance checks before debiting an account (implemented)
Daily reconciliation job to verify ledger accuracy (not implemented)
Automated tests for every transaction type (not implemented, there is no test suite yet)
2. Idempotent Payment Processing
Challenge: Preventing duplicate transactions from retries/webhooks
Approach:
Unique idempotency keys for transfer operations (implemented)
Database unique constraints on idempotency keys (implemented)
Webhook event deduplication using external IDs (implemented for the handlers that exist)
Retry logic with exponential backoff (not implemented)
3. Card Authorization Flows
Challenge: Responding to Stripe Issuing authorization webhooks quickly and consistently
Approach:
Indexed lookups on card and user identifiers (implemented)
Efficient authorization handling (implemented, unmeasured)
Caching layer for hot reads (not implemented)
No latency target is claimed here because none has been measured.
4. Webhook Reliability
Challenge: Handling external service webhooks reliably
Approach:
Signature verification for webhooks (implemented)
Idempotent event processing (implemented)
Dead letter queue for failed webhooks (not implemented)
Custom webhook retry mechanism (not implemented, currently relies on provider retries)
5. Data Consistency Across Services
Challenge: Keeping Supabase Auth and Prisma data in sync
Approach:
User record provisioned on first authenticated request (implemented)
Transaction-based user creation (implemented)
Periodic reconciliation jobs (not implemented)
Soft deletes to maintain referential integrity (not implemented, deletes currently cascade)

Money Safety
This is the part of the codebase that matters most, so it is documented in detail.
No real money moves through this app, but the mechanics below are the ones a real system has to get right, and they are implemented as if it did.

Double-entry, with a real counterparty
Every movement of money debits one account and credits another for the same amount.
The two entries are written in the same database transaction as the balance updates, by a single function (postDoubleEntry in lib/ledger.ts), so there is no code path that can write one side without the other.
Money entering or leaving the neobank has to come from somewhere outside it, so each external rail gets an internal house account: ACH_SETTLEMENT for transfers to and from external banks, CARD_SETTLEMENT for card spend.
These are rows in the Account table with a null userId, because they are the bank's own books rather than a customer's.
The consequence is that the sum of every account balance in the system is always exactly zero, and that invariant is asserted directly in the test suite.
Before this, the ACH and card paths wrote only one side of each entry, so the ledger did not balance despite the schema section being titled "double-entry".

Preventing double spends
A balance read followed by a write of an absolute value is a lost update.
Under Postgres's default READ COMMITTED isolation, two concurrent transfers can both read a balance of 100, both decide 100 is enough, and both write 50, spending 100 twice.
The fix is to make the balance check part of the write rather than a separate read: UPDATE "Account" SET balance = balance - $amount WHERE id = $id AND balance >= $amount.
Postgres re-evaluates that predicate after acquiring the row lock, so the second writer sees the first writer's committed balance, matches zero rows, and the transfer fails as insufficient funds.
The validation that runs before the transaction still reads the balance, but only to produce a useful error message; it is explicitly not the safety mechanism.

Decimal, never float
All money is Prisma Decimal end to end, backed by Postgres NUMERIC(19,4).
There is no parseFloat anywhere in a money path.
Binary floating point cannot represent 0.10, so ten transfers of ten cents under float arithmetic do not sum to one dollar; the test suite asserts that they do.

Idempotency
Every money-moving endpoint requires a client-supplied Idempotency-Key header, and that key is stored on the transaction under a unique index.
A repeated key returns the original transaction instead of moving money again.
The previous implementation generated a fresh UUID server-side on every call, which is the shape of idempotency without any of the effect: a retried request would simply have sent the money twice.
Clients hold one key per logical transfer and only mint a new one after a success, so a retry after a timeout is safe.

Webhook trust
All three webhook endpoints verify their sender before reading the body.
Plaid's verification is an ES256 JWT in the Plaid-Verification header: the signature is checked against Plaid's published key for the token's key ID, the algorithm is pinned to ES256 so it cannot be downgraded, the issued-at timestamp must be within five minutes, and the token's request_body_sha256 must match a hash of the exact bytes received.
That last check is what binds the signature to the payload; without it a valid signature over a different body would be accepted.
This endpoint previously had no verification at all, and it settles ACH transfers.
Separately, every provider delivers at least once, so each handler claims its event ID in a ProcessedWebhookEvent table before doing any work.
The claim is an INSERT ... ON CONFLICT DO NOTHING against a unique (provider, eventId) index, so the database does the mutual exclusion and a redelivery is a no-op rather than a second ledger entry.

Constraints in the database, not just the code
Application code can be bypassed by a script, a migration, or a future code path that forgets a rule, so the invariants are also declared as CHECK constraints in the migration.
Customer balances cannot go negative; system accounts are exempt, because a settlement account holding a claim against an external rail is legitimately negative.
Transaction, ledger entry, and ACH transfer amounts must be positive, since direction is carried by the entry type and by which account field is set, never by the sign of the amount.
An account must be owned by exactly one of a customer or the system, never both and never neither.

Held transfers have an exit
Transfers at or above the review threshold are held rather than posted.
Previously nothing could ever settle them: the isAdmin flag existed on the User model and was read nowhere, so the money sat in a state with no way out.
There is now an admin review queue that approves or rejects them, with the reviewer and timestamp recorded on the transaction.
Approval posts the ledger entries at approval time, which means the balance guard runs then: if the sender has spent the money while the transfer was held, the approval correctly fails instead of overdrawing the account.
This is an honest limitation rather than a design goal; a real system would place an authorization hold at submission so the funds could not be spent in the first place.

Testing
The money paths are covered by integration tests running against a real Postgres engine, because the bugs above live in the database's concurrency and constraint semantics and a mocked client would prove nothing about any of them.
Locally the tests run against PGlite, a WebAssembly build of Postgres that runs in process, so there is no Docker or database install to set up.
PGlite serves a single connection, so the genuinely-parallel double-spend test is skipped locally and runs in CI against a real Postgres service container.
Coverage includes concurrent double-spend prevention, insufficient funds at both the transfer and ledger levels, self-transfer rejection, KYC gating, per-transaction and daily limits in both directions, decimal precision, idempotent replay, webhook replay deduplication, ACH settlement and returns, the review queue, and the ledger summing to zero after every scenario.

Security & Compliance
This is a demo application. Nothing below is a certification, an attestation, or a guarantee, and the app has not been audited or penetration tested.

Implemented Today
Supabase Auth with server-side session cookies
Auth checks on protected pages and API routes, enforced server-side rather than only in the proxy
Encryption in transit (HTTPS) and Supabase's default encryption at rest for the database
Feature gating behind KYC status
Per-transaction and daily transfer limits, applied to both P2P and ACH, in both directions
Rate limiting on transfers, recipient lookup, card issuance, and authenticated reads
Signature verification on all three webhook endpoints, including Plaid's ES256 JWT with body-hash binding and a five minute replay window
Webhook event deduplication, so a provider redelivery cannot post a ledger entry twice
Client-supplied idempotency keys on every money-moving endpoint
Recipient lookup returns only a display name and a masked account number, so it cannot be used to harvest the customer list
Generic error responses to clients, with the real error logged server-side only
Zod validation on every mutating API route
Identity documents handled entirely by Stripe Identity, never stored by this app
Bank credentials handled entirely by Plaid Link, never entered into or seen by this app
Test/sandbox credentials only, so no real financial data is in scope

Known Gaps (would block any real deployment)
Plaid access tokens are stored in plaintext in the database and need application-level encryption
No Row-Level Security policies exist in the repo, so authorization is enforced only in application code
Rate limiting is in-process and in-memory, so it does not hold across multiple instances and resets on deploy. Production would move the counter to Redis behind the same interface
No multi-factor authentication
No dedicated audit log table; the ledger and the review trail on Transaction are the only durable history
No security audit and no penetration testing
No transaction monitoring, fraud detection, or suspicious activity reporting
No data subject request handling, retention policy, or privacy tooling
Held transfers do not reserve funds. The balance check runs again at approval time, so an approval can legitimately fail; a real system would place a hold at submission instead

Regulatory Note
Operating anything like this for real would require, at minimum, a bank partner or the relevant licences, a real KYC/AML programme with sanctions screening and SAR filing, PCI DSS scope analysis for card data, and a genuine privacy and data protection programme.
None of that exists here, and none of it is claimed.

Future Enhancements
Correctness and Trust (highest value next steps)
Encryption at rest for third-party access tokens
Row-Level Security policies in Postgres
Dedicated audit log table for every financial operation
Distributed rate limiting (Redis) so limits hold across instances
Authorization holds on submitted transfers, so held funds cannot be spent twice
Error monitoring
Product Features
Fraud detection: velocity checks, anomaly detection
Admin dashboard for KYC review (transfer review is implemented)
Mobile app (React Native)
Recurring payments and subscriptions
Savings goals and budgeting tools
Multi-currency support
Merchant payment processing
Technical Explorations
GraphQL API for mobile clients
Real-time analytics dashboard
Caching strategies
Multi-region deployment
Backup and recovery strategy

Portfolio Criteria
Clean, documented codebase
README with architecture overview
Live demo with test credentials, clearly labelled as a demo
Video walkthrough of key features
Write-up of the interesting engineering problems (ledger atomicity, idempotency, webhook handling)

Resources & References
Documentation
Next.js Docs
Supabase Auth Docs
Prisma Docs
Stripe API Docs
Plaid Docs
Learning Resources
Double-Entry Accounting
PCI DSS Compliance
Fintech Compliance Overview

Contact & Questions
For questions about this design document or the project architecture, please reach out to the project author.
Last Updated: October 24, 2025
