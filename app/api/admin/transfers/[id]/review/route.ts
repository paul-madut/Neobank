import { NextRequest, NextResponse } from 'next/server'
import {
  approvePendingTransfer,
  rejectPendingTransfer,
} from '@/lib/transfer-utils'
import { getAdminUser } from '@/lib/admin'
import {
  badRequest,
  forbidden,
  serverError,
  validationError,
} from '@/lib/api-utils'
import { z } from 'zod'

const reviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().max(500).optional(),
})

/**
 * Approve or reject a held transfer.
 *
 * Approval posts the ledger entries now, which means the balance guard runs
 * now: if the sender spent the money while the transfer sat in review, the
 * approval fails rather than overdrawing them.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return forbidden('Admin access required')
    }

    const { id } = await params

    const parsed = reviewSchema.safeParse(await request.json())
    if (!parsed.success) {
      return validationError(parsed.error)
    }

    const { decision, note } = parsed.data

    const result =
      decision === 'APPROVE'
        ? await approvePendingTransfer(id, admin.id, note)
        : await rejectPendingTransfer(id, admin.id, note)

    if (!result.success) {
      return badRequest(result.error || 'Review failed')
    }

    return NextResponse.json({ success: true, status: result.status })
  } catch (error) {
    return serverError('admin/transfers/review', error)
  }
}
