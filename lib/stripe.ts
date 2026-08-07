import Stripe from 'stripe'

/**
 * Lazily constructed Stripe client.
 *
 * `next build` imports every route module to collect page data, and the Stripe
 * constructor throws when no API key is present. Building an eager client at
 * module scope therefore made a production build require runtime secrets, which
 * broke `pnpm build` on a fresh clone and would break any CI job that does not
 * inject provider credentials.
 *
 * The proxy keeps the same `import { stripe }` shape everywhere while deferring
 * construction to the first real API call, where a missing key is a genuine
 * misconfiguration and the loud error is the correct behaviour.
 */

let client: Stripe | null = null

function getStripe(): Stripe {
  if (client) return client

  const apiKey = process.env.STRIPE_SECRET_KEY
  if (!apiKey) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Copy .env.example to .env and add your Stripe test key.'
    )
  }

  client = new Stripe(apiKey, {
    apiVersion: '2025-09-30.clover',
    typescript: true,
  })

  return client
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, property) {
    const instance = getStripe()
    const value = instance[property as keyof Stripe]
    return typeof value === 'function' ? value.bind(instance) : value
  },
})
