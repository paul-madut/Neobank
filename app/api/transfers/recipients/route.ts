import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import {
  findRecipient,
  getRecentRecipients,
  toPublicRecipient,
} from '@/lib/transfer-utils'
import {
  notFound,
  serverError,
  tooManyRequests,
  unauthorized,
} from '@/lib/api-utils'
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

    // Recipient lookup confirms whether an email belongs to a customer, so it
    // is an enumeration oracle by design. It cannot be removed without breaking
    // send-by-email, so it is rate limited and the response is trimmed to the
    // minimum needed to confirm the payee.
    const limit = rateLimit(
      `transfers:recipients:${user.id}`,
      RATE_LIMITS.recipientLookup
    )
    if (!limit.allowed) {
      return tooManyRequests(limit.retryAfterSeconds)
    }

    // Find user in database
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    })

    if (!dbUser) {
      return notFound('User not found')
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
      const identifier = query.trim()
      const recipient = await findRecipient(identifier)

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

      // Redacted on purpose. The full record holds the recipient's email, real
      // full name, internal account ID and full account number; none of that is
      // needed to confirm you are paying the right person.
      return NextResponse.json({
        recipients: [toPublicRecipient(recipient, identifier)],
      })
    }

    // If no query or mode, return empty
    return NextResponse.json({ recipients: [] })
  } catch (error) {
    return serverError('transfers/recipients', error)
  }
}
