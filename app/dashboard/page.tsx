import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase-server"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                Welcome to your Dashboard
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400">
                Logged in as {user.email}
              </p>
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

          <div className="grid gap-6 md:grid-cols-3">
            <div className="p-6 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                Account Balance
              </h2>
              <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                $0.00
              </p>
            </div>

            <div className="p-6 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                Transactions
              </h2>
              <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                0
              </p>
            </div>

            <div className="p-6 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                Saved
              </h2>
              <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                $0.00
              </p>
            </div>
          </div>

          <div className="mt-8 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
              Recent Activity
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400">
              No recent activity. Your transactions will appear here.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
