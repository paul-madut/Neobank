"use client"

import { InternalAccountCard } from "@/components/accounts/internal-account-card"
import { Button } from "@/components/ui/button"
import { ExternalLink, ArrowRight } from "lucide-react"
import Link from "next/link"
import type { InternalAccount } from "@/types/account"

interface DashboardClientProps {
  account: InternalAccount | null
  userEmail: string
}

export function DashboardClient({ account, userEmail }: DashboardClientProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
              Dashboard
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">{userEmail}</p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Internal Account - Takes 2 columns */}
          <div className="lg:col-span-2">
            {account ? (
              <InternalAccountCard account={account} />
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
                <Link href="/banks" className="block">
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                  >
                    External Banks
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  disabled
                >
                  Transactions
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  disabled
                >
                  Settings
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
                This Month
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Transactions
                  </p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                    0
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Spent
                  </p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                    $0.00
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
            Recent Activity
          </h2>
          <div className="text-center py-12">
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              No recent activity
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              Your transactions will appear here
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
