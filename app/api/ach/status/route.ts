import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const achTransferId = searchParams.get('id')

    if (achTransferId) {
      // Get specific ACH transfer
      const achTransfer = await prisma.aCHTransfer.findUnique({
        where: { id: achTransferId },
        include: {
          externalAccount: {
            select: {
              institutionName: true,
              mask: true,
              accountName: true,
            },
          },
          transaction: {
            select: {
              id: true,
              amount: true,
              status: true,
              description: true,
              createdAt: true,
            },
          },
        },
      })

      if (!achTransfer || achTransfer.userId !== user.id) {
        return NextResponse.json({ error: 'ACH transfer not found' }, { status: 404 })
      }

      return NextResponse.json({
        achTransfer: {
          id: achTransfer.id,
          direction: achTransfer.direction,
          amount: achTransfer.amount.toString(),
          currency: achTransfer.currency,
          status: achTransfer.status,
          failureReason: achTransfer.failureReason,
          expectedDate: achTransfer.expectedDate,
          createdAt: achTransfer.createdAt,
          externalAccount: achTransfer.externalAccount,
          transaction: achTransfer.transaction,
        },
      })
    }

    // Get all ACH transfers for user
    const achTransfers = await prisma.aCHTransfer.findMany({
      where: { userId: user.id },
      include: {
        externalAccount: {
          select: {
            institutionName: true,
            mask: true,
            accountName: true,
          },
        },
        transaction: {
          select: {
            id: true,
            amount: true,
            status: true,
            description: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({
      achTransfers: achTransfers.map((transfer) => ({
        id: transfer.id,
        direction: transfer.direction,
        amount: transfer.amount.toString(),
        currency: transfer.currency,
        status: transfer.status,
        failureReason: transfer.failureReason,
        expectedDate: transfer.expectedDate,
        createdAt: transfer.createdAt,
        externalAccount: transfer.externalAccount,
        transaction: transfer.transaction,
      })),
      total: achTransfers.length,
    })
  } catch (error) {
    console.error('ACH status API error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
