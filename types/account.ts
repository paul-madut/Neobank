// TypeScript types for accounts and transactions

import type { Prisma } from "@prisma/client"

/**
 * Everything the client is allowed to know about a transfer recipient.
 *
 * Deliberately narrow. Recipient lookup lets any signed-in user probe an email
 * address, so the response carries only what is needed to confirm the payee -
 * not their real full name, email, internal account ID or full account number.
 */
export interface PublicRecipient {
  /** Send this back as recipientIdentifier when submitting the transfer. */
  identifier: string
  /** First name plus last initial, e.g. "Jane D." */
  displayName: string
  /** e.g. "••••7421" */
  maskedAccountNumber: string
  accountStatus: string
}

// Mirrors the Prisma Account row after Decimal serialization.
// userId and accountType are widened because internal system (house) accounts
// share the table: they have no owner and carry accountType SYSTEM. API routes
// only ever hand back accounts owned by the signed-in user, so the UI will not
// see a SYSTEM row, but the type should not claim a guarantee the table does
// not enforce.
export interface InternalAccount {
  id: string
  userId: string | null
  accountType: "CHECKING" | "SAVINGS" | "SYSTEM"
  accountNumber: string
  routingNumber: string
  balance: string | number
  currency: string
  status: "ACTIVE" | "FROZEN" | "CLOSED"
  createdAt: Date | string
  updatedAt: Date | string
}

export interface ExternalAccount {
  id: string
  userId: string
  plaidAccountId: string
  plaidItemId: string
  institutionId: string
  institutionName: string
  accountName: string | null
  officialName: string | null
  mask: string
  type: string
  subtype: string | null
  availableBalance: string | number | null
  currentBalance: string | number | null
  currency: string
  verificationStatus: "PENDING" | "VERIFIED" | "FAILED"
  lastSynced: Date | string
  createdAt: Date | string
  updatedAt: Date | string
}

export interface PlaidAccountBalance {
  available: number | null
  current: number | null
  limit: number | null
  iso_currency_code: string | null
  unofficial_currency_code: string | null
}

export interface PlaidAccount {
  account_id: string
  balances: PlaidAccountBalance
  mask: string | null
  name: string
  official_name: string | null
  subtype: string | null
  type: string
}

export interface PlaidInstitution {
  institution_id: string
  name: string
}

export interface Transaction {
  id: string
  userId: string
  fromAccountId: string | null
  toAccountId: string | null
  amount: string | number
  currency: string
  type: "P2P_TRANSFER" | "ACH_DEBIT" | "ACH_CREDIT" | "CARD_AUTHORIZATION" | "CARD_CAPTURE" | "CARD_PURCHASE" | "CARD_REFUND" | "REFUND" | "FEE" | "DEPOSIT" | "WITHDRAWAL"
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED"
  description: string | null
  metadata: Prisma.JsonValue
  idempotencyKey: string
  externalId: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

export interface User {
  id: string
  supabaseId: string
  email: string
  firstName: string | null
  lastName: string | null
  kycStatus: "PENDING" | "VERIFIED" | "REJECTED" | "REQUIRES_REVIEW"
  kycProviderId: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

// API Response types
export interface CreateLinkTokenResponse {
  linkToken: string
  expiration: string
}

export interface ExchangePublicTokenRequest {
  publicToken: string
}

export interface ExchangePublicTokenResponse {
  success: boolean
  accountsCreated: number
  message: string
}

export interface GetAccountsResponse {
  internalAccount: InternalAccount | null
  externalAccounts: ExternalAccount[]
}

export interface LedgerEntry {
  id: string
  accountId: string
  transactionId: string
  entryType: "DEBIT" | "CREDIT"
  amount: string | number
  balanceAfter: string | number
  description: string
  createdAt: Date | string
}

export interface TransactionWithDetails extends Transaction {
  fromAccount?: {
    id: string
    accountNumber: string
    accountType: string
  } | null
  toAccount?: {
    id: string
    accountNumber: string
    accountType: string
  } | null
  ledgerEntries?: LedgerEntry[]
}

export interface GetTransactionsResponse {
  transactions: TransactionWithDetails[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}
