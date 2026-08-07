import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "NeoBank - a neobank demo built on Next.js, Stripe and Plaid",
  description: "A portfolio demo of a neobank, built with Next.js, Prisma and Supabase. It moves no real money: Stripe runs in test mode, Plaid in sandbox, and every balance, card and transfer is fake.",
  keywords: ["portfolio project", "demo app", "fintech demo", "next.js", "prisma", "stripe test mode", "plaid sandbox"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <Providers>
          {children}
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
