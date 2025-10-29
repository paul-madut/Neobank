"use client"

import { useEffect, useState } from "react"
import { TransactionItem } from "./transaction-item"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import type { TransactionWithDetails } from "@/types/account"

interface TransactionListProps {
  limit?: number
  showLoadMore?: boolean
  onTransactionClick?: (transaction: TransactionWithDetails) => void
}

export function TransactionList({
  limit = 10,
  showLoadMore = false,
  onTransactionClick,
}: TransactionListProps) {
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const fetchTransactions = async (currentOffset: number, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      const response = await fetch(
        `/api/transactions?limit=${limit}&offset=${currentOffset}`
      )

      if (!response.ok) {
        throw new Error("Failed to fetch transactions")
      }

      const data = await response.json()

      if (append) {
        setTransactions((prev) => [...prev, ...data.transactions])
      } else {
        setTransactions(data.transactions)
      }

      setHasMore(data.pagination.hasMore)
      setError(null)
    } catch (err: any) {
      console.error("Error fetching transactions:", err)
      setError(err.message || "Failed to load transactions")
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchTransactions(0)
  }, [])

  const handleLoadMore = () => {
    const newOffset = offset + limit
    setOffset(newOffset)
    fetchTransactions(newOffset, true)
  }

  if (loading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        <span className="ml-2 text-zinc-600 dark:text-zinc-400">
          Loading transactions...
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        <Button
          variant="outline"
          onClick={() => fetchTransactions(0)}
        >
          Try again
        </Button>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 px-4 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
        <p className="text-zinc-600 dark:text-zinc-400 mb-2">
          No transactions yet
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          Your transaction history will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <TransactionItem
          key={transaction.id}
          transaction={transaction}
          onClick={
            onTransactionClick ? () => onTransactionClick(transaction) : undefined
          }
        />
      ))}

      {showLoadMore && hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
