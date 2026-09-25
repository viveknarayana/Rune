import { DEFAULT_PALETTE, type ColorPalette } from "../lib/colors";
import { NODE_TYPES, type NodeTypeName } from "../lib/types";

interface ColorStudioProps {
  palette: ColorPalette;
  selectedLabel?: string;
  selectedColor?: string;
  onPaletteChange: (type: NodeTypeName, color: string) => void;
  onSelectedColor?: (color: string) => void;
  onReset: () => void;
}

export function ColorStudio({
  palette,
  selectedLabel,
  selectedColor,
  onPaletteChange,
  onSelectedColor,
  onReset,
}: ColorStudioProps) {
  return (
    <div className="no-drag flex flex-wrap items-center gap-1.5 overflow-hidden px-0.5">
      {NODE_TYPES.filter((type) => type !== "CUSTOM").map((type) => (
        <label
          key={type}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/8 bg-[#0F1015]/90 px-2 py-1 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
          title={`Default ${type} color`}
        >
          <input
            type="color"
            value={palette[type]}
            onChange={(event) => onPaletteChange(type, event.target.value)}
            className="h-3 w-3 cursor-pointer border-0 bg-transparent p-0"
          />
          <span className="font-mono text-[9px] tracking-tight text-zinc-500">
            {type}
          </span>
        </label>
      ))}
      {selectedLabel && onSelectedColor && (
        <label className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/20 bg-white/[0.06] px-2 py-1">
          <input
            type="color"
            value={selectedColor ?? DEFAULT_PALETTE.CUSTOM}
            onChange={(event) => onSelectedColor(event.target.value)}
            className="h-3 w-3 cursor-pointer border-0 bg-transparent p-0"
          />
          <span className="max-w-[110px] truncate font-mono text-[9px] tracking-tight text-zinc-200">
            {selectedLabel}
          </span>
        </label>
      )}
      <button
        type="button"
        onClick={onReset}
        className="shrink-0 font-mono text-[10px] tracking-tight text-zinc-600 hover:text-zinc-300"
      >
        Reset
      </button>
    </div>
  );
}
