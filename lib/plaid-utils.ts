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
