import Link from "next/link"
import { Compass, Home, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
            <Compass className="h-6 w-6 text-zinc-600 dark:text-zinc-300" />
          </div>

          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            404
          </p>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
            Page not found
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            The page you are looking for does not exist, or it moved somewhere
            else. Check the address, or pick one of the routes below.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link href="/dashboard" className="w-full sm:flex-1">
              <Button className="w-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900">
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Go to dashboard
              </Button>
            </Link>
            <Link href="/" className="w-full sm:flex-1">
              <Button variant="outline" className="w-full">
                <Home className="w-4 h-4 mr-2" />
                Home
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
