import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/admin'
import { forbidden, serverError } from '@/lib/api-utils'

/** List transfers held for manual review. Admin only. */
export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return forbidden('Admin access required')
    }

    const pending = await prisma.transaction.findMany({
      where: { status: 'PENDING', type: 'P2P_TRANSFER' },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        toAccount: {
          select: {
            accountNumber: true,
            user: { select: { email: true } },
          },
        },
      },
    })

    return NextResponse.json({
      transfers: pending.map((transfer) => ({
        id: transfer.id,
        amount: transfer.amount.toString(),
        currency: transfer.currency,
        description: transfer.description,
        createdAt: transfer.createdAt,
        senderEmail: transfer.user.email,
        senderName:
          [transfer.user.firstName, transfer.user.lastName]
            .filter(Boolean)
            .join(' ') || transfer.user.email,
        recipientEmail: transfer.toAccount?.user?.email ?? null,
        recipientAccountNumber: transfer.toAccount
          ? `••••${transfer.toAccount.accountNumber.slice(-4)}`
          : null,
      })),
    })
  } catch (error) {
    return serverError('admin/transfers', error)
  }
}
