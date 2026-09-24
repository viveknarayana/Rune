interface LatencyHudProps {
  jevMs: number;
  dagreMs: number;
  fps: number;
  source: "jev" | "local";
}

export function LatencyHud({ jevMs, dagreMs, fps, source }: LatencyHudProps) {
  return (
    <div className="rounded-full border border-white/10 bg-white/8 px-4 py-2 font-mono text-[11px] text-white/75 backdrop-blur-xl">
      ⚡ Jev Decision: {jevMs.toFixed(0)}ms · Dagre Math: {dagreMs.toFixed(1)}ms ·
      Render FPS: {fps} · {source === "jev" ? "System One" : "Local"}
    </div>
  );
}
