// Route-segment skeleton for /transfers. Mirrors TransfersClient: header, the
// 2/3 transfer form card with the balance box on top, and the 1/3 column with
// transfer history and the limits panel.
export default function TransfersLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
        {/* Header */}
        <div className="mb-8">
          <div className="h-10 w-44 rounded-md bg-zinc-200/70 dark:bg-zinc-800/70 mb-4" />
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 flex-shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div>
              <div className="h-9 w-48 rounded-lg bg-zinc-200 dark:bg-zinc-800 mb-2" />
              <div className="h-5 w-64 rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Transfer form */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8">
              {/* Available balance */}
              <div className="mb-6 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800 mb-2" />
                <div className="h-9 w-44 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-40 rounded bg-zinc-200/70 dark:bg-zinc-800/70 mt-2" />
              </div>

              {/* Form fields */}
              <div className="space-y-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i}>
                    <div className="h-4 w-28 rounded bg-zinc-200/70 dark:bg-zinc-800/70 mb-2" />
                    <div className="h-10 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                ))}
                <div className="h-10 rounded-md bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          </div>

          {/* History + limits */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="h-5 w-36 rounded bg-zinc-200 dark:bg-zinc-800 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-9 w-9 flex-shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    <div className="flex-1 min-w-0">
                      <div className="h-4 w-28 max-w-full rounded bg-zinc-200 dark:bg-zinc-800 mb-1.5" />
                      <div className="h-3 w-20 max-w-full rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
                    </div>
                    <div className="h-4 w-16 flex-shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800 mb-3" />
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-4 w-24 rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
                    <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="h-3 w-full rounded bg-zinc-200/70 dark:bg-zinc-800/70 mb-1.5" />
                  <div className="h-3 w-2/3 rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
