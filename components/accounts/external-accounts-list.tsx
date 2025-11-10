"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AccountCard } from "./account-card"
import { RefreshCw, Trash2 } from "lucide-react"
import type { ExternalAccount } from "@/types/account"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"

interface ExternalAccountsListProps {
  accounts: ExternalAccount[]
  onRefresh?: () => void
  onAccountDeleted?: () => void
}

export function ExternalAccountsList({
  accounts,
  onRefresh,
  onAccountDeleted,
}: ExternalAccountsListProps) {
  const [refreshing, setRefreshing] = useState(false)
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null)
  const [accountToDelete, setAccountToDelete] = useState<ExternalAccount | null>(null)

  const handleRefresh = async () => {
    if (!onRefresh) return

    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  const handleDeleteClick = (account: ExternalAccount) => {
    setAccountToDelete(account)
  }

  const handleDeleteConfirm = async () => {
    if (!accountToDelete) return

    setDeletingAccountId(accountToDelete.id)
    try {
      const response = await fetch(`/api/plaid/accounts/${accountToDelete.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account')
      }

      toast.success('Bank account removed successfully')
      setAccountToDelete(null)

      // Refresh the accounts list
      if (onAccountDeleted) {
        onAccountDeleted()
      } else if (onRefresh) {
        onRefresh()
      }
    } catch (error: any) {
      console.error('Error deleting account:', error)
      toast.error(error.message || 'Failed to remove bank account')
    } finally {
      setDeletingAccountId(null)
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
          <div key={account.id} className="relative group">
            <AccountCard
              accountName={account.accountName || account.officialName || "Account"}
              accountNumber={account.mask}
              balance={account.currentBalance || account.availableBalance || 0}
              currency={account.currency}
              type={account.subtype || account.type}
              institutionName={account.institutionName}
            />
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDeleteClick(account)}
              disabled={deletingAccountId === account.id}
              className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Bank Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <strong>
                {accountToDelete?.institutionName} ••••{accountToDelete?.mask}
              </strong>
              ? This action cannot be undone.
              {accountToDelete?.verificationStatus === 'VERIFIED' && (
                <span className="block mt-2 text-yellow-600 dark:text-yellow-400">
                  Note: You will need to re-verify this account if you connect it again.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Last synced */}
      <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
        Last updated:{" "}
        {new Date(accounts[0]?.lastSynced || new Date()).toLocaleString()}
      </p>
    </div>
  )
}
