const SWATCHES = ["#111113", "#F59E0B", "#34D399", "#60A5FA", "#A78BFA", "#F43F5E", "#E5E7EB"];

export type NodeMenuAction =
  | { type: "remove" }
  | { type: "outage" }
  | { type: "link" }
  | { type: "color"; color: string };

interface NodeMenuProps {
  linking?: boolean;
  isOutage?: boolean;
  onAction: (action: NodeMenuAction) => void;
}

export function NodeMenu({ linking, isOutage, onAction }: NodeMenuProps) {
  return (
    <div
      className="no-drag absolute left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-white/10 bg-[#0F1015]/95 px-1.5 py-1 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
      style={{ top: "100%", marginTop: 6 }}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.preventDefault();
      }}
    >
      <button
        type="button"
        onClick={() => onAction({ type: "remove" })}
        className="rounded-md px-2 py-0.5 font-mono text-[10px] tracking-tight text-zinc-400 hover:bg-red-500/15 hover:text-red-300"
      >
        Remove
      </button>
      <button
        type="button"
        onClick={() => onAction({ type: "outage" })}
        className="rounded-md px-2 py-0.5 font-mono text-[10px] tracking-tight text-zinc-400 hover:bg-white/8 hover:text-zinc-100"
      >
        {isOutage ? "Recover" : "Outage"}
      </button>
      <button
        type="button"
        onClick={() => onAction({ type: "link" })}
        className={`rounded-md px-2 py-0.5 font-mono text-[10px] tracking-tight ${
          linking
            ? "bg-emerald-400/15 text-emerald-300"
            : "text-zinc-400 hover:bg-white/8 hover:text-zinc-100"
        }`}
      >
        {linking ? "Pick target" : "Link"}
      </button>
      <span className="mx-0.5 h-3 w-px bg-white/10" />
      {SWATCHES.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Color ${color}`}
          onClick={() => onAction({ type: "color", color })}
          className="h-2.5 w-2.5 rounded-full border border-white/20"
          style={{ background: color }}
        />
      ))}
    </div>
  );
}
