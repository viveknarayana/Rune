const SWATCHES = [
  "#111113",
  "#F59E0B",
  "#34D399",
  "#60A5FA",
  "#A78BFA",
  "#F43F5E",
  "#E5E7EB",
];

export type NodeMenuAction =
  | { type: "remove" }
  | { type: "outage" }
  | { type: "link" }
  | { type: "color"; color: string }
  | { type: "disconnect"; source: string; target: string };

export interface NodeLink {
  source: string;
  target: string;
  label: string;
  dir: "in" | "out";
}

interface NodeMenuProps {
  name: string;
  kind: string;
  linking?: boolean;
  isOutage?: boolean;
  links: NodeLink[];
  onAction: (action: NodeMenuAction) => void;
}

function IconX() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M3 3l6 6M9 3L3 9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NodeMenu({
  name,
  kind,
  linking,
  isOutage,
  links,
  onAction,
}: NodeMenuProps) {
  return (
    <div
      className="node-inspector no-drag"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
    >
      <div className="mb-2.5 min-w-0">
        <p className="truncate text-[13px] font-medium tracking-tight text-zinc-50">
          {name}
        </p>
        <p className="mt-0.5 font-mono text-[9px] tracking-[0.16em] text-sky-100/40 uppercase">
          {kind}
        </p>
      </div>

      <div className="mb-2.5 grid grid-cols-3 gap-1">
        <button
          type="button"
          onClick={() => onAction({ type: "remove" })}
          className="rounded-lg bg-white/[0.04] px-2 py-1.5 font-mono text-[10px] tracking-tight text-zinc-400 hover:bg-red-500/15 hover:text-red-300"
        >
          Remove
        </button>
        <button
          type="button"
          onClick={() => onAction({ type: "outage" })}
          className="rounded-lg bg-white/[0.04] px-2 py-1.5 font-mono text-[10px] tracking-tight text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
        >
          {isOutage ? "Recover" : "Outage"}
        </button>
        <button
          type="button"
          onClick={() => onAction({ type: "link" })}
          className={`rounded-lg px-2 py-1.5 font-mono text-[10px] tracking-tight ${
            linking
              ? "bg-emerald-400/18 text-emerald-300"
              : "bg-white/[0.04] text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
          }`}
        >
          {linking ? "Click node" : "Link"}
        </button>
      </div>

      {links.length > 0 && (
        <div className="mb-2.5">
          <p className="mb-1 font-mono text-[9px] tracking-[0.16em] text-sky-100/35 uppercase">
            Links
          </p>
          <div className="max-h-28 space-y-0.5 overflow-y-auto">
            {links.map((link) => (
              <div
                key={`${link.source}-${link.target}-${link.dir}`}
                className="flex items-center gap-1.5 rounded-lg px-1 py-0.5 hover:bg-white/[0.05]"
              >
                <span className="w-3 shrink-0 text-center font-mono text-[9px] text-zinc-600">
                  {link.dir === "out" ? "→" : "←"}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] tracking-tight text-zinc-300">
                  {link.label}
                </span>
                <button
                  type="button"
                  aria-label={`Unlink ${link.label}`}
                  onClick={() =>
                    onAction({
                      type: "disconnect",
                      source: link.source,
                      target: link.target,
                    })
                  }
                  className="flex h-5 w-5 items-center justify-center rounded-md text-zinc-500 hover:bg-red-500/15 hover:text-red-300"
                >
                  <IconX />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Color ${color}`}
            onClick={() => onAction({ type: "color", color })}
            className="h-3.5 w-3.5 rounded-full border border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  );
}
