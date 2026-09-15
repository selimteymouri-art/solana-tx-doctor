"use client";
import { useState } from "react";
import Image from "next/image";
import Floaties, { MatrixRain } from "@/components/XezaDecor";

interface CreatorBuy { signature: string; time: string | null; side: string; solAmount: number | null }
interface EarlyBuyer { address: string; time: string | null; linkedToCreator: boolean; linkReason: string | null; solAmount: number | null }
interface TopHolder { owner: string; tokenAccount: string; amount: number | null; pct: number | null }
interface TokenLink { label: string; url: string }
interface Scan {
  mint: string; name: string | null; symbol: string | null; decimals: number | null; supply: number | null;
  creator: { address: string; source: string; solBalance: number | null; tokenBalance: number | null };
  creatorBuys: CreatorBuy[]; earlyBuyers: EarlyBuyer[]; topHolders: TopHolder[]; poolCreatedAt: string | null;
  market: { priceUsd: number | null; liquidityUsd: number | null; volumeH1: number | null; volumeH24: number | null; priceChangeH1: number | null; priceChangeH24: number | null; dex: string | null; pairUrl: string | null; imageUrl: string | null; websites: TokenLink[]; socials: TokenLink[] };
  sanity: { score: number; reasons: { label: string; good: boolean }[]; verdict: string };
  warnings: string[];
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "unknown");
const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

/** Exact decimal price — never exponential notation, full precision from DexScreener. */
const fmtPrice = (n: number | null) => {
  if (n === null || !Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  if (n >= 1000) return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  // small prices: show up to 12 significant decimals, trim trailing zeros, no exponent
  let s = n.toFixed(12);
  s = s.replace(/0+$/, "").replace(/\.$/, "");
  return "$" + s;
};
const fmtBig = (n: number | null) => (n === null ? "—" : `$${Math.round(n).toLocaleString()}`);

const SRC_LABEL: Record<string, string> = {
  mintAuthority: "Mint authority (on-chain)",
  metaplexCreator: "Metaplex creator metadata",
  firstFunder: "First funder (oldest tx)",
  unknown: "Unknown",
};

function socialIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("twitter") || l.includes("x.com")) return "𝕏";
  if (l.includes("telegram")) return "✈";
  if (l.includes("discord")) return "◈";
  if (l.includes("youtube")) return "▶";
  if (l.includes("medium")) return "M";
  if (l.includes("github")) return "⌨";
  if (l.includes("instagram")) return "◉";
  if (l.includes("tiktok")) return "♪";
  return "↗";
}

function Card({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="hud-corner rounded-lg border border-[#00ff9d]/15 bg-[#0b0f14]/90 p-5">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00ff9d]/70">
        <span className="text-[#ff2ea6]">{index}</span> · {title}
      </p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function Home() {
  const [mint, setMint] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [scanErr, setScanErr] = useState(false);
  const [demo, setDemo] = useState(false);
  const [scan, setScan] = useState<Scan | null>(null);

  async function analyze() {
    setLoading(true); setErr(null); setScan(null); setScanErr(false);
    const phases = ["resolving creator…", "reading creator buys…", "loading top holders…", "tracing first-hour wallets…", "checking market…"];
    let pi = 0;
    setPhase(phases[0]);
    const timer = setInterval(() => { pi = Math.min(pi + 1, phases.length - 1); setPhase(phases[pi]); }, 6000);
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
      setScanErr(true);
    } finally {
      clearInterval(timer);
      setLoading(false);
      setPhase("");
    }
  }

  const linked = scan?.earlyBuyers.filter((b) => b.linkedToCreator) ?? [];
  const s = scan?.sanity.score ?? 0;
  const ticker = scan?.symbol ? `$${scan.symbol.replace(/^\$/, "")}` : null;
  const xSearchUrl = ticker
    ? `https://x.com/search?q=${encodeURIComponent(ticker)}&src=typed_query&f=live`
    : scan ? `https://x.com/search?q=${encodeURIComponent(scan.mint)}&src=typed_query&f=live` : null;

  return (
    <div className="min-h-screen bg-[#0d0d0d] font-sans text-zinc-100">
      {/* backdrop: matrix rain + scanline wash */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <MatrixRain />
        <div className="absolute -top-48 left-1/2 h-[28rem] w-[46rem] -translate-x-1/2 rounded-full bg-[#00ff9d]/[0.07] blur-[130px]" />
        <div className="absolute bottom-0 right-0 h-72 w-96 rounded-full bg-[#ff2ea6]/[0.06] blur-[100px]" />
      </div>

      <a href="#scanner" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-[#00ff9d] focus:px-3 focus:py-2 focus:text-black">
        Skip to scanner
      </a>

      <header className="sticky top-0 z-50 border-b border-[#00ff9d]/10 bg-[#0d0d0d]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-5">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 rotate-45 items-center justify-center border border-[#00ff9d]/70 bg-[#00ff9d]/10">
              <span className="-rotate-45 font-display text-sm font-black text-[#00ff9d]">X</span>
            </span>
            <span className="font-display text-sm font-bold tracking-[0.18em]">XEZA</span>
          </a>
          <nav className="ml-6 hidden items-center gap-5 text-[13px] text-zinc-400 sm:flex">
            <a href="#scanner" className="transition hover:text-[#00ff9d]">Scanner</a>
            <a href="https://docs.helius.dev" target="_blank" rel="noreferrer" className="transition hover:text-[#00ff9d]">Helius Docs</a>
          </nav>
          <a href="#scanner" className="ml-auto cursor-pointer rounded-sm border border-[#00ff9d]/60 bg-[#00ff9d]/10 px-4 py-1.5 font-mono text-[13px] font-bold text-[#00ff9d] transition hover:bg-[#00ff9d]/20">
            [ SCAN ]
          </a>
        </div>
      </header>

      <main id="top" className="relative mx-auto max-w-3xl px-5 pb-16">
        <Floaties />
        <div className="relative z-10">
          <div className="pt-14 text-center">
            <div className="reveal inline-flex items-center gap-2 rounded-sm border border-[#00ff9d]/30 bg-[#00ff9d]/[0.06] px-3.5 py-1.5 font-mono text-[11px] tracking-[0.2em] text-[#00ff9d]" style={{ ["--d" as string]: "0s" }}>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ff9d] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00ff9d]" />
              </span>
              MEME_COIN_X-RAY // SOLANA
            </div>
            <h1 className="reveal font-display mx-auto mt-5 max-w-xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl" style={{ ["--d" as string]: "0.08s" }}>
              Who made this token — and{" "}
              <span className="glow-num text-[#00ff9d]">should you ape $5?</span>
            </h1>
            <p className="reveal mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-400" style={{ ["--d" as string]: "0.16s" }}>
              Paste a token contract address. See the creator, top holders, first-hour wallets, insider links, liquidity — and an honest 1–10 sanity score.
            </p>
          </div>

          <div id="scanner" className="reveal hud-corner mt-8 scroll-mt-20 rounded-lg border border-[#00ff9d]/20 bg-[#0b0f14]/90 p-2 shadow-2xl shadow-black/60 backdrop-blur" style={{ ["--d" as string]: "0.24s" }}>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => { e.preventDefault(); if (mint.trim() && !loading) analyze(); }}
            >
              <label htmlFor="mint-input" className="sr-only">Token contract address</label>
              <input
                id="mint-input"
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                placeholder="paste_contract_address…"
                spellCheck={false}
                autoComplete="off"
                aria-invalid={scanErr}
                aria-describedby={scanErr ? "scan-error" : undefined}
                className="h-12 flex-1 rounded-sm border border-transparent bg-black/60 px-4 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-[#00ff9d]/50 focus:ring-2 focus:ring-[#00ff9d]/40 aria-[invalid=true]:border-[#ff2ea6]/60"
              />
              <button
                type="submit"
                disabled={loading || !mint.trim()}
                aria-busy={loading}
                className="h-12 cursor-pointer rounded-sm bg-[#00ff9d] px-7 font-mono text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "> scanning_" : "> SCAN"}
              </button>
            </form>
            {loading && (
              <div className="px-2 pb-1 pt-2" role="status" aria-live="polite">
                <div className="h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-[#00ff9d] to-[#38e1ff]" />
                </div>
                <p className="mt-1.5 font-mono text-[11px] text-[#00ff9d]/80">{phase || "scanning…"}</p>
              </div>
            )}
          </div>

          {err && <p id="scan-error" role="alert" className="mt-4 rounded-sm border border-[#ff2ea6]/40 bg-[#ff2ea6]/10 p-3 text-sm text-[#ff8ac2]">{err}</p>}
          {demo && (
            <p className="mt-4 rounded-sm border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              Demo mode — add HELIUS_API_KEY in .env.local for live on-chain data.
            </p>
          )}
          {scan?.warnings.map((w, i) => (
            <p key={i} className="mt-2 rounded-sm border border-white/10 bg-white/[0.03] p-3 font-mono text-xs text-zinc-400">{w}</p>
          ))}

          {scan && (
            <div className="reveal mt-6 space-y-4" style={{ ["--d" as string]: "0.05s" }}>
              {/* header: token + price */}
              <div className="scanlines hud-corner relative overflow-hidden rounded-lg border border-[#00ff9d]/20 bg-[#0b0f14]/90 p-5 text-center">
                {scan.market.imageUrl && (
                  <Image src={scan.market.imageUrl} alt={scan.symbol ?? "token"} width={56} height={56} className="mx-auto rounded-full ring-2 ring-[#00ff9d]/40" unoptimized />
                )}
                <p className="font-display mt-2 text-xl font-bold">
                  {scan.symbol ? `$${scan.symbol}` : "Unknown token"}{" "}
                  {scan.name && <span className="font-sans text-sm font-normal text-zinc-400">{scan.name}</span>}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-zinc-500">{scan.mint}</p>
                <p className="glow-num font-display mt-3 break-all text-3xl font-black text-[#00ff9d]">{fmtPrice(scan.market.priceUsd)}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">live price · usd</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-sm bg-black/40 p-3"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Liquidity</p><p className="font-display mt-1 font-bold">{fmtBig(scan.market.liquidityUsd)}</p></div>
                  <div className="rounded-sm bg-black/40 p-3"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Vol 1h</p><p className="font-display mt-1 font-bold">{fmtBig(scan.market.volumeH1)}</p></div>
                  <div className="rounded-sm bg-black/40 p-3"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Vol 24h</p><p className="font-display mt-1 font-bold">{fmtBig(scan.market.volumeH24)}</p></div>
                </div>
                {scan.market.priceChangeH1 !== null && (
                  <p className={`mt-2 font-mono text-xs ${scan.market.priceChangeH1 >= 0 ? "text-[#00ff9d]" : "text-[#ff2ea6]"}`}>
                    {scan.market.priceChangeH1 >= 0 ? "+" : ""}{scan.market.priceChangeH1.toFixed(1)}% (1h)
                    {scan.market.priceChangeH24 !== null && <> · {scan.market.priceChangeH24 >= 0 ? "+" : ""}{scan.market.priceChangeH24.toFixed(1)}% (24h)</>}
                  </p>
                )}
                {/* socials + x search */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {scan.market.websites.map((w) => (
                    <a key={w.url} href={w.url} target="_blank" rel="noreferrer" className="cursor-pointer rounded-sm border border-white/15 px-3 py-1.5 font-mono text-xs text-zinc-300 transition hover:border-[#00ff9d]/50 hover:text-[#00ff9d]">
                      ⌂ Website
                    </a>
                  ))}
                  {scan.market.socials.map((w) => (
                    <a key={w.url} href={w.url} target="_blank" rel="noreferrer" className="cursor-pointer rounded-sm border border-white/15 px-3 py-1.5 font-mono text-xs text-zinc-300 transition hover:border-[#00ff9d]/50 hover:text-[#00ff9d]">
                      {socialIcon(w.label)} {w.label}
                    </a>
                  ))}
                  {xSearchUrl && (
                    <a href={xSearchUrl} target="_blank" rel="noreferrer" className="cursor-pointer rounded-sm border border-[#38e1ff]/50 bg-[#38e1ff]/10 px-3 py-1.5 font-mono text-xs font-bold text-[#38e1ff] transition hover:bg-[#38e1ff]/20">
                      𝕏 Search {ticker ?? "token"} posts
                    </a>
                  )}
                </div>
              </div>

              {/* 1 creator */}
              {scan.creator.address ? (
              <Card index="01" title="Creator wallet">
                <p className="font-mono text-sm break-all text-[#00ff9d]">{scan.creator.address}</p>
                <p className="mt-1 font-mono text-xs text-zinc-500">found_via: {SRC_LABEL[scan.creator.source] ?? scan.creator.source}</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-sm bg-black/40 p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">SOL balance</p>
                    <p className="mt-1 tabular-nums text-zinc-100">{scan.creator.solBalance !== null ? `${scan.creator.solBalance.toFixed(3)} SOL` : "—"}</p>
                  </div>
                  <div className="rounded-sm bg-black/40 p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Holds of this token</p>
                    <p className="mt-1 tabular-nums text-zinc-100">{scan.creator.tokenBalance !== null ? scan.creator.tokenBalance.toLocaleString() : "—"}</p>
                  </div>
                </div>
              </Card>
              ) : (
              <Card index="01" title="Creator wallet">
                <p className="font-mono text-sm text-zinc-400">unknown — mint authority revoked, history too deep to trace.</p>
              </Card>
              )}

              {/* 2 creator buys */}
              <Card index="02" title={`Creator's own buys (${scan.creatorBuys.filter((b) => b.side === "buy").length})`}>
                {scan.creatorBuys.length === 0 ? (
                  <p className="text-sm text-zinc-400">No buys of their own token found in recent history.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {scan.creatorBuys.slice(0, 8).map((b) => (
                      <li key={b.signature} className="flex items-center justify-between gap-3 rounded-sm bg-black/40 px-3 py-2">
                        <span className="font-mono text-xs text-zinc-400">{short(b.signature)} · {fmtDate(b.time)}</span>
                        <span className={`rounded-sm px-2 py-0.5 font-mono text-[11px] ${b.side === "buy" ? "bg-[#00ff9d]/15 text-[#00ff9d]" : "bg-white/10 text-zinc-400"}`}>
                          {b.side === "buy" ? `BUY${b.solAmount ? ` ${b.solAmount.toFixed(2)} SOL` : ""}` : "OTHER"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* 3 top holders */}
              <Card index="03" title={`Top holders (${scan.topHolders.length})`}>
                {scan.topHolders.length === 0 ? (
                  <p className="text-sm text-zinc-400">No holder data.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {scan.topHolders.map((h, i) => (
                      <li key={h.tokenAccount} className="rounded-sm bg-black/40 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-zinc-200">
                            <span className="mr-2 text-zinc-600">#{i + 1}</span>{short(h.owner)}
                          </span>
                          <span className={`font-mono text-[11px] tabular-nums ${h.pct !== null && h.pct > 20 ? "text-[#ff2ea6]" : "text-zinc-400"}`}>
                            {h.pct !== null ? `${h.pct.toFixed(1)}%` : "—"}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                          <div className={`h-full rounded-full ${h.pct !== null && h.pct > 20 ? "bg-[#ff2ea6]" : "bg-[#00ff9d]/70"}`} style={{ width: `${Math.min(100, h.pct ?? 0)}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* 4 early buyers + links */}
              <Card index="04" title={`First-hour buyers (${scan.earlyBuyers.length}) — ${linked.length} linked`}>
                {scan.earlyBuyers.length === 0 ? (
                  <p className="text-sm text-zinc-400">No first-hour buys detected (or pool age unknown).</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {scan.earlyBuyers.map((b) => (
                      <li key={b.address + b.time} className={`rounded-sm border px-3 py-2 ${b.linkedToCreator ? "border-[#ff2ea6]/50 bg-[#ff2ea6]/[0.07]" : "border-white/[0.06] bg-black/40"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-zinc-200">{short(b.address)}</span>
                          <span className="font-mono text-[11px] tabular-nums text-zinc-500">{b.solAmount ? `${b.solAmount.toFixed(2)} SOL` : ""} · {fmtDate(b.time)}</span>
                        </div>
                        {b.linkedToCreator && <p className="mt-1 font-mono text-xs text-[#ff8ac2]">[!] LINKED — {b.linkReason}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* 5 sanity */}
              <div className="hud-corner rounded-lg border border-[#00ff9d]/20 bg-gradient-to-b from-[#0b0f14] to-black/60 p-5">
                <div className="flex items-baseline justify-between">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">$5_of_$100 // sanity</p>
                  <p className="font-display glow-num text-3xl font-black text-[#00ff9d]">{s}<span className="font-sans text-sm font-medium text-zinc-500"> / 10</span></p>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#00ff9d] to-[#38e1ff]" style={{ width: `${s * 10}%` }} />
                </div>
                <ul className="mt-3 space-y-1.5 text-xs text-zinc-300">
                  {scan.sanity.reasons.map((r, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className={r.good ? "text-[#00ff9d]" : "text-[#ff2ea6]"}>{r.good ? "[+]" : "[!]"}</span>
                      {r.label}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 rounded-sm border border-[#00ff9d]/20 bg-black/40 p-3 text-sm text-zinc-200">{scan.sanity.verdict}</p>
                <p className="mt-2 font-mono text-[11px] text-zinc-500">rule-based estimate from on-chain signals, not financial advice.</p>
              </div>
            </div>
          )}

          <footer className="mt-12 border-t border-[#00ff9d]/10 pt-6 text-center">
            <p className="font-mono text-[11px] text-zinc-600">XEZA // creator + early-wallet x-ray · helius + dexscreener</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
