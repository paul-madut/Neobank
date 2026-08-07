import { prisma } from './prisma'

export type WebhookProvider = 'stripe_issuing' | 'stripe_identity' | 'plaid'

/**
 * Claim a webhook event for processing exactly once.
 *
 * Every payment provider delivers at-least-once: Stripe retries for up to
 * three days on a non-2xx, and will also redeliver on manual replay. Handlers
 * here post ledger entries, so a redelivery that is not filtered out credits
 * or debits an account a second time.
 *
 * The claim is an INSERT ... ON CONFLICT DO NOTHING against a unique
 * (provider, eventId) index, so the database does the mutual exclusion in a
 * single round trip. Returns false if this event has already been seen, in
 * which case the caller must do nothing and return 200 - a non-2xx would just
 * make the provider retry a duplicate forever.
 *
 * Deliberately not written as a plain INSERT with a caught P2002: a duplicate
 * webhook is an expected, routine event, and routine events should not be
 * signalled by throwing, aborting the statement, and filling the Postgres log
 * with constraint violations.
 */
export async function claimWebhookEvent(
  provider: WebhookProvider,
  eventId: string,
  eventType?: string
): Promise<boolean> {
  const result = await prisma.processedWebhookEvent.createMany({
    data: [{ provider, eventId, eventType }],
    skipDuplicates: true,
  })

  return result.count === 1
}

/**
 * Release a claim so a failed event can be retried by the provider.
 *
 * Only call this when the handler threw before committing anything. If the
 * handler partially succeeded, leaving the claim in place is the safer failure
 * mode: a stuck event is recoverable by hand, a double-posted ledger entry is
 * not.
 */
export async function releaseWebhookEvent(
  provider: WebhookProvider,
  eventId: string
): Promise<void> {
  await prisma.processedWebhookEvent
    .delete({ where: { provider_eventId: { provider, eventId } } })
    .catch(() => undefined)
}
