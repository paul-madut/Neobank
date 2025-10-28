"use client"

import { Button } from "@/components/ui/button"
import { ArrowDownToLine, CreditCard } from "lucide-react"
import type { InternalAccount } from "@/types/account"

interface InternalAccountCardProps {
  account: InternalAccount
}

export function InternalAccountCard({ account }: InternalAccountCardProps) {
  const balance =
    typeof account.balance === "string"
      ? parseFloat(account.balance)
      : account.balance

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 p-8 shadow-lg">
      <div className="space-y-6">
        {/* Header */}
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

        {/* Account Details */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              Account Number
            </p>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              ••••{account.accountNumber.slice(-4)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              Routing Number
            </p>
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              {account.routingNumber}
            </p>
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
