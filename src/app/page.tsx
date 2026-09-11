"use client";
import { useState } from "react";
import Image from "next/image";
import Floaties from "@/components/Floaties";

interface Result {
  demoMode: boolean;
  summary: { status: string; program: string; time: string | null; feeSol: number };
  explain: { what: string; fix: string };
  wallet: { address: string; firstSeen: string | null; lastActive: string | null } | null;
  risk: { score: number; level: string; reasons: { label: string; good: boolean }[] };
  logs: string[];
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString() : "unknown";
const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

const RISK_STYLE: Record<string, { bar: string; text: string; glow: string }> = {
  Low: { bar: "from-emerald-400 to-teal-300", text: "text-emerald-300", glow: "shadow-emerald-500/20" },
  Medium: { bar: "from-amber-400 to-yellow-300", text: "text-amber-300", glow: "shadow-amber-500/20" },
  High: { bar: "from-orange-500 to-red-400", text: "text-orange-300", glow: "shadow-orange-500/20" },
  Critical: { bar: "from-red-500 to-rose-400", text: "text-red-300", glow: "shadow-red-500/25" },
};

function Feature({ icon, title, desc, delay }: { icon: string; title: string; desc: string; delay: string }) {
  return (
    <div
      className="reveal rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-orange-500/30 hover:bg-white/[0.05]"
      style={{ ["--d" as string]: delay }}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/25 to-amber-400/10 text-lg ring-1 ring-orange-500/30">
        {icon}
      </span>
      <p className="font-display mt-3 font-bold">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-zinc-400">{desc}</p>
    </div>
  );
}

export default function Home() {
  const [sig, setSig] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Result | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  async function analyze() {
    setLoading(true);
    setErr(null);
    setData(null);
    setShowLogs(false);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signature: sig.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analyze failed");
      setData(json);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  const risk = data ? (RISK_STYLE[data.risk.level] ?? RISK_STYLE.Medium) : null;
  const failed = data?.summary.status === "failed";

  return (
    <div className="min-h-screen bg-[#070708] font-sans text-zinc-100">
      {/* backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_75%_55%_at_50%_0%,black,transparent)]" />
        <div className="absolute -top-48 left-1/2 h-[28rem] w-[46rem] -translate-x-1/2 rounded-full bg-orange-600/[0.13] blur-[130px]" />
        <div className="absolute bottom-0 right-0 h-72 w-96 rounded-full bg-orange-500/[0.06] blur-[100px]" />
      </div>

      {/* nav — Helius pattern: logo left, links center, CTA right */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#070708]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-5">
          <a href="#top" className="flex items-center gap-2">
            <Image src="/helius-logo.png" alt="Helius" width={24} height={24} className="rounded-full" />
            <span className="font-display text-sm font-bold tracking-wide">Tx Doctor</span>
          </a>
          <nav className="ml-6 hidden items-center gap-5 text-[13px] text-zinc-400 sm:flex">
            <a href="#analyzer" className="transition hover:text-white">Debugger</a>
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="https://docs.helius.dev" target="_blank" rel="noreferrer" className="transition hover:text-white">Helius Docs</a>
          </nav>
          <a
            href="#analyzer"
            className="ml-auto rounded-full bg-gradient-to-r from-[#FF6A00] to-[#FF9E00] px-4 py-1.5 text-[13px] font-bold text-white transition hover:brightness-110"
          >
            Launch app
          </a>
        </div>
      </header>

      <main id="top" className="relative mx-auto max-w-2xl px-5 pb-16">
        <Floaties />

        <div className="relative z-10">
          {/* hero */}
          <div className="pt-14 text-center">
            <div className="reveal inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/[0.08] px-3.5 py-1.5 font-mono text-[11px] text-orange-200" style={{ ["--d" as string]: "0s" }}>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-400" />
              </span>
              LIVE ON SOLANA MAINNET
            </div>
            <h1 className="reveal font-display mx-auto mt-5 max-w-xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl" style={{ ["--d" as string]: "0.08s" }}>
              Understand any Solana transaction in{" "}
              <span className="bg-gradient-to-r from-[#FF6A00] to-[#FFB800] bg-clip-text text-transparent">seconds.</span>
            </h1>
            <p className="reveal mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-400" style={{ ["--d" as string]: "0.16s" }}>
              Paste a signature. Get a plain-English diagnosis, wallet context and an honest risk score — powered by Helius.
            </p>
          </div>

          {/* analyzer */}
          <div id="analyzer" className="reveal mt-8 scroll-mt-20 rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-2xl shadow-black/50 backdrop-blur" style={{ ["--d" as string]: "0.24s" }}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={sig}
                onChange={(e) => setSig(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sig.trim() && !loading && analyze()}
                placeholder="Paste transaction signature…"
                spellCheck={false}
                className="flex-1 rounded-xl bg-black/50 px-4 py-3.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 outline-none ring-orange-500/0 focus:ring-2 focus:ring-orange-500/60"
              />
              <button
                onClick={analyze}
                disabled={loading || !sig.trim()}
                className="rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#FF9E00] px-7 py-3.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
              >
                {loading ? "Analyzing…" : "Analyze"}
              </button>
            </div>
          </div>

          {/* powered by */}
          <div className="reveal mt-5 flex items-center justify-center gap-4" style={{ ["--d" as string]: "0.3s" }}>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">Powered by</span>
            <a
              href="https://helius.dev"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/[0.09] py-1.5 pl-2 pr-4 transition hover:border-orange-500/60 hover:bg-orange-500/[0.14]"
            >
              <Image src="/helius-logo.png" alt="Helius" width={24} height={24} className="rounded-full" />
              <span className="font-display text-sm font-bold text-orange-200">Helius</span>
            </a>
            <a
              href="https://solana.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 opacity-60 transition hover:opacity-100"
            >
              <Image src="/solana-mark.svg" alt="Solana" width={14} height={14} />
              <span className="text-xs font-medium text-zinc-400">Solana</span>
            </a>
          </div>

          {err && (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{err}</p>
          )}
          {data?.demoMode && (
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              Demo mode — add HELIUS_API_KEY in .env.local for live on-chain data.
            </p>
          )}

          {data && risk && (
            <div className="reveal mt-6 space-y-4" style={{ ["--d" as string]: "0.05s" }}>
              <div
                className={`rounded-2xl border p-4 text-center font-display text-lg font-bold ${
                  failed
                    ? "border-red-500/30 bg-red-500/10 text-red-300"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                {failed ? "❌ Transaction failed" : "✅ Transaction succeeded"}
                <span className="ml-2 font-sans text-sm font-normal text-zinc-400">
                  {data.summary.program} · {fmtDate(data.summary.time)} · {data.summary.feeSol} SOL fee
                </span>
              </div>

              <div className={`rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl ${risk.glow}`}>
                <div className="flex items-baseline justify-between">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Risk estimate</p>
                  <p className={`font-display text-2xl font-bold ${risk.text}`}>
                    {data.risk.score}<span className="font-sans text-sm font-medium text-zinc-500"> / 10 · {data.risk.level}</span>
                  </p>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${risk.bar} transition-all`}
                    style={{ width: `${data.risk.score * 10}%` }}
                  />
                </div>
                <ul className="mt-3 space-y-1.5 text-xs text-zinc-300">
                  {data.risk.reasons.map((r, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className={r.good ? "text-emerald-400" : "text-amber-400"}>{r.good ? "✓" : "⚠"}</span>
                      {r.label}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-zinc-500">Based on on-chain signals, not a safety guarantee.</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="font-display font-semibold">What went wrong?</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-300">{data.explain.what}</p>
                <p className="mt-4 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-orange-300/90">How to fix</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-300">{data.explain.fix}</p>
                <button onClick={() => setShowLogs(!showLogs)} className="mt-3 text-xs text-orange-300 underline underline-offset-2">
                  {showLogs ? "Hide" : "View"} technical logs
                </button>
                {showLogs && (
                  <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-black/60 p-3 font-mono text-[11px] leading-relaxed text-zinc-300 ring-1 ring-white/10">
                    {data.logs.join("\n") || "(no logs)"}
                  </pre>
                )}
              </div>

              {data.wallet && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <p className="font-display font-semibold">
                    Wallet <span className="font-mono font-normal text-orange-200">{short(data.wallet.address)}</span>
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-black/30 p-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">First seen on-chain</p>
                      <p className="mt-1 text-zinc-200">{fmtDate(data.wallet.firstSeen)}</p>
                    </div>
                    <div className="rounded-xl bg-black/30 p-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Last active</p>
                      <p className="mt-1 text-zinc-200">{fmtDate(data.wallet.lastActive)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* mini stats — Helius pattern */}
          <div className="reveal mt-10 grid grid-cols-3 divide-x divide-white/[0.07] rounded-2xl border border-white/10 bg-white/[0.02]" style={{ ["--d" as string]: "0.1s" }}>
            {[
              ["Live data", "Helius mainnet RPC"],
              ["Zero guesswork", "Rules score, AI explains"],
              ["No signup", "Paste & analyze"],
            ].map(([t, s]) => (
              <div key={t} className="px-4 py-4 text-center">
                <p className="font-display text-sm font-bold text-white">{t}</p>
                <p className="mt-1 font-mono text-[10px] leading-snug text-zinc-500">{s}</p>
              </div>
            ))}
          </div>

          {/* features — Helius product-card pattern */}
          <div id="features" className="mt-12 scroll-mt-20">
            <p className="reveal text-center font-mono text-[11px] uppercase tracking-[0.24em] text-orange-300/80" style={{ ["--d" as string]: "0s" }}>
              The complete checkup
            </p>
            <h2 className="reveal font-display mt-2 text-center text-2xl font-bold tracking-tight sm:text-3xl" style={{ ["--d" as string]: "0.08s" }}>
              Everything a failed transaction is hiding.
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Feature icon="🩺" title="Instant diagnosis" desc="Raw logs and program errors translated into plain English, with a concrete fix." delay="0.1s" />
              <Feature icon="👛" title="Wallet context" desc="First seen on-chain, last activity and history — know who you're dealing with." delay="0.18s" />
              <Feature icon="🛡️" title="Honest risk score" desc="Deterministic 1–10 rules, every point explained. The AI never invents the number." delay="0.26s" />
            </div>
          </div>

          {/* CTA banner — Helius orange panel pattern */}
          <div className="reveal relative mt-12 overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF6A00] to-[#B34700] p-8 text-center shadow-2xl shadow-orange-900/40" style={{ ["--d" as string]: "0.1s" }}>
            <div className="bg-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
            <div className="relative">
              <Image src="/helius-logo.png" alt="Helius" width={44} height={44} className="mx-auto rounded-full ring-2 ring-white/40" />
              <h2 className="font-display mx-auto mt-4 max-w-md text-2xl font-bold leading-tight text-white">
                Built on the same infra as Solana&apos;s best teams.
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-orange-100/90">
                Every diagnosis runs on Helius RPCs and parsed transaction data.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <a href="#analyzer" className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#B34700] transition hover:brightness-95">
                  Try it now
                </a>
                <a
                  href="https://helius.dev"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/40 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Get Helius →
                </a>
              </div>
            </div>
          </div>

          {/* footer */}
          <footer className="mt-12 border-t border-white/[0.07] pt-8">
            <div className="grid gap-8 sm:grid-cols-3">
              <div>
                <div className="flex items-center gap-2">
                  <Image src="/helius-logo.png" alt="Helius" width={20} height={20} className="rounded-full" />
                  <span className="font-display text-sm font-bold">Tx Doctor</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  The fastest way to understand any Solana transaction.
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">Resources</p>
                <ul className="mt-3 space-y-2 text-[13px] text-zinc-400">
                  <li><a href="https://helius.dev" target="_blank" rel="noreferrer" className="transition hover:text-white">Helius</a></li>
                  <li><a href="https://docs.helius.dev" target="_blank" rel="noreferrer" className="transition hover:text-white">Helius Docs</a></li>
                  <li><a href="https://solana.com" target="_blank" rel="noreferrer" className="transition hover:text-white">Solana</a></li>
                  <li><a href="https://solscan.io" target="_blank" rel="noreferrer" className="transition hover:text-white">Solscan</a></li>
                </ul>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">Builder</p>
                <a
                  href="https://x.com/salimteymouri"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-white/25 hover:bg-white/[0.07]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                    <Image src="/x-logo.svg" alt="X" width={14} height={14} />
                  </span>
                  <Image
                    src="/builder.png"
                    alt="Salim Teymouri"
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-orange-500/60"
                  />
                  <span>
                    <span className="block text-[13px] font-semibold text-zinc-100">Salim Teymouri</span>
                    <span className="block font-mono text-[11px] text-zinc-500">@salimteymouri</span>
                  </span>
                </a>
              </div>
            </div>
            <p className="mt-8 border-t border-white/[0.06] pt-5 text-center font-mono text-[11px] text-zinc-600">
              Risk is an estimate from on-chain signals · Built with Helius
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
