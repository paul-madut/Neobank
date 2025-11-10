import { plaidClient } from './plaid'
import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
  LinkTokenCreateRequest,
  ItemPublicTokenExchangeRequest,
  AccountsGetRequest,
  TransferAuthorizationCreateRequest,
  TransferCreateRequest,
  TransferGetRequest,
  TransferType,
  ACHClass,
  TransferNetwork,
} from 'plaid'
import type { PlaidAccount, PlaidInstitution } from '@/types/account'

/**
 * Create a Link token for Plaid Link initialization
 * @param userId - The user's Supabase ID
 * @param userName - The user's name for display
 */
export async function createLinkToken(userId: string, userName: string) {
  try {
    const request: LinkTokenCreateRequest = {
      user: {
        client_user_id: userId,
      },
      client_name: 'NeoBank',
      products: [Products.Auth, Products.Transactions],
      country_codes: [CountryCode.Us, CountryCode.Ca],
      language: 'en',
      webhook: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/plaid`
        : undefined,
    }

    const response = await plaidClient.linkTokenCreate(request)
    return {
      linkToken: response.data.link_token,
      expiration: response.data.expiration,
    }
  } catch (error) {
    console.error('Error creating link token:', error)
    throw new Error('Failed to create Plaid link token')
  }
}

/**
 * Exchange a public token for an access token
 * @param publicToken - The public token from Plaid Link
 */
export async function exchangePublicToken(publicToken: string) {
  try {
    const request: ItemPublicTokenExchangeRequest = {
      public_token: publicToken,
    }

    const response = await plaidClient.itemPublicTokenExchange(request)
    return {
      accessToken: response.data.access_token,
      itemId: response.data.item_id,
    }
  } catch (error) {
    console.error('Error exchanging public token:', error)
    throw new Error('Failed to exchange public token')
  }
}

/**
 * Get accounts for a given access token
 * @param accessToken - The Plaid access token
 */
export async function getAccounts(accessToken: string) {
  try {
    const request: AccountsGetRequest = {
      access_token: accessToken,
    }

    const response = await plaidClient.accountsGet(request)
    return {
      accounts: response.data.accounts,
      item: response.data.item,
    }
  } catch (error) {
    console.error('Error getting accounts:', error)
    throw new Error('Failed to get accounts from Plaid')
  }
}

/**
 * Get balances for accounts
 * @param accessToken - The Plaid access token
 */
export async function getBalances(accessToken: string) {
  try {
    const request: AccountsGetRequest = {
      access_token: accessToken,
    }

    const response = await plaidClient.accountsGet(request)
    return response.data.accounts.map((account) => ({
      accountId: account.account_id,
      availableBalance: account.balances.available,
      currentBalance: account.balances.current,
      currency: account.balances.iso_currency_code || 'USD',
    }))
  } catch (error) {
    console.error('Error getting balances:', error)
    throw new Error('Failed to get account balances')
  }
}

/**
 * Get institution details
 * @param institutionId - The Plaid institution ID
 */
export async function getInstitution(institutionId: string) {
  try {
    const response = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us, CountryCode.Ca],
    })

    return {
      institutionId: response.data.institution.institution_id,
      name: response.data.institution.name,
      logo: response.data.institution.logo,
      primaryColor: response.data.institution.primary_color,
      url: response.data.institution.url,
    }
  } catch (error) {
    console.error('Error getting institution:', error)
    return null
  }
}

/**
 * Generate a unique account number (mock for internal accounts)
 */
export function generateAccountNumber(): string {
  const timestamp = Date.now().toString()
  const random = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0')
  return timestamp.slice(-8) + random
}

/**
 * Authorize an ACH transfer (required before creating transfer)
 * @param accessToken - The Plaid access token
 * @param accountId - The Plaid account ID
 * @param amount - Amount in dollars
 * @param type - 'debit' (withdrawal) or 'credit' (deposit)
 */
export async function authorizeACHTransfer(
  accessToken: string,
  accountId: string,
  amount: number,
  type: 'debit' | 'credit'
) {
  try {
    const request: TransferAuthorizationCreateRequest = {
      access_token: accessToken,
      account_id: accountId,
      type: type === 'debit' ? TransferType.Debit : TransferType.Credit,
      network: TransferNetwork.Ach,
      amount: amount.toFixed(2),
      ach_class: ACHClass.Ppd, // Prearranged Payment and Deposit
      user: {
        legal_name: 'NeoBank Customer', // Should be user's actual name
      },
    }

    const response = await plaidClient.transferAuthorizationCreate(request)
    return {
      authorizationId: response.data.authorization.id,
      decision: response.data.authorization.decision,
      decisionRationale: response.data.authorization.decision_rationale,
    }
  } catch (error) {
    console.error('Error authorizing ACH transfer:', error)
    throw new Error('Failed to authorize ACH transfer')
  }
}

/**
 * Create an ACH transfer
 * @param authorizationId - Authorization ID from authorizeACHTransfer
 * @param description - Transfer description
 * @param idempotencyKey - Unique key to prevent duplicate transfers
 */
export async function createACHTransfer(
  authorizationId: string,
  description: string,
  idempotencyKey: string
) {
  try {
    const request: TransferCreateRequest = {
      authorization_id: authorizationId,
      description: description,
      idempotency_key: idempotencyKey,
    }

    const response = await plaidClient.transferCreate(request)
    return {
      transferId: response.data.transfer.id,
      status: response.data.transfer.status,
      achReturnCode: response.data.transfer.ach_return_code,
      created: response.data.transfer.created,
    }
  } catch (error) {
    console.error('Error creating ACH transfer:', error)
    throw new Error('Failed to create ACH transfer')
  }
}

/**
 * Get ACH transfer status
 * @param transferId - The Plaid transfer ID
 */
export async function getACHTransferStatus(transferId: string) {
  try {
    const request: TransferGetRequest = {
      transfer_id: transferId,
    }

    const response = await plaidClient.transferGet(request)
    return {
      transferId: response.data.transfer.id,
      status: response.data.transfer.status,
      amount: response.data.transfer.amount,
      achReturnCode: response.data.transfer.ach_return_code,
      failureReason: response.data.transfer.failure_reason,
      metadata: response.data.transfer.metadata,
    }
  } catch (error) {
    console.error('Error getting ACH transfer status:', error)
    throw new Error('Failed to get ACH transfer status')
  }
}
