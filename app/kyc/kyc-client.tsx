"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  ShieldCheck,
  FileText,
  Camera,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface KYCVerificationClientProps {
  kycStatus: "PENDING" | "VERIFIED" | "REJECTED" | "REQUIRES_REVIEW"
  userEmail: string
}

export function KYCVerificationClient({
  kycStatus,
  userEmail,
}: KYCVerificationClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleStartVerification = async () => {
    setLoading(true)

    try {
      // Create verification session
      const response = await fetch("/api/kyc/create-session", {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to start verification")
      }

      const data = await response.json()

      // Redirect to Stripe Identity hosted page
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error("No verification URL received")
      }
    } catch (error: any) {
      console.error("Error starting verification:", error)
      toast.error(error.message || "Failed to start verification")
      setLoading(false)
    }
  }

  // If already verified, show success state
  if (kycStatus === "VERIFIED") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
        <div className="container mx-auto px-4 py-16 max-w-2xl">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-8"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Link>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4">
              You're All Verified!
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8">
              Your identity has been successfully verified. You now have access to all
              features.
            </p>
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Link>

        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-6">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4">
            Verify Your Identity
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            To unlock all features and ensure the security of your account, we need to
            verify your identity.
          </p>
        </div>

        {/* Status Messages */}
        {kycStatus === "REQUIRES_REVIEW" && (
          <div className="mb-8 p-6 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-1">
                  Additional Information Required
                </h3>
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  Your verification needs additional review. Please check your email for
                  next steps or contact our support team.
                </p>
              </div>
            </div>
          </div>
        )}

        {kycStatus === "REJECTED" && (
          <div className="mb-8 p-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                  Verification Unsuccessful
                </h3>
                <p className="text-sm text-red-800 dark:text-red-200">
                  Your previous verification attempt was not successful. Please try again
                  with different documents or contact support if you need assistance.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* What You'll Need */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
              Government ID
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Passport, driver's license, or national ID card
            </p>
          </div>

          <div className="p-6 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
              <Camera className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
              Selfie Photo
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              A live photo of yourself for identity verification
            </p>
          </div>

          <div className="p-6 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
              5 Minutes
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Quick and secure verification process
            </p>
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="mb-8 p-6 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-3">
            Your Privacy Matters
          </h3>
          <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>Your documents are encrypted and securely stored</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>We never share your information with third parties</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span>Verification is powered by Stripe Identity</span>
            </li>
          </ul>
        </div>

        {/* Start Button */}
        <div className="text-center">
          <Button
            onClick={handleStartVerification}
            disabled={loading}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-8"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Starting Verification...
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5 mr-2" />
                Start Verification
              </>
            )}
          </Button>
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            By continuing, you agree to our terms of service and privacy policy
          </p>
        </div>
      </div>
    </div>
  )
}
