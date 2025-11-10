'use client'

import { Card } from '@/components/ui/card'
import { ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle, XCircle } from 'lucide-react'

interface ACHTransfer {
  id: string
  direction: 'DEPOSIT' | 'WITHDRAWAL'
  amount: string
  currency: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'RETURNED'
  failureReason?: string
  expectedDate?: string
  createdAt: string
  externalAccount: {
    institutionName: string
    mask: string
    accountName?: string
  }
  transaction?: {
    description: string
  }
}

interface ACHTransferHistoryProps {
  transfers: ACHTransfer[]
  isLoading: boolean
}

export default function ACHTransferHistory({
  transfers,
  isLoading,
}: ACHTransferHistoryProps) {
  if (isLoading) {
    return (
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
        <div className="text-center text-zinc-600 dark:text-zinc-400">Loading transfer history...</div>
      </Card>
    )
  }

  if (!transfers || transfers.length === 0) {
    return (
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
        <div className="text-center">
          <Clock className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-600 mb-4" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">No Transfer History</h3>
          <p className="text-zinc-600 dark:text-zinc-400">
            Your ACH transfers will appear here once you initiate them
          </p>
        </div>
      </Card>
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'PENDING':
      case 'PROCESSING':
        return <Clock className="h-5 w-5 text-yellow-500" />
      case 'FAILED':
      case 'CANCELLED':
      case 'RETURNED':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-slate-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-500'
      case 'PENDING':
      case 'PROCESSING':
        return 'text-yellow-500'
      case 'FAILED':
      case 'CANCELLED':
      case 'RETURNED':
        return 'text-red-500'
      default:
        return 'text-slate-400'
    }
  }

  return (
    <div className="space-y-4">
      {transfers.map((transfer) => (
        <Card
          key={transfer.id}
          className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 transition-colors"
        >
          <div className="flex items-start justify-between">
            {/* Left side - Direction icon and details */}
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-full ${
                  transfer.direction === 'DEPOSIT'
                    ? 'bg-purple-500/10'
                    : 'bg-purple-500/10'
                }`}
              >
                {transfer.direction === 'DEPOSIT' ? (
                  <ArrowDownCircle className="h-6 w-6 text-purple-500" />
                ) : (
                  <ArrowUpCircle className="h-6 w-6 text-purple-500" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-zinc-900 dark:text-white">
                    {transfer.direction === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'}
                  </h3>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(transfer.status)}
                    <span className={`text-sm ${getStatusColor(transfer.status)}`}>
                      {transfer.status}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
                  {transfer.externalAccount.institutionName} ••••{' '}
                  {transfer.externalAccount.mask}
                </p>

                {transfer.transaction?.description && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-500">
                    {transfer.transaction.description}
                  </p>
                )}

                {transfer.failureReason && (
                  <p className="text-sm text-red-400 mt-2">
                    Reason: {transfer.failureReason}
                  </p>
                )}

                <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
                  {new Date(transfer.createdAt).toLocaleString()}
                </p>

                {transfer.expectedDate && transfer.status === 'PROCESSING' && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    Expected: {new Date(transfer.expectedDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            {/* Right side - Amount */}
            <div className="text-right">
              <div
                className={`text-lg font-semibold ${
                  transfer.direction === 'DEPOSIT'
                    ? 'text-purple-500'
                    : 'text-purple-500'
                }`}
              >
                {transfer.direction === 'DEPOSIT' ? '+' : '-'}$
                {parseFloat(transfer.amount).toFixed(2)}
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">{transfer.currency}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
