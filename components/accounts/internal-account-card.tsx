"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  ArrowDownToLine,
  CreditCard,
  Copy,
  Eye,
  EyeOff,
  Check,
  Calendar
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import type { InternalAccount } from "@/types/account"

interface InternalAccountCardProps {
  account: InternalAccount
}

export function InternalAccountCard({ account }: InternalAccountCardProps) {
  const [showFullAccount, setShowFullAccount] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
      case "FROZEN":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
      case "CLOSED":
        return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
      default:
        return "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "CHECKING":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800"
      case "SAVINGS":
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
      default:
        return "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
    }
  }

  const createdDate = new Date(account.createdAt)

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 p-8 shadow-lg">
      <div className="space-y-8">
        {/* Header with Badges */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
              Total Balance
            </p>
            <h2 className="text-4xl font-bold text-zinc-900 dark:text-white">
              ${balance.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            <span
              className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                account.status
              )}`}
            >
              {account.status}
            </span>
            <span
              className={`px-3 py-1 text-xs font-medium rounded-full border ${getTypeColor(
                account.accountType
              )}`}
            >
              {account.accountType}
            </span>
          </div>
        </div>

        {/* Account Opening Date */}
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <Calendar className="w-3.5 h-3.5" />
          <span>Opened {format(createdDate, "MMMM d, yyyy")}</span>
        </div>

        {/* Account Details with Copy */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          {/* Account Number */}
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              Account Number
            </p>
            <div className="flex items-center gap-2">
              <p className="text-sm font-mono font-medium text-zinc-900 dark:text-white">
                {showFullAccount
                  ? account.accountNumber
                  : `••••${account.accountNumber.slice(-4)}`}
              </p>
              <button
                onClick={() => setShowFullAccount(!showFullAccount)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                aria-label={showFullAccount ? "Hide account number" : "Show account number"}
              >
                {showFullAccount ? (
                  <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-zinc-500" />
                )}
              </button>
              <button
                onClick={() => copyToClipboard(account.accountNumber, "Account number")}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                aria-label="Copy account number"
              >
                {copiedField === "Account number" ? (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-zinc-500" />
                )}
              </button>
            </div>
          </div>

          {/* Routing Number */}
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              Routing Number
            </p>
            <div className="flex items-center gap-2">
              <p className="text-sm font-mono font-medium text-zinc-900 dark:text-white">
                {account.routingNumber}
              </p>
              <button
                onClick={() => copyToClipboard(account.routingNumber, "Routing number")}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                aria-label="Copy routing number"
              >
                {copiedField === "Routing number" ? (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-zinc-500" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            variant="default"
            className="w-full"
            disabled
          >
            <ArrowDownToLine className="w-4 h-4 mr-2" />
            Add Money
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Add Card
          </Button>
        </div>

        <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">
          Coming soon: Add money and virtual cards
        </p>
      </div>
    </div>
  )
}
