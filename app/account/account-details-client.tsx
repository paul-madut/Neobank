"use client"

import { useState } from "react"
import { InternalAccountCard } from "@/components/accounts/internal-account-card"
import { TransactionList } from "@/components/transactions/transaction-list"
import { TransactionDetails } from "@/components/transactions/transaction-details"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Copy,
  Check,
  Eye,
  EyeOff,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import Link from "next/link"
import type { InternalAccount, TransactionWithDetails } from "@/types/account"

interface AccountDetailsClientProps {
  account: InternalAccount | null
  userEmail: string
}

export function AccountDetailsClient({
  account,
  userEmail,
}: AccountDetailsClientProps) {
  const [showFullAccount, setShowFullAccount] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const handleTransactionClick = (transaction: TransactionWithDetails) => {
    setSelectedTransaction(transaction)
    setIsDetailsOpen(true)
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            No account found
          </p>
          <Link href="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  const balance =
    typeof account.balance === "string"
      ? parseFloat(account.balance)
      : account.balance

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      toast.success(`${fieldName} copied to clipboard`)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      toast.error(`Failed to copy ${fieldName}`)
    }
  }

  const createdDate = new Date(account.createdAt)

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
                Account Details
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400">{userEmail}</p>
            </div>
          </div>
        </div>

        {/* Account Overview Card */}
        <div className="mb-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 p-8 shadow-lg">
          <div className="space-y-6">
            {/* Balance */}
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                Available Balance
              </p>
              <h2 className="text-5xl font-bold text-zinc-900 dark:text-white">
                ${balance.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </h2>
            </div>

            {/* Account Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
              {/* Account Number */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Account Number
                  </p>
                  <button
                    onClick={() => setShowFullAccount(!showFullAccount)}
                    className="p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                  >
                    {showFullAccount ? (
                      <EyeOff className="w-3 h-3 text-zinc-500" />
                    ) : (
                      <Eye className="w-3 h-3 text-zinc-500" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-semibold text-zinc-900 dark:text-white">
                    {showFullAccount
                      ? account.accountNumber
                      : `••••${account.accountNumber.slice(-4)}`}
                  </p>
                  <button
                    onClick={() =>
                      copyToClipboard(account.accountNumber, "Account number")
                    }
                    className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                  >
                    {copiedField === "Account number" ? (
                      <Check className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-zinc-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* Routing Number */}
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                  Routing Number
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-semibold text-zinc-900 dark:text-white">
                    {account.routingNumber}
                  </p>
                  <button
                    onClick={() =>
                      copyToClipboard(account.routingNumber, "Routing number")
                    }
                    className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                  >
                    {copiedField === "Routing number" ? (
                      <Check className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-zinc-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* Account Type */}
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                  Account Type
                </p>
                <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                  {account.accountType}
                </span>
              </div>

              {/* Status */}
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                  Status
                </p>
                <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                  {account.status}
                </span>
              </div>
            </div>

            {/* Opening Date */}
            <div className="flex items-center gap-2 pt-2 text-sm text-zinc-600 dark:text-zinc-400">
              <Calendar className="w-4 h-4" />
              <span>Account opened on {format(createdDate, "MMMM d, yyyy")}</span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                This Month
              </p>
              <Activity className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-3xl font-bold text-zinc-900 dark:text-white mb-1">
              12
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Transactions
            </p>
          </div>

          <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Money In
              </p>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
              +$2,250
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Total deposits
            </p>
          </div>

          <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Money Out
              </p>
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">
              -$309.48
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Total spending
            </p>
          </div>
        </div>

        {/* Transaction History */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-6">
            Transaction History
          </h2>
          <TransactionList
            limit={20}
            showLoadMore={true}
            onTransactionClick={handleTransactionClick}
          />
        </div>

        {/* Transaction Details Modal */}
        <TransactionDetails
          transaction={selectedTransaction}
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
        />
      </div>
    </div>
  )
}
