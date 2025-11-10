import { Suspense } from 'react'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar'
import { KYCBanner } from '@/components/kyc/kyc-banner'
import ACHClient from './ach-client'

export default async function ACHPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user's KYC status
  let kycStatus: "PENDING" | "VERIFIED" | "REJECTED" | "REQUIRES_REVIEW" = "PENDING"

  try {
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    })

    if (dbUser) {
      kycStatus = dbUser.kycStatus
    }
  } catch (error) {
    console.error("Error fetching user:", error)
  }

  return (
    <div className="flex h-screen w-full bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Sidebar */}
      <DashboardSidebar userEmail={user.email || ""} kycStatus={kycStatus} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* KYC Banner */}
        <KYCBanner kycStatus={kycStatus} />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
                Deposit & Withdraw
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                Transfer money between your NeoBank account and external bank accounts
              </p>
            </div>

            <Suspense fallback={<div>Loading...</div>}>
              <ACHClient />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
