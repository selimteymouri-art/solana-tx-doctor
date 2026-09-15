import type { Metadata } from "next";
import { Orbitron, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Orbitron({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Xeza — Meme Coin X-Ray",
  description:
    "Paste a Solana token address. See the creator, top holders, first-hour wallets, insider links, liquidity — and an honest 1–10 sanity score.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
