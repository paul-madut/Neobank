'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ACHTransferForm from '@/components/ach/ach-transfer-form'
import ACHTransferHistory from '@/components/ach/ach-transfer-history'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function ACHClient() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('transfer')

  // Fetch external accounts
  const { data: externalAccounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['externalAccounts'],
    queryFn: async () => {
      const res = await fetch('/api/plaid/accounts')
      if (!res.ok) throw new Error('Failed to fetch external accounts')
      const data = await res.json()
      return data.externalAccounts || []
    },
  })

  // Fetch ACH transfer history
  const { data: achHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['achTransfers'],
    queryFn: async () => {
      const res = await fetch('/api/ach/status')
      if (!res.ok) throw new Error('Failed to fetch ACH transfers')
      const data = await res.json()
      return data.achTransfers || []
    },
  })

  const handleTransferSuccess = () => {
    // Refresh ACH transfer history
    queryClient.invalidateQueries({ queryKey: ['achTransfers'] })
    // Switch to history tab
    setActiveTab('history')
  }

  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-600 dark:text-zinc-400">Loading external accounts...</div>
      </div>
    )
  }

  if (!externalAccounts || externalAccounts.length === 0) {
    return (
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
            No External Accounts Linked
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            You need to link an external bank account before you can deposit or
            withdraw funds.
          </p>
          <a
            href="/banks"
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
          >
            Link Bank Account
          </a>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-zinc-200 dark:bg-zinc-800 p-1">
          <TabsTrigger
            value="transfer"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md"
          >
            Transfer
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md"
          >
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transfer" className="mt-6">
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-6">
                Deposit or Withdraw Funds
              </h2>
              <ACHTransferForm
                externalAccounts={externalAccounts}
                onSuccess={handleTransferSuccess}
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <ACHTransferHistory
            transfers={achHistory || []}
            isLoading={historyLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
