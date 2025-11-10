'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertCircle, CheckCircle, ArrowRight } from 'lucide-react'

interface RecipientInfo {
  id: string
  email: string
  firstName: string
  lastName: string
  accountId: string
  accountNumber: string
  accountStatus: string
}

interface TransferConfirmationProps {
  isOpen: boolean
  onClose: () => void
  recipient: RecipientInfo
  amount: number
  description?: string
  onConfirm: () => Promise<void>
}

export function TransferConfirmation({
  isOpen,
  onClose,
  recipient,
  amount,
  description,
  onConfirm,
}: TransferConfirmationProps) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleConfirm = async () => {
    setConfirming(true)
    setError(null)

    try {
      await onConfirm()
      setSuccess(true)

      // Close dialog after success
      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Transfer failed')
    } finally {
      setConfirming(false)
    }
  }

  const handleClose = () => {
    setError(null)
    setSuccess(false)
    setConfirming(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {success ? (
          // Success State
          <div className="flex flex-col items-center justify-center py-6">
            <div className="mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
              Transfer Successful!
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
              ${amount.toFixed(2)} sent to {recipient.firstName}{' '}
              {recipient.lastName}
            </p>
          </div>
        ) : (
          // Confirmation State
          <>
            <DialogHeader>
              <DialogTitle>Confirm Transfer</DialogTitle>
              <DialogDescription>
                Please review the transfer details before confirming.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Transfer Details */}
              <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 space-y-3">
                {/* Amount */}
                <div className="flex justify-between items-center pb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    Amount
                  </span>
                  <span className="text-2xl font-bold text-zinc-900 dark:text-white">
                    ${amount.toFixed(2)}
                  </span>
                </div>

                {/* Recipient */}
                <div className="space-y-1">
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    To
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-medium">
                      {recipient.firstName[0]}
                      {recipient.lastName[0]}
                    </div>
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-white">
                        {recipient.firstName} {recipient.lastName}
                      </div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">
                        {recipient.email}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                    Account: {recipient.accountNumber}
                  </div>
                </div>

                {/* Description */}
                {description && (
                  <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                      Description
                    </div>
                    <div className="text-sm text-zinc-900 dark:text-white">
                      {description}
                    </div>
                  </div>
                )}

                {/* Transfer Info */}
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>
                      {amount >= 5000
                        ? 'Transfers above $5,000 require review and may take up to 24 hours.'
                        : 'This transfer will be processed immediately.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={confirming}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900"
              >
                {confirming ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    Confirm Transfer
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
