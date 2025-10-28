"use client"

import { cn } from "@/lib/utils"

interface AccountCardProps {
  accountName: string
  accountNumber?: string
  balance: string | number
  currency?: string
  type?: string
  institutionName?: string
  className?: string
  onClick?: () => void
}

export function AccountCard({
  accountName,
  accountNumber,
  balance,
  currency = "USD",
  type,
  institutionName,
  className,
  onClick,
}: AccountCardProps) {
  const formattedBalance =
    typeof balance === "string"
      ? parseFloat(balance)
      : balance

  const isClickable = onClick !== undefined

  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 transition-all",
        isClickable && "cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md",
        className
      )}
      onClick={onClick}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-white">
              {accountName}
            </h3>
            {institutionName && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {institutionName}
              </p>
            )}
          </div>
          {type && (
            <span className="px-2 py-1 text-xs font-medium rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 capitalize">
              {type}
            </span>
          )}
        </div>

        {/* Balance */}
        <div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white">
            {currency === "USD" && "$"}
            {formattedBalance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          {accountNumber && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              ••••{accountNumber.slice(-4)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
