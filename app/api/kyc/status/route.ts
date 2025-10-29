import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

export async function GET(request: Request) {
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

    // If user has a verification session ID and status is PENDING, check Stripe
    if (dbUser.kycProviderId && dbUser.kycStatus === 'PENDING') {
      try {
        const session = await stripe.identity.verificationSessions.retrieve(
          dbUser.kycProviderId
        )

        // Update status based on Stripe session status
        let newStatus: "PENDING" | "VERIFIED" | "REJECTED" | "REQUIRES_REVIEW" = dbUser.kycStatus

        if (session.status === 'verified') {
          newStatus = 'VERIFIED'
        } else if (session.status === 'requires_input') {
          newStatus = 'REQUIRES_REVIEW'
        } else if (session.status === 'canceled') {
          newStatus = 'REJECTED'
        }

        // Update database if status changed
        if (newStatus !== dbUser.kycStatus) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { kycStatus: newStatus },
          })

          return NextResponse.json({
            kycStatus: newStatus,
            sessionStatus: session.status,
            lastError: session.last_error?.reason,
          })
        }
      } catch (error) {
        console.error('Error fetching verification session:', error)
      }
    }

    return NextResponse.json({
      kycStatus: dbUser.kycStatus,
      kycProviderId: dbUser.kycProviderId,
    })
  } catch (error: any) {
    console.error('Error checking KYC status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check KYC status' },
      { status: 500 }
    )
  }
}
