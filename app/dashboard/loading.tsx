// Route-segment skeleton for /dashboard. The shape mirrors DashboardClient -
// collapsed sidebar rail, header, 2/1 grid with the account card and the quick
// actions + stats column, then the recent activity list - so the real content
// swaps in without moving anything.
export default function DashboardLoading() {
  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Sidebar rail (matches the collapsed desktop sidebar at 60px) */}
      <div className="hidden md:flex md:flex-col justify-between h-full w-[60px] flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4 animate-pulse">
        <div>
          <div className="h-5 w-6 rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-8 flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="my-2 h-5 w-5 rounded bg-zinc-200 dark:bg-zinc-800"
              />
            ))}
          </div>
        </div>
        <div>
          <div className="my-2 h-7 w-7 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-4 h-5 w-5 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-8 max-w-6xl animate-pulse">
            {/* Header */}
            <div className="mb-8">
              <div className="h-9 w-44 rounded-lg bg-zinc-200 dark:bg-zinc-800 mb-2" />
              <div className="h-5 w-64 rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Account card */}
              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 p-8 shadow-lg">
                  <div className="space-y-8">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="h-4 w-24 rounded bg-zinc-200/70 dark:bg-zinc-800/70 mb-2" />
                        <div className="h-10 w-52 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="h-6 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                        <div className="h-6 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                    </div>

                    <div className="h-4 w-44 rounded bg-zinc-200/70 dark:bg-zinc-800/70" />

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i}>
                          <div className="h-3 w-28 rounded bg-zinc-200/70 dark:bg-zinc-800/70 mb-2" />
                          <div className="h-5 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="h-10 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                      <div className="h-10 rounded-md bg-zinc-200/70 dark:bg-zinc-800/70" />
                    </div>

                    <div className="h-4 w-64 mx-auto rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
                  </div>
                </div>
              </div>

              {/* Quick actions + stats */}
              <div className="space-y-4">
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                  <div className="h-5 w-32 rounded bg-zinc-200 dark:bg-zinc-800 mb-4" />
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-10 rounded-md bg-zinc-200/70 dark:bg-zinc-800/70"
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                  <div className="h-5 w-24 rounded bg-zinc-200 dark:bg-zinc-800 mb-4" />
                  <div className="flex justify-between">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i}>
                        <div className="h-3 w-20 rounded bg-zinc-200/70 dark:bg-zinc-800/70 mb-2" />
                        <div className="h-8 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent activity */}
            <div className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="h-6 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-9 w-24 rounded-md bg-zinc-200/70 dark:bg-zinc-800/70" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-11 w-11 flex-shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      <div className="flex-1 min-w-0">
                        <div className="h-4 w-40 max-w-full rounded bg-zinc-200 dark:bg-zinc-800 mb-2" />
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
      </div>
    </div>
  )
}
