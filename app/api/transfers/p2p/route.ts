import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { executeP2PTransfer } from '@/lib/transfer-utils'
import { idempotencyKey, p2pTransferSchema } from '@/lib/validation'
import {
  badRequest,
  notFound,
  serverError,
  tooManyRequests,
  unauthorized,
  validationError,
} from '@/lib/api-utils'
import { RATE_LIMITS, rateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return unauthorized()
    }

    const limit = rateLimit(`transfers:p2p:${user.id}`, RATE_LIMITS.transfer)
    if (!limit.allowed) {
      return tooManyRequests(limit.retryAfterSeconds)
    }

    // The key must come from the client and must be stable across retries of
    // the same logical transfer. Generating one here would make every retry a
    // new transfer, which is exactly the bug this replaces.
    const keyResult = idempotencyKey.safeParse(
      request.headers.get('Idempotency-Key') ?? ''
    )
    if (!keyResult.success) {
      return badRequest(
        'An Idempotency-Key header is required for transfers'
      )
    }

    // Find user in database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    })

    if (!dbUser) {
      return notFound('User not found')
    }

    const parsed = p2pTransferSchema.safeParse(await request.json())
    if (!parsed.success) {
      return validationError(parsed.error)
    }

    const { recipientIdentifier, amount, description } = parsed.data

    // Execute transfer
    const result = await executeP2PTransfer(
      dbUser.id,
      recipientIdentifier,
      amount,
      keyResult.data,
      description
    )

    if (!result.success) {
      return badRequest(result.error || 'Transfer failed')
    }

    // Get the created transaction with details
    const transaction = await prisma.transaction.findUnique({
      where: { id: result.transactionId },
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
        ledgerEntries: true,
      },
    })

    if (!transaction) {
      return notFound('Transaction not found')
    }

    // Serialize transaction (convert Decimal to string)
    const serializedTransaction = {
      ...transaction,
      amount: transaction.amount.toString(),
      fromAccount: transaction.fromAccount
        ? {
            ...transaction.fromAccount,
            balance: transaction.fromAccount.balance.toString(),
          }
        : null,
      toAccount: transaction.toAccount
        ? {
            ...transaction.toAccount,
            balance: transaction.toAccount.balance.toString(),
          }
        : null,
      ledgerEntries: transaction.ledgerEntries.map((entry) => ({
        ...entry,
        amount: entry.amount.toString(),
        balanceAfter: entry.balanceAfter.toString(),
      })),
    }

    return NextResponse.json({
      success: true,
      transaction: serializedTransaction,
      status: result.status,
      replayed: result.replayed ?? false,
      message:
        result.status === 'PENDING'
          ? 'Transfer is being held for manual review'
          : 'Transfer completed successfully',
    })
  } catch (error) {
    return serverError('transfers/p2p', error)
  }
}
