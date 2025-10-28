import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeoBank - Banking for the Digital Age",
  description: "Experience seamless banking with instant transfers, smart budgeting, and powerful financial tools designed for modern life.",
  keywords: ["neobank", "digital banking", "online banking", "fintech", "mobile banking"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
