import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";
import { Meteors } from "@/components/magicui/meteors";
import { DemoLoginButton } from "@/components/demo/demo-login-button";
import { Cover } from "@/components/magicui/cover";
import { FloatingNavbar } from "@/components/navbar/floating-navbar";
import { ArrowRight, CreditCard, FlaskConical, Lock, Smartphone, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Floating Navbar */}
      <FloatingNavbar />

      {/* Animated Background */}
      <AnimatedGridPattern
        numSquares={30}
        maxOpacity={0.1}
        duration={3}
        className="absolute inset-0 [mask-image:radial-gradient(500px_circle_at_center,white,transparent)]"
      />

      {/* Hero Section */}
      <section id="hero" className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-20">
        <Meteors number={20} />

        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm text-slate-300 backdrop-blur-sm">
            <FlaskConical className="h-4 w-4" />
            <span>Portfolio demo - no real money, no real bank</span>
          </div>

          <h1 className="mb-6 text-5xl font-bold tracking-tight text-white sm:text-7xl">
            Banking for the
            <br />
            <Cover className="mt-2">
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Digital Age
              </span>
            </Cover>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-400 sm:text-xl">
            A full-stack neobank built as a portfolio project: instant transfers
            on a double-entry ledger, Plaid bank linking, and Stripe-issued
            virtual cards. Stripe runs in test mode and Plaid in sandbox mode,
            so no real money is ever involved.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:items-start">
            <DemoLoginButton />

            <Link href="/register">
              <button className="group inline-flex items-center gap-2 rounded-full border border-slate-700 bg-transparent px-6 py-3 text-base font-semibold text-white transition-all hover:border-slate-500 hover:bg-slate-800/50">
                Create an account
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            </Link>
          </div>

          {/* Built With */}
          <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              { label: "Frontend & API", value: "Next.js 16" },
              { label: "Database & ORM", value: "Postgres + Prisma" },
              { label: "Integrations", value: "Stripe + Plaid" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
                <div className="text-2xl font-bold text-white">{item.value}</div>
                <div className="mt-1 text-sm text-slate-400">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-white sm:text-5xl">
              What NeoBank Demonstrates
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-400">
              The pieces of a modern banking product, built end to end against
              provider test environments
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <Smartphone className="h-8 w-8" />,
                title: "Responsive Web App",
                description: "One responsive interface that works on phone, tablet, and desktop",
              },
              {
                icon: <Lock className="h-8 w-8" />,
                title: "Authenticated Access",
                description: "Supabase Auth with email/password and OAuth sign-in, plus Stripe Identity verification",
              },
              {
                icon: <TrendingUp className="h-8 w-8" />,
                title: "Double-Entry Ledger",
                description: "Every transfer writes matching debit and credit entries in one atomic transaction",
              },
              {
                icon: <CreditCard className="h-8 w-8" />,
                title: "Cards & Transfers",
                description: "Stripe Issuing virtual cards and Plaid bank linking, running in test and sandbox mode",
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/50 to-slate-900/20 p-8 backdrop-blur-sm transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10"
              >
                <div className="mb-4 inline-flex rounded-lg bg-purple-500/10 p-3 text-purple-400">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-xl font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-4 py-20">
        <div className="mx-auto max-w-4xl rounded-3xl border border-slate-800 bg-gradient-to-br from-purple-900/20 to-pink-900/20 p-12 text-center backdrop-blur-sm">
          <h2 className="mb-4 text-4xl font-bold text-white">
            Want to look around?
          </h2>
          <p className="mb-8 text-lg text-slate-300">
            Jump straight into a populated account. No signup, no email
            confirmation. Nothing you do here touches real money or a real bank.
          </p>
          <div className="flex justify-center">
            <DemoLoginButton />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div>
              <h3 className="mb-4 text-lg font-semibold text-white">NeoBank</h3>
              <p className="text-sm text-slate-400">
                A full-stack banking demo built as a portfolio project
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold text-white">Explore</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#features" className="text-sm text-slate-400 hover:text-white">
                    Features
                  </a>
                </li>
                <li>
                  <Link href="/register" className="text-sm text-slate-400 hover:text-white">
                    Create a demo account
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-sm text-slate-400 hover:text-white">
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold text-white">Built With</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>Next.js 16 and TypeScript</li>
                <li>Supabase Auth and Postgres</li>
                <li>Prisma</li>
                <li>Stripe and Plaid</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold text-white">Demo Status</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>Stripe in test mode</li>
                <li>Plaid in sandbox mode</li>
                <li>No real money moves</li>
                <li>No real financial data</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 space-y-2 border-t border-slate-800 pt-8 text-center text-sm text-slate-400">
            <p>
              NeoBank is a portfolio and demo application. It is not a bank, it
              is not a licensed or regulated financial institution, and it holds
              no customer funds. Deposits are not insured because there are no
              deposits. Please do not enter real financial or identity
              information.
            </p>
            <p>© 2025 NeoBank demo project.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
