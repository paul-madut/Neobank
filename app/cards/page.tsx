import { createClient } from "@/lib/supabase-server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { KYCBanner } from "@/components/kyc/kyc-banner"
import { CardsClient } from "./cards-client"

async function getAuthenticatedUser() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/sign-in")
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  })

  if (!dbUser) {
    redirect("/sign-in")
  }

  return dbUser
}

async function getKYCStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kycStatus: true },
  })

  return user?.kycStatus || "PENDING"
}

export default async function CardsPage() {
  const user = await getAuthenticatedUser()
  const kycStatus = await getKYCStatus(user.id)

  return (
    <div className="flex h-screen overflow-hidden">
      <DashboardSidebar userEmail={user.email} kycStatus={kycStatus} />
      <div className="flex-1 overflow-y-auto">
        <KYCBanner kycStatus={kycStatus} />
        <div className="p-8">
          <div className="mx-auto max-w-7xl space-y-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
                Virtual Cards
              </h1>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                Create and manage your virtual debit cards for secure online
                shopping
              </p>
            </div>

            <CardsClient />
          </div>
        </div>
      </div>
    </div>
  )
}
