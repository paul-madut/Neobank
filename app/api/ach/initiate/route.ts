import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { executeACHTransfer } from '@/lib/transfer-utils'
import { prisma } from '@/lib/prisma'
import { achInitiateSchema, idempotencyKey } from '@/lib/validation'
import {
  badRequest,
  notFound,
  serverError,
  tooManyRequests,
  unauthorized,
  validationError,
} from '@/lib/api-utils'
import { RATE_LIMITS, rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return unauthorized()
    }

    const limit = rateLimit(`ach:initiate:${authUser.id}`, RATE_LIMITS.transfer)
    if (!limit.allowed) {
      return tooManyRequests(limit.retryAfterSeconds)
    }

    // Same contract as P2P: the client owns the key, so a retried request
    // settles the same ACH transfer rather than starting a second one.
    const keyResult = idempotencyKey.safeParse(
      request.headers.get('Idempotency-Key') ?? ''
    )
    if (!keyResult.success) {
      return badRequest('An Idempotency-Key header is required for transfers')
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    })

    if (!user) {
      return notFound('User not found')
    }

    const parsed = achInitiateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return validationError(parsed.error)
    }

    const { externalAccountId, amount, direction, description } = parsed.data

    // Execute ACH transfer
    const result = await executeACHTransfer(
      user.id,
      externalAccountId,
      amount,
      direction,
      keyResult.data,
      description
    )

    if (!result.success) {
      return badRequest(result.error || 'ACH transfer failed')
    }

    return NextResponse.json({
      success: true,
      achTransferId: result.achTransferId,
      transactionId: result.transactionId,
      status: result.status,
      replayed: result.replayed ?? false,
      message:
        result.status === 'COMPLETED'
          ? 'ACH transfer settled.'
          : 'ACH transfer initiated. It may take 1-3 business days to complete.',
    })
  } catch (error) {
    return serverError('ach/initiate', error)
  }
}
