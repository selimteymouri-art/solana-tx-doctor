// Cyberpunk decor: matrix rain + HUD accents in gutters only.
// Never overlaps text. Content column (z-10) always paints above (z-0).
const GLYPHS = "01<>[]#$%&*+=/\\|XYZ#01";

function MatrixRain() {
  const cols = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden opacity-[0.16]">
      {cols.map((c) => (
        <div
          key={c}
          className="animate-matrix absolute top-0 flex h-[200%] w-8 flex-col items-center gap-1 font-mono text-[10px] leading-none text-[#00ff9d]"
          style={{ left: `${c * 7.5}%`, animationDelay: `${-(c * 1.7)}s`, animationDuration: `${11 + (c % 5) * 2.4}s` }}
        >
          {Array.from({ length: 28 }, (_, r) => (
            <span key={r} style={{ opacity: r % 7 === 0 ? 1 : 0.45 }}>
              {GLYPHS[(c * 13 + r * 7) % GLYPHS.length]}
            </span>
          ))}
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#070708]" />
    </div>
  );
}

function HudCard({ label, children, delay = "0.5s" }: { label: string; children: React.ReactNode; delay?: string }) {
  return (
    <div
      className="reveal animate-floaty-slow hud-corner rounded-lg border border-[#00ff9d]/20 bg-[#0b0f14]/80 p-3.5 shadow-2xl shadow-black/60 backdrop-blur-md"
      style={{ ["--d" as string]: delay, ["--tilt" as string]: "0deg" }}
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#00ff9d]/70">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function Floaties() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 hidden select-none xl:block">
      {/* LEFT gutter */}
      <div className="absolute -left-64 top-28 w-52 space-y-5">
        <HudCard label="// target_locked" delay="0.5s">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#00ff9d] shadow-sm shadow-[#00ff9d]/70" />
            <span className="font-mono text-xs text-zinc-200">5Xh7…8kdP</span>
            <span className="ml-auto rounded-sm border border-[#00ff9d]/40 bg-[#00ff9d]/10 px-2 py-0.5 font-mono text-[10px] text-[#00ff9d]">TRACE</span>
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-zinc-500">creator · 12.4 SOL</p>
        </HudCard>
        <div className="flex justify-center pt-2">
          <div className="flex h-10 w-10 rotate-45 items-center justify-center border border-[#ff2ea6]/60 bg-[#ff2ea6]/10 shadow-[0_0_24px_rgb(255_46_166/0.35)]">
            <span className="-rotate-45 font-mono text-sm font-bold text-[#ff2ea6]">X</span>
          </div>
        </div>
      </div>

      {/* RIGHT gutter */}
      <div className="absolute -right-64 top-24 w-52 space-y-5">
        <HudCard label="// sanity_index" delay="0.65s">
          <div className="flex items-baseline justify-between">
            <span className="font-display glow-num text-2xl font-bold text-[#00ff9d]">6<span className="text-xs font-medium text-zinc-500"> / 10</span></span>
            <span className="rounded-sm border border-[#ff2ea6]/40 bg-[#ff2ea6]/10 px-2 py-0.5 font-mono text-[10px] text-[#ff2ea6]">DEGEN</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[60%] rounded-full bg-gradient-to-r from-[#00ff9d] to-[#38e1ff]" />
          </div>
          <p className="mt-2 font-mono text-[10px] text-zinc-500">[!] 1 insider link found</p>
        </HudCard>
        <div className="reveal rounded-lg border border-[#00ff9d]/20 bg-[#0b0f14]/80 p-3.5 shadow-2xl shadow-black/60 backdrop-blur-md" style={{ ["--d" as string]: "0.8s" }}>
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#00ff9d]/70">liq · live</p>
          <div className="mt-2 flex h-12 items-end gap-1.5">
            {[40, 70, 32, 88, 55, 96, 48, 76].map((h, i) => (
              <div
                key={i}
                className="animate-bar w-full rounded-t bg-gradient-to-t from-[#00ff9d]/70 to-[#38e1ff]/90"
                style={{ height: `${h}%`, animationDelay: `${i * 0.3}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export { MatrixRain };
