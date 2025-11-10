'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Send, Clock } from 'lucide-react'

interface RecipientInfo {
  id: string
  email: string
  firstName: string
  lastName: string
  accountId: string
  accountNumber: string
  accountStatus: string
}

interface TransferHistoryProps {
  onQuickTransfer?: (recipient: RecipientInfo) => void
}

export function TransferHistory({ onQuickTransfer }: TransferHistoryProps) {
  const [recentRecipients, setRecentRecipients] = useState<RecipientInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRecentRecipients()
  }, [])

  const fetchRecentRecipients = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/transfers/recipients?mode=recent')

      if (!response.ok) {
        throw new Error('Failed to fetch recent recipients')
      }

      const data = await response.json()
      setRecentRecipients(data.recipients || [])
      setError(null)
    } catch (err: any) {
      console.error('Error fetching recent recipients:', err)
      setError(err.message || 'Failed to load recent recipients')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
        <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-400">
          Loading...
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
        <Button
          variant="outline"
          onClick={fetchRecentRecipients}
          className="text-xs"
        >
          Try again
        </Button>
      </div>
    )
  }

  if (recentRecipients.length === 0) {
    return (
      <div className="text-center py-8 px-4 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
        <Clock className="w-8 h-8 mx-auto mb-3 text-zinc-400" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">
          No recent transfers
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          Send your first transfer to see recent recipients here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-white">
        Recent Recipients
      </h3>

      <div className="space-y-2">
        {recentRecipients.map((recipient) => (
          <div
            key={recipient.id}
            className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-medium flex-shrink-0">
                {recipient.firstName[0]}
                {recipient.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-zinc-900 dark:text-white truncate">
                  {recipient.firstName} {recipient.lastName}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {recipient.email}
                </div>
              </div>
            </div>

            {onQuickTransfer && (
              <Button
                variant="outline"
                onClick={() => onQuickTransfer(recipient)}
                className="ml-2 flex-shrink-0"
              >
                <Send className="h-3 w-3 mr-1" />
                Send
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
