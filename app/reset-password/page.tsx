"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"

const MIN_PASSWORD_LENGTH = 6

/**
 * Where the recovery link lands, once /auth/callback has turned the code into
 * a session. Without that session `updateUser` has nobody to update, so the
 * page checks for one before it offers the form.
 */
type LinkState = "checking" | "valid" | "invalid"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [linkState, setLinkState] = useState<LinkState>("checking")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const supabase = createClient()

    supabase.auth
      .getUser()
      .then(({ data, error: userError }) => {
        if (!active) return
        setLinkState(data.user && !userError ? "valid" : "invalid")
      })
      .catch(() => {
        if (active) setLinkState("invalid")
      })

    return () => {
      active = false
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        if (updateError.status === 401 || updateError.status === 403) {
          setLinkState("invalid")
          return
        }
        console.error("Password update failed", updateError)
        setError("We could not update your password. Please try again.")
        return
      }

      // Finish on a clean slate: the recovery session goes, and the new
      // password gets proved once at the login screen.
      await supabase.auth.signOut()
      router.push(
        "/login?message=Your password has been updated. Please sign in."
      )
      router.refresh()
    } catch (err) {
      console.error("Password update failed", err)
      setError("We could not update your password. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8">
          {linkState === "checking" && (
            <div className="mb-2">
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                Checking your link
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400">
                One moment while we verify your reset link.
              </p>
            </div>
          )}

          {linkState === "invalid" && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                  This link has expired
                </h1>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Password reset links can only be used once, and they expire an
                  hour after they are sent. Request a fresh one to continue.
                </p>
              </div>

              <Link href="/forgot-password" className="block">
                <Button className="w-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900">
                  Request a new link
                </Button>
              </Link>

              <div className="mt-6 text-center text-sm">
                <Link
                  href="/login"
                  className="font-medium text-zinc-900 dark:text-white hover:underline"
                >
                  Back to sign in
                </Link>
              </div>
            </>
          )}

          {linkState === "valid" && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                  Set a new password
                </h1>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Choose a password you have not used on this account before
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    placeholder="••••••••"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <Input
                    id="confirmPassword"
                    placeholder="••••••••"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                  {loading ? "Updating password..." : "Update password"}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm">
                <Link
                  href="/login"
                  className="font-medium text-zinc-900 dark:text-white hover:underline"
                >
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
