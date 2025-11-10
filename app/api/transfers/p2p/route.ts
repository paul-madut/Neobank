import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { executeP2PTransfer } from '@/lib/transfer-utils'

export async function POST(request: Request) {
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

    // Parse request body
    const body = await request.json()
    const { recipientIdentifier, amount, description } = body

    // Validate required fields
    if (!recipientIdentifier) {
      return NextResponse.json(
        { error: 'Recipient email or account number is required' },
        { status: 400 }
      )
    }

    if (!amount || typeof amount !== 'number') {
      return NextResponse.json(
        { error: 'Valid transfer amount is required' },
        { status: 400 }
      )
    }

    // Execute transfer
    const result = await executeP2PTransfer(
      dbUser.id,
      recipientIdentifier,
      amount,
      description
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
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
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
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
      message:
        result.status === 'PENDING'
          ? 'Transfer is pending review'
          : 'Transfer completed successfully',
    })
  } catch (error: any) {
    console.error('Error in P2P transfer:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process transfer' },
      { status: 500 }
    )
  }
}
