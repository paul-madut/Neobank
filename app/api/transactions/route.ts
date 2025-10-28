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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type') // Filter by transaction type
    const status = searchParams.get('status') // Filter by status
    const dateFrom = searchParams.get('dateFrom') // Start date
    const dateTo = searchParams.get('dateTo') // End date

    // Find user in database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    })

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Build filter conditions
    const where: any = {
      userId: dbUser.id,
    }

    if (type) {
      where.type = type
    }

    if (status) {
      where.status = status
    }

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo)
      }
    }

    // Fetch transactions
    const [transactions, totalCount] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          fromAccount: {
            select: {
              id: true,
              accountNumber: true,
              accountType: true,
            },
          },
          toAccount: {
            select: {
              id: true,
              accountNumber: true,
              accountType: true,
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
      }),
      prisma.transaction.count({ where }),
    ])

    // Serialize transactions (convert Decimal to string)
    const serializedTransactions = transactions.map((tx) => ({
      ...tx,
      amount: tx.amount.toString(),
      ledgerEntries: tx.ledgerEntries.map((entry) => ({
        ...entry,
        amount: entry.amount.toString(),
        balanceAfter: entry.balanceAfter.toString(),
      })),
    }))

    return NextResponse.json({
      transactions: serializedTransactions,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    })
  } catch (error: any) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}
