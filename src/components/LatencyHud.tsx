interface LatencyHudProps {
  jevMs: number;
  dagreMs: number;
  fps: number;
  source: "jev" | "local";
}

export function LatencyHud({ jevMs, dagreMs, fps, source }: LatencyHudProps) {
  return (
    <div className="font-mono text-[10px] text-white/40">
      {jevMs.toFixed(0)}ms · dagre {dagreMs.toFixed(1)}ms · {fps}fps · {source}
    </div>
  );
}
