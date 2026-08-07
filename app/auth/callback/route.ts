import { createClient } from "@/lib/supabase-server"
import { provisionUser } from "@/lib/provisioning"
import { NextResponse } from "next/server"

/**
 * The one place every new session is born.
 *
 * Email confirmation, OAuth and password recovery all redirect here with a
 * code, so this is the only server-side moment that is guaranteed to run once
 * per sign-in with a live session attached. Provisioning the Postgres user
 * here - rather than from the browser straight after `signUp`, where there is
 * no session yet and the call just 401s - is what keeps a signed-in user from
 * meeting "User not found" on every API call.
 */

const DEFAULT_REDIRECT = "/dashboard"

/** Only same-origin paths. `//evil.com` is a protocol-relative URL, not a path. */
function safeNext(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return DEFAULT_REDIRECT
  }
  return next
}

function failed(origin: string, message: string) {
  return NextResponse.redirect(
    `${origin}/login?message=${encodeURIComponent(message)}`
  )
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = requestUrl.origin
  const code = requestUrl.searchParams.get("code")
  const next = safeNext(requestUrl.searchParams.get("next"))

  // Supabase reports expired or already-consumed links as query params rather
  // than as a failed exchange.
  const authError = requestUrl.searchParams.get("error")
  if (authError) {
    console.error(
      "[auth/callback] provider returned an error",
      authError,
      requestUrl.searchParams.get("error_description")
    )
    return failed(origin, "That link is invalid or has expired. Please try again.")
  }

  if (!code) {
    return failed(origin, "That link is invalid or has expired. Please try again.")
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error("[auth/callback] code exchange failed", error)
    return failed(origin, "That link is invalid or has expired. Please try again.")
  }

  try {
    await provisionUser(data.user)
  } catch (provisioningError) {
    console.error("[auth/callback] provisioning failed", provisioningError)
    // Letting them through would land them on a dashboard where every request
    // 404s. Drop the half-made session so /login is reachable and they can
    // simply try again.
    await supabase.auth.signOut()
    return failed(
      origin,
      "We could not finish setting up your account. Please try signing in again."
    )
  }

  return NextResponse.redirect(`${origin}${next}`)
}
