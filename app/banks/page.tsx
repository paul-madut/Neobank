"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PlaidLinkButton } from "@/components/plaid/plaid-link-button"
import { ExternalAccountsList } from "@/components/accounts/external-accounts-list"
import { ArrowLeft, Plus, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { ExternalAccount } from "@/types/account"

export default function BanksPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<ExternalAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kycStatus, setKycStatus] = useState<string | null>(null)

  const fetchAccounts = async (refresh = false) => {
    try {
      setLoading(true)
      const url = refresh
        ? "/api/plaid/accounts?refresh=true"
        : "/api/plaid/accounts"

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error("Failed to fetch accounts")
      }

      const data = await response.json()
      setAccounts(data.externalAccounts || [])
    } catch (err: any) {
      console.error("Error fetching accounts:", err)
      setError(err.message || "Failed to load accounts")
    } finally {
      setLoading(false)
    }
  }

  const fetchKYCStatus = async () => {
    try {
      const response = await fetch("/api/kyc/status")
      if (response.ok) {
        const data = await response.json()
        setKycStatus(data.kycStatus)
      }
    } catch (err) {
      console.error("Error fetching KYC status:", err)
    }
  }

  useEffect(() => {
    fetchAccounts()
    fetchKYCStatus()
  }, [])

  const handleConnectClick = () => {
    if (kycStatus !== "VERIFIED") {
      toast.error("KYC verification required to connect banks")
      router.push("/kyc")
    }
  }

  const handleLinkSuccess = () => {
    // Refresh accounts after successful link
    fetchAccounts()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                External Bank Accounts
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400">
                Connect and manage your external bank accounts
              </p>
            </div>

            {kycStatus === "VERIFIED" ? (
              <PlaidLinkButton
                onSuccess={handleLinkSuccess}
                className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900"
              >
                <Plus className="w-4 h-4 mr-2" />
                Connect Bank
              </PlaidLinkButton>
            ) : (
              <Button
                onClick={handleConnectClick}
                className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900"
              >
                <ShieldAlert className="w-4 h-4 mr-2" />
                Connect Bank
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-lg">
          {loading && accounts.length === 0 ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 dark:border-white mx-auto"></div>
              <p className="mt-4 text-zinc-600 dark:text-zinc-400">
                Loading accounts...
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={() => fetchAccounts()}
                className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <ExternalAccountsList
              accounts={accounts}
              onRefresh={() => fetchAccounts(true)}
              onAccountDeleted={() => fetchAccounts()}
            />
          )}
        </div>

        {/* Info Section */}
        <div className="mt-6 p-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            About External Accounts
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Connect your existing bank accounts securely via Plaid</li>
            <li>• View real-time balances from all your connected accounts</li>
            <li>• ACH transfers will be available in a future update</li>
            <li>
              • Your credentials are encrypted and never stored on our servers
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
