import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";
import { Meteors } from "@/components/magicui/meteors";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { Cover } from "@/components/magicui/cover";
import { FloatingNavbar } from "@/components/navbar/floating-navbar";
import { ArrowRight, CreditCard, Lock, Smartphone, TrendingUp } from "lucide-react";
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
            <Lock className="h-4 w-4" />
            <span>Bank-level security & FDIC insured</span>
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
            Experience seamless banking with instant transfers, smart budgeting,
            and powerful financial tools designed for modern life.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register">
              <ShimmerButton
                className="text-base font-semibold shadow-lg"
                background="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              >
                Get Started
                <ArrowRight className="h-5 w-5" />
              </ShimmerButton>
            </Link>

            <a href="#features">
              <button className="group inline-flex items-center gap-2 rounded-full border border-slate-700 bg-transparent px-6 py-3 text-base font-semibold text-white transition-all hover:border-slate-500 hover:bg-slate-800/50">
                Learn More
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            </a>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              { label: "Active Users", value: "500K+" },
              { label: "Total Transactions", value: "$2.5B" },
              { label: "Trust Rating", value: "4.9/5" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
                <div className="text-3xl font-bold text-white">{stat.value}</div>
                <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
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
              Why Choose NeoBank?
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-400">
              Everything you need to manage your finances in one place
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <Smartphone className="h-8 w-8" />,
                title: "Mobile First",
                description: "Manage your money on the go with our intuitive mobile app",
              },
              {
                icon: <Lock className="h-8 w-8" />,
                title: "Secure & Safe",
                description: "Bank-grade encryption and biometric authentication",
              },
              {
                icon: <TrendingUp className="h-8 w-8" />,
                title: "Smart Insights",
                description: "AI-powered analytics to help you make better financial decisions",
              },
              {
                icon: <CreditCard className="h-8 w-8" />,
                title: "Instant Transfers",
                description: "Send and receive money instantly with zero fees",
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
            Ready to transform your banking?
          </h2>
          <p className="mb-8 text-lg text-slate-300">
            Join thousands of users who are already experiencing the future of finance
          </p>
          <Link href="/register">
            <ShimmerButton
              className="text-lg font-semibold"
              background="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            >
              Open Your Account
              <ArrowRight className="h-5 w-5" />
            </ShimmerButton>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div>
              <h3 className="mb-4 text-lg font-semibold text-white">NeoBank</h3>
              <p className="text-sm text-slate-400">
                Modern banking for the digital age
              </p>
            </div>
            {[
              {
                title: "Product",
                links: ["Features", "Security", "Pricing", "API"],
              },
              {
                title: "Company",
                links: ["About", "Blog", "Careers", "Contact"],
              },
              {
                title: "Legal",
                links: ["Privacy", "Terms", "Compliance", "Licenses"],
              },
            ].map((section) => (
              <div key={section.title}>
                <h4 className="mb-4 text-sm font-semibold text-white">
                  {section.title}
                </h4>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm text-slate-400 hover:text-white">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 border-t border-slate-800 pt-8 text-center text-sm text-slate-400">
            © 2025 NeoBank. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
