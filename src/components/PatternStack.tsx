import { PATTERNS, type DesignPattern } from "../lib/patterns";

interface PatternStackProps {
  rail?: boolean;
  luminous?: boolean;
  onPick: (pattern: DesignPattern) => void;
}

export function PatternStack({ rail, luminous, onPick }: PatternStackProps) {
  return (
    <div className={`no-drag w-full ${rail ? "mb-3" : "mb-4"}`}>
      <p
        className={`mb-2 px-0.5 font-mono tracking-[0.18em] uppercase ${
          rail ? "text-[10px]" : "text-[11px]"
        } ${luminous ? "text-sky-100/40" : "text-zinc-600"}`}
      >
        Patterns
      </p>
      <div className={rail ? "grid w-full grid-cols-2 gap-1.5" : "grid w-full grid-cols-3 gap-2.5"}>
        {PATTERNS.map((pattern) => (
          <button
            key={pattern.id}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(pattern)}
            className={`text-left transition-colors ${
              rail
                ? "rounded-lg px-2 py-2"
                : "min-h-[72px] rounded-xl px-3.5 py-3"
            } ${
              luminous
                ? "pattern-glass hover:border-sky-100/25 hover:bg-white/[0.08]"
                : "border border-white/8 bg-[#0F1015]/80 hover:border-white/16 hover:bg-white/[0.04]"
            }`}
            title={pattern.label}
          >
            <span
              className={`block font-mono tracking-tight text-zinc-100 ${
                rail ? "text-[10px]" : "text-[13px]"
              }`}
            >
              {pattern.short}
            </span>
            <span
              className={`mt-0.5 block font-mono tracking-tight ${
                rail ? "truncate text-[9px]" : "text-[11px] leading-snug"
              } ${luminous ? "text-sky-100/45" : "text-zinc-600"}`}
            >
              {pattern.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
