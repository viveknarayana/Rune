import type { FormEvent, RefObject } from "react";

const PRESETS = [
  "SaaS API with auth and a database",
  "Add a CDN before the API gateway",
  "Remove the CDN",
  "Add Redis before the database",
];

interface CommandBarProps {
  prompt: string;
  compiling: boolean;
  onPromptChange: (value: string) => void;
  onCompile: (value?: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function CommandBar({
  prompt,
  compiling,
  onPromptChange,
  onCompile,
  inputRef,
}: CommandBarProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onCompile();
  }

  return (
    <div className="no-drag rounded-2xl border border-white/12 bg-white/8 p-3 backdrop-blur-xl">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="hidden items-center gap-1 rounded-lg border border-white/10 px-2 py-1 font-mono text-[10px] text-white/60 sm:flex">
          <kbd>⌘</kbd>
          <kbd>⇧</kbd>
          <kbd>J</kbd>
        </div>
        <input
          ref={inputRef}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Generate a system, or mutate the current graph…"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
        />
        <button
          type="submit"
          disabled={compiling || !prompt.trim()}
          className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-semibold text-black disabled:opacity-40"
        >
          {compiling ? "Compiling…" : "Compile"}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => {
              onPromptChange(preset);
              onCompile(preset);
            }}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/80 hover:border-emerald-400/60"
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}
