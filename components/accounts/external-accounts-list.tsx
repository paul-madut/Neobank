"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AccountCard } from "./account-card"
import { RefreshCw } from "lucide-react"
import type { ExternalAccount } from "@/types/account"

interface ExternalAccountsListProps {
  accounts: ExternalAccount[]
  onRefresh?: () => void
}

export function ExternalAccountsList({
  accounts,
  onRefresh,
}: ExternalAccountsListProps) {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (!onRefresh) return

    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12 px-4 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
        <p className="text-zinc-600 dark:text-zinc-400 mb-2">
          No external bank accounts connected
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          Connect a bank account to get started
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
          Connected Accounts ({accounts.length})
        </h3>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        )}
      </div>

      {/* Accounts grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <AccountCard
            key={account.id}
            accountName={account.accountName || account.officialName || "Account"}
            accountNumber={account.mask}
            balance={account.currentBalance || account.availableBalance || 0}
            currency={account.currency}
            type={account.subtype || account.type}
            institutionName={account.institutionName}
          />
        ))}
      </div>

      {/* Last synced */}
      <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
        Last updated:{" "}
        {new Date(accounts[0]?.lastSynced || new Date()).toLocaleString()}
      </p>
    </div>
  )
}
