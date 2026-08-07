import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe-issuing-utils'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'
import { Decimal } from '@prisma/client/runtime/library'
import {
  InsufficientFundsError,
  getSystemAccount,
  postDoubleEntry,
} from '@/lib/ledger'
import { claimWebhookEvent, releaseWebhookEvent } from '@/lib/webhook-events'

// Stripe mints a separate signing secret per webhook endpoint, so Issuing and
// Identity cannot share one in a deployed environment. The Stripe CLI does
// issue a single account-wide secret for local forwarding, which is why
// STRIPE_WEBHOOK_SECRET remains a valid fallback for development.
const STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_ISSUING_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET

if (!STRIPE_WEBHOOK_SECRET) {
  console.warn(
    'Neither STRIPE_ISSUING_WEBHOOK_SECRET nor STRIPE_WEBHOOK_SECRET is set'
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    if (!STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    console.log(`Received Stripe Issuing webhook: ${event.type}`)

    // Stripe delivers at-least-once and retries for up to three days. Claim the
    // event before doing anything that touches the ledger.
    const claimed = await claimWebhookEvent(
      'stripe_issuing',
      event.id,
      event.type
    )
    if (!claimed) {
      console.log(`Duplicate Stripe Issuing event ignored: ${event.id}`)
      return NextResponse.json({ received: true, duplicate: true })
    }

    try {
      // Handle different event types
      switch (event.type) {
        case 'issuing_card.created':
          await handleCardCreated(event.data.object as Stripe.Issuing.Card)
          break

        case 'issuing_card.updated':
          await handleCardUpdated(event.data.object as Stripe.Issuing.Card)
          break

        case 'issuing_authorization.created':
          await handleAuthorizationCreated(
            event.data.object as Stripe.Issuing.Authorization
          )
          break

        case 'issuing_authorization.updated':
          await handleAuthorizationUpdated(
            event.data.object as Stripe.Issuing.Authorization
          )
          break

        case 'issuing_transaction.created':
          await handleTransactionCreated(
            event.data.object as Stripe.Issuing.Transaction
          )
          break

        case 'issuing_transaction.updated':
          await handleTransactionUpdated(
            event.data.object as Stripe.Issuing.Transaction
          )
          break

        default:
          console.log(`Unhandled event type: ${event.type}`)
      }
    } catch (handlerError) {
      // Nothing was committed, so give the claim back and let Stripe retry.
      await releaseWebhookEvent('stripe_issuing', event.id)
      throw handlerError
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handleCardCreated(card: Stripe.Issuing.Card) {
  console.log(`Card created: ${card.id}`)
  // Card is already created by our API, no action needed
}

async function handleCardUpdated(card: Stripe.Issuing.Card) {
  console.log(`Card updated: ${card.id}`)

  // Update card status in database
  const dbCard = await prisma.card.findUnique({
    where: { stripeCardId: card.id },
  })

  if (!dbCard) {
    console.error(`Card not found in database: ${card.id}`)
    return
  }

  let status: 'ACTIVE' | 'FROZEN' | 'CANCELLED'
  if (card.status === 'active') {
    status = 'ACTIVE'
  } else if (card.status === 'inactive') {
    status = 'FROZEN'
  } else {
    status = 'CANCELLED'
  }

  await prisma.card.update({
    where: { stripeCardId: card.id },
    data: { status },
  })
}

async function handleAuthorizationCreated(
  authorization: Stripe.Issuing.Authorization
) {
  console.log(`Authorization created: ${authorization.id}`)
  console.log(`  Amount: ${authorization.amount / 100} ${authorization.currency}`)
  console.log(`  Merchant: ${authorization.merchant_data.name}`)
  console.log(`  Status: ${authorization.status}`)

  // Find the card
  const card = await prisma.card.findUnique({
    where: { stripeCardId: authorization.card.id },
    include: { user: true },
  })

  if (!card) {
    console.error(`Card not found: ${authorization.card.id}`)
    return
  }

  // For approved authorizations, you might want to:
  // 1. Send a notification to the user
  // 2. Log the transaction for analytics
  // 3. Check if spending limits are being approached

  if (authorization.approved) {
    console.log(`✅ Authorization approved for user ${card.user.email}`)
  } else {
    console.log(`❌ Authorization declined for user ${card.user.email}`)
    console.log(`   Reason: ${authorization.request_history?.[0]?.reason}`)
  }
}

async function handleAuthorizationUpdated(
  authorization: Stripe.Issuing.Authorization
) {
  console.log(`Authorization updated: ${authorization.id}`)
  console.log(`  New status: ${authorization.status}`)
}

async function handleTransactionCreated(transaction: Stripe.Issuing.Transaction) {
  console.log(`Transaction created: ${transaction.id}`)
  console.log(`  Amount: ${transaction.amount / 100} ${transaction.currency}`)
  console.log(`  Type: ${transaction.type}`)

  const cardId = stripeCardId(transaction.card)

  // Find the card
  const card = await prisma.card.findUnique({
    where: { stripeCardId: cardId },
    select: { userId: true, last4: true, user: { select: { email: true } } },
  })

  if (!card) {
    console.error(`Card not found: ${cardId}`)
    return
  }

  // Get user's internal account
  const internalAccount = await prisma.account.findFirst({
    where: {
      userId: card.userId,
      accountType: 'CHECKING',
      status: 'ACTIVE',
    },
  })

  if (!internalAccount) {
    console.error(`No active account found for user ${card.userId}`)
    return
  }

  // Stripe reports amounts in the smallest currency unit. Divide with Decimal
  // so a $0.29 purchase does not become 0.28999999999999998.
  const amount = new Decimal(transaction.amount).abs().div(100)
  const isRefund = transaction.amount > 0 // Positive amount = refund, negative = purchase

  if (amount.lte(0)) {
    console.log(`Ignoring zero-amount card transaction ${transaction.id}`)
    return
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Card spend is money leaving the neobank for the card network, so the
      // network settlement house account is the other side of the entry.
      const settlement = await getSystemAccount(tx, 'CARD_SETTLEMENT')

      const dbTransaction = await tx.transaction.create({
        data: {
          userId: card.userId,
          fromAccountId: isRefund ? null : internalAccount.id,
          toAccountId: isRefund ? internalAccount.id : null,
          amount,
          currency: transaction.currency.toUpperCase(),
          type: isRefund ? 'CARD_REFUND' : 'CARD_PURCHASE',
          status: 'COMPLETED',
          description: `${transaction.merchant_data?.name || 'Card Transaction'} - Card ••••${card.last4}`,
          // Stripe's own transaction ID is the natural idempotency key here.
          // It was missing entirely, which made this create() throw every time.
          idempotencyKey: `stripe_issuing_txn_${transaction.id}`,
          externalId: transaction.id,
          metadata: {
            stripeTransactionId: transaction.id,
            merchantName: transaction.merchant_data?.name,
            merchantCategory: transaction.merchant_data?.category,
            cardLast4: card.last4,
          },
        },
      })

      await postDoubleEntry(tx, {
        transactionId: dbTransaction.id,
        debitAccountId: isRefund ? settlement.id : internalAccount.id,
        creditAccountId: isRefund ? internalAccount.id : settlement.id,
        amount,
        debitDescription: isRefund
          ? 'Card Refund - settlement'
          : 'Card Purchase',
        creditDescription: isRefund
          ? 'Card Refund'
          : 'Card Purchase - settlement',
      })
    })
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      // Stripe already approved the authorization, so the money is owed. Record
      // it for follow-up rather than silently dropping a real obligation.
      console.error(
        `Card transaction ${transaction.id} exceeds available balance for user ${card.userId}`
      )
      return
    }
    throw error
  }

  console.log(`Transaction recorded for user ${card.user?.email ?? card.userId}`)
}

/** Stripe expandable fields arrive as either an ID or the full object. */
function stripeCardId(card: string | Stripe.Issuing.Card): string {
  return typeof card === 'string' ? card : card.id
}

async function handleTransactionUpdated(transaction: Stripe.Issuing.Transaction) {
  console.log(`Transaction updated: ${transaction.id}`)
  // Handle transaction updates if needed
}
