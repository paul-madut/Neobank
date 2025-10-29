import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase-server"
import { prisma } from "@/lib/prisma"
import { KYCVerificationClient } from "./kyc-client"

export default async function KYCPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
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
    console.error("Error fetching KYC status:", error)
  }

  return <KYCVerificationClient kycStatus={kycStatus} userEmail={user.email || ""} />
}
