"use client"

import { useCallback, useState, useEffect } from "react"
import { usePlaidLink } from "react-plaid-link"
import { Button } from "@/components/ui/button"

interface PlaidLinkButtonProps {
  onSuccess?: () => void
  onExit?: () => void
  className?: string
  children?: React.ReactNode
}

export function PlaidLinkButton({
  onSuccess,
  onExit,
  className,
  children = "Connect Bank Account",
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch link token on component mount
  useEffect(() => {
    async function createLinkToken() {
      try {
        const response = await fetch("/api/plaid/create-link-token", {
          method: "POST",
        })

        if (!response.ok) {
          throw new Error("Failed to create link token")
        }

        const data = await response.json()
        setLinkToken(data.linkToken)
      } catch (err: any) {
        console.error("Error creating link token:", err)
        setError(err.message || "Failed to initialize Plaid Link")
      }
    }

    createLinkToken()
  }, [])

  const onSuccessCallback = useCallback(
    async (publicToken: string, metadata: any) => {
      setLoading(true)
      setError(null)

      try {
        // Exchange public token for access token
        const response = await fetch("/api/plaid/exchange-public-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ publicToken }),
        })

        if (!response.ok) {
          throw new Error("Failed to link account")
        }

        const data = await response.json()
        console.log("Successfully linked accounts:", data)

        // Call parent success callback
        onSuccess?.()
      } catch (err: any) {
        console.error("Error exchanging token:", err)
        setError(err.message || "Failed to connect bank account")
      } finally {
        setLoading(false)
      }
    },
    [onSuccess]
  )

  const onExitCallback = useCallback(
    (err: any, metadata: any) => {
      if (err) {
        console.error("Plaid Link error:", err)
        setError(err.message || "Failed to connect bank account")
      }
      onExit?.()
    },
    [onExit]
  )

  const config = {
    token: linkToken,
    onSuccess: onSuccessCallback,
    onExit: onExitCallback,
  }

  const { open, ready } = usePlaidLink(config)

  const handleClick = () => {
    if (ready) {
      open()
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleClick}
        disabled={!ready || loading}
        className={className}
      >
        {loading ? "Connecting..." : children}
      </Button>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
