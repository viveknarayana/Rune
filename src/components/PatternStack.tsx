import { PATTERNS, type DesignPattern } from "../lib/patterns";

interface PatternStackProps {
  rail?: boolean;
  onPick: (pattern: DesignPattern) => void;
}

export function PatternStack({ rail, onPick }: PatternStackProps) {
  return (
    <div className="no-drag mb-3">
      <p className="mb-1.5 px-0.5 font-mono text-[10px] tracking-[0.18em] text-zinc-600 uppercase">
        Patterns
      </p>
      <div className={rail ? "grid grid-cols-2 gap-1" : "grid grid-cols-3 gap-1.5"}>
        {PATTERNS.map((pattern) => (
          <button
            key={pattern.id}
            type="button"
            onClick={() => onPick(pattern)}
            className="rounded-lg border border-white/8 bg-[#0F1015]/80 px-2 py-1.5 text-left hover:border-white/16 hover:bg-white/[0.04]"
            title={pattern.label}
          >
            <span className="block font-mono text-[10px] tracking-tight text-zinc-200">
              {pattern.short}
            </span>
            <span className="block truncate font-mono text-[9px] tracking-tight text-zinc-600">
              {pattern.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
