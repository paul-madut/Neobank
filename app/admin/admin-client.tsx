"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ShieldCheck, Check, X, Inbox } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

interface PendingTransfer {
  id: string
  amount: string
  description: string | null
  createdAt: string
  senderEmail: string
  senderName: string
  recipientEmail: string | null
  recipientAccountNumber: string | null
}

interface AdminClientProps {
  transfers: PendingTransfer[]
  adminEmail: string
}

export function AdminClient({ transfers, adminEmail }: AdminClientProps) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  const review = async (id: string, decision: "APPROVE" | "REJECT") => {
    setBusyId(id)

    try {
      const response = await fetch(`/api/admin/transfers/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Review failed")
      }

      toast.success(
        decision === "APPROVE" ? "Transfer approved and posted" : "Transfer rejected"
      )
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review failed")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard">
          <Button variant="outline" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-white dark:text-zinc-900" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              Transfer Review
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Signed in as {adminEmail}
            </p>
          </div>
        </div>

        <p className="mt-4 mb-8 text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl">
          Transfers at or above the review threshold are held and post no ledger
          entries until approved here. The balance check runs at approval time,
          so a transfer approved after the sender has spent the money will be
          rejected rather than overdrawing the account.
        </p>

        {transfers.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center">
            <Inbox className="h-10 w-10 mx-auto mb-4 text-zinc-400" />
            <p className="text-zinc-600 dark:text-zinc-400">
              Nothing is waiting for review.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {transfers.map((transfer) => (
              <div
                key={transfer.id}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                      ${Number(transfer.amount).toFixed(2)}
                    </div>
                    <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 truncate">
                      {transfer.senderName} to{" "}
                      {transfer.recipientEmail ?? transfer.recipientAccountNumber}
                    </div>
                    {transfer.description && (
                      <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-500 truncate">
                        {transfer.description}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                      Held {format(new Date(transfer.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      disabled={busyId === transfer.id}
                      onClick={() => review(transfer.id, "REJECT")}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                    <Button
                      disabled={busyId === transfer.id}
                      onClick={() => review(transfer.id, "APPROVE")}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
