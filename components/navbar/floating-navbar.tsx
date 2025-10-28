"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, ArrowRight } from "lucide-react"

export function FloatingNavbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const navItems = [
    { name: "Features", href: "#features" },
    { name: "About", href: "#about" },
    { name: "Pricing", href: "#pricing" },
  ]

  return (
    <>
      {/* Desktop & Mobile Navbar */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300",
          "w-[95%] max-w-6xl"
        )}
      >
        <div
          className={cn(
            "relative rounded-full border backdrop-blur-md transition-all duration-300",
            isScrolled
              ? "border-slate-700/80 bg-slate-900/80 shadow-lg shadow-purple-500/10"
              : "border-slate-800/50 bg-slate-900/50"
          )}
        >
          <div className="flex items-center justify-between px-6 py-4">
            {/* Logo */}
            <Link
              href="/"
              className="text-xl font-bold text-white hover:text-purple-400 transition-colors"
            >
              NeoBank
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-sm font-medium text-slate-300 hover:text-white transition-colors relative group"
                >
                  {item.name}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-purple-500 transition-all group-hover:w-full" />
                </a>
              ))}
            </div>

            {/* Desktop Auth Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link href="/login">
                <button className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
                  Login
                </button>
              </Link>
              <Link href="/register">
                <button className="group px-5 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all hover:scale-105 flex items-center gap-2">
                  Get Started
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-300 hover:text-white transition-colors"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="md:hidden mt-2 rounded-2xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md shadow-xl overflow-hidden"
            >
              <div className="p-6 space-y-4">
                {/* Mobile Nav Items */}
                {navItems.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-4 py-3 text-base font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all"
                  >
                    {item.name}
                  </a>
                ))}

                {/* Mobile Auth Buttons */}
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                    <button className="w-full px-4 py-3 text-base font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all text-left">
                      Login
                    </button>
                  </Link>
                  <Link href="/register" onClick={() => setIsMobileMenuOpen(false)}>
                    <button className="w-full px-5 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-base font-semibold text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all hover:scale-[1.02] flex items-center justify-center gap-2">
                      Get Started
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Spacer to prevent content from hiding under fixed navbar */}
      <div className="h-20" />
    </>
  )
}
