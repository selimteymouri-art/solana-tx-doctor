import { NextRequest, NextResponse } from "next/server";
import { scanToken, type TokenScan } from "@/lib/scanner";

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function demoScan(mint: string): TokenScan {
  return {
    mint,
    name: "Demo Meme",
    symbol: "DMEME",
    decimals: 6,
    supply: 1_000_000_000,
    creator: {
      address: "7fK9pL2mQ4xR8tYvBnCjD3fGhJ6kL1nP5qR7sT9uV91x",
      source: "mintAuthority",
      solBalance: 12.4,
      tokenBalance: 45_000_000,
    },
    creatorBuys: [
      { signature: "demo-sig-1", time: new Date(Date.now() - 5 * 3600_000).toISOString(), side: "buy", solAmount: 2.5 },
      { signature: "demo-sig-2", time: new Date(Date.now() - 4 * 3600_000).toISOString(), side: "buy", solAmount: 1.2 },
    ],
    earlyBuyers: [
      { address: "Aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Jj9Kk0Ll1Mm2Nn91x", time: new Date(Date.now() - 5.5 * 3600_000).toISOString(), linkedToCreator: true, linkReason: "Direct on-chain interaction with creator", solAmount: 3.1 },
      { address: "Zz9Yy8Xx7Ww6Vv5Uu4Tt3Ss2Rr1Qq0Pp9Oo8Nn91x", time: new Date(Date.now() - 5.2 * 3600_000).toISOString(), linkedToCreator: false, linkReason: null, solAmount: 0.8 },
      { address: "Qq1Ww2Ee3Rr4Tt5Yy6Uu7Ii8Oo9Pp0Aa1Ss2Dd91x", time: new Date(Date.now() - 4.9 * 3600_000).toISOString(), linkedToCreator: false, linkReason: null, solAmount: 5.0 },
    ],
    topHolders: [
      { owner: "Pool9xQeWvG816bUx9EPjWMo8sVvGs9z8E8c9d91x", tokenAccount: "Pool9xQeWvG816bUx9EPjWMo8sVvGs9z8E8c9d91x", amount: 620_000_000, pct: 62.0 },
      { owner: "7fK9pL2mQ4xR8tYvBnCjD3fGhJ6kL1nP5qR7sT9uV91x", tokenAccount: "Ab1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Jj9Kk0Ll1Mm2Nn91x", amount: 45_000_000, pct: 4.5 },
      { owner: "Aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Jj9Kk0Ll1Mm2Nn91x", tokenAccount: "Cd1Dd2Ee3Ff4Gg5Hh6Jj7Kk8Ll9Mm0Nn1Oo2Pp91x", amount: 31_000_000, pct: 3.1 },
    ],
    poolCreatedAt: new Date(Date.now() - 6 * 3600_000).toISOString(),
    market: {
      priceUsd: 0.0004123,
      liquidityUsd: 84_500,
      volumeH1: 12_300,
      volumeH24: 210_000,
      priceChangeH1: 34.5,
      priceChangeH24: 180.2,
      dex: "raydium",
      pairUrl: "https://dexscreener.com/solana/demo",
      imageUrl: null,
      websites: [{ label: "Website", url: "https://example.com" }],
      socials: [
        { label: "twitter", url: "https://x.com/demo" },
        { label: "telegram", url: "https://t.me/demo" },
      ],
    },
    sanity: {
      score: 6,
      reasons: [
        { label: "$5 is 5% of $100 — lotto-ticket sizing, survivable if it goes to zero", good: true },
        { label: "Liquidity $84,500 — enough to exit $5", good: true },
        { label: "Creator holds ~4.5% — low dump leverage", good: true },
        { label: "1/3 early buyers link to creator", good: false },
      ],
      verdict: "Reasonable degen play — sized right, eyes open.",
    },
    warnings: [],
  };
}

export async function POST(req: NextRequest) {
  try {
    const { mint } = await req.json();
    if (typeof mint !== "string" || !MINT_RE.test(mint.trim())) {
      return NextResponse.json(
        { error: "Invalid mint address (expected base58, 32–44 chars)." },
        { status: 400 }
      );
    }
    if (!process.env.HELIUS_API_KEY) {
      return NextResponse.json({ demoMode: true, scan: demoScan(mint.trim()) });
    }
    const scan = await scanToken(mint.trim());
    return NextResponse.json({ demoMode: false, scan });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Scan failed" }, { status: 500 });
  }
}
