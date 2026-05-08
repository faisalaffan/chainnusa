import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChainNusa — Crypto Wallet Analyzer",
  description:
    "Multi-chain wallet analyzer dengan AI summary. Powered by Etherscan V2 + Claude.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
