import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    )
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'identity.verification_session.verified': {
        const session = event.data.object as Stripe.Identity.VerificationSession

        // Update user KYC status to VERIFIED
        await prisma.user.updateMany({
          where: { kycProviderId: session.id },
          data: { kycStatus: 'VERIFIED' },
        })

        console.log(`✅ User verified: ${session.id}`)
        break
      }

      case 'identity.verification_session.requires_input': {
        const session = event.data.object as Stripe.Identity.VerificationSession

        // Update user KYC status to REQUIRES_REVIEW
        await prisma.user.updateMany({
          where: { kycProviderId: session.id },
          data: { kycStatus: 'REQUIRES_REVIEW' },
        })

        console.log(`⚠️  User requires review: ${session.id}`)
        break
      }

      case 'identity.verification_session.canceled': {
        const session = event.data.object as Stripe.Identity.VerificationSession

        // Update user KYC status to REJECTED
        await prisma.user.updateMany({
          where: { kycProviderId: session.id },
          data: { kycStatus: 'REJECTED' },
        })

        console.log(`❌ Verification canceled: ${session.id}`)
        break
      }

      case 'identity.verification_session.processing': {
        const session = event.data.object as Stripe.Identity.VerificationSession
        console.log(`⏳ Verification processing: ${session.id}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
