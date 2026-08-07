'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { P2PTransferForm } from '@/components/transfers/p2p-transfer-form'
import { TransferConfirmation } from '@/components/transfers/transfer-confirmation'
import { TransferHistory } from '@/components/transfers/transfer-history'
import { AlertCircle, Send, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { InternalAccount, PublicRecipient } from '@/types/account'


interface TransferData {
  recipient: PublicRecipient
  amount: number
  description?: string
}

/** The account as the server hands it over: the Decimal balance is stringified
 *  before crossing the server/client boundary. */
type SerializedAccount = Omit<InternalAccount, 'balance'> & { balance: string }

interface TransfersClientProps {
  account: SerializedAccount | null
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REQUIRES_REVIEW'
}

export function TransfersClient({
  account,
  kycStatus,
}: TransfersClientProps) {
  const router = useRouter()
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [transferData, setTransferData] = useState<TransferData | null>(null)
  const [selectedRecipient, setSelectedRecipient] =
    useState<PublicRecipient | null>(null)
  const idempotencyKeyRef = useRef<string | null>(null)

  const handleTransferInitiated = (data: TransferData) => {
    setTransferData(data)
    setShowConfirmation(true)
  }

  const handleConfirmTransfer = async () => {
    if (!transferData) {
      throw new Error('No transfer data')
    }

    // One key per confirmed transfer, reused if the user retries after a
    // failure. The server returns the original transaction for a repeated key
    // rather than sending the money again.
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID()
    }

    const response = await fetch('/api/transfers/p2p', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKeyRef.current,
      },
      body: JSON.stringify({
        recipientIdentifier: transferData.recipient.identifier,
        amount: transferData.amount,
        description: transferData.description,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Transfer failed')
    }

    idempotencyKeyRef.current = null

    // Refresh the page to update balances
    router.refresh()
  }

  const handleQuickTransfer = (recipient: PublicRecipient) => {
    setSelectedRecipient(recipient)
    // Scroll to the form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCloseConfirmation = () => {
    setShowConfirmation(false)
    setTransferData(null)
  }

  // Check if user has KYC verified
  const isKYCVerified = kycStatus === 'VERIFIED'

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard">
            <Button
              variant="outline"
              className="mb-4 text-zinc-600 dark:text-zinc-400"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center">
              <Send className="h-6 w-6 text-white dark:text-zinc-900" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
                Send Money
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400">
                Transfer money to other neobank users
              </p>
            </div>
          </div>
        </div>

        {/* KYC Warning */}
        {!isKYCVerified && (
          <div className="mb-6 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                  KYC Verification Required
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                  You need to complete identity verification before you can send
                  transfers.
                </p>
                <Link href="/kyc">
                  <Button className="bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600 text-white">
                    Complete Verification
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* No Account Warning */}
        {!account && isKYCVerified && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900 dark:text-red-100 mb-1">
                  No Active Account
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">
                  You don&apos;t have an active account to send transfers from.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Transfer Form */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8">
              {account && isKYCVerified ? (
                <>
                  {/* Account Balance */}
                  <div className="mb-6 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                    <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                      Available Balance
                    </div>
                    <div className="text-3xl font-bold text-zinc-900 dark:text-white">
                      ${parseFloat(account.balance).toFixed(2)}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                      {account.accountType} • {account.accountNumber}
                    </div>
                  </div>

                  {/* Transfer Form. Keyed on the recipient so choosing one from
                      the recent list remounts the form prefilled. */}
                  <P2PTransferForm
                    key={selectedRecipient?.identifier ?? 'new-transfer'}
                    initialRecipient={selectedRecipient}
                    availableBalance={parseFloat(account.balance)}
                    onTransferInitiated={handleTransferInitiated}
                  />
                </>
              ) : (
                <div className="text-center py-12">
                  <Send className="h-12 w-12 mx-auto mb-4 text-zinc-400" />
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {!isKYCVerified
                      ? 'Complete KYC verification to start sending transfers'
                      : 'Unable to send transfers at this time'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6">
              {isKYCVerified && account ? (
                <TransferHistory onQuickTransfer={handleQuickTransfer} />
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Complete verification to see transfer history
                  </p>
                </div>
              )}
            </div>

            {/* Transfer Limits Info */}
            <div className="mt-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-3">
                Transfer Limits
              </h3>
              <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <div className="flex justify-between">
                  <span>Per transfer:</span>
                  <span className="font-medium text-zinc-900 dark:text-white">
                    $10,000
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Daily limit:</span>
                  <span className="font-medium text-zinc-900 dark:text-white">
                    $25,000
                  </span>
                </div>
                <div className="pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    Transfers above $5,000 may require review and take up to 24
                    hours
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Confirmation Dialog */}
      {transferData && (
        <TransferConfirmation
          isOpen={showConfirmation}
          onClose={handleCloseConfirmation}
          recipient={transferData.recipient}
          amount={transferData.amount}
          description={transferData.description}
          onConfirm={handleConfirmTransfer}
        />
      )}
    </div>
  )
}
