// Helius-style restrained decor: warm glow + tiny 3D accents in gutters only.
// Never overlaps text. Content column (z-10) always paints above (z-0).
function SharpCube({ size = 40 }: { size?: number }) {
  const t = size / 2;
  const faces = [
    { tr: `rotateY(0deg) translateZ(${t}px)`, bg: "linear-gradient(135deg, rgb(255 140 60 / 0.8), rgb(255 90 0 / 0.65))" },
    { tr: `rotateY(90deg) translateZ(${t}px)`, bg: "linear-gradient(135deg, rgb(230 110 30 / 0.65), rgb(200 70 0 / 0.55))" },
    { tr: `rotateY(180deg) translateZ(${t}px)`, bg: "linear-gradient(135deg, rgb(200 95 25 / 0.55), rgb(170 60 0 / 0.45))" },
    { tr: `rotateY(-90deg) translateZ(${t}px)`, bg: "linear-gradient(135deg, rgb(230 110 30 / 0.65), rgb(200 70 0 / 0.55))" },
    { tr: `rotateX(90deg) translateZ(${t}px)`, bg: "linear-gradient(135deg, rgb(255 180 110 / 0.85), rgb(255 140 60 / 0.7))" },
    { tr: `rotateX(-90deg) translateZ(${t}px)`, bg: "linear-gradient(135deg, rgb(150 70 15 / 0.6), rgb(120 50 0 / 0.5))" },
  ];
  return (
    <div className="persp">
      <div className="cube3d cube3d-sharp" style={{ width: size, height: size, filter: "drop-shadow(0 12px 18px rgb(255 106 0 / 0.35))" }}>
        {faces.map((f, i) => (
          <div
            key={i}
            style={{ transform: f.tr, background: f.bg, border: "1.5px solid rgb(255 255 255 / 0.5)", borderRadius: 9 }}
          >
            {i === 0 && (
              <span className="flex h-full w-full items-center justify-center text-sm font-black text-white/90">✓</span>
            )}
          </div>
        ))}
      </div>
      <div className="animate-shadow mx-auto mt-4 h-2.5 w-10 rounded-full bg-orange-500/40 blur-md" />
    </div>
  );
}

function GlassCard({ label, children, delay = "0.5s" }: { label: string; children: React.ReactNode; delay?: string }) {
  return (
    <div
      className="reveal animate-floaty-slow rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 shadow-2xl shadow-black/50 backdrop-blur-md"
      style={{ ["--d" as string]: delay, ["--tilt" as string]: "0deg" }}
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function Floaties() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 hidden select-none xl:block">
      {/* LEFT gutter */}
      <div className="absolute -left-64 top-28 w-52 space-y-5">
        <GlassCard label="Latest check" delay="0.5s">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/70" />
            <span className="font-mono text-xs text-zinc-200">5Xh7…8kdP</span>
            <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-300">success</span>
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-zinc-500">Jupiter · 0.000005 SOL</p>
        </GlassCard>
        <div className="flex justify-center pt-2">
          <SharpCube size={40} />
        </div>
      </div>

      {/* RIGHT gutter */}
      <div className="absolute -right-64 top-24 w-52 space-y-5">
        <GlassCard label="Risk report" delay="0.65s">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-2xl font-bold text-emerald-300">3<span className="text-xs font-medium text-zinc-500"> / 10</span></span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-300">LOW</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[30%] rounded-full bg-gradient-to-r from-emerald-400 to-teal-300" />
          </div>
          <p className="mt-2 font-mono text-[10px] text-zinc-500">✓ Known program</p>
        </GlassCard>
        <div className="reveal rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 shadow-2xl shadow-black/50 backdrop-blur-md" style={{ ["--d" as string]: "0.8s" }}>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500">slots · live</p>
          <div className="mt-2 flex h-12 items-end gap-1.5">
            {[40, 70, 32, 88, 55, 96, 48, 76].map((h, i) => (
              <div
                key={i}
                className="animate-bar w-full rounded-t bg-gradient-to-t from-orange-600/80 to-amber-300/90"
                style={{ height: `${h}%`, animationDelay: `${i * 0.3}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
