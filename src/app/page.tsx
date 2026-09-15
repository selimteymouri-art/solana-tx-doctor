"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import XezaPixelInk from "@/components/XezaPixelInk";

interface CreatorBuy { signature: string; time: string | null; side: string; solAmount: number | null }
interface EarlyBuyer { address: string; time: string | null; linkedToCreator: boolean; linkReason: string | null; confidence: string | null; solAmount: number | null }
interface TopHolder { owner: string; tokenAccount: string; amount: number | null; pct: number | null; tag: string }
interface TokenLink { label: string; url: string }
interface Scan {
  mint: string; name: string | null; symbol: string | null; decimals: number | null; supply: number | null;
  creator: { address: string; source: string; solBalance: number | null; tokenBalance: number | null };
  creatorBuys: CreatorBuy[]; earlyBuyers: EarlyBuyer[]; topHolders: TopHolder[];
  contract: { mintAuthority: string | null; freezeAuthority: string | null };
  network: { creatorPct: number | null; linkedCount: number; linkedPct: number | null; combinedPct: number | null; confidence: string };
  poolCreatedAt: string | null; scannedAt: string;
  market: { priceUsd: number | null; liquidityUsd: number | null; marketCap: number | null; volumeH1: number | null; volumeH24: number | null; txnsH1: { buys: number; sells: number } | null; txnsH24: { buys: number; sells: number } | null; priceChangeM5: number | null; priceChangeH1: number | null; priceChangeH6: number | null; priceChangeH24: number | null; dex: string | null; pairUrl: string | null; imageUrl: string | null; websites: TokenLink[]; socials: TokenLink[]; poolCount: number; priceWarning: string | null };
  sanity: { score: number; reasons: { label: string; good: boolean }[]; verdict: string };
  warnings: string[];
}

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}...${a.slice(-4)}` : a);

/** Adaptive price formatting. Never exponential notation. Brief §55-56. */
const fmtPrice = (n: number | null) => {
  if (n === null || !Number.isFinite(n)) return "N/A";
  if (n === 0) return "$0";
  if (n >= 100) return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (n >= 0.01) return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  if (n >= 0.0001) return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 8 });
  // very small: at least 4 significant non-zero digits, trim the rest
  const sig = n.toPrecision(4);
  let plain = Number(sig).toFixed(20).replace(/0+$/, "").replace(/\.$/, "");
  return "$" + plain;
};

/** Compact money: $1,482 / $18.4K / $2.81M / $1.24B. Brief §58. */
const fmtCompact = (n: number | null) => {
  if (n === null || !Number.isFinite(n)) return "N/A";
  const abs = Math.abs(n);
  if (abs >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
  return "$" + Math.round(n).toLocaleString();
};

const fmtAge = (iso: string | null) => {
  if (!iso) return "N/A";
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
};

const SRC_LABEL: Record<string, string> = {
  mintAuthority: "Mint authority (on-chain)",
  metaplexCreator: "Metaplex creator metadata",
  firstFunder: "First funder (oldest tx)",
  unknown: "Unknown",
};

const TAG_STYLE: Record<string, string> = {
  creator: "border-[#ff2ea6]/50 bg-[#ff2ea6]/10 text-[#ff8ac2]",
  linked: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  early: "border-[#38e1ff]/40 bg-[#38e1ff]/10 text-[#38e1ff]",
  burn: "border-white/15 bg-white/5 text-zinc-500",
  unknown: "border-white/10 bg-white/5 text-zinc-500",
};

function socialIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("twitter") || l.includes("x.com")) return "X";
  if (l.includes("telegram")) return "TG";
  if (l.includes("discord")) return "DC";
  if (l.includes("youtube")) return "YT";
  if (l.includes("medium")) return "M";
  if (l.includes("github")) return "GH";
  return "WEB";
}

function Section({ title, right, children, index }: { title: string; right?: React.ReactNode; children: React.ReactNode; index?: number }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <section
      ref={ref}
      aria-label={title}
      style={{ transitionDelay: `${(index ?? 0) * 70}ms` }}
      className={`rounded-xl border border-white/[0.08] bg-[#0c1017] p-5 transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[13px] font-bold uppercase tracking-[0.16em] text-zinc-300">{title}</h2>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const SCAN_STEPS = [
  "Tracing deployer",
  "Following funding",
  "Scanning launch transactions",
  "Analyzing first-hour buyers",
  "Finding wallet connections",
  "Checking holder concentration",
  "Checking liquidity",
  "Checking insider activity",
  "Building 5$ Test",
];

const ERR_COPY: Record<string, string> = {
  invalid: "That does not look like a valid contract address.",
  notfound: "We could not find a token for this contract.",
  noliquidity: "No active liquidity pool found.",
};

export default function Home() {
  const [mint, setMint] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [scanErr, setScanErr] = useState(false);
  const [demo, setDemo] = useState(false);
  const [scan, setScan] = useState<Scan | null>(null);
  const [copied, setCopied] = useState(false);

  async function analyze() {
    setLoading(true); setErr(null); setScan(null); setScanErr(false); setStepIdx(0);
    const timer = setInterval(() => setStepIdx((i) => Math.min(i + 1, SCAN_STEPS.length - 1)), 3500);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mint: mint.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = String(json.error ?? "");
        if (res.status === 400) throw new Error(ERR_COPY.invalid);
        if (/creator|history/i.test(msg)) throw new Error(ERR_COPY.notfound);
        throw new Error("Some live data could not be loaded. Try refreshing.");
      }
      setDemo(json.demoMode);
      setScan(json.scan);
      if (json.scan?.warnings?.length) setErr(null);
    } catch (e: any) {
      setErr(e.message ?? "Some live data could not be loaded. Try refreshing.");
      setScanErr(true);
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  const linked = scan?.earlyBuyers.filter((b) => b.linkedToCreator) ?? [];
  const s = scan?.sanity.score ?? 0;
  const riskLabel = s <= 3 ? "HIGH RISK" : s <= 5 ? "RISKY" : s <= 7 ? "MIXED" : "CLEANER";
  const riskColor = s <= 3 ? "text-[#ff2ea6]" : s <= 5 ? "text-amber-300" : s <= 7 ? "text-[#38e1ff]" : "text-[#00ff9d]";
  const ticker = scan?.symbol ? `$${scan.symbol.replace(/^\$/, "")}` : null;
  // Smarter X query: ticker + contract together so generic tickers do not drown. Brief §64.
  const xQuery = ticker && scan ? `"${ticker}" "${scan.mint}"` : scan ? `"${scan.mint}"` : "";
  const xSearchUrl = scan ? `https://x.com/search?q=${encodeURIComponent(xQuery)}&f=live` : null;
  const xTickerUrl = ticker ? `https://x.com/search?q=${encodeURIComponent(ticker)}&f=live` : null;
  const top10Pct = scan ? scan.topHolders.slice(0, 10).reduce((a, h) => a + (h.pct ?? 0), 0) : 0;

  function copyCA() {
    if (!scan) return;
    navigator.clipboard?.writeText(scan.mint).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  return (
    <div className="relative isolate min-h-screen bg-[#070b12] font-sans text-zinc-100">
      <XezaPixelInk />
      <a href="#scanner" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-black">
        Skip to scanner
      </a>

      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#070b12]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-5">
          <a href="#top" className="flex items-center gap-2">
            <Image src="/xeza-logo.png" alt="XEZA" width={28} height={28} className="rounded-md" />
            <span className="font-display text-sm font-black tracking-[0.14em]">XEZA</span>
          </a>
          <nav className="ml-6 hidden items-center gap-5 text-[13px] text-zinc-400 sm:flex">
            <a href="#scanner" className="transition hover:text-white">Scanner</a>
            <a href="https://docs.helius.dev" target="_blank" rel="noreferrer" className="transition hover:text-white">Helius Docs</a>
          </nav>
          <a href="#scanner" className="ml-auto cursor-pointer rounded-lg bg-white px-4 py-1.5 text-[13px] font-bold text-black transition hover:brightness-90">
          Run the 5$ Test
          </a>
        </div>
      </header>

      <main id="top" className="relative z-10 mx-auto max-w-3xl px-5 pb-16">
        <div className="relative z-10">
          {!scan && !loading && (
            <div className="pt-16 text-center sm:pt-24">
              <Image src="/xeza-logo.png" alt="XEZA logo" width={72} height={72} className="reveal mx-auto rounded-2xl" style={{ ["--d" as string]: "0s" }} />
              <p className="reveal font-display mt-5 text-xs font-bold tracking-[0.3em] text-zinc-500" style={{ ["--d" as string]: "0.05s" }}>XEZA</p>
              <h1 className="reveal font-display mx-auto mt-4 max-w-xl text-5xl font-black tracking-tight sm:text-6xl" style={{ ["--d" as string]: "0.12s" }}>
                5$ TEST
              </h1>
              <p className="reveal mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-zinc-400" style={{ ["--d" as string]: "0.2s" }}>
                If your entire bankroll was $100, how rational would putting $5 here be?
              </p>
            </div>
          )}

          {scan && (
            <div className="pt-8">
              <p className="text-center font-display text-[11px] font-bold tracking-[0.3em] text-zinc-500">XEZA · 5$ TEST</p>
            </div>
          )}

          <div id="scanner" className="mt-8 scroll-mt-20 rounded-xl border border-white/10 bg-white/[0.03] p-2 shadow-2xl shadow-black/50">
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (mint.trim() && !loading) analyze(); }}>
              <label htmlFor="mint-input" className="sr-only">Token contract address</label>
              <input
                id="mint-input"
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                placeholder="Paste token contract address"
                spellCheck={false}
                autoComplete="off"
                aria-invalid={scanErr}
                aria-describedby={scanErr ? "scan-error" : undefined}
                className="h-12 flex-1 rounded-lg bg-black/50 px-4 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-white/30 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-[#ff2ea6]/50"
              />
              <button
                type="submit"
                disabled={loading || !mint.trim()}
                aria-busy={loading}
                className="h-12 cursor-pointer rounded-lg bg-white px-7 text-sm font-bold text-black transition hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "Testing" : "Run the 5$ Test"}
              </button>
            </form>
            {loading && (
              <ol className="space-y-1.5 px-3 pb-2 pt-3" role="status" aria-live="polite">
                {SCAN_STEPS.map((st, i) => (
                  <li key={st} className={`font-mono text-xs ${i < stepIdx ? "text-zinc-600" : i === stepIdx ? "text-zinc-100" : "text-zinc-700"}`}>
                    {i < stepIdx ? "✓" : i === stepIdx ? "›" : "·"} {st}{i === stepIdx ? "..." : ""}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {!scan && !loading && (
            <p className="mt-4 text-center font-mono text-xs text-zinc-600">Follow the money before you follow the hype.</p>
          )}

          {err && <p id="scan-error" role="alert" className="mt-4 rounded-xl border border-[#ff2ea6]/30 bg-[#ff2ea6]/10 p-3 text-sm text-[#ff8ac2]">{err}</p>}
          {demo && (
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              Demo mode. Add HELIUS_API_KEY in .env.local for live on-chain data.
            </p>
          )}
          {scan?.warnings.map((w, i) => (
            <p key={i} className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-zinc-400">Analysis completed with limited data. {w}</p>
          ))}

          {scan && (
            <div className="mt-6 space-y-4">
              {/* token overview + score */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    {scan.market.imageUrl && (
                      <Image src={scan.market.imageUrl} alt={scan.symbol ?? "token"} width={44} height={44} className="rounded-full" unoptimized />
                    )}
                    <div>
                      <p className="font-display text-xl font-bold">{scan.symbol ? `$${scan.symbol}` : "Unknown token"}{scan.name ? <span className="ml-2 font-sans text-sm font-normal text-zinc-400">{scan.name}</span> : null}</p>
                      <button onClick={copyCA} title="Copy contract address" className="mt-0.5 cursor-pointer font-mono text-xs text-zinc-500 transition hover:text-white">
                        {short(scan.mint)} {copied ? "· Copied" : "· Copy"}
                      </button>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {xTickerUrl && <a href={xTickerUrl} target="_blank" rel="noreferrer" title="Search ticker on X" className="cursor-pointer rounded-md border border-white/10 px-2 py-1 font-mono text-[11px] text-zinc-300 transition hover:border-white/30 hover:text-white">X Search</a>}
                        {xSearchUrl && <a href={xSearchUrl} target="_blank" rel="noreferrer" title="Search contract on X" className="cursor-pointer rounded-md border border-white/10 px-2 py-1 font-mono text-[11px] text-zinc-300 transition hover:border-white/30 hover:text-white">X Contract</a>}
                        {scan.market.websites.map((w) => <a key={w.url} href={w.url} target="_blank" rel="noreferrer" title="Website" className="cursor-pointer rounded-md border border-white/10 px-2 py-1 font-mono text-[11px] text-zinc-300 transition hover:border-white/30 hover:text-white">Website</a>)}
                        {scan.market.socials.slice(0, 2).map((w) => <a key={w.url} href={w.url} target="_blank" rel="noreferrer" title={w.label} className="cursor-pointer rounded-md border border-white/10 px-2 py-1 font-mono text-[11px] text-zinc-300 transition hover:border-white/30 hover:text-white">{socialIcon(w.label)}</a>)}
                        {scan.market.pairUrl && <a href={scan.market.pairUrl} target="_blank" rel="noreferrer" title="Open DEX" className="cursor-pointer rounded-md border border-white/10 px-2 py-1 font-mono text-[11px] text-zinc-300 transition hover:border-white/30 hover:text-white">DEX</a>}
                      </div>
                      {scan.market.websites.length === 0 && scan.market.socials.length === 0 && (
                        <p className="mt-2 font-mono text-[11px] text-zinc-600">No verified project socials found.</p>
                      )}
                    </div>
                  </div>
                  <div className="text-center sm:text-right">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">5$ TEST</p>
                    <p className={`font-display text-5xl font-black tabular-nums ${riskColor}`}>{s}<span className="text-lg text-zinc-500">/10</span></p>
                    <p className={`font-mono text-xs font-bold tracking-widest ${riskColor}`}>{riskLabel}</p>
                  </div>
                </div>
                <p className="mt-3 text-center text-sm text-zinc-400 sm:text-left">If your total bankroll was $100, putting $5 here would currently score {s}/10.</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
                  {[
                    ["Price", fmtPrice(scan.market.priceUsd)],
                    ["Market Cap", fmtCompact(scan.market.marketCap)],
                    ["Liquidity", fmtCompact(scan.market.liquidityUsd)],
                    ["Vol 24h", fmtCompact(scan.market.volumeH24)],
                    ["Holders", scan.topHolders.length ? `Top ${scan.topHolders.length}` : "N/A"],
                    ["Age", fmtAge(scan.poolCreatedAt)],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-lg bg-black/30 px-2 py-2.5">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{l}</p>
                      <p className="mt-0.5 truncate text-sm font-bold tabular-nums" title={String(v)}>{v}</p>
                    </div>
                  ))}
                </div>
                {scan.market.priceWarning && (
                  <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-center font-mono text-[11px] text-amber-200">{scan.market.priceWarning}</p>
                )}
                <p className="mt-2 text-center font-mono text-[10px] text-zinc-600">
                  Source: {scan.market.dex ?? "unknown"} primary pool · {scan.market.poolCount} pool{scan.market.poolCount === 1 ? "" : "s"} · Scanned {new Date(scan.scannedAt).toLocaleTimeString()}
                </p>
              </div>

              {/* why this score */}
              <Section index={0} title="Why this score">
                <ul className="space-y-1.5 text-sm">
                  {scan.sanity.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-zinc-300">
                      <span className={r.good ? "text-emerald-400" : "text-amber-400"}>{r.good ? "✓" : "·"}</span>
                      <span>{r.label}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 rounded-lg bg-black/30 p-3 text-sm text-zinc-200">{scan.sanity.verdict}</p>
              </Section>

              {/* creator */}
              <Section index={1} title="Creator wallet" right={<span className="font-mono text-[11px] text-zinc-500">{scan.creator.address ? (SRC_LABEL[scan.creator.source] ?? "") : ""}</span>}>
                {!scan.creator.address ? (
                  <p className="text-sm text-zinc-400">No meaningful creator linked wallet cluster detected. Mint authority revoked, history too deep to trace.</p>
                ) : (
                  <>
                    <p className="break-all font-mono text-sm text-zinc-100">{scan.creator.address}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <div className="rounded-lg bg-black/30 p-3"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">SOL balance</p><p className="mt-1 tabular-nums">{scan.creator.solBalance !== null ? `${scan.creator.solBalance.toFixed(3)}` : "N/A"}</p></div>
                      <div className="rounded-lg bg-black/30 p-3"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Token share</p><p className="mt-1 tabular-nums">{scan.network.creatorPct !== null ? `${scan.network.creatorPct.toFixed(1)}%` : "N/A"}</p></div>
                      <div className="rounded-lg bg-black/30 p-3"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Own buys</p><p className="mt-1 tabular-nums">{scan.creatorBuys.filter((b) => b.side === "buy").length}</p></div>
                      <div className="rounded-lg bg-black/30 p-3"><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Mint / Freeze</p><p className="mt-1 font-mono text-xs">{scan.contract.mintAuthority ? "ACTIVE" : "revoked"} / {scan.contract.freezeAuthority ? "ACTIVE" : "revoked"}</p></div>
                    </div>
                  </>
                )}
              </Section>

              {/* creator network */}
              <Section index={2} title="Creator network" right={<span className="font-mono text-[11px] text-zinc-500">confidence: {scan.network.confidence}</span>}>
                {scan.network.linkedCount === 0 ? (
                  <p className="text-sm text-zinc-400">No meaningful creator linked wallet cluster detected.</p>
                ) : (
                  <>
                    <p className="text-sm text-zinc-200">{scan.network.linkedCount} wallet{scan.network.linkedCount === 1 ? "" : "s"} appear connected to the creator.</p>
                    <ul className="mt-3 space-y-2">
                      {linked.slice(0, 8).map((b) => (
                        <li key={b.address} className="rounded-lg bg-black/30 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs">{short(b.address)}</span>
                            <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">{b.confidence ?? "possible"}</span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-400">{b.linkReason}</p>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-lg bg-black/30 p-2.5"><p className="font-mono text-[10px] text-zinc-500">Creator</p><p className="font-bold tabular-nums">{scan.network.creatorPct !== null ? `${scan.network.creatorPct.toFixed(1)}%` : "N/A"}</p></div>
                      <div className="rounded-lg bg-black/30 p-2.5"><p className="font-mono text-[10px] text-zinc-500">Linked</p><p className="font-bold tabular-nums">{scan.network.linkedPct !== null ? `${scan.network.linkedPct.toFixed(1)}%` : "N/A"}</p></div>
                      <div className="rounded-lg bg-black/30 p-2.5"><p className="font-mono text-[10px] text-zinc-500">Combined</p><p className="font-bold tabular-nums">{scan.network.combinedPct !== null ? `${scan.network.combinedPct.toFixed(1)}%` : "N/A"}</p></div>
                    </div>
                    {scan.network.combinedPct !== null && (
                      <p className="mt-2 text-sm text-zinc-300">Creator network controls approximately {scan.network.combinedPct.toFixed(1)}% of circulating supply.</p>
                    )}
                  </>
                )}
              </Section>

              {/* first 60 minutes */}
              <Section index={3} title="First 60 minutes" right={<span className="font-mono text-[11px] text-zinc-500">{scan.earlyBuyers.length} wallets</span>}>
                {scan.earlyBuyers.length === 0 ? (
                  <p className="text-sm text-zinc-400">Not enough launch activity yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {scan.earlyBuyers.slice(0, 12).map((b) => (
                      <li key={b.address + b.time} className="flex items-center justify-between gap-2 rounded-lg bg-black/30 px-3 py-2 text-sm">
                        <span className="font-mono text-xs">{short(b.address)}</span>
                        <span className="font-mono text-[11px] tabular-nums text-zinc-400">{b.solAmount ? `${b.solAmount.toFixed(2)} SOL` : ""}</span>
                        <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${b.linkedToCreator ? "border-amber-500/40 text-amber-300" : "border-white/10 text-zinc-500"}`}>
                          {b.linkedToCreator ? (b.confidence ?? "linked") : "no link"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* top holders */}
              <Section index={4} title="Top holders" right={<span className="font-mono text-[11px] text-zinc-500">top 10: {top10Pct.toFixed(1)}%</span>}>
                {scan.topHolders.length === 0 ? (
                  <p className="text-sm text-zinc-400">No holder data.</p>
                ) : (
                  <ul className="space-y-2">
                    {scan.topHolders.map((h, i) => (
                      <li key={h.tokenAccount} className="rounded-lg bg-black/30 px-3 py-2">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-mono text-xs"><span className="mr-2 text-zinc-600">#{i + 1}</span>{short(h.owner)}</span>
                          <span className="flex items-center gap-2">
                            <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${TAG_STYLE[h.tag] ?? TAG_STYLE.unknown}`}>{h.tag}</span>
                            <span className="font-mono text-[11px] tabular-nums text-zinc-300">{h.pct !== null ? `${h.pct.toFixed(1)}%` : "N/A"}</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-white/50" style={{ width: `${Math.min(100, h.pct ?? 0)}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* market */}
              <Section index={5} title="Market">
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div className="rounded-lg bg-black/30 p-3"><p className="font-mono text-[10px] text-zinc-500">Price</p><p className="mt-1 break-all font-bold tabular-nums">{fmtPrice(scan.market.priceUsd)}</p></div>
                  <div className="rounded-lg bg-black/30 p-3"><p className="font-mono text-[10px] text-zinc-500">Liquidity</p><p className="mt-1 font-bold tabular-nums">{fmtCompact(scan.market.liquidityUsd)}</p></div>
                  <div className="rounded-lg bg-black/30 p-3"><p className="font-mono text-[10px] text-zinc-500">1h flow</p><p className="mt-1 font-mono text-xs tabular-nums">{scan.market.txnsH1 ? `${scan.market.txnsH1.buys}B / ${scan.market.txnsH1.sells}S` : "N/A"}</p></div>
                  <div className="rounded-lg bg-black/30 p-3"><p className="font-mono text-[10px] text-zinc-500">24h flow</p><p className="mt-1 font-mono text-xs tabular-nums">{scan.market.txnsH24 ? `${scan.market.txnsH24.buys}B / ${scan.market.txnsH24.sells}S` : "N/A"}</p></div>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center font-mono text-[11px]">
                  {[["5m", scan.market.priceChangeM5], ["1h", scan.market.priceChangeH1], ["6h", scan.market.priceChangeH6], ["24h", scan.market.priceChangeH24]].map(([l, v]) => (
                    <div key={l as string} className="rounded-lg bg-black/30 p-2">
                      <p className="text-zinc-500">{l}</p>
                      <p className={`tabular-nums ${(v as number | null) !== null && (v as number) >= 0 ? "text-emerald-400" : "text-[#ff8ac2]"}`}>
                        {(v as number | null) === null ? "N/A" : `${(v as number) >= 0 ? "+" : ""}${(v as number).toFixed(1)}%`}
                      </p>
                    </div>
                  ))}
                </div>
              </Section>

              {/* project links */}
              <Section index={6} title="Project links">
                {scan.market.websites.length === 0 && scan.market.socials.length === 0 ? (
                  <p className="text-sm text-zinc-400">No verified project socials found.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {scan.market.websites.map((w) => <a key={w.url} href={w.url} target="_blank" rel="noreferrer" className="cursor-pointer rounded-md border border-white/10 px-3 py-1.5 font-mono text-xs transition hover:border-white/30 hover:text-white">Website</a>)}
                    {scan.market.socials.map((w) => <a key={w.url} href={w.url} target="_blank" rel="noreferrer" className="cursor-pointer rounded-md border border-white/10 px-3 py-1.5 font-mono text-xs transition hover:border-white/30 hover:text-white">{socialIcon(w.label)} {w.label}</a>)}
                  </div>
                )}
                {xSearchUrl && <a href={xSearchUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block cursor-pointer font-mono text-xs text-zinc-400 underline underline-offset-2 transition hover:text-white">Search token on X</a>}
              </Section>

              {/* footer note */}
              <p className="text-center font-mono text-[11px] text-zinc-600">Rule based estimate from on-chain signals, not financial advice.</p>
            </div>
          )}

          <footer className="mt-12 border-t border-white/[0.06] pt-6">
            <div className="flex flex-col items-center gap-4">
              <Image src="/xeza-logo.png" alt="XEZA" width={36} height={36} className="rounded-lg" />
              <div className="flex items-center gap-4">
                <a href="https://helius.dev" target="_blank" rel="noreferrer" title="Powered by Helius" className="opacity-60 transition hover:opacity-100">
                  <Image src="/helius-logo.png" alt="Helius" width={28} height={28} className="rounded-full" />
                </a>
                <Image src="/solana-mark.svg" alt="Solana" width={20} height={20} className="opacity-60" />
                <a href="https://x.com/salimteymouri" target="_blank" rel="noreferrer" className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 transition hover:border-white/25 hover:bg-white/[0.07]">
                  <Image src="/x-logo.svg" alt="X" width={13} height={13} />
                  <Image src="/builder.png" alt="Sello" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
                  <span className="text-left">
                    <span className="block text-xs font-semibold text-zinc-100">Sello</span>
                    <span className="block font-mono text-[10px] text-zinc-500">@salimteymouri</span>
                  </span>
                </a>
              </div>
              <p className="font-mono text-[11px] text-zinc-600">Built by Sello · Powered by Helius on Solana</p>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
