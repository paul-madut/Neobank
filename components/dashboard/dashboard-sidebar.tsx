"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar"
import {
  LayoutDashboard,
  Building2,
  ArrowLeftRight,
  CreditCard,
  Settings,
  LogOut,
  User,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardSidebarProps {
  userEmail: string
  kycStatus: "PENDING" | "VERIFIED" | "REJECTED" | "REQUIRES_REVIEW"
}

export function DashboardSidebar({ userEmail, kycStatus }: DashboardSidebarProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const links = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: (
        <LayoutDashboard className="text-zinc-700 dark:text-zinc-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "My Account",
      href: "/account",
      icon: (
        <User className="text-zinc-700 dark:text-zinc-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "External Banks",
      href: "/banks",
      icon: (
        <Building2 className="text-zinc-700 dark:text-zinc-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Transfers",
      href: "/transfers",
      icon: (
        <ArrowLeftRight className="text-zinc-700 dark:text-zinc-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Cards",
      href: "/cards",
      icon: (
        <CreditCard className="text-zinc-700 dark:text-zinc-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Verify Identity",
      href: "/kyc",
      icon: (
        <ShieldCheck className={cn(
          "h-5 w-5 flex-shrink-0",
          kycStatus === "VERIFIED"
            ? "text-green-600 dark:text-green-400"
            : "text-yellow-600 dark:text-yellow-400"
        )} />
      ),
    },
    {
      label: "Settings",
      href: "/settings",
      icon: (
        <Settings className="text-zinc-700 dark:text-zinc-200 h-5 w-5 flex-shrink-0" />
      ),
    },
  ]

  return (
    <Sidebar open={open} setOpen={setOpen}>
      <SidebarBody className="justify-between gap-10">
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          {open ? <Logo /> : <LogoIcon />}
          <div className="mt-8 flex flex-col gap-2">
            {links.map((link, idx) => (
              <SidebarLink
                key={idx}
                link={link}
                className={cn(
                  pathname === link.href &&
                    "bg-zinc-100 dark:bg-zinc-800 rounded-lg"
                )}
              />
            ))}
          </div>
        </div>
        <div>
          <SidebarLink
            link={{
              label: userEmail,
              href: "#",
              icon: (
                <div className="h-7 w-7 flex-shrink-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                  {userEmail.charAt(0).toUpperCase()}
                </div>
              ),
            }}
          />
          <form action="/auth/signout" method="post" className="mt-2">
            <button
              type="submit"
              className="flex items-center justify-start gap-2 group/sidebar py-2 w-full text-left"
            >
              <LogOut className="text-zinc-700 dark:text-zinc-200 h-5 w-5 flex-shrink-0" />
              <span className="text-zinc-700 dark:text-zinc-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0">
                Logout
              </span>
            </button>
          </form>
        </div>
      </SidebarBody>
    </Sidebar>
  )
}

export const Logo = () => {
  return (
    <Link
      href="/dashboard"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
      <span className="font-bold text-xl text-zinc-900 dark:text-white whitespace-pre">
        NeoBank
      </span>
    </Link>
  )
}

export const LogoIcon = () => {
  return (
    <Link
      href="/dashboard"
      className="font-normal flex space-x-2 items-center text-sm text-black py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
    </Link>
  )
}
