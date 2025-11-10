'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Search, DollarSign, AlertCircle, CheckCircle } from 'lucide-react'

interface RecipientInfo {
  id: string
  email: string
  firstName: string
  lastName: string
  accountId: string
  accountNumber: string
  accountStatus: string
}

interface P2PTransferFormProps {
  availableBalance: number
  onTransferInitiated: (transferData: {
    recipient: RecipientInfo
    amount: number
    description?: string
  }) => void
  onCancel?: () => void
}

export function P2PTransferForm({
  availableBalance,
  onTransferInitiated,
  onCancel,
}: P2PTransferFormProps) {
  const [recipientQuery, setRecipientQuery] = useState('')
  const [searchResults, setSearchResults] = useState<RecipientInfo[]>([])
  const [selectedRecipient, setSelectedRecipient] =
    useState<RecipientInfo | null>(null)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounced search for recipients
  useEffect(() => {
    const searchRecipients = async () => {
      if (!recipientQuery.trim() || selectedRecipient) {
        setSearchResults([])
        return
      }

      setSearching(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/transfers/recipients?q=${encodeURIComponent(recipientQuery)}`
        )
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to search recipients')
        }

        setSearchResults(data.recipients || [])

        if (data.message) {
          setError(data.message)
        }
      } catch (err: any) {
        setError(err.message)
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }

    const timeoutId = setTimeout(searchRecipients, 300)
    return () => clearTimeout(timeoutId)
  }, [recipientQuery, selectedRecipient])

  const handleRecipientSelect = (recipient: RecipientInfo) => {
    setSelectedRecipient(recipient)
    setRecipientQuery(recipient.email)
    setSearchResults([])
    setError(null)
  }

  const handleRecipientChange = (value: string) => {
    setRecipientQuery(value)
    setSelectedRecipient(null)
  }

  const validateAmount = useCallback(() => {
    const numAmount = parseFloat(amount)

    if (isNaN(numAmount) || numAmount <= 0) {
      return 'Please enter a valid amount'
    }

    if (numAmount > availableBalance) {
      return `Insufficient funds. Available: $${availableBalance.toFixed(2)}`
    }

    if (numAmount > 10000) {
      return 'Amount exceeds maximum transfer limit of $10,000'
    }

    return null
  }, [amount, availableBalance])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate recipient
    if (!selectedRecipient) {
      setError('Please select a valid recipient')
      return
    }

    // Validate amount
    const amountError = validateAmount()
    if (amountError) {
      setError(amountError)
      return
    }

    // Initiate transfer
    onTransferInitiated({
      recipient: selectedRecipient,
      amount: parseFloat(amount),
      description: description.trim() || undefined,
    })
  }

  const isFormValid =
    selectedRecipient && amount && parseFloat(amount) > 0 && !validateAmount()

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Recipient Search */}
      <div className="space-y-2">
        <Label htmlFor="recipient">Recipient</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            id="recipient"
            type="text"
            placeholder="Enter email or account number"
            value={recipientQuery}
            onChange={(e) => handleRecipientChange(e.target.value)}
            className="pl-10"
            disabled={searching}
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg overflow-hidden">
            {searchResults.map((recipient) => (
              <button
                key={recipient.id}
                type="button"
                onClick={() => handleRecipientSelect(recipient)}
                className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-100 dark:border-zinc-800 last:border-b-0"
              >
                <div className="font-medium text-zinc-900 dark:text-white">
                  {recipient.firstName} {recipient.lastName}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  {recipient.email} • {recipient.accountNumber}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Selected Recipient */}
        {selectedRecipient && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-green-900 dark:text-green-100">
                {selectedRecipient.firstName} {selectedRecipient.lastName}
              </div>
              <div className="text-xs text-green-700 dark:text-green-300">
                {selectedRecipient.email}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount">Amount</Label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            max={availableBalance}
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-10"
          />
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Available balance: ${availableBalance.toFixed(2)}
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          type="text"
          placeholder="What's this for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={100}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Add a note to remember what this transfer is for
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={!isFormValid}
          className="flex-1 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900"
        >
          Continue
        </Button>
      </div>
    </form>
  )
}
