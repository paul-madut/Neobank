"use client"

import { format } from "date-fns"
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  DollarSign,
  RefreshCw,
  AlertCircle,
} from "lucide-react"
import type { TransactionWithDetails } from "@/types/account"

interface TransactionItemProps {
  transaction: TransactionWithDetails
  onClick?: () => void
}

export function TransactionItem({ transaction, onClick }: TransactionItemProps) {
  const amount =
    typeof transaction.amount === "string"
      ? parseFloat(transaction.amount)
      : transaction.amount

  // Determine if this is a credit (money in) or debit (money out)
  const isCredit = ["DEPOSIT", "ACH_CREDIT", "REFUND"].includes(transaction.type)
  const isDebit = ["WITHDRAWAL", "ACH_DEBIT", "CARD_AUTHORIZATION", "CARD_CAPTURE", "FEE"].includes(transaction.type)

  const getTransactionIcon = () => {
    switch (transaction.type) {
      case "DEPOSIT":
        return <ArrowDownLeft className="w-5 h-5" />
      case "WITHDRAWAL":
        return <ArrowUpRight className="w-5 h-5" />
      case "ACH_CREDIT":
        return <ArrowDownLeft className="w-5 h-5" />
      case "ACH_DEBIT":
        return <ArrowUpRight className="w-5 h-5" />
      case "CARD_AUTHORIZATION":
      case "CARD_CAPTURE":
        return <CreditCard className="w-5 h-5" />
      case "REFUND":
        return <RefreshCw className="w-5 h-5" />
      case "FEE":
        return <AlertCircle className="w-5 h-5" />
      case "P2P_TRANSFER":
        return <DollarSign className="w-5 h-5" />
      default:
        return <DollarSign className="w-5 h-5" />
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
    <div
      className={`flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-all ${
        onClick ? "cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-4 flex-1">
        {/* Icon */}
        <div
          className={`p-3 rounded-full ${
            isCredit
              ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
              : isDebit
              ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
          }`}
        >
          {getTransactionIcon()}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-zinc-900 dark:text-white truncate">
              {transaction.description || getTypeLabel(transaction.type)}
            </p>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                transaction.status
              )}`}
            >
              {transaction.status}
            </span>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {format(new Date(transaction.createdAt), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
      </div>

      {/* Amount */}
      <div className="text-right">
        <p
          className={`text-lg font-semibold ${
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
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          {getTypeLabel(transaction.type)}
        </p>
      </div>
    </div>
  )
}
