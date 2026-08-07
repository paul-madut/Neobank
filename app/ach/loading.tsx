// Route-segment skeleton for /ach. Mirrors the page: collapsed sidebar rail,
// header, the Transfer / History tab bar, and the transfer form card.
export default function ACHLoading() {
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-8 max-w-6xl animate-pulse">
            {/* Header */}
            <div className="mb-8">
              <div className="h-9 w-64 max-w-full rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-2 h-5 w-96 max-w-full rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
            </div>

            <div className="space-y-6">
              {/* Tab bar */}
              <div className="grid w-full max-w-md mx-auto grid-cols-2 gap-1 h-9 rounded-lg bg-zinc-200 dark:bg-zinc-800 p-1">
                <div className="rounded-md bg-zinc-300/70 dark:bg-zinc-700/70" />
                <div className="rounded-md bg-zinc-300/40 dark:bg-zinc-700/40" />
              </div>

              {/* Transfer form card */}
              <div className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow">
                <div className="p-6">
                  <div className="h-6 w-64 max-w-full rounded bg-zinc-200 dark:bg-zinc-800 mb-6" />
                  <div className="space-y-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i}>
                        <div className="h-4 w-32 rounded bg-zinc-200/70 dark:bg-zinc-800/70 mb-2" />
                        <div className="h-10 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                    ))}
                    <div className="h-10 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
