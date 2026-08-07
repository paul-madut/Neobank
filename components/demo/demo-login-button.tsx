"use client"

import { useState } from "react"
import { ArrowRight, Loader2 } from "lucide-react"
import { ShimmerButton } from "@/components/magicui/shimmer-button"

/**
 * One-click entry into a populated demo account.
 *
 * The point is that an interviewer never has to sign up, confirm an email,
 * pass KYC and link a bank before seeing anything. The server creates a
 * throwaway customer seeded with a few months of history and signs the visitor
 * straight in.
 */
export function DemoLoginButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startDemo = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/demo/login", { method: "POST" })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Could not start the demo")
      }

      // Full navigation, so the new session cookies are picked up server-side.
      window.location.assign(data.redirectTo ?? "/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the demo")
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <ShimmerButton
        onClick={startDemo}
        disabled={loading}
        className="text-base font-semibold shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
        background="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Preparing your demo
          </>
        ) : (
          <>
            Explore the live demo
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </ShimmerButton>

      <p className="text-xs text-slate-500">
        No signup. A throwaway account, seeded with sample activity.
      </p>

      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
