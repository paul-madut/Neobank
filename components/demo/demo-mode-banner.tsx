"use client"

import { motion } from "framer-motion"
import { FlaskConical, X } from "lucide-react"
import { useSyncExternalStore } from "react"

const DISMISS_KEY = "neobank:demo-banner-dismissed"

/**
 * The dismissal lives in sessionStorage, which React knows nothing about.
 * useSyncExternalStore is the supported way to read that kind of state: no
 * mount effect that immediately calls setState and cascades a render, and the
 * server snapshot is pinned to "dismissed" so the server and the first client
 * render both emit nothing and hydration has nothing to disagree about. The
 * banner then animates in once the real value is read.
 */
const listeners = new Set<() => void>()

/** Fallback for private mode or blocked storage, where the write throws. */
let dismissedInMemory = false

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)

  return () => {
    listeners.delete(onStoreChange)
  }
}

function getIsDismissed() {
  if (dismissedInMemory) {
    return true
  }

  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "true"
  } catch {
    return false
  }
}

function getIsDismissedOnServer() {
  return true
}

function dismiss() {
  dismissedInMemory = true

  try {
    window.sessionStorage.setItem(DISMISS_KEY, "true")
  } catch {
    // Dismissal simply will not persist beyond this page load
  }

  for (const listener of listeners) {
    listener()
  }
}

interface DemoModeBannerProps {
  className?: string
}

export function DemoModeBanner({ className }: DemoModeBannerProps) {
  const isDismissed = useSyncExternalStore(
    subscribe,
    getIsDismissed,
    getIsDismissedOnServer
  )

  if (isDismissed) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className={`relative overflow-hidden ${className ?? ""}`}
    >
      <div className="border-b border-blue-200 dark:border-blue-900/60 bg-blue-50/80 dark:bg-blue-950/30 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Icon and Text */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <FlaskConical className="w-4 h-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />

              <p className="text-xs sm:text-sm text-blue-900 dark:text-blue-100 min-w-0">
                <span className="font-semibold">Demo mode.</span>{" "}
                <span className="text-blue-800 dark:text-blue-300">
                  No real money moves here.
                </span>{" "}
                <span className="text-blue-800 dark:text-blue-300 hidden sm:inline">
                  Stripe runs in test mode and Plaid in sandbox mode, so every
                  balance, card, and transfer is fake.
                </span>
              </p>
            </div>

            {/* Right: Dismiss */}
            <button
              onClick={dismiss}
              className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex-shrink-0"
              aria-label="Dismiss demo mode notice"
            >
              <X className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
