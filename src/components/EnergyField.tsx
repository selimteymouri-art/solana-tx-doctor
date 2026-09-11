// Rising energy field: glowing numbers + light aura drifting bottom → top.
// Slow-motion, behind content (z-0), masked so it never touches text.
const COLS = [
  { left: "8%", dur: "24s", delay: "0s", nums: ["44621", "0x1771", "88103", "6002", "12904", "2rbe"], color: "text-orange-300/70" },
  { left: "26%", dur: "19s", delay: "-7s", nums: ["0.000005", "SLIP", "77310", "5Xh7", "44021"], color: "text-amber-200/60" },
  { left: "68%", dur: "22s", delay: "-12s", nums: ["9be2", "INSUF", "55017", "8kdP", "0x01"], color: "text-emerald-200/60" },
  { left: "86%", dur: "26s", delay: "-4s", nums: ["31088", "SEED", "0x2a", "72014", "c0de"], color: "text-orange-200/60" },
];

export default function EnergyField() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 top-24 z-0 select-none overflow-hidden [mask-image:linear-gradient(to_top,black_55%,transparent_95%)]"
    >
      {/* central light aura */}
      <div className="animate-aura absolute bottom-0 left-1/2 h-[130%] w-56 -translate-x-1/2 bg-gradient-to-t from-orange-600/25 via-orange-500/10 to-transparent blur-2xl" />
      <div className="animate-aura absolute bottom-0 left-1/2 h-[110%] w-24 -translate-x-1/2 bg-gradient-to-t from-amber-300/20 to-transparent blur-xl" style={{ animationDelay: "-3s" }} />

      {/* rising number columns with mini chart ticks */}
      {COLS.map((c, i) => (
        <div key={i} className="absolute bottom-0 top-0 w-16 overflow-hidden" style={{ left: c.left }}>
          <div className="animate-rise-slow" style={{ animationDuration: c.dur, animationDelay: c.delay }}>
            {[...c.nums, ...c.nums, ...c.nums].map((n, j) => (
              <div key={j} className="flex h-16 flex-col items-center justify-center gap-1">
                <span className={`glow-num font-mono text-[11px] ${c.color}`}>{n}</span>
                <span
                  className="block w-6 rounded-sm bg-gradient-to-t from-orange-500/50 to-amber-300/70"
                  style={{ height: `${4 + ((i * 7 + j * 13) % 14)}px` }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* rising glow orbs */}
      {[["12%", "20s", "0s"], ["80%", "24s", "-9s"], ["45%", "28s", "-15s"]].map(([left, dur, delay], i) => (
        <div key={i} className="absolute bottom-0 top-0 overflow-hidden" style={{ left }}>
          <div className="animate-rise-slow" style={{ animationDuration: dur, animationDelay: delay }}>
            {[0, 1, 2].map((k) => (
              <div key={k} className="flex h-44 items-center justify-center">
                <span className="block h-2 w-2 rounded-full bg-orange-300/70 blur-[3px]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
