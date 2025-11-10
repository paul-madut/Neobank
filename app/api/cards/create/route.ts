import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { createCardholder, createVirtualCard } from '@/lib/stripe-issuing-utils'
import { requireKYC } from '@/lib/kyc-utils'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Require KYC verification
    try {
      await requireKYC(dbUser.id)
    } catch (error) {
      return NextResponse.json(
        { error: 'KYC verification required to create virtual cards' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      spendingLimit,
      monthlyLimit,
      nickname,
      dateOfBirth,
      address,
      phoneNumber,
    } = body

    // Validate required cardholder information
    if (!dbUser.firstName || !dbUser.lastName) {
      return NextResponse.json(
        { error: 'First name and last name are required. Please update your profile.' },
        { status: 400 }
      )
    }

    if (!dateOfBirth) {
      return NextResponse.json(
        { error: 'Date of birth is required for card creation' },
        { status: 400 }
      )
    }

    if (!address || !address.line1 || !address.city || !address.state || !address.postalCode) {
      return NextResponse.json(
        { error: 'Complete address is required for card creation' },
        { status: 400 }
      )
    }

    // Create Stripe cardholder if not exists
    let cardholderId = dbUser.stripeCardholderId

    if (!cardholderId) {
      const cardholderResult = await createCardholder({
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        phoneNumber,
        dateOfBirth: {
          day: dateOfBirth.day,
          month: dateOfBirth.month,
          year: dateOfBirth.year,
        },
        address: {
          line1: address.line1,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country || 'US',
        },
      })

      if (!cardholderResult.success) {
        return NextResponse.json(
          { error: cardholderResult.error || 'Failed to create cardholder' },
          { status: 500 }
        )
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
      spendingLimit: spendingLimit ? parseFloat(spendingLimit) : undefined,
      monthlyLimit: monthlyLimit ? parseFloat(monthlyLimit) : undefined,
    })

    if (!cardResult.success) {
      return NextResponse.json(
        { error: cardResult.error || 'Failed to create virtual card' },
        { status: 500 }
      )
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
        spendingLimit: spendingLimit ? parseFloat(spendingLimit) : null,
        monthlyLimit: monthlyLimit ? parseFloat(monthlyLimit) : null,
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
        spendingLimit: card.spendingLimit,
        monthlyLimit: card.monthlyLimit,
        nickname: card.nickname,
        createdAt: card.createdAt,
      },
    })
  } catch (error: any) {
    console.error('Error creating virtual card:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to create virtual card',
      },
      { status: 500 }
    )
  }
}
