NeoBank - Digital Banking Platform
Technical Design Document
Version: 1.0
 Date: October 24, 2025
 Project Type: Portfolio Project (Production-Ready)

Table of Contents
Project Overview
Goals & Objectives
Tech Stack
System Architecture
Core Features
Database Schema
Development Phases
Technical Challenges
Security & Compliance
Future Enhancements

Project Overview
NeoBank is a full-stack digital banking platform demonstrating enterprise-grade fintech infrastructure, payment processing, and regulatory compliance. The platform provides core banking services including account management, P2P transfers, external bank transfers via ACH, virtual card issuance, and comprehensive fraud detection.
Target Audience: Hiring managers, technical recruiters, and potential clients evaluating full-stack development capabilities in fintech. Students in tech who want to make Fintech related projects.


Goals & Objectives
Primary Goals
Build a production-ready banking platform demonstrating technical expertise
Showcase understanding of financial systems and double-entry accounting
Implement real-world integrations with payment providers
Demonstrate security-first architecture and compliance awareness
Success Metrics
100% ledger accuracy across all transactions
Sub-200ms response time for balance queries
95%+ fraud detection rate on suspicious patterns
Zero critical security vulnerabilities
Clean, maintainable codebase suitable for portfolio presentation

Tech Stack
Frontend & Backend
Framework: Next.js (App Router)
Language: TypeScript
Styling: TailwindCSS, Shadcn, Aceternity
State Management: React Query / SWR
Authentication
Provider: Supabase Auth
Features: Email/password, social logins, MFA
Session Management: Server-side with secure cookies
Database & ORM
Database: Supabase (PostgreSQL)
ORM: Prisma
Caching: Redis (optional for MVP)
Storage: Supabase Storage (KYC documents, receipts)
External Services
Identity Verification: Stripe Identity (KYC/AML)
Payment Processing: Stripe (Treasury)
Bank Connectivity: Plaid (ACH transfers)
Card Issuing:Lithic
Infrastructure
Hosting: Vercel
Monitoring: Sentry
Analytics: Vercel Analytics
CI/CD: GitHub Actions

System Architecture
High-Level Architecture
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│              Next.js 14 + TailwindCSS                    │
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
│          │ │ Supabase │ │ • Plaid         │
│          │ │   (DB)   │ │ • Stripe        │
│          │ │          │ │   Identity      │
└──────────┘ └──────────┘ └─────────────────┘

Key Architectural Patterns
1. Double-Entry Ledger
Every transaction creates two offsetting entries (debit + credit)
Ensures mathematical accuracy and audit trails
Enables reconciliation and balance verification
2. Event-Driven Architecture
Webhooks from Stripe and Plaid trigger async processing
Idempotent event handlers prevent duplicate processing
Event sourcing for complete transaction history
3. API Route Protection
Supabase Auth middleware on all protected routes
Row-Level Security (RLS) policies in database
Request validation with Zod schemas
4. Transaction Safety
Prisma transactions for atomic operations
Idempotency keys for payment operations
Optimistic locking for concurrent balance updates

Core Features
1. User Authentication & Onboarding
Email/password registration with Supabase Auth
Email verification flow
Social login options (Google, GitHub)
User profile management
Multi-factor authentication (MFA)
2. KYC/Identity Verification
Integration with Stripe Identity
Government ID verification
Liveness detection (selfie verification)
Address verification
Account restrictions until KYC complete
3. Account Management
Checking account creation on signup
Real-time balance display
Transaction history with filtering
Account statements (PDF generation)
Balance reconciliation against ledger
4. Peer-to-Peer (P2P) Transfers
Instant transfers between NeoBank users
Recipient lookup by email/username
Transfer limits and validations
Real-time balance updates
Transaction notifications
5. External Bank Transfers (ACH)
Plaid Link integration for bank account connection
Microdeposit verification
ACH debit/credit transfers
1-3 business day processing
Webhook handling for status updates
6. Virtual Card Issuance
Stripe Issuing integration
Instant virtual card creation
Card details display (number, CVV, expiry)
Spending limits and controls
Card freeze/unfreeze functionality
Real-time authorization webhooks
7. Transaction Monitoring & Fraud Detection
Real-time transaction screening
Velocity checks (frequency, amount)
Geolocation-based anomaly detection
Suspicious pattern flagging
Manual review queue for admins
8. Admin Dashboard
User account overview
Transaction monitoring
Fraud alert management
KYC status review
Audit logs and reporting

Database Schema
Core Tables
users
model User {
  id              String    @id @default(uuid())
  supabaseId      String    @unique // Supabase Auth user ID
  email           String    @unique
  firstName       String
  lastName        String
  kycStatus       KycStatus @default(PENDING)
  kycProviderId   String?   // Stripe Identity verification ID
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
  routingNumber   String
  balance         Decimal       @default(0.00) @db.Decimal(19, 4)
  currency        String        @default("USD")
  status          AccountStatus @default(ACTIVE)
  stripeAccountId String?       // Stripe Treasury account ID
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
  fraudChecks       FraudCheck[]
  
  @@index([userId, createdAt])
  @@index([status])
}

enum TransactionType {
  P2P_TRANSFER
  ACH_DEBIT
  ACH_CREDIT
  CARD_AUTHORIZATION
  CARD_CAPTURE
  REFUND
  FEE
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
  accountId       String
  stripeCardId    String      @unique // Stripe Issuing card ID
  last4           String
  brand           String
  expMonth        Int
  expYear         Int
  status          CardStatus  @default(ACTIVE)
  spendingLimit   Decimal?    @db.Decimal(19, 4)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  user            User        @relation(fields: [userId], references: [id])
}

enum CardStatus {
  ACTIVE
  INACTIVE
  FROZEN
  CANCELLED
}

fraud_checks
model FraudCheck {
  id              String      @id @default(uuid())
  transactionId   String
  riskScore       Decimal     @db.Decimal(5, 2) // 0.00 to 100.00
  riskLevel       RiskLevel
  flags           Json        // Array of fraud indicators
  reviewStatus    ReviewStatus @default(PENDING)
  reviewedBy      String?
  reviewedAt      DateTime?
  createdAt       DateTime    @default(now())
  
  transaction     Transaction @relation(fields: [transactionId], references: [id])
  
  @@index([riskLevel, reviewStatus])
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum ReviewStatus {
  PENDING
  APPROVED
  REJECTED
  ESCALATED
}

external_accounts (Plaid-linked banks)
model ExternalAccount {
  id              String   @id @default(uuid())
  userId          String
  plaidAccountId  String   @unique
  plaidItemId     String
  institutionName String
  accountName     String
  mask            String   // Last 4 digits
  type            String   // checking, savings, etc.
  verificationStatus String @default("pending")
  createdAt       DateTime @default(now())
  
  @@index([userId])
}


Development Phases
Phase 1: Foundation (Week 1-2)
Goal: Set up authentication and database infrastructure
Next.js 14 project setup with TypeScript
Supabase project creation and configuration
Supabase Auth integration (email/password, social providers)
Prisma schema design and initial migration
Protected route middleware
User registration and login flows
Basic user profile page
Deliverable: Users can sign up, log in, and view their profile

Phase 2: Core Banking (Week 3-4)
Goal: Implement account creation and ledger system
Checking account creation on user signup
Double-entry ledger implementation
Balance calculation logic
Transaction history display
Mock transaction seeding for testing
Balance reconciliation validation
Deliverable: Users have accounts with accurate balances and transaction history

Phase 3: P2P Transfers (Week 5)
Goal: Enable transfers between NeoBank users
Transfer form with amount validation
Recipient lookup by email
Idempotency key generation
Atomic transfer execution with Prisma transactions
Real-time balance updates
Transfer confirmation emails
Transfer limit enforcement
Deliverable: Users can send money to other NeoBank users instantly

Phase 4: External Bank Integration (Week 6-7)
Goal: Connect external banks via Plaid for ACH transfers
Plaid Link integration (Link token generation)
Bank account connection flow
External account verification (microdeposits)
ACH transfer initiation
Webhook handler for Plaid events
Transfer status tracking and updates
Failed transfer handling
Deliverable: Users can link external banks and initiate ACH transfers

Phase 5: Virtual Cards (Week 8-9)
Goal: Issue virtual cards via Stripe Issuing
Stripe Issuing account setup
Virtual card creation API
Secure card details display
Card controls (spending limits, freeze/unfreeze)
Authorization webhook handler
Real-time transaction notifications
Card transaction history
Deliverable: Users can create virtual cards and make purchases

Phase 6: KYC & Security (Week 10)
Goal: Implement identity verification and fraud detection
Stripe Identity integration
KYC verification flow (ID upload, selfie)
Account restrictions until KYC approved
Velocity checks (transaction frequency/amount)
Geolocation anomaly detection
Fraud alert generation
Manual review queue
Deliverable: KYC-verified users with active fraud monitoring

Phase 7: Admin Dashboard (Week 11)
Goal: Build operations and compliance tools
Admin authentication and authorization
User account management interface
Transaction monitoring dashboard
Fraud alert review system
KYC status management
Audit log viewer
Basic reporting (daily transactions, fraud stats)
Deliverable: Admin panel for operations team

Phase 8: Polish & Deploy (Week 12)
Goal: Production deployment and documentation
Environment variable configuration
Vercel deployment setup
Sentry error tracking integration
Performance optimization
Security audit and penetration testing
Comprehensive README and documentation
Demo video creation
Test account seeding
Deliverable: Live production app with complete documentation

Technical Challenges
1. Double-Entry Ledger Accuracy
Challenge: Ensuring every transaction maintains ledger balance integrity
Solution:
Prisma transactions for atomic debit/credit pairs
Database constraints to prevent negative balances
Daily reconciliation job to verify ledger accuracy
Automated tests for every transaction type
2. Idempotent Payment Processing
Challenge: Preventing duplicate transactions from retries/webhooks
Solution:
Unique idempotency keys for all payment operations
Database unique constraints on idempotency keys
Webhook event deduplication using external IDs
Retry logic with exponential backoff
3. Real-Time Authorization Flows
Challenge: Sub-second card authorization decisions
Solution:
Optimized database queries with proper indexing
Redis caching for frequently accessed data (optional)
Efficient fraud check algorithms
Asynchronous post-authorization processing
4. Webhook Reliability
Challenge: Handling external service webhooks reliably
Solution:
Signature verification for all webhooks
Idempotent event processing
Dead letter queue for failed webhooks
Webhook retry mechanism
5. Data Consistency Across Services
Challenge: Keeping Supabase Auth and Prisma data in sync
Solution:
Supabase Auth triggers to sync user data
Transaction-based user creation
Periodic reconciliation jobs
Soft deletes to maintain referential integrity

Security & Compliance
Authentication & Authorization
Supabase Auth with secure session management
JWT validation on all protected routes
Row-Level Security (RLS) policies in Supabase
Multi-factor authentication (MFA)
Password strength requirements
Data Protection
Encryption at rest (Supabase default)
TLS/HTTPS for all communications
PII encryption for sensitive fields
Secure card data handling (PCI DSS considerations)
Regular security audits
Compliance Features
KYC/AML verification via Stripe Identity
Transaction monitoring and reporting
Audit logs for all financial operations
User consent and privacy controls
GDPR-compliant data handling
Fraud Prevention
Real-time transaction screening
Machine learning-based anomaly detection (future)
Manual review workflows
Account freezing capabilities
Suspicious activity reporting

Future Enhancements
Phase 9+: Advanced Features
Mobile app (React Native)
Cryptocurrency wallet integration
Investment accounts (stocks, bonds via Alpaca API)
Merchant payment processing
Recurring payments and subscriptions
International wire transfers
Multi-currency support
Savings goals and budgeting tools
Credit score monitoring
Loan applications and underwriting
Technical Improvements
Microservices architecture for scale
GraphQL API for mobile clients
Machine learning fraud models
Real-time analytics dashboard
Advanced caching strategies
Multi-region deployment
Disaster recovery and backup systems

Success Criteria
Technical Metrics
✅ 100% ledger accuracy validated by automated tests
✅ <200ms average response time for balance queries
✅ 99.9% uptime SLA
✅ Zero critical security vulnerabilities
✅ 95%+ fraud detection rate
Portfolio Metrics
✅ Clean, documented codebase
✅ Comprehensive README with architecture diagrams
✅ Live demo with test credentials
✅ Video walkthrough of key features
✅ Case study demonstrating problem-solving

Resources & References
Documentation
Next.js 14 Docs
Supabase Auth Docs
Prisma Docs
Stripe API Docs
Plaid Docs
Learning Resources
Double-Entry Accounting
PCI DSS Compliance
Fintech Compliance Overview

Contact & Questions
For questions about this design document or the project architecture, please reach out to the development team.
Last Updated: October 24, 2025

