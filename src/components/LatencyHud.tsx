interface LatencyHudProps {
  jevMs: number;
  dagreMs: number;
  fps: number;
  source: "jev" | "local";
}

export function LatencyHud({ jevMs, dagreMs, fps, source }: LatencyHudProps) {
  return (
    <div className="font-mono text-[11px] tracking-tight text-zinc-500">
      <span className="text-emerald-400">{jevMs.toFixed(0)}ms</span>
      <span className="text-zinc-600"> · </span>
      <span>dagre {dagreMs.toFixed(1)}ms</span>
      <span className="text-zinc-600"> · </span>
      <span>{fps}fps</span>
      <span className="text-zinc-600"> · </span>
      <span className="uppercase">{source}</span>
    </div>
  );
}
