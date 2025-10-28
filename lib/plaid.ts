import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'

// Determine Plaid environment from PLAID_ENV (sandbox, development, or production)
const getPlaidEnvironment = () => {
  const env = process.env.PLAID_ENV?.toLowerCase()

  switch (env) {
    case 'production':
      return PlaidEnvironments.production
    case 'development':
      return PlaidEnvironments.development
    case 'sandbox':
    default:
      return PlaidEnvironments.sandbox
  }
}

const configuration = new Configuration({
  basePath: getPlaidEnvironment(),
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
      'PLAID-SECRET': process.env.PLAID_SECRET!,
    },
  },
})

export const plaidClient = new PlaidApi(configuration)
