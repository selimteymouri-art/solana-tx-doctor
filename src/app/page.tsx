"use client";
import { useState } from "react";
import Image from "next/image";
import Floaties from "@/components/Floaties";

interface CreatorBuy { signature: string; time: string | null; side: string; solAmount: number | null }
interface EarlyBuyer { address: string; time: string | null; linkedToCreator: boolean; linkReason: string | null; solAmount: number | null }
interface Scan {
  mint: string; name: string | null; symbol: string | null; decimals: number | null; supply: number | null;
  creator: { address: string; source: string; solBalance: number | null; tokenBalance: number | null };
  creatorBuys: CreatorBuy[]; earlyBuyers: EarlyBuyer[]; poolCreatedAt: string | null;
  market: { priceUsd: number | null; liquidityUsd: number | null; volumeH1: number | null; volumeH24: number | null; priceChangeH1: number | null; priceChangeH24: number | null; dex: string | null; pairUrl: string | null };
  sanity: { score: number; reasons: { label: string; good: boolean }[]; verdict: string };
  warnings: string[];
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "unknown");
const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);
const fmtUsd = (n: number | null) =>
  n === null ? "—" : n < 0.01 ? `$${n.toExponential(2)}` : `$${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
const fmtBig = (n: number | null) => (n === null ? "—" : `$${Math.round(n).toLocaleString()}`);

const SRC_LABEL: Record<string, string> = {
  mintAuthority: "Mint authority (on-chain)",
  metaplexCreator: "Metaplex creator metadata",
  firstFunder: "First funder (oldest tx)",
  unknown: "Unknown",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function Home() {
  const [mint, setMint] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [scan, setScan] = useState<Scan | null>(null);

  async function analyze() {
    setLoading(true); setErr(null); setScan(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mint: mint.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Scan failed");
      setDemo(json.demoMode);
      setScan(json.scan);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  const linked = scan?.earlyBuyers.filter((b) => b.linkedToCreator) ?? [];
  const s = scan?.sanity.score ?? 0;

  return (
    <div className="min-h-screen bg-[#070708] font-sans text-zinc-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_75%_55%_at_50%_0%,black,transparent)]" />
        <div className="absolute -top-48 left-1/2 h-[28rem] w-[46rem] -translate-x-1/2 rounded-full bg-orange-600/[0.13] blur-[130px]" />
        <div className="absolute bottom-0 right-0 h-72 w-96 rounded-full bg-orange-500/[0.06] blur-[100px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#070708]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-5">
          <a href="#top" className="flex items-center gap-2">
            <Image src="/helius-logo.png" alt="Helius" width={24} height={24} className="rounded-full" />
            <span className="font-display text-sm font-bold tracking-wide">Meme Scanner</span>
          </a>
          <nav className="ml-6 hidden items-center gap-5 text-[13px] text-zinc-400 sm:flex">
            <a href="#scanner" className="transition hover:text-white">Scanner</a>
            <a href="https://docs.helius.dev" target="_blank" rel="noreferrer" className="transition hover:text-white">Helius Docs</a>
          </nav>
          <a href="#scanner" className="ml-auto rounded-full bg-gradient-to-r from-[#FF6A00] to-[#FF9E00] px-4 py-1.5 text-[13px] font-bold text-white transition hover:brightness-110">
            Scan token
          </a>
        </div>
      </header>

      <main id="top" className="relative mx-auto max-w-3xl px-5 pb-16">
        <Floaties />
        <div className="relative z-10">
          <div className="pt-14 text-center">
            <div className="reveal inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/[0.08] px-3.5 py-1.5 font-mono text-[11px] text-orange-200" style={{ ["--d" as string]: "0s" }}>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-400" />
              </span>
              MEME COIN X-RAY · SOLANA
            </div>
            <h1 className="reveal font-display mx-auto mt-5 max-w-xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl" style={{ ["--d" as string]: "0.08s" }}>
              Who made this token — and{" "}
              <span className="bg-gradient-to-r from-[#FF6A00] to-[#FFB800] bg-clip-text text-transparent">should you ape $5?</span>
            </h1>
            <p className="reveal mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-400" style={{ ["--d" as string]: "0.16s" }}>
              Paste a token contract address. See the creator, their buys, first-hour wallets, insider links, liquidity — and an honest 1–10 sanity score.
            </p>
          </div>

          <div id="scanner" className="reveal mt-8 scroll-mt-20 rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-2xl shadow-black/50 backdrop-blur" style={{ ["--d" as string]: "0.24s" }}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && mint.trim() && !loading && analyze()}
                placeholder="Paste token contract address…"
                spellCheck={false}
                className="flex-1 rounded-xl bg-black/50 px-4 py-3.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-orange-500/60"
              />
              <button
                onClick={analyze}
                disabled={loading || !mint.trim()}
                className="rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#FF9E00] px-7 py-3.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
              >
                {loading ? "Scanning… (up to 60s)" : "Scan"}
              </button>
            </div>
          </div>

          {err && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}
          {demo && (
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              Demo mode — add HELIUS_API_KEY in .env.local for live on-chain data.
            </p>
          )}
          {scan?.warnings.map((w, i) => (
            <p key={i} className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-zinc-400">{w}</p>
          ))}

          {scan && (
            <div className="reveal mt-6 space-y-4" style={{ ["--d" as string]: "0.05s" }}>
              {/* header: token + price */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center">
                <p className="font-display text-xl font-bold">
                  {scan.symbol ? `$${scan.symbol}` : "Unknown token"}{" "}
                  {scan.name && <span className="font-sans text-sm font-normal text-zinc-400">{scan.name}</span>}
                </p>
                <p className="mt-1 font-mono text-xs text-zinc-500">{short(scan.mint)}</p>
                <div className="mt-3 flex items-center justify-center gap-6">
                  <div><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Price</p><p className="font-display text-lg font-bold text-emerald-300">{fmtUsd(scan.market.priceUsd)}</p></div>
                  <div><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Liquidity</p><p className="font-display text-lg font-bold">{fmtBig(scan.market.liquidityUsd)}</p></div>
                  <div><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Vol 1h / 24h</p><p className="text-sm text-zinc-200">{fmtBig(scan.market.volumeH1)} / {fmtBig(scan.market.volumeH24)}</p></div>
                </div>
                {scan.market.priceChangeH1 !== null && (
                  <p className={`mt-1 text-xs ${scan.market.priceChangeH1 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {scan.market.priceChangeH1 >= 0 ? "+" : ""}{scan.market.priceChangeH1.toFixed(1)}% (1h)
                    {scan.market.priceChangeH24 !== null && <> · {scan.market.priceChangeH24 >= 0 ? "+" : ""}{scan.market.priceChangeH24.toFixed(1)}% (24h)</>}
                  </p>
                )}
              </div>

              {/* 1+2 creator */}
              <Card title="① Creator wallet">
                <p className="font-mono text-sm break-all text-orange-200">{scan.creator.address}</p>
                <p className="mt-1 text-xs text-zinc-500">Found via: {SRC_LABEL[scan.creator.source] ?? scan.creator.source}</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-black/30 p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">SOL balance</p>
                    <p className="mt-1 text-zinc-100">{scan.creator.solBalance !== null ? `${scan.creator.solBalance.toFixed(3)} SOL` : "—"}</p>
                  </div>
                  <div className="rounded-xl bg-black/30 p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Holds of this token</p>
                    <p className="mt-1 text-zinc-100">{scan.creator.tokenBalance !== null ? scan.creator.tokenBalance.toLocaleString() : "—"}</p>
                  </div>
                </div>
              </Card>

              {/* 3 creator buys */}
              <Card title={`② Creator's own buys (${scan.creatorBuys.filter((b) => b.side === "buy").length})`}>
                {scan.creatorBuys.length === 0 ? (
                  <p className="text-sm text-zinc-400">No buys of their own token found in recent history.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {scan.creatorBuys.slice(0, 8).map((b) => (
                      <li key={b.signature} className="flex items-center justify-between gap-3 rounded-xl bg-black/30 px-3 py-2">
                        <span className="font-mono text-xs text-zinc-400">{short(b.signature)} · {fmtDate(b.time)}</span>
                        <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${b.side === "buy" ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-zinc-400"}`}>
                          {b.side === "buy" ? `BUY${b.solAmount ? ` ${b.solAmount.toFixed(2)} SOL` : ""}` : "OTHER"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* 4+5 early buyers + links */}
              <Card title={`③ First-hour buyers (${scan.earlyBuyers.length}) — ${linked.length} linked to creator`}>
                {scan.earlyBuyers.length === 0 ? (
                  <p className="text-sm text-zinc-400">No first-hour buys detected (or pool age unknown).</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {scan.earlyBuyers.map((b) => (
                      <li key={b.address + b.time} className={`rounded-xl border px-3 py-2 ${b.linkedToCreator ? "border-amber-500/40 bg-amber-500/[0.07]" : "border-white/[0.06] bg-black/30"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-zinc-200">{short(b.address)}</span>
                          <span className="font-mono text-[11px] text-zinc-500">{b.solAmount ? `${b.solAmount.toFixed(2)} SOL` : ""} · {fmtDate(b.time)}</span>
                        </div>
                        {b.linkedToCreator && <p className="mt-1 text-xs text-amber-300">⚠ Linked to creator — {b.linkReason}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* 6 sanity */}
              <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5">
                <div className="flex items-baseline justify-between">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">$5 of $100 sanity</p>
                  <p className="font-display text-3xl font-bold text-orange-300">{s}<span className="font-sans text-sm font-medium text-zinc-500"> / 10</span></p>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#FF6A00] to-[#FFB800]" style={{ width: `${s * 10}%` }} />
                </div>
                <ul className="mt-3 space-y-1.5 text-xs text-zinc-300">
                  {scan.sanity.reasons.map((r, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className={r.good ? "text-emerald-400" : "text-amber-400"}>{r.good ? "✓" : "⚠"}</span>
                      {r.label}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 rounded-xl bg-black/30 p-3 text-sm text-zinc-200">{scan.sanity.verdict}</p>
                <p className="mt-2 text-[11px] text-zinc-500">Rule-based estimate from on-chain signals, not financial advice.</p>
              </div>
            </div>
          )}

          <footer className="mt-12 border-t border-white/[0.07] pt-6 text-center">
            <p className="font-mono text-[11px] text-zinc-600">Creator + early-wallet X-ray · Built with Helius + DexScreener</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
