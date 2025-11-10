'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowDownCircle, ArrowUpCircle, Loader2 } from 'lucide-react'

interface ExternalAccount {
  id: string
  institutionName: string
  accountName?: string
  mask: string
  type: string
  availableBalance?: number
}

interface ACHTransferFormProps {
  externalAccounts: ExternalAccount[]
  onSuccess?: () => void
}

export default function ACHTransferForm({
  externalAccounts,
  onSuccess,
}: ACHTransferFormProps) {
  const [direction, setDirection] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT')
  const [externalAccountId, setExternalAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  const initiateTransfer = useMutation({
    mutationFn: async (data: {
      externalAccountId: string
      amount: number
      direction: string
      description?: string
    }) => {
      const res = await fetch('/api/ach/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const responseData = await res.json()

      if (!res.ok) {
        throw new Error(responseData.error || 'Transfer failed')
      }

      return responseData
    },
    onSuccess: () => {
      // Reset form
      setAmount('')
      setDescription('')
      setError('')
      onSuccess?.()
    },
    onError: (error: Error) => {
      setError(error.message)
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate
    if (!externalAccountId) {
      setError('Please select a bank account')
      return
    }

    const transferAmount = parseFloat(amount)
    if (isNaN(transferAmount) || transferAmount <= 0) {
      setError('Please enter a valid amount')
      return
    }

    initiateTransfer.mutate({
      externalAccountId,
      amount: transferAmount,
      direction,
      description,
    })
  }

  const selectedAccount = externalAccounts.find((acc) => acc.id === externalAccountId)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Direction Selection */}
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setDirection('DEPOSIT')}
          className={`p-4 rounded-lg border-2 transition-all ${
            direction === 'DEPOSIT'
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600'
          }`}
        >
          <ArrowDownCircle
            className={`mx-auto mb-2 ${direction === 'DEPOSIT' ? 'text-purple-500' : 'text-zinc-400'}`}
            size={32}
          />
          <div
            className={`font-semibold ${direction === 'DEPOSIT' ? 'text-purple-500' : 'text-zinc-600 dark:text-zinc-300'}`}
          >
            Deposit
          </div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Add funds to NeoBank</div>
        </button>

        <button
          type="button"
          onClick={() => setDirection('WITHDRAWAL')}
          className={`p-4 rounded-lg border-2 transition-all ${
            direction === 'WITHDRAWAL'
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600'
          }`}
        >
          <ArrowUpCircle
            className={`mx-auto mb-2 ${direction === 'WITHDRAWAL' ? 'text-purple-500' : 'text-zinc-400'}`}
            size={32}
          />
          <div
            className={`font-semibold ${direction === 'WITHDRAWAL' ? 'text-purple-500' : 'text-zinc-600 dark:text-zinc-300'}`}
          >
            Withdraw
          </div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Move funds to external bank</div>
        </button>
      </div>

      {/* Bank Account Selection */}
      <div className="space-y-2">
        <Label htmlFor="account" className="text-zinc-900 dark:text-zinc-200">
          {direction === 'DEPOSIT' ? 'From Bank Account' : 'To Bank Account'}
        </Label>
        <Select value={externalAccountId} onValueChange={setExternalAccountId}>
          <SelectTrigger className="bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white">
            <SelectValue placeholder="Select a bank account" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700">
            {externalAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                <div className="flex items-center justify-between w-full">
                  <span className="text-zinc-900 dark:text-white">
                    {account.institutionName} •••• {account.mask}
                  </span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400 ml-4">
                    {account.type}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedAccount && selectedAccount.availableBalance !== undefined && selectedAccount.availableBalance !== null && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Available: ${parseFloat(selectedAccount.availableBalance).toFixed(2)}
          </p>
        )}
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount" className="text-zinc-900 dark:text-zinc-200">
          Amount
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 dark:text-zinc-400">
            $
          </span>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-8 bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
            required
          />
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {direction === 'DEPOSIT'
            ? 'Funds typically arrive in 1-3 business days'
            : 'Withdrawals typically complete in 1-3 business days'}
        </p>
      </div>

      {/* Description (Optional) */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-zinc-900 dark:text-zinc-200">
          Description (Optional)
        </Label>
        <Input
          id="description"
          type="text"
          placeholder="Add a note..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {initiateTransfer.isSuccess && (
        <div className="p-4 bg-green-500/10 border border-green-500/50 rounded-lg">
          <p className="text-green-400 text-sm">
            Transfer initiated successfully! Check the history tab for status updates.
          </p>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={initiateTransfer.isPending}
        className="w-full bg-purple-600 hover:bg-purple-700"
      >
        {initiateTransfer.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            {direction === 'DEPOSIT' ? 'Deposit Funds' : 'Withdraw Funds'}
          </>
        )}
      </Button>
    </form>
  )
}
