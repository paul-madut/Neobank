"use client"

import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  DollarSign,
  RefreshCw,
  AlertCircle,
  Calendar,
  Hash,
  Building2,
} from "lucide-react"
import type { TransactionWithDetails } from "@/types/account"

interface TransactionDetailsProps {
  transaction: TransactionWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TransactionDetails({
  transaction,
  open,
  onOpenChange,
}: TransactionDetailsProps) {
  if (!transaction) return null

  const amount =
    typeof transaction.amount === "string"
      ? parseFloat(transaction.amount)
      : transaction.amount

  const isCredit = ["DEPOSIT", "ACH_CREDIT", "REFUND"].includes(transaction.type)
  const isDebit = ["WITHDRAWAL", "ACH_DEBIT", "CARD_AUTHORIZATION", "CARD_CAPTURE", "FEE"].includes(transaction.type)

  const getTransactionIcon = () => {
    switch (transaction.type) {
      case "DEPOSIT":
        return <ArrowDownLeft className="w-6 h-6" />
      case "WITHDRAWAL":
        return <ArrowUpRight className="w-6 h-6" />
      case "ACH_CREDIT":
        return <ArrowDownLeft className="w-6 h-6" />
      case "ACH_DEBIT":
        return <ArrowUpRight className="w-6 h-6" />
      case "CARD_AUTHORIZATION":
      case "CARD_CAPTURE":
        return <CreditCard className="w-6 h-6" />
      case "REFUND":
        return <RefreshCw className="w-6 h-6" />
      case "FEE":
        return <AlertCircle className="w-6 h-6" />
      case "P2P_TRANSFER":
        return <DollarSign className="w-6 h-6" />
      default:
        return <DollarSign className="w-6 h-6" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
      case "PENDING":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
      case "PROCESSING":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
      case "FAILED":
        return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
      case "CANCELLED":
        return "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
      default:
        return "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
    }
  }

  const getTypeLabel = (type: string) => {
    return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
          <DialogDescription>
            Complete information about this transaction
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Amount Card */}
          <div className="flex items-center gap-4 p-6 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div
              className={`p-4 rounded-full ${
                isCredit
                  ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                  : isDebit
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {getTransactionIcon()}
            </div>
            <div className="flex-1">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                Amount
              </p>
              <p
                className={`text-3xl font-bold ${
                  isCredit
                    ? "text-green-600 dark:text-green-400"
                    : isDebit
                    ? "text-red-600 dark:text-red-400"
                    : "text-zinc-900 dark:text-white"
                }`}
              >
                {isCredit ? "+" : isDebit ? "-" : ""}$
                {amount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>

          {/* Transaction Info */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-zinc-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                  Date & Time
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {format(new Date(transaction.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-zinc-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                  Description
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {transaction.description || getTypeLabel(transaction.type)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Hash className="w-5 h-5 text-zinc-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                  Transaction Type
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {getTypeLabel(transaction.type)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                Status
              </p>
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(
                  transaction.status
                )}`}
              >
                {transaction.status}
              </span>
            </div>
          </div>

          {/* Ledger Entries (if available) */}
          {transaction.ledgerEntries && transaction.ledgerEntries.length > 0 && (
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <p className="text-sm font-medium text-zinc-900 dark:text-white mb-3">
                Ledger Entries
              </p>
              <div className="space-y-2">
                {transaction.ledgerEntries.map((entry) => {
                  const entryAmount =
                    typeof entry.amount === "string"
                      ? parseFloat(entry.amount)
                      : entry.amount
                  const balanceAfter =
                    typeof entry.balanceAfter === "string"
                      ? parseFloat(entry.balanceAfter)
                      : entry.balanceAfter

                  return (
                    <div
                      key={entry.id}
                      className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`font-medium ${
                            entry.entryType === "CREDIT"
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {entry.entryType}
                        </span>
                        <span className="text-zinc-900 dark:text-white font-semibold">
                          ${entryAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Balance after: ${balanceAfter.toFixed(2)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Transaction ID */}
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono pt-2 border-t border-zinc-200 dark:border-zinc-800">
            ID: {transaction.id}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
