"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function KYCPendingPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const checkStatus = async () => {
    setChecking(true)
    try {
      const response = await fetch("/api/kyc/status")
      if (response.ok) {
        const data = await response.json()
        setStatus(data.kycStatus)

        // If verified, redirect to success page
        if (data.kycStatus === "VERIFIED") {
          router.push("/kyc/success")
        }
      }
    } catch (error) {
      console.error("Error checking status:", error)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    // Check status immediately
    checkStatus()

    // Poll every 5 seconds
    const interval = setInterval(checkStatus, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>

        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-6">
          <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin" />
        </div>

        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4">
          Verification In Progress
        </h1>

        <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8">
          We're reviewing your documents. This usually takes 1-5 minutes.
        </p>

        <div className="mb-8 p-6 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <div className="space-y-3 text-sm text-left">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-zinc-700 dark:text-zinc-300">
                Documents uploaded successfully
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-500 flex-shrink-0 animate-spin" />
              <span className="text-zinc-700 dark:text-zinc-300">
                Verifying your identity...
              </span>
            </div>
          </div>
        </div>

        <Button
          onClick={checkStatus}
          disabled={checking}
          variant="outline"
          className="w-full"
        >
          {checking ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Checking Status...
            </>
          ) : (
            "Check Status"
          )}
        </Button>

        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          You'll be notified once verification is complete. Feel free to close this
          page.
        </p>
      </div>
    </div>
  )
}
