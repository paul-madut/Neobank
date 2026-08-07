import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import {
  notFound,
  serverError,
  tooManyRequests,
  unauthorized,
  validationError,
} from '@/lib/api-utils'
import { transactionQuerySchema } from '@/lib/validation'
import { RATE_LIMITS, rateLimit } from '@/lib/rate-limit'

export async function GET(request: Request) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return unauthorized()
    }

    const limit_ = rateLimit(`transactions:list:${user.id}`, RATE_LIMITS.read)
    if (!limit_.allowed) {
      return tooManyRequests(limit_.retryAfterSeconds)
    }

    // Query params used to be spread into a `where: any` straight off the URL,
    // so an unrecognised value reached Prisma untouched. Validate first, then
    // build a typed filter.
    const { searchParams } = new URL(request.url)
    const parsed = transactionQuerySchema.safeParse(
      Object.fromEntries(searchParams)
    )
    if (!parsed.success) {
      return validationError(parsed.error)
    }

    const { limit, offset, type, status, dateFrom, dateTo } = parsed.data

    // Find user in database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    })

    if (!dbUser) {
      return notFound('User not found')
    }

    // Build filter conditions. Scoped to the caller's own transactions.
    const where: Prisma.TransactionWhereInput = {
      userId: dbUser.id,
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
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
  } catch (error) {
    return serverError('transactions', error)
  }
}
