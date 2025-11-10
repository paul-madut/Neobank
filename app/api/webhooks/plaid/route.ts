import { NextRequest, NextResponse } from 'next/server'
import { updateACHTransferStatus } from '@/lib/transfer-utils'

/**
 * Plaid Webhook Handler
 * Handles various webhook events from Plaid including:
 * - TRANSFER status updates
 * - ITEM login required
 * - ERROR notifications
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { webhook_type, webhook_code, transfer_id } = body

    console.log('Plaid webhook received:', {
      type: webhook_type,
      code: webhook_code,
      transferId: transfer_id,
    })

    // Handle TRANSFER webhooks
    if (webhook_type === 'TRANSFER') {
      if (!transfer_id) {
        console.error('Missing transfer_id in TRANSFER webhook')
        return NextResponse.json({ error: 'Missing transfer_id' }, { status: 400 })
      }

      let status: string
      let failureReason: string | undefined

      switch (webhook_code) {
        case 'TRANSFER_EVENTS_UPDATE':
          // Get the transfer event from the body
          const event = body.transfer_event
          if (event) {
            status = event.event_type
            failureReason = event.failure_reason?.description
          } else {
            // Default to fetching the status
            status = 'pending'
          }
          break

        case 'TRANSFER_PENDING':
          status = 'pending'
          break

        case 'TRANSFER_POSTED':
          status = 'posted'
          break

        case 'TRANSFER_FAILED':
          status = 'failed'
          failureReason = body.failure_reason?.description
          break

        case 'TRANSFER_CANCELLED':
          status = 'cancelled'
          break

        case 'TRANSFER_RETURNED':
          status = 'returned'
          failureReason = body.return_code?.description
          break

        default:
          console.log(`Unhandled TRANSFER webhook code: ${webhook_code}`)
          status = 'pending'
      }

      // Update ACH transfer status in database
      await updateACHTransferStatus(transfer_id, status, failureReason)

      return NextResponse.json({
        success: true,
        message: 'Transfer status updated',
      })
    }

    // Handle ITEM webhooks (login required, error, etc.)
    if (webhook_type === 'ITEM') {
      switch (webhook_code) {
        case 'ERROR':
          console.error('Plaid ITEM error:', body.error)
          // TODO: Notify user that they need to re-authenticate
          break

        case 'PENDING_EXPIRATION':
          console.warn('Plaid item pending expiration:', body.item_id)
          // TODO: Notify user to update credentials
          break

        case 'USER_PERMISSION_REVOKED':
          console.warn('User revoked permissions:', body.item_id)
          // TODO: Mark external account as disconnected
          break

        case 'LOGIN_REPAIRED':
          console.log('User login repaired:', body.item_id)
          // TODO: Update external account status
          break

        default:
          console.log(`Unhandled ITEM webhook code: ${webhook_code}`)
      }

      return NextResponse.json({
        success: true,
        message: 'ITEM webhook received',
      })
    }

    // Handle other webhook types
    console.log(`Unhandled webhook type: ${webhook_type}`)
    return NextResponse.json({
      success: true,
      message: 'Webhook received',
    })
  } catch (error) {
    console.error('Plaid webhook error:', error)
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
