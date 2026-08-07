// Route-segment skeleton for /account. Mirrors AccountDetailsClient: header,
// the large balance/overview card, the three monthly stat tiles, and the
// transaction history list.
export default function AccountLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="container mx-auto px-4 py-8 max-w-6xl animate-pulse">
        {/* Header */}
        <div className="mb-8">
          <div className="h-5 w-40 rounded bg-zinc-200/70 dark:bg-zinc-800/70 mb-4" />
          <div className="h-9 w-56 rounded-lg bg-zinc-200 dark:bg-zinc-800 mb-2" />
          <div className="h-5 w-64 rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
        </div>

        {/* Account overview card */}
        <div className="mb-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 p-8 shadow-lg">
          <div className="space-y-6">
            <div>
              <div className="h-5 w-36 rounded bg-zinc-200/70 dark:bg-zinc-800/70 mb-2" />
              <div className="h-12 w-72 max-w-full rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <div className="h-3 w-24 rounded bg-zinc-200/70 dark:bg-zinc-800/70 mb-2" />
                  <div className="h-7 w-28 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                </div>
              ))}
            </div>

            <div className="pt-2">
              <div className="h-5 w-60 rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="h-5 w-24 rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
                <div className="h-5 w-5 rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
              </div>
              <div className="h-9 w-32 rounded-lg bg-zinc-200 dark:bg-zinc-800 mb-1" />
              <div className="h-4 w-36 rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
            </div>
          ))}
        </div>

        {/* Transaction history */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
          <div className="h-6 w-48 rounded bg-zinc-200 dark:bg-zinc-800 mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-11 w-11 flex-shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  <div className="flex-1 min-w-0">
                    <div className="h-4 w-44 max-w-full rounded bg-zinc-200 dark:bg-zinc-800 mb-2" />
                    <div className="h-3.5 w-52 max-w-full rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
                  </div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <div className="h-6 w-24 rounded bg-zinc-200 dark:bg-zinc-800 mb-1" />
                  <div className="h-3 w-16 rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
