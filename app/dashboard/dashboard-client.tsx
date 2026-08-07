"use client"

import { InternalAccountCard } from "@/components/accounts/internal-account-card"
import { TransactionList } from "@/components/transactions/transaction-list"
import { KYCBanner } from "@/components/kyc/kyc-banner"
import { DemoModeBanner } from "@/components/demo/demo-mode-banner"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import type { InternalAccount } from "@/types/account"
import { displayAccountName } from "@/lib/demo"

export interface MonthlyStats {
  transactionCount: number
  moneyIn: string
  moneyOut: string
}

interface DashboardClientProps {
  account: InternalAccount | null
  userEmail: string
  kycStatus: "PENDING" | "VERIFIED" | "REJECTED" | "REQUIRES_REVIEW"
  monthlyStats: MonthlyStats
}

function formatAmount(value: string) {
  const amount = parseFloat(value)

  return `$${(Number.isFinite(amount) ? amount : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function DashboardClient({
  account,
  userEmail,
  kycStatus,
  monthlyStats,
}: DashboardClientProps) {
  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Sidebar */}
      <DashboardSidebar userEmail={userEmail} kycStatus={kycStatus} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Demo + KYC Banners */}
        <DemoModeBanner />
        <KYCBanner kycStatus={kycStatus} />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-8 max-w-6xl">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                Dashboard
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400">
                Welcome back, {displayAccountName(userEmail)}
              </p>
            </div>

            {/* Main Content */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Internal Account - Takes 2 columns */}
              <div className="lg:col-span-2">
                {account ? (
                  <InternalAccountCard account={account} kycStatus={kycStatus} />
                ) : (
                  <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
                    <p className="text-zinc-600 dark:text-zinc-400">
                      Loading account...
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="space-y-4">
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                  <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
                    Quick Actions
                  </h3>
                  <div className="space-y-3">
                    <Link href="/cards" className="block">
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                      >
                        Virtual Cards
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link href="/ach" className="block">
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                      >
                        Deposit / Withdraw
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link href="/banks" className="block">
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                      >
                        External Banks
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link href="/account" className="block">
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                      >
                        Transactions
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Stats */}
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                  <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
                    This Month
                  </h3>
                  <div className="flex justify-between">
                    <div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Transactions
                      </p>
                      <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {monthlyStats.transactionCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Spent
                      </p>
                      <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {formatAmount(monthlyStats.moneyOut)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                  Recent Activity
                </h2>
                <Link href="/account">
                  <Button variant="ghost">
                    View All
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
              <TransactionList limit={8} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
