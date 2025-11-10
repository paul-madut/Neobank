"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CreditCard, Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

interface VirtualCardProps {
  last4: string
  brand: string
  expiryMonth: number
  expiryYear: number
  status: "ACTIVE" | "FROZEN" | "CANCELLED"
  nickname?: string | null
  fullNumber?: string
  cvc?: string
  onReveal?: () => void
}

export function VirtualCard({
  last4,
  brand,
  expiryMonth,
  expiryYear,
  status,
  nickname,
  fullNumber,
  cvc,
  onReveal,
}: VirtualCardProps) {
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleReveal = async () => {
    if (!revealed && onReveal) {
      setLoading(true)
      await onReveal()
      setLoading(false)
    }
    setRevealed(!revealed)
  }

  const getStatusColor = () => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-500"
      case "FROZEN":
        return "bg-yellow-500"
      case "CANCELLED":
        return "bg-red-500"
      default:
        return "bg-zinc-500"
    }
  }

  const getStatusText = () => {
    switch (status) {
      case "ACTIVE":
        return "Active"
      case "FROZEN":
        return "Frozen"
      case "CANCELLED":
        return "Cancelled"
      default:
        return status
    }
  }

  const formatCardNumber = () => {
    if (revealed && fullNumber) {
      // Format as XXXX XXXX XXXX XXXX
      return fullNumber.match(/.{1,4}/g)?.join(" ") || fullNumber
    }
    return `•••• •••• •••• ${last4}`
  }

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-purple-600 to-purple-800 p-6 text-white shadow-lg">
      {/* Status badge */}
      <div className="absolute top-4 right-4">
        <Badge
          className={`${getStatusColor()} text-white border-none`}
        >
          {getStatusText()}
        </Badge>
      </div>

      {/* Card brand */}
      <div className="mb-8 flex items-center gap-2">
        <CreditCard className="h-8 w-8" />
        <span className="text-sm font-semibold uppercase">{brand}</span>
      </div>

      {/* Card number */}
      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xl tracking-wider">
            {formatCardNumber()}
          </p>
          {status === "ACTIVE" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReveal}
              disabled={loading}
              className="text-white hover:text-white hover:bg-purple-700"
            >
              {revealed ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        {revealed && cvc && (
          <p className="text-sm">
            <span className="opacity-75">CVC: </span>
            <span className="font-mono">{cvc}</span>
          </p>
        )}
      </div>

      {/* Cardholder name and expiry */}
      <div className="flex items-end justify-between">
        <div>
          <p className="mb-1 text-xs opacity-75">Cardholder</p>
          <p className="font-semibold">
            {nickname || "Virtual Card"}
          </p>
        </div>
        <div className="text-right">
          <p className="mb-1 text-xs opacity-75">Expires</p>
          <p className="font-mono">
            {String(expiryMonth).padStart(2, "0")}/{String(expiryYear).slice(-2)}
          </p>
        </div>
      </div>
    </Card>
  )
}
