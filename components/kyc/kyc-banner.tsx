"use client"

import { motion } from "framer-motion"
import { AlertCircle, ShieldCheck, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"

interface KYCBannerProps {
  kycStatus: "PENDING" | "VERIFIED" | "REJECTED" | "REQUIRES_REVIEW"
}

export function KYCBanner({ kycStatus }: KYCBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false)

  // Don't show banner if verified or dismissed
  if (kycStatus === "VERIFIED" || isDismissed) {
    return null
  }

  const getBannerConfig = () => {
    switch (kycStatus) {
      case "PENDING":
        return {
          gradient: "from-yellow-500/20 via-orange-500/20 to-yellow-500/20",
          borderColor: "border-yellow-500/30",
          icon: <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />,
          title: "Verify your identity to unlock all features",
          description:
            "Complete KYC verification to send money, connect banks, and access cards.",
          buttonText: "Verify Now",
          buttonClass:
            "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white",
        }
      case "REQUIRES_REVIEW":
        return {
          gradient: "from-orange-500/20 via-red-500/20 to-orange-500/20",
          borderColor: "border-orange-500/30",
          icon: <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />,
          title: "Additional information required",
          description:
            "Your verification needs review. Please check your email for next steps or contact support.",
          buttonText: "Contact Support",
          buttonClass:
            "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white",
        }
      case "REJECTED":
        return {
          gradient: "from-red-500/20 via-pink-500/20 to-red-500/20",
          borderColor: "border-red-500/30",
          icon: <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />,
          title: "Verification unsuccessful",
          description:
            "Your identity verification was not successful. Please try again with different documents.",
          buttonText: "Try Again",
          buttonClass:
            "bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white",
        }
      default:
        return {
          gradient: "from-blue-500/20 via-purple-500/20 to-blue-500/20",
          borderColor: "border-blue-500/30",
          icon: <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
          title: "Verification pending",
          description: "Your account is being reviewed.",
          buttonText: "Learn More",
          buttonClass:
            "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white",
        }
    }
  }

  const config = getBannerConfig()

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="relative overflow-hidden"
    >
      {/* Animated gradient background */}
      <div
        className={`absolute inset-0 bg-gradient-to-r ${config.gradient} animate-gradient-x`}
      />

      {/* Border */}
      <div
        className={`relative border-b ${config.borderColor} backdrop-blur-sm bg-white/50 dark:bg-zinc-900/50`}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Icon and Text */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="flex-shrink-0">{config.icon}</div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-zinc-900 dark:text-white text-sm sm:text-base">
                  {config.title}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5 hidden sm:block">
                  {config.description}
                </p>
              </div>
            </div>

            {/* Right: CTA and Dismiss */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Link href="/kyc">
                <Button
                  className={`${config.buttonClass} shadow-lg font-semibold`}
                >
                  {config.buttonText}
                </Button>
              </Link>

              <button
                onClick={() => setIsDismissed(true)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
