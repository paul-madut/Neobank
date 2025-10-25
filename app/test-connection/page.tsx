"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

export default function TestConnectionPage() {
  const [status, setStatus] = useState<string>("Testing connection...")
  const [details, setDetails] = useState<any>(null)

  useEffect(() => {
    async function testConnection() {
      try {
        const supabase = createClient()

        // Test 1: Check connection
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          setStatus("❌ Connection failed")
          setDetails({ error: sessionError.message })
          return
        }

        // Test 2: Check user (if logged in)
        const { data: userData, error: userError } = await supabase.auth.getUser()

        setStatus("✅ Supabase is connected successfully!")
        setDetails({
          url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasSession: !!sessionData.session,
          hasUser: !!userData.user,
          userEmail: userData.user?.email || "No user logged in",
        })
      } catch (err: any) {
        setStatus("❌ Unexpected error")
        setDetails({ error: err.message })
      }
    }

    testConnection()
  }, [])

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-8">
          Supabase Connection Test
        </h1>

        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
            Status
          </h2>
          <p className="text-lg mb-4">{status}</p>

          {details && (
            <pre className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(details, null, 2)}
            </pre>
          )}
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
            About the Error
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300 mb-4">
            The error "Unsupported provider: provider is not enabled" means:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-zinc-700 dark:text-zinc-300 mb-4">
            <li>Google and Apple OAuth providers are not enabled in your Supabase project</li>
            <li>Email/password authentication should work by default</li>
            <li>You need to enable and configure OAuth providers in Supabase Dashboard</li>
          </ul>

          <div className="mt-6 p-4 bg-white dark:bg-zinc-800 rounded border border-blue-300 dark:border-blue-700">
            <h3 className="font-semibold mb-2">Next Steps:</h3>
            <ol className="list-decimal pl-6 space-y-2 text-sm">
              <li>Try signing up with email/password first (should work)</li>
              <li>
                To enable Google/Apple auth, visit:{" "}
                <a
                  href="https://supabase.com/dashboard/project/ugwzqhfdzwslemvpydfm/auth/providers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Supabase Auth Providers
                </a>
              </li>
              <li>Enable the providers you want to use</li>
              <li>Configure OAuth credentials from Google/Apple</li>
            </ol>
          </div>
        </div>

        <div className="mt-6 flex gap-4">
          <a
            href="/register"
            className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100"
          >
            Try Email Signup
          </a>
          <a
            href="/login"
            className="px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700"
          >
            Try Email Login
          </a>
        </div>
      </div>
    </div>
  )
}
