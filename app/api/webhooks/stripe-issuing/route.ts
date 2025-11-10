import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe-issuing-utils'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'
import { Decimal } from '@prisma/client/runtime/library'

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

if (!STRIPE_WEBHOOK_SECRET) {
  console.warn('STRIPE_WEBHOOK_SECRET is not set')
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

  // Find the card
  const card = await prisma.card.findUnique({
    where: { stripeCardId: transaction.card },
    include: { user: true },
  })

  if (!card) {
    console.error(`Card not found: ${transaction.card}`)
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

  // Create transaction record
  const amount = Math.abs(transaction.amount) / 100 // Convert from cents and get absolute value
  const isRefund = transaction.amount > 0 // Positive amount = refund, negative = purchase

  const dbTransaction = await prisma.transaction.create({
    data: {
      userId: card.userId,
      fromAccountId: isRefund ? null : internalAccount.id,
      toAccountId: isRefund ? internalAccount.id : null,
      amount: new Decimal(amount),
      currency: transaction.currency.toUpperCase(),
      type: isRefund ? 'CARD_REFUND' : 'CARD_PURCHASE',
      status: 'COMPLETED',
      description: `${transaction.merchant_data?.name || 'Card Transaction'} - Card ••••${card.last4}`,
      externalId: transaction.id,
      metadata: {
        stripeTransactionId: transaction.id,
        merchantName: transaction.merchant_data?.name,
        merchantCategory: transaction.merchant_data?.category,
        cardLast4: card.last4,
      },
    },
  })

  // Update account balance and create ledger entry
  const currentBalance = parseFloat(internalAccount.balance.toString())
  const newBalance = isRefund ? currentBalance + amount : currentBalance - amount

  await prisma.$transaction(async (tx) => {
    // Create ledger entry
    await tx.ledgerEntry.create({
      data: {
        accountId: internalAccount.id,
        transactionId: dbTransaction.id,
        entryType: isRefund ? 'CREDIT' : 'DEBIT',
        amount: new Decimal(amount),
        balanceAfter: new Decimal(newBalance),
        description: isRefund ? 'Card Refund' : 'Card Purchase',
      },
    })

    // Update account balance
    await tx.account.update({
      where: { id: internalAccount.id },
      data: { balance: new Decimal(newBalance) },
    })
  })

  console.log(`✅ Transaction recorded for user ${card.user.email}`)
  console.log(`   New balance: $${newBalance.toFixed(2)}`)
}

async function handleTransactionUpdated(transaction: Stripe.Issuing.Transaction) {
  console.log(`Transaction updated: ${transaction.id}`)
  // Handle transaction updates if needed
}
