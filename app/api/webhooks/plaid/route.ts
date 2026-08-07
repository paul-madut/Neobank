import { NextRequest, NextResponse } from 'next/server'
import { updateACHTransferStatus } from '@/lib/transfer-utils'
import { prisma } from '@/lib/prisma'
import {
  plaidEventId,
  verifyPlaidWebhook,
} from '@/lib/plaid-webhook-verification'
import { claimWebhookEvent, releaseWebhookEvent } from '@/lib/webhook-events'

/**
 * Plaid Webhook Handler
 *
 * Handles TRANSFER status updates and ITEM lifecycle events.
 *
 * Every request is verified against Plaid's ES256 signature before anything is
 * read from the body, and deduplicated before anything is written, because this
 * handler settles ACH transfers.
 */
export async function POST(request: NextRequest) {
  // Read the raw bytes. The signature covers the body exactly as sent, so
  // parsing first and re-serializing would break the hash comparison.
  const rawBody = await request.text()

  const verification = await verifyPlaidWebhook(
    request.headers.get('Plaid-Verification'),
    rawBody
  )

  if (!verification.verified) {
    console.warn('Rejected Plaid webhook:', verification.reason)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const webhookType = body.webhook_type as string | undefined
  const webhookCode = body.webhook_code as string | undefined
  const transferId = body.transfer_id as string | undefined
  const itemId = body.item_id as string | undefined

  const eventId = plaidEventId(rawBody, body)

  const claimed = await claimWebhookEvent('plaid', eventId, `${webhookType}.${webhookCode}`)
  if (!claimed) {
    console.log(`Duplicate Plaid webhook ignored: ${eventId}`)
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    console.log('Plaid webhook received:', {
      type: webhookType,
      code: webhookCode,
      transferId,
    })

    if (webhookType === 'TRANSFER') {
      if (!transferId) {
        console.error('Missing transfer_id in TRANSFER webhook')
        return NextResponse.json({ error: 'Missing transfer_id' }, { status: 400 })
      }

      const { status, failureReason } = mapTransferStatus(body, webhookCode)
      await updateACHTransferStatus(transferId, status, failureReason)

      return NextResponse.json({
        success: true,
        message: 'Transfer status updated',
      })
    }

    if (webhookType === 'ITEM') {
      await handleItemWebhook(webhookCode, itemId, body)
      return NextResponse.json({
        success: true,
        message: 'ITEM webhook processed',
      })
    }

    console.log(`Unhandled webhook type: ${webhookType}`)
    return NextResponse.json({
      success: true,
      message: 'Webhook received',
    })
  } catch (error) {
    // Nothing durable was written, so release the claim and let Plaid retry.
    await releaseWebhookEvent('plaid', eventId)
    console.error('[webhooks/plaid]', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

function mapTransferStatus(
  body: Record<string, unknown>,
  webhookCode: string | undefined
): { status: string; failureReason?: string } {
  switch (webhookCode) {
    case 'TRANSFER_EVENTS_UPDATE': {
      const event = body.transfer_event as Record<string, unknown> | undefined
      if (event) {
        const failure = event.failure_reason as
          | Record<string, unknown>
          | undefined
        return {
          status: String(event.event_type ?? 'pending'),
          failureReason: failure?.description as string | undefined,
        }
      }
      return { status: 'pending' }
    }

    case 'TRANSFER_PENDING':
      return { status: 'pending' }

    case 'TRANSFER_POSTED':
      return { status: 'posted' }

    case 'TRANSFER_SETTLED':
      return { status: 'settled' }

    case 'TRANSFER_FAILED': {
      const failure = body.failure_reason as Record<string, unknown> | undefined
      return {
        status: 'failed',
        failureReason: failure?.description as string | undefined,
      }
    }

    case 'TRANSFER_CANCELLED':
      return { status: 'cancelled' }

    case 'TRANSFER_RETURNED': {
      const returnCode = body.return_code as Record<string, unknown> | undefined
      return {
        status: 'returned',
        failureReason: returnCode?.description as string | undefined,
      }
    }

    default:
      console.log(`Unhandled TRANSFER webhook code: ${webhookCode}`)
      return { status: 'pending' }
  }
}

/**
 * ITEM lifecycle events.
 *
 * These all describe the same underlying condition: the link to the customer's
 * external bank is or is not usable. That maps directly onto
 * ExternalAccount.verificationStatus, which validateACHTransfer already checks,
 * so flipping it here is what actually stops a transfer being attempted against
 * a dead item.
 */
async function handleItemWebhook(
  webhookCode: string | undefined,
  itemId: string | undefined,
  body: Record<string, unknown>
) {
  if (!itemId) {
    console.error('Missing item_id in ITEM webhook')
    return
  }

  switch (webhookCode) {
    case 'ERROR':
      console.error('Plaid ITEM error:', body.error)
      await markItem(itemId, 'FAILED')
      break

    case 'PENDING_EXPIRATION':
      console.warn('Plaid item pending expiration:', itemId)
      await markItem(itemId, 'FAILED')
      break

    case 'USER_PERMISSION_REVOKED':
      console.warn('User revoked permissions:', itemId)
      await markItem(itemId, 'FAILED')
      break

    case 'LOGIN_REPAIRED':
      console.log('User login repaired:', itemId)
      await markItem(itemId, 'VERIFIED')
      break

    default:
      console.log(`Unhandled ITEM webhook code: ${webhookCode}`)
  }
}

async function markItem(
  plaidItemId: string,
  verificationStatus: 'VERIFIED' | 'FAILED'
) {
  const result = await prisma.externalAccount.updateMany({
    where: { plaidItemId },
    data: { verificationStatus },
  })

  console.log(
    `Marked ${result.count} external account(s) for item ${plaidItemId} as ${verificationStatus}`
  )
}
