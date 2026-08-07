/**
 * Fixed-window rate limiter.
 *
 * This is deliberately in-process and in-memory. That is the correct trade-off
 * for a demo running as a single instance, and the wrong one for anything
 * horizontally scaled: each instance would keep its own counters, so the
 * effective limit becomes limit x instances, and every deploy resets it. The
 * fix in production is to move the counter to Redis or Upstash behind this same
 * interface - the call sites do not change.
 */

interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()

/** Stop the map growing without bound in a long-lived process. */
function sweep(now: number) {
  if (windows.size < 5000) return
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key)
  }
}

export interface RateLimitOptions {
  /** Requests permitted per window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Seconds until the window resets. Suitable for a Retry-After header. */
  retryAfterSeconds: number
}

export function rateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const existing = windows.get(key)

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return {
      allowed: true,
      remaining: limit - 1,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    }
  }

  existing.count += 1
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((existing.resetAt - now) / 1000)
  )

  if (existing.count > limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }

  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds,
  }
}

/** Presets, so limits are named rather than scattered magic numbers. */
export const RATE_LIMITS = {
  /** Money movement. Deliberately tight. */
  transfer: { limit: 10, windowMs: 60_000 },
  /** Recipient lookup. This is an account enumeration surface. */
  recipientLookup: { limit: 20, windowMs: 60_000 },
  /** Card issuance and other expensive provider calls. */
  provisioning: { limit: 5, windowMs: 60_000 },
  /** General authenticated reads. */
  read: { limit: 120, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitOptions>

/** Reset all counters. Test helper only. */
export function __resetRateLimits() {
  windows.clear()
}
