import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find user in database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if already verified
    if (dbUser.kycStatus === 'VERIFIED') {
      return NextResponse.json(
        { error: 'User is already verified' },
        { status: 400 }
      )
    }

    // Create Stripe Identity VerificationSession
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: 'document',
      options: {
        document: {
          allowed_types: ['driving_license', 'passport', 'id_card'],
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
      metadata: {
        userId: dbUser.id,
        supabaseId: user.id,
        email: user.email || '',
      },
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/kyc/pending`,
    })

    // Update user with verification session ID
    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        kycProviderId: verificationSession.id,
      },
    })

    return NextResponse.json({
      clientSecret: verificationSession.client_secret,
      sessionId: verificationSession.id,
      url: verificationSession.url,
    })
  } catch (error: any) {
    console.error('Error creating verification session:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create verification session' },
      { status: 500 }
    )
  }
}
