import { PATTERNS, type DesignPattern } from "../lib/patterns";

interface PatternStackProps {
  rail?: boolean;
  luminous?: boolean;
  onPick: (pattern: DesignPattern) => void;
}

export function PatternStack({ rail, luminous, onPick }: PatternStackProps) {
  return (
    <div className="no-drag mb-3">
      <p
        className={`mb-1.5 px-0.5 font-mono text-[10px] tracking-[0.18em] uppercase ${
          luminous ? "text-sky-100/40" : "text-zinc-600"
        }`}
      >
        Patterns
      </p>
      <div className={rail ? "grid grid-cols-2 gap-1" : "grid grid-cols-3 gap-1.5"}>
        {PATTERNS.map((pattern) => (
          <button
            key={pattern.id}
            type="button"
            onClick={() => onPick(pattern)}
            className={`rounded-lg px-2 py-1.5 text-left transition-colors ${
              luminous
                ? "pattern-glass hover:border-sky-100/25 hover:bg-white/[0.08]"
                : "border border-white/8 bg-[#0F1015]/80 hover:border-white/16 hover:bg-white/[0.04]"
            }`}
            title={pattern.label}
          >
            <span className="block font-mono text-[10px] tracking-tight text-zinc-200">
              {pattern.short}
            </span>
            <span
              className={`block truncate font-mono text-[9px] tracking-tight ${
                luminous ? "text-sky-100/35" : "text-zinc-600"
              }`}
            >
              {pattern.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
