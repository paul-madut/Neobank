"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, LayoutDashboard, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalRouteError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // The full error object goes to the console for whoever is debugging.
    // It is deliberately never rendered: a real 500 in this app leaked the
    // absolute filesystem path, the bundler chunk name, and the database host
    // and port straight into the page.
    console.error("Unhandled application error:", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>

          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
            Something went wrong
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            This page hit an unexpected error and could not finish loading. No
            balances, cards, or transfers were changed. Try again, and if it
            keeps happening head back to your dashboard.
          </p>

          {error.digest && (
            <div className="mt-6 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 p-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                Reference for this error
              </p>
              <p className="font-mono text-sm text-zinc-900 dark:text-white break-all">
                {error.digest}
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button
              onClick={reset}
              className="w-full sm:flex-1 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900"
            >
              <RotateCw className="w-4 h-4 mr-2" />
              Try again
            </Button>
            <Link href="/dashboard" className="w-full sm:flex-1">
              <Button variant="outline" className="w-full">
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Back to dashboard
              </Button>
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-500">
          NeoBank is a portfolio demo. Stripe runs in test mode and Plaid in
          sandbox, so nothing here moves real money.
        </p>
      </div>
    </div>
  )
}
