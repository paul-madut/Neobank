"use client"

import { useEffect, useState } from "react"
import { VirtualCard } from "@/components/cards/virtual-card"
import { CreateCardForm } from "@/components/cards/create-card-form"
import { CardControls } from "@/components/cards/card-controls"
import { toast } from "sonner"

interface Card {
  id: string
  last4: string
  brand: string
  expiryMonth: number
  expiryYear: number
  status: "ACTIVE" | "FROZEN" | "CANCELLED"
  spendingLimit: number | null
  monthlyLimit: number | null
  nickname: string | null
  createdAt: string
}

export function CardsClient() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [cardDetails, setCardDetails] = useState<Record<string, any>>({})

  const fetchCards = async () => {
    try {
      const response = await fetch("/api/cards")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch cards")
      }

      setCards(data.cards || [])
    } catch (error: any) {
      console.error("Error fetching cards:", error)
      toast.error(error.message || "Failed to load cards")
    } finally {
      setLoading(false)
    }
  }

  const handleRevealCard = async (cardId: string) => {
    try {
      const response = await fetch(`/api/cards/${cardId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to retrieve card details")
      }

      setCardDetails((prev) => ({
        ...prev,
        [cardId]: {
          number: data.card.number,
          cvc: data.card.cvc,
        },
      }))
    } catch (error: any) {
      console.error("Error revealing card:", error)
      toast.error(error.message || "Failed to reveal card details")
    }
  }

  useEffect(() => {
    fetchCards()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Create Card Form */}
      <div>
        <CreateCardForm onCardCreated={fetchCards} />
      </div>

      {/* Cards Grid */}
      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
          <p className="text-zinc-600 dark:text-zinc-400 mb-2">
            No virtual cards yet
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Create your first virtual card to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div key={card.id} className="space-y-4">
              <VirtualCard
                last4={card.last4}
                brand={card.brand}
                expiryMonth={card.expiryMonth}
                expiryYear={card.expiryYear}
                status={card.status}
                nickname={card.nickname}
                fullNumber={cardDetails[card.id]?.number}
                cvc={cardDetails[card.id]?.cvc}
                onReveal={() => handleRevealCard(card.id)}
              />
              <CardControls
                cardId={card.id}
                status={card.status}
                currentSpendingLimit={card.spendingLimit}
                currentMonthlyLimit={card.monthlyLimit}
                onUpdate={fetchCards}
              />
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-4">
        <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-2">
          About Virtual Cards
        </h3>
        <ul className="space-y-1 text-sm text-purple-800 dark:text-purple-200">
          <li>• Virtual cards are instantly available for online purchases</li>
          <li>• Set spending limits to control your budget</li>
          <li>• Freeze or cancel cards anytime for security</li>
          <li>
            • Transactions are deducted from your NeoBank checking account
          </li>
        </ul>
      </div>
    </div>
  )
}
