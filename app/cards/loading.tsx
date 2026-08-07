// Route-segment skeleton for /cards. Mirrors the cards page: collapsed sidebar
// rail, page header, the "Create Virtual Card" action, the card grid, and the
// info panel underneath.
export default function CardsLoading() {
  // No gradient wrapper here on purpose: app/cards/page.tsx renders on the
  // plain body background, so the skeleton matches it exactly and the page does
  // not flash a different colour when the real content arrives.
  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
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

      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          <div className="mx-auto max-w-7xl space-y-8 animate-pulse">
            {/* Header */}
            <div>
              <div className="h-9 w-52 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-2 h-5 w-96 max-w-full rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
            </div>

            {/* Create card action */}
            <div className="h-10 w-full rounded-md bg-zinc-200 dark:bg-zinc-800" />

            {/* Card grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-4">
                  <div className="h-52 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-200 dark:bg-zinc-800" />
                  <div className="flex flex-wrap gap-2">
                    <div className="h-10 flex-1 rounded-md bg-zinc-200/70 dark:bg-zinc-800/70" />
                    <div className="h-10 flex-1 rounded-md bg-zinc-200/70 dark:bg-zinc-800/70" />
                  </div>
                </div>
              ))}
            </div>

            {/* Info panel */}
            <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20 p-4">
              <div className="h-4 w-40 rounded bg-purple-200/80 dark:bg-purple-900/50 mb-3" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-3.5 w-full max-w-lg rounded bg-purple-200/60 dark:bg-purple-900/40"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
