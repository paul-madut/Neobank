import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import {
  updateCardStatus,
  updateCardSpendingLimits,
  getCardDetails,
} from '@/lib/stripe-issuing-utils'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Await params in Next.js 15+
    const { id: cardId } = await params

    // Find the card
    const card = await prisma.card.findUnique({
      where: { id: cardId },
    })

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    // Verify the card belongs to the user
    if (card.userId !== dbUser.id) {
      return NextResponse.json(
        { error: 'Unauthorized to modify this card' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { action, spendingLimit, monthlyLimit, nickname } = body

    // Handle different actions
    if (action === 'freeze') {
      // Freeze the card
      const result = await updateCardStatus(card.stripeCardId, 'inactive')

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to freeze card' },
          { status: 500 }
        )
      }

      await prisma.card.update({
        where: { id: cardId },
        data: { status: 'FROZEN' },
      })

      return NextResponse.json({
        success: true,
        message: 'Card frozen successfully',
        status: 'FROZEN',
      })
    }

    if (action === 'unfreeze') {
      // Unfreeze the card
      const result = await updateCardStatus(card.stripeCardId, 'active')

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to unfreeze card' },
          { status: 500 }
        )
      }

      await prisma.card.update({
        where: { id: cardId },
        data: { status: 'ACTIVE' },
      })

      return NextResponse.json({
        success: true,
        message: 'Card unfrozen successfully',
        status: 'ACTIVE',
      })
    }

    if (action === 'update_limits') {
      // Update spending limits
      const result = await updateCardSpendingLimits(
        card.stripeCardId,
        spendingLimit ? parseFloat(spendingLimit) : undefined,
        monthlyLimit ? parseFloat(monthlyLimit) : undefined
      )

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to update spending limits' },
          { status: 500 }
        )
      }

      await prisma.card.update({
        where: { id: cardId },
        data: {
          spendingLimit: spendingLimit ? parseFloat(spendingLimit) : null,
          monthlyLimit: monthlyLimit ? parseFloat(monthlyLimit) : null,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Spending limits updated successfully',
      })
    }

    if (action === 'update_nickname') {
      // Update card nickname
      await prisma.card.update({
        where: { id: cardId },
        data: { nickname },
      })

      return NextResponse.json({
        success: true,
        message: 'Card nickname updated successfully',
      })
    }

    return NextResponse.json(
      { error: 'Invalid action. Supported actions: freeze, unfreeze, update_limits, update_nickname' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error updating card:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to update card',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Await params in Next.js 15+
    const { id: cardId } = await params

    // Find the card
    const card = await prisma.card.findUnique({
      where: { id: cardId },
    })

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    // Verify the card belongs to the user
    if (card.userId !== dbUser.id) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this card' },
        { status: 403 }
      )
    }

    // Cancel the card in Stripe
    const result = await updateCardStatus(card.stripeCardId, 'canceled')

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to cancel card' },
        { status: 500 }
      )
    }

    // Update card status in database
    await prisma.card.update({
      where: { id: cardId },
      data: { status: 'CANCELLED' },
    })

    return NextResponse.json({
      success: true,
      message: 'Card cancelled successfully',
    })
  } catch (error: any) {
    console.error('Error deleting card:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to cancel card',
      },
      { status: 500 }
    )
  }
}

// Get card details (including sensitive data)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Await params in Next.js 15+
    const { id: cardId } = await params

    // Find the card
    const card = await prisma.card.findUnique({
      where: { id: cardId },
    })

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    // Verify the card belongs to the user
    if (card.userId !== dbUser.id) {
      return NextResponse.json(
        { error: 'Unauthorized to view this card' },
        { status: 403 }
      )
    }

    // Get card details from Stripe (including sensitive data)
    const result = await getCardDetails(card.stripeCardId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to retrieve card details' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      card: {
        id: card.id,
        number: result.number,
        cvc: result.cvc,
        last4: card.last4,
        brand: card.brand,
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
        status: card.status,
        spendingLimit: card.spendingLimit,
        monthlyLimit: card.monthlyLimit,
        nickname: card.nickname,
      },
    })
  } catch (error: any) {
    console.error('Error retrieving card details:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to retrieve card details',
      },
      { status: 500 }
    )
  }
}
