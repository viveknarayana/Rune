import type { FormEvent, RefObject } from "react";

const PRESETS = [
  "SaaS API with auth and a database",
  "Add IAM component, and connect to identity. Square IAM and Identity",
  'Add "Route 53" then connect to the API gateway',
  "Group app and database as VPC",
];

interface CommandBarProps {
  prompt: string;
  compiling: boolean;
  steps?: string[];
  showPresets?: boolean;
  onPromptChange: (value: string) => void;
  onCompile: (value?: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function CommandBar({
  prompt,
  compiling,
  steps,
  showPresets = true,
  onPromptChange,
  onCompile,
  inputRef,
}: CommandBarProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onCompile();
  }

  return (
    <div className="no-drag rounded-2xl border border-white/12 bg-black/25 p-3 backdrop-blur-xl">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="hidden items-center gap-1 rounded-lg border border-white/10 px-2 py-1 font-mono text-[10px] text-white/55 sm:flex">
          <kbd>⌘</kbd>
          <kbd>⇧</kbd>
          <kbd>J</kbd>
        </div>
        <input
          ref={inputRef}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Type lambda, s3, iam… cards lift from the stack"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/35"
        />
        <button
          type="submit"
          disabled={compiling || !prompt.trim()}
          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-zinc-900 disabled:opacity-40"
        >
          {compiling ? "Running…" : "Run"}
        </button>
      </form>
      {showPresets && (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => {
              onPromptChange(preset);
              onCompile(preset);
            }}
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/75 hover:border-white/30 hover:text-white"
          >
            {preset}
          </button>
        ))}
      </div>
      )}
      {steps && steps.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {steps.map((step, index) => (
            <span
              key={`${step}-${index}`}
              className="rounded-full bg-white/8 px-2 py-0.5 font-mono text-[10px] text-white/65"
            >
              {index + 1}. {step}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
