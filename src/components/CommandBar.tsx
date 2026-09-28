import type { FormEvent, RefObject } from "react";

interface CommandBarProps {
  prompt: string;
  compiling: boolean;
  luminous?: boolean;
  onPromptChange: (value: string) => void;
  onCompile: (value?: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function CommandBar({
  prompt,
  compiling,
  luminous,
  onPromptChange,
  onCompile,
  inputRef,
}: CommandBarProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onCompile();
  }

  return (
    <form onSubmit={handleSubmit} className="no-drag">
      <div
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${
          luminous
            ? "command-glass"
            : "border border-white/8 bg-[#14151A] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
        }`}
      >
        <span
          className={`font-mono text-[10px] tracking-tight ${
            luminous ? "text-sky-200/45" : "text-zinc-600"
          }`}
        >
          ⌘⇧J
        </span>
        <input
          ref={inputRef}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder={luminous ? "Describe a system, or search AWS…" : "Search AWS…"}
          autoFocus
          onBlur={() => {
            window.requestAnimationFrame(() => {
              const active = document.activeElement as HTMLElement | null;
              if (active?.closest(".node-inspector")) return;
              if (active instanceof HTMLInputElement && active.type === "color") return;
              inputRef.current?.focus({ preventScroll: true });
            });
          }}
          className={`min-w-0 flex-1 bg-transparent py-1 text-[13px] tracking-tight outline-none ${
            luminous
              ? "text-zinc-50 placeholder:text-sky-100/35"
              : "text-zinc-100 placeholder:text-zinc-600"
          }`}
        />
        {prompt && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPromptChange("")}
            className="font-mono text-[10px] tracking-tight text-zinc-600 hover:text-zinc-300"
          >
            Clear
          </button>
        )}
        <button
          type="submit"
          onMouseDown={(event) => event.preventDefault()}
          disabled={compiling || !prompt.trim()}
          className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-medium tracking-tight text-zinc-950 disabled:opacity-30"
        >
          {compiling ? "…" : "Run"}
        </button>
      </div>
    </form>
  );
}
