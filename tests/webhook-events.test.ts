import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { claimWebhookEvent, releaseWebhookEvent } from '@/lib/webhook-events'

describe('webhook replay deduplication', () => {
  it('claims an event once and refuses the replay', async () => {
    expect(await claimWebhookEvent('stripe_issuing', 'evt_1', 'a.b')).toBe(true)
    expect(await claimWebhookEvent('stripe_issuing', 'evt_1', 'a.b')).toBe(false)
    expect(await claimWebhookEvent('stripe_issuing', 'evt_1', 'a.b')).toBe(false)

    expect(await prisma.processedWebhookEvent.count()).toBe(1)
  })

  it('scopes the claim to a provider, so IDs cannot collide across them', async () => {
    expect(await claimWebhookEvent('stripe_issuing', 'shared_id')).toBe(true)
    expect(await claimWebhookEvent('stripe_identity', 'shared_id')).toBe(true)
    expect(await claimWebhookEvent('plaid', 'shared_id')).toBe(true)

    expect(await prisma.processedWebhookEvent.count()).toBe(3)
  })

  it('lets a released event be retried', async () => {
    expect(await claimWebhookEvent('plaid', 'evt_retry')).toBe(true)
    await releaseWebhookEvent('plaid', 'evt_retry')
    expect(await claimWebhookEvent('plaid', 'evt_retry')).toBe(true)
  })

  it('survives releasing an event that was never claimed', async () => {
    await expect(
      releaseWebhookEvent('plaid', 'never_seen')
    ).resolves.toBeUndefined()
  })

  it('lets only one of several simultaneous claims win', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        claimWebhookEvent('stripe_issuing', 'evt_race')
      )
    )

    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await prisma.processedWebhookEvent.count()).toBe(1)
  })
})
