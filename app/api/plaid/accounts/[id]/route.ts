import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Await params in Next.js 15+
    const { id: accountId } = await params

    // Find the external account
    const externalAccount = await prisma.externalAccount.findUnique({
      where: { id: accountId },
    })

    if (!externalAccount) {
      return NextResponse.json(
        { error: 'External account not found' },
        { status: 404 }
      )
    }

    // Verify the account belongs to the user
    if (externalAccount.userId !== dbUser.id) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this account' },
        { status: 403 }
      )
    }

    // Check if there are any pending ACH transfers for this account
    const pendingTransfers = await prisma.aCHTransfer.findFirst({
      where: {
        externalAccountId: accountId,
        status: {
          in: ['PENDING', 'PROCESSING'],
        },
      },
    })

    if (pendingTransfers) {
      return NextResponse.json(
        {
          error:
            'Cannot delete account with pending transfers. Please wait for transfers to complete.',
        },
        { status: 400 }
      )
    }

    // Delete the external account
    await prisma.externalAccount.delete({
      where: { id: accountId },
    })

    return NextResponse.json({
      success: true,
      message: 'External account removed successfully',
    })
  } catch (error: any) {
    console.error('Error deleting external account:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to delete external account',
      },
      { status: 500 }
    )
  }
}
