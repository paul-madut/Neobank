"use client"

import { useState } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          // The recovery link comes back through the same callback as every
          // other Supabase code, which exchanges it for a session server-side
          // before handing control to the reset form.
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        }
      )

      if (resetError?.status === 429) {
        setError("Too many attempts. Please wait a minute and try again.")
      } else if (resetError) {
        // Supabase does not report whether the address has an account, so
        // anything that reaches here is a real fault, not a missing user.
        console.error("Password reset request failed", resetError)
        setError("We could not send the reset email. Please try again shortly.")
      } else {
        setSent(true)
      }
    } catch (err) {
      console.error("Password reset request failed", err)
      setError("We could not send the reset email. Please try again shortly.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8">
          {sent ? (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                  Check your email
                </h1>
                <p className="text-zinc-600 dark:text-zinc-400">
                  If an account exists for {email}, we have sent a link to reset
                  your password. The link expires in one hour.
                </p>
              </div>

              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No email after a few minutes? Check your spam folder, or try a
                different address.
              </p>

              <Button
                type="button"
                variant="outline"
                className="w-full mt-6"
                onClick={() => {
                  setSent(false)
                  setError(null)
                }}
              >
                Use a different email
              </Button>

              <div className="mt-6 text-center text-sm">
                <Link
                  href="/login"
                  className="font-medium text-zinc-900 dark:text-white hover:underline"
                >
                  Back to sign in
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                  Reset your password
                </h1>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Enter your email and we will send you a link to set a new one
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    placeholder="name@example.com"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {error}
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900"
                  disabled={loading}
                >
                  {loading ? "Sending link..." : "Send reset link"}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Remembered it?{" "}
                </span>
                <Link
                  href="/login"
                  className="font-medium text-zinc-900 dark:text-white hover:underline"
                >
                  Sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
