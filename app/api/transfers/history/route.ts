import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'

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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Get P2P transfer history
    const transfers = await prisma.transaction.findMany({
      where: {
        userId: dbUser.id,
        type: 'P2P_TRANSFER',
      },
      include: {
        fromAccount: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        toAccount: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        ledgerEntries: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    })

    // Get total count for pagination
    const totalCount = await prisma.transaction.count({
      where: {
        userId: dbUser.id,
        type: 'P2P_TRANSFER',
      },
    })

    // Serialize transfers (convert Decimal to string)
    const serializedTransfers = transfers.map((transfer) => ({
      ...transfer,
      amount: transfer.amount.toString(),
      fromAccount: transfer.fromAccount
        ? {
            ...transfer.fromAccount,
            balance: transfer.fromAccount.balance.toString(),
          }
        : null,
      toAccount: transfer.toAccount
        ? {
            ...transfer.toAccount,
            balance: transfer.toAccount.balance.toString(),
          }
        : null,
      ledgerEntries: transfer.ledgerEntries.map((entry) => ({
        ...entry,
        amount: entry.amount.toString(),
        balanceAfter: entry.balanceAfter.toString(),
      })),
    }))

    return NextResponse.json({
      transfers: serializedTransfers,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    })
  } catch (error: any) {
    console.error('Error in transfer history:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get transfer history' },
      { status: 500 }
    )
  }
}
