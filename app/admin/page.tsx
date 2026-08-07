import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getAdminUser } from "@/lib/admin"
import { AdminClient } from "./admin-client"

export default async function AdminPage() {
  const admin = await getAdminUser()

  // Not an admin and not signed in look the same from outside, so the page does
  // not confirm that an admin surface exists.
  if (!admin) {
    redirect("/dashboard")
  }

  const pending = await prisma.transaction.findMany({
    where: { status: "PENDING", type: "P2P_TRANSFER" },
    orderBy: { createdAt: "asc" },
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

  const transfers = pending.map((transfer) => ({
    id: transfer.id,
    amount: transfer.amount.toString(),
    description: transfer.description,
    createdAt: transfer.createdAt.toISOString(),
    senderEmail: transfer.user.email,
    senderName:
      [transfer.user.firstName, transfer.user.lastName]
        .filter(Boolean)
        .join(" ") || transfer.user.email,
    recipientEmail: transfer.toAccount?.user?.email ?? null,
    recipientAccountNumber: transfer.toAccount
      ? `••••${transfer.toAccount.accountNumber.slice(-4)}`
      : null,
  }))

  return <AdminClient transfers={transfers} adminEmail={admin.email} />
}
