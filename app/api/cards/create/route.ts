import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { createCardholder, createVirtualCard } from '@/lib/stripe-issuing-utils'
import { requireKYC } from '@/lib/kyc-utils'
import { createCardSchema } from '@/lib/validation'
import {
  badRequest,
  forbidden,
  notFound,
  serverError,
  tooManyRequests,
  unauthorized,
  validationError,
} from '@/lib/api-utils'
import { RATE_LIMITS, rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return unauthorized()
    }

    const limit = rateLimit(`cards:create:${user.id}`, RATE_LIMITS.provisioning)
    if (!limit.allowed) {
      return tooManyRequests(limit.retryAfterSeconds)
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    })

    if (!dbUser) {
      return notFound('User not found')
    }

    // Require KYC verification
    try {
      await requireKYC(dbUser.id)
    } catch {
      return forbidden('KYC verification required to create virtual cards')
    }

    // Parse and validate request body. Spending limits used to be passed to
    // Stripe straight out of parseFloat, so a negative limit sailed through.
    const parsed = createCardSchema.safeParse(await request.json())
    if (!parsed.success) {
      return validationError(parsed.error)
    }

    const {
      spendingLimit,
      monthlyLimit,
      nickname,
      dateOfBirth,
      address,
      phoneNumber,
    } = parsed.data

    // Validate required cardholder information
    if (!dbUser.firstName || !dbUser.lastName) {
      return badRequest(
        'First name and last name are required. Please update your profile.'
      )
    }

    // Create Stripe cardholder if not exists
    let cardholderId: string

    if (dbUser.stripeCardholderId) {
      cardholderId = dbUser.stripeCardholderId
    } else {
      const cardholderResult = await createCardholder({
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        phoneNumber,
        dateOfBirth,
        address,
      })

      if (!cardholderResult.success) {
        console.error('Stripe cardholder creation failed:', cardholderResult.error)
        return badRequest('Could not create cardholder with the details provided')
      }

      cardholderId = cardholderResult.cardholderId

      // Save cardholder ID to database
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { stripeCardholderId: cardholderId },
      })
    }

    // Create virtual card
    const cardResult = await createVirtualCard({
      cardholderId,
      currency: 'usd',
      spendingLimit: spendingLimit?.toNumber(),
      monthlyLimit: monthlyLimit?.toNumber(),
    })

    if (!cardResult.success) {
      console.error('Stripe card creation failed:', cardResult.error)
      return badRequest('Could not create the virtual card')
    }

    // Save card to database
    const card = await prisma.card.create({
      data: {
        userId: dbUser.id,
        stripeCardId: cardResult.cardId,
        last4: cardResult.last4,
        brand: cardResult.brand,
        expiryMonth: cardResult.expMonth,
        expiryYear: cardResult.expYear,
        status: 'ACTIVE',
        spendingLimit: spendingLimit ?? null,
        monthlyLimit: monthlyLimit ?? null,
        nickname,
      },
    })

    return NextResponse.json({
      success: true,
      card: {
        id: card.id,
        last4: card.last4,
        brand: card.brand,
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
        status: card.status,
        spendingLimit: card.spendingLimit?.toString() ?? null,
        monthlyLimit: card.monthlyLimit?.toString() ?? null,
        nickname: card.nickname,
        createdAt: card.createdAt,
      },
    })
  } catch (error) {
    return serverError('cards/create', error)
  }
}
