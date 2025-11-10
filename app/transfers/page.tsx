import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'
import { TransfersClient } from './transfers-client'

export default async function TransfersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user's internal account and KYC status
  let account = null
  let kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REQUIRES_REVIEW' =
    'PENDING'

  try {
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: {
        accounts: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    })

    if (dbUser) {
      kycStatus = dbUser.kycStatus

      if (dbUser.accounts[0]) {
        account = {
          ...dbUser.accounts[0],
          balance: dbUser.accounts[0].balance.toString(),
        }
      }
    }
  } catch (error) {
    console.error('Error fetching account:', error)
  }

  return (
    <TransfersClient
      account={account}
      userEmail={user.email || ''}
      kycStatus={kycStatus}
    />
  )
}
