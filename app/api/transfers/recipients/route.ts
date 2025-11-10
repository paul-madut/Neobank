import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { findRecipient, getRecentRecipients } from '@/lib/transfer-utils'

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
    const query = searchParams.get('q')
    const mode = searchParams.get('mode') // 'search' or 'recent'

    // If mode is recent, get recent recipients
    if (mode === 'recent') {
      const recentRecipients = await getRecentRecipients(dbUser.id, 5)
      return NextResponse.json({ recipients: recentRecipients })
    }

    // If query is provided, search for recipient
    if (query && query.trim()) {
      const recipient = await findRecipient(query.trim())

      if (!recipient) {
        return NextResponse.json({
          recipients: [],
          message: 'No recipient found',
        })
      }

      // Don't allow searching for yourself
      if (recipient.id === dbUser.id) {
        return NextResponse.json({
          recipients: [],
          message: 'Cannot transfer to yourself',
        })
      }

      return NextResponse.json({ recipients: [recipient] })
    }

    // If no query or mode, return empty
    return NextResponse.json({ recipients: [] })
  } catch (error: any) {
    console.error('Error in recipient search:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to search recipients' },
      { status: 500 }
    )
  }
}
