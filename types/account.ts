// TypeScript types for accounts and transactions

export interface InternalAccount {
  id: string
  userId: string
  accountType: "CHECKING" | "SAVINGS"
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
  type: "P2P_TRANSFER" | "ACH_DEBIT" | "ACH_CREDIT" | "CARD_AUTHORIZATION" | "CARD_CAPTURE" | "REFUND" | "FEE" | "DEPOSIT" | "WITHDRAWAL"
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED"
  description: string | null
  metadata: any
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
