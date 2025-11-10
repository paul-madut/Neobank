"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { Plus } from "lucide-react"

interface CreateCardFormProps {
  onCardCreated?: () => void
}

export function CreateCardForm({ onCardCreated }: CreateCardFormProps) {
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    nickname: "",
    spendingLimit: "",
    monthlyLimit: "",
    dobDay: "",
    dobMonth: "",
    dobYear: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    phoneNumber: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)

    try {
      const response = await fetch("/api/cards/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: formData.nickname || undefined,
          spendingLimit: formData.spendingLimit || undefined,
          monthlyLimit: formData.monthlyLimit || undefined,
          dateOfBirth: {
            day: parseInt(formData.dobDay),
            month: parseInt(formData.dobMonth),
            year: parseInt(formData.dobYear),
          },
          address: {
            line1: formData.addressLine1,
            city: formData.city,
            state: formData.state,
            postalCode: formData.postalCode,
            country: "US",
          },
          phoneNumber: formData.phoneNumber || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create card")
      }

      toast.success("Virtual card created successfully!")
      setShowForm(false)
      setFormData({
        nickname: "",
        spendingLimit: "",
        monthlyLimit: "",
        dobDay: "",
        dobMonth: "",
        dobYear: "",
        addressLine1: "",
        city: "",
        state: "",
        postalCode: "",
        phoneNumber: "",
      })

      if (onCardCreated) {
        onCardCreated()
      }
    } catch (error: any) {
      console.error("Error creating card:", error)
      toast.error(error.message || "Failed to create card")
    } finally {
      setCreating(false)
    }
  }

  if (!showForm) {
    return (
      <Button
        onClick={() => setShowForm(true)}
        className="w-full bg-purple-600 hover:bg-purple-700"
      >
        <Plus className="mr-2 h-4 w-4" />
        Create Virtual Card
      </Button>
    )
  }

  return (
    <Card className="p-6 bg-zinc-50 dark:bg-zinc-900">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Create Virtual Card</h3>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowForm(false)}
          >
            Cancel
          </Button>
        </div>

        {/* Card Details */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Card Details
          </h4>

          <div>
            <Label htmlFor="nickname">Card Nickname (Optional)</Label>
            <Input
              id="nickname"
              placeholder="My Shopping Card"
              value={formData.nickname}
              onChange={(e) =>
                setFormData({ ...formData, nickname: e.target.value })
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="spendingLimit">
                Per-Transaction Limit (Optional)
              </Label>
              <Input
                id="spendingLimit"
                type="number"
                step="0.01"
                placeholder="500.00"
                value={formData.spendingLimit}
                onChange={(e) =>
                  setFormData({ ...formData, spendingLimit: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="monthlyLimit">Monthly Limit (Optional)</Label>
              <Input
                id="monthlyLimit"
                type="number"
                step="0.01"
                placeholder="5000.00"
                value={formData.monthlyLimit}
                onChange={(e) =>
                  setFormData({ ...formData, monthlyLimit: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Cardholder Information */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Cardholder Information
          </h4>

          <div>
            <Label>Date of Birth *</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                placeholder="Day"
                min="1"
                max="31"
                required
                value={formData.dobDay}
                onChange={(e) =>
                  setFormData({ ...formData, dobDay: e.target.value })
                }
              />
              <Input
                type="number"
                placeholder="Month"
                min="1"
                max="12"
                required
                value={formData.dobMonth}
                onChange={(e) =>
                  setFormData({ ...formData, dobMonth: e.target.value })
                }
              />
              <Input
                type="number"
                placeholder="Year"
                min="1900"
                max="2010"
                required
                value={formData.dobYear}
                onChange={(e) =>
                  setFormData({ ...formData, dobYear: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
            <Input
              id="phoneNumber"
              type="tel"
              placeholder="+1234567890"
              value={formData.phoneNumber}
              onChange={(e) =>
                setFormData({ ...formData, phoneNumber: e.target.value })
              }
            />
          </div>
        </div>

        {/* Billing Address */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Billing Address *
          </h4>

          <div>
            <Label htmlFor="addressLine1">Street Address</Label>
            <Input
              id="addressLine1"
              placeholder="123 Main Street"
              required
              value={formData.addressLine1}
              onChange={(e) =>
                setFormData({ ...formData, addressLine1: e.target.value })
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="San Francisco"
                required
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                placeholder="CA"
                maxLength={2}
                required
                value={formData.state}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    state: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="postalCode">ZIP Code</Label>
              <Input
                id="postalCode"
                placeholder="94111"
                required
                value={formData.postalCode}
                onChange={(e) =>
                  setFormData({ ...formData, postalCode: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={creating}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            {creating ? "Creating..." : "Create Card"}
          </Button>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          * This information is required by Stripe for regulatory compliance and will be securely stored.
        </p>
      </form>
    </Card>
  )
}
