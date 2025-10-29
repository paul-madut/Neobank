"use client"

import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-react"
import Link from "next/link"

export default function KYCFailedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-red-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
          <AlertCircle className="w-14 h-14 text-red-600 dark:text-red-400" />
        </div>

        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4">
          Verification Unsuccessful
        </h1>

        <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8">
          We were unable to verify your identity with the information provided.
        </p>

        <div className="mb-8 p-6 rounded-lg bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-800">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-3">
            Common reasons:
          </h3>
          <ul className="space-y-2 text-sm text-left text-zinc-600 dark:text-zinc-400">
            <li className="flex items-start gap-2">
              <span className="text-red-500 flex-shrink-0">•</span>
              <span>Document image was unclear or cropped</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 flex-shrink-0">•</span>
              <span>Document has expired</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 flex-shrink-0">•</span>
              <span>Selfie didn't match the ID photo</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 flex-shrink-0">•</span>
              <span>Information on document was not readable</span>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <Link href="/kyc">
            <Button
              className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Try Again
            </Button>
          </Link>

          <Link href="/dashboard">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          Need help? <Link href="/support" className="text-red-500 hover:underline">Contact Support</Link>
        </p>
      </div>
    </div>
  )
}
