// Route-segment skeleton for /banks. Mirrors the page: header with the connect
// action, the connected-accounts panel, and the informational panel below it.
export default function BanksLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="container mx-auto px-4 py-8 max-w-6xl animate-pulse">
        {/* Header */}
        <div className="mb-8">
          <div className="h-5 w-40 rounded bg-zinc-200/70 dark:bg-zinc-800/70 mb-4" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="h-9 w-72 max-w-full rounded-lg bg-zinc-200 dark:bg-zinc-800 mb-2" />
              <div className="h-5 w-80 max-w-full rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
            </div>
            <div className="h-10 w-40 flex-shrink-0 rounded-md bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>

        {/* Connected accounts */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-lg">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-6 w-52 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-10 w-28 rounded-md bg-zinc-200/70 dark:bg-zinc-800/70" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-6"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                    <div className="flex-1 min-w-0">
                      <div className="h-4 w-28 max-w-full rounded bg-zinc-200 dark:bg-zinc-800 mb-1.5" />
                      <div className="h-3 w-16 max-w-full rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
                    </div>
                  </div>
                  <div className="h-3 w-20 rounded bg-zinc-200/70 dark:bg-zinc-800/70 mb-2" />
                  <div className="h-8 w-32 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info panel */}
        <div className="mt-6 p-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="h-5 w-48 rounded bg-blue-200/80 dark:bg-blue-900/50 mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-3.5 w-full max-w-2xl rounded bg-blue-200/60 dark:bg-blue-900/40"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
