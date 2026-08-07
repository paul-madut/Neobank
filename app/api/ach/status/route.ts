import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { notFound, serverError, unauthorized } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return unauthorized()
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    })

    if (!user) {
      return notFound('User not found')
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
        return notFound('ACH transfer not found')
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
    return serverError('ach/status', error)
  }
}
