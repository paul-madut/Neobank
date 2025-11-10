import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { executeACHTransfer } from '@/lib/transfer-utils'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    const { externalAccountId, amount, direction, description } = body

    // Validate required fields
    if (!externalAccountId || !amount || !direction) {
      return NextResponse.json(
        { error: 'Missing required fields: externalAccountId, amount, direction' },
        { status: 400 }
      )
    }

    // Validate direction
    if (direction !== 'DEPOSIT' && direction !== 'WITHDRAWAL') {
      return NextResponse.json(
        { error: 'Invalid direction. Must be DEPOSIT or WITHDRAWAL' },
        { status: 400 }
      )
    }

    // Validate amount
    const transferAmount = parseFloat(amount)
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount. Must be a positive number' },
        { status: 400 }
      )
    }

    // Execute ACH transfer
    const result = await executeACHTransfer(
      user.id,
      externalAccountId,
      transferAmount,
      direction,
      description
    )

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'ACH transfer failed',
          status: result.status,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      achTransferId: result.achTransferId,
      transactionId: result.transactionId,
      status: result.status,
      message:
        'ACH transfer initiated successfully. It may take 1-3 business days to complete.',
    })
  } catch (error) {
    console.error('ACH initiation API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
