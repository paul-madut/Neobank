"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { Snowflake, Play, Settings, Trash2 } from "lucide-react"

interface CardControlsProps {
  cardId: string
  status: "ACTIVE" | "FROZEN" | "CANCELLED"
  currentSpendingLimit?: number | null
  currentMonthlyLimit?: number | null
  onUpdate?: () => void
}

export function CardControls({
  cardId,
  status,
  currentSpendingLimit,
  currentMonthlyLimit,
  onUpdate,
}: CardControlsProps) {
  const [loading, setLoading] = useState(false)
  const [showLimitsDialog, setShowLimitsDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [spendingLimit, setSpendingLimit] = useState(
    currentSpendingLimit?.toString() || ""
  )
  const [monthlyLimit, setMonthlyLimit] = useState(
    currentMonthlyLimit?.toString() || ""
  )

  const handleFreeze = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "freeze" }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to freeze card")
      }

      toast.success("Card frozen successfully")
      if (onUpdate) onUpdate()
    } catch (error: any) {
      toast.error(error.message || "Failed to freeze card")
    } finally {
      setLoading(false)
    }
  }

  const handleUnfreeze = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unfreeze" }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to unfreeze card")
      }

      toast.success("Card unfrozen successfully")
      if (onUpdate) onUpdate()
    } catch (error: any) {
      toast.error(error.message || "Failed to unfreeze card")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateLimits = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_limits",
          spendingLimit: spendingLimit || undefined,
          monthlyLimit: monthlyLimit || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update limits")
      }

      toast.success("Spending limits updated successfully")
      setShowLimitsDialog(false)
      if (onUpdate) onUpdate()
    } catch (error: any) {
      toast.error(error.message || "Failed to update limits")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel card")
      }

      toast.success("Card cancelled successfully")
      setShowCancelDialog(false)
      if (onUpdate) onUpdate()
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel card")
    } finally {
      setLoading(false)
    }
  }

  if (status === "CANCELLED") {
    return (
      <div className="flex gap-2">
        <Button variant="outline" disabled className="flex-1">
          Card Cancelled
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {status === "ACTIVE" ? (
          <Button
            variant="outline"
            onClick={handleFreeze}
            disabled={loading}
            className="flex-1"
          >
            <Snowflake className="mr-2 h-4 w-4" />
            Freeze Card
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={handleUnfreeze}
            disabled={loading}
            className="flex-1"
          >
            <Play className="mr-2 h-4 w-4" />
            Unfreeze Card
          </Button>
        )}

        <Button
          variant="outline"
          onClick={() => setShowLimitsDialog(true)}
          disabled={loading}
          className="flex-1"
        >
          <Settings className="mr-2 h-4 w-4" />
          Set Limits
        </Button>

        <Button
          variant="destructive"
          onClick={() => setShowCancelDialog(true)}
          disabled={loading}
          className="flex-1"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Cancel Card
        </Button>
      </div>

      {/* Update Limits Dialog */}
      <Dialog open={showLimitsDialog} onOpenChange={setShowLimitsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Spending Limits</DialogTitle>
            <DialogDescription>
              Configure transaction and monthly spending limits for this card.
              Leave empty for no limit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="spending-limit">Per-Transaction Limit ($)</Label>
              <Input
                id="spending-limit"
                type="number"
                step="0.01"
                placeholder="500.00"
                value={spendingLimit}
                onChange={(e) => setSpendingLimit(e.target.value)}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Maximum amount per transaction
              </p>
            </div>

            <div>
              <Label htmlFor="monthly-limit">Monthly Limit ($)</Label>
              <Input
                id="monthly-limit"
                type="number"
                step="0.01"
                placeholder="5000.00"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Maximum total spending per month
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLimitsDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateLimits}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {loading ? "Updating..." : "Update Limits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Card Confirmation */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Card?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this card? This action cannot be
              undone. The card will be permanently deactivated and cannot be
              used for purchases.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Card</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? "Cancelling..." : "Cancel Card"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
