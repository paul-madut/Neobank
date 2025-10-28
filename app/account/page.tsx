import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase-server"
import { prisma } from "@/lib/prisma"
import { AccountDetailsClient } from "./account-details-client"

export default async function AccountPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch user's internal account
  let account = null
  try {
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: {
        accounts: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    })

    if (dbUser?.accounts[0]) {
      account = {
        ...dbUser.accounts[0],
        balance: dbUser.accounts[0].balance.toString(),
      }
    }
  } catch (error) {
    console.error("Error fetching account:", error)
  }

  return <AccountDetailsClient account={account} userEmail={user.email || ""} />
}
