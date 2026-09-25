import type { FormEvent, RefObject } from "react";

interface CommandBarProps {
  prompt: string;
  compiling: boolean;
  canUndo?: boolean;
  onPromptChange: (value: string) => void;
  onCompile: (value?: string) => void;
  onUndo?: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function CommandBar({
  prompt,
  compiling,
  canUndo,
  onPromptChange,
  onCompile,
  onUndo,
  inputRef,
}: CommandBarProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onCompile();
  }

  return (
    <form onSubmit={handleSubmit} className="no-drag">
      <div className="flex items-center gap-2 rounded-full border border-white/8 bg-[#14151A] px-3 py-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
        <span className="font-mono text-[10px] tracking-tight text-zinc-600">
          ⌘⇧J
        </span>
        <input
          ref={inputRef}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Search or undo…"
          className="min-w-0 flex-1 bg-transparent py-1 text-[13px] tracking-tight text-zinc-100 outline-none placeholder:text-zinc-600"
        />
        {prompt && (
          <button
            type="button"
            onClick={() => onPromptChange("")}
            className="font-mono text-[10px] tracking-tight text-zinc-600 hover:text-zinc-300"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          className="font-mono text-[10px] tracking-tight text-zinc-500 hover:text-zinc-200 disabled:opacity-25"
        >
          Undo
        </button>
        <button
          type="submit"
          disabled={compiling || !prompt.trim()}
          className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-medium tracking-tight text-zinc-950 disabled:opacity-30"
        >
          {compiling ? "…" : "Run"}
        </button>
      </div>
    </form>
  );
}
