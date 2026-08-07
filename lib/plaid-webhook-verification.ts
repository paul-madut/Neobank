import { createHash, timingSafeEqual } from 'crypto'
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from 'jose'
import { plaidClient } from './plaid'

/**
 * Plaid webhook verification.
 *
 * The handler behind this moves money, and it previously accepted any POST from
 * anyone who knew the URL. Plaid signs each webhook with an ES256 JWT in the
 * `Plaid-Verification` header. Verifying it takes four checks, and skipping any
 * one of them leaves the endpoint forgeable:
 *
 *   1. The JWT signature, against the public key Plaid publishes for the `kid`
 *      in the JWT header.
 *   2. The algorithm is ES256. Accepting the token's own `alg` would allow the
 *      classic "alg: none" and HS256-with-the-public-key-as-secret downgrades,
 *      so the expected algorithm is pinned.
 *   3. `iat` is recent. Plaid's guidance is a 5 minute window; without it a
 *      captured webhook can be replayed indefinitely.
 *   4. `request_body_sha256` matches the SHA-256 of the raw request body. This
 *      is what actually binds the signature to the payload. A valid signature
 *      over a different body is worthless.
 *
 * The body must be the exact bytes received. Re-serializing a parsed object
 * changes key order and whitespace and the hash will not match.
 */

const FIVE_MINUTES_MS = 5 * 60 * 1000

/** kid -> JWK. Plaid's keys are stable, so fetching one per webhook is waste. */
const keyCache = new Map<string, JWK>()

export type PlaidVerificationResult =
  | { verified: true }
  | { verified: false; reason: string }

async function getVerificationKey(kid: string): Promise<JWK | null> {
  const cached = keyCache.get(kid)
  if (cached) return cached

  try {
    const response = await plaidClient.webhookVerificationKeyGet({ key_id: kid })
    const key = response.data.key

    // A key Plaid has retired must not be used to accept new webhooks.
    if (key.expired_at !== null && key.expired_at !== undefined) {
      return null
    }

    const jwk: JWK = {
      alg: key.alg,
      crv: key.crv,
      kid: key.kid,
      kty: key.kty,
      use: key.use,
      x: key.x,
      y: key.y,
    }

    keyCache.set(kid, jwk)
    return jwk
  } catch (error) {
    console.error('Failed to fetch Plaid webhook verification key:', error)
    return null
  }
}

function hashesMatch(expectedHex: string, actualHex: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex')
  const actual = Buffer.from(actualHex, 'hex')
  if (expected.length !== actual.length || expected.length === 0) {
    return false
  }
  return timingSafeEqual(expected, actual)
}

/**
 * Verify a Plaid webhook.
 *
 * @param token The raw `Plaid-Verification` header value.
 * @param rawBody The exact request body string, before JSON.parse.
 */
export async function verifyPlaidWebhook(
  token: string | null,
  rawBody: string
): Promise<PlaidVerificationResult> {
  if (!token) {
    return { verified: false, reason: 'Missing Plaid-Verification header' }
  }

  let kid: string | undefined
  let alg: string | undefined
  try {
    const header = decodeProtectedHeader(token)
    kid = header.kid
    alg = header.alg
  } catch {
    return { verified: false, reason: 'Malformed verification token' }
  }

  if (alg !== 'ES256') {
    return { verified: false, reason: `Unexpected algorithm: ${alg}` }
  }

  if (!kid) {
    return { verified: false, reason: 'Verification token has no key ID' }
  }

  const jwk = await getVerificationKey(kid)
  if (!jwk) {
    return { verified: false, reason: 'Unknown or expired verification key' }
  }

  let payload
  try {
    const key = await importJWK(jwk, 'ES256')
    const result = await jwtVerify(token, key, { algorithms: ['ES256'] })
    payload = result.payload
  } catch {
    return { verified: false, reason: 'Signature verification failed' }
  }

  const issuedAtMs = typeof payload.iat === 'number' ? payload.iat * 1000 : 0
  if (!issuedAtMs || Date.now() - issuedAtMs > FIVE_MINUTES_MS) {
    return { verified: false, reason: 'Verification token is stale' }
  }

  const claimedHash = payload.request_body_sha256
  if (typeof claimedHash !== 'string') {
    return { verified: false, reason: 'Verification token has no body hash' }
  }

  const actualHash = createHash('sha256').update(rawBody, 'utf8').digest('hex')
  if (!hashesMatch(claimedHash, actualHash)) {
    return { verified: false, reason: 'Body hash mismatch' }
  }

  return { verified: true }
}

/**
 * Stable identifier for a webhook delivery, used for replay deduplication.
 *
 * Plaid does not put a single event ID on every webhook type, so where one
 * exists it is used, and otherwise the body hash stands in - the same delivery
 * redelivered has byte-identical content.
 */
export function plaidEventId(rawBody: string, parsed: unknown): string {
  if (parsed && typeof parsed === 'object') {
    const body = parsed as Record<string, unknown>
    const event = body.transfer_event as Record<string, unknown> | undefined
    if (event && event.event_id !== undefined) {
      return `transfer_event:${String(event.event_id)}`
    }
  }
  return `body:${createHash('sha256').update(rawBody, 'utf8').digest('hex')}`
}
