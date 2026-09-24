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
    <div className="no-drag flex items-center gap-2 overflow-x-auto px-0.5">
      {NODE_TYPES.filter((type) => type !== "CUSTOM").map((type) => (
        <label
          key={type}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2 py-1"
          title={`Default ${type} color`}
        >
          <input
            type="color"
            value={palette[type]}
            onChange={(event) => onPaletteChange(type, event.target.value)}
            className="h-3.5 w-3.5 cursor-pointer border-0 bg-transparent p-0"
          />
          <span className="font-mono text-[9px] text-white/55">{type}</span>
        </label>
      ))}
      {selectedLabel && onSelectedColor && (
        <label className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2 py-1">
          <input
            type="color"
            value={selectedColor ?? DEFAULT_PALETTE.CUSTOM}
            onChange={(event) => onSelectedColor(event.target.value)}
            className="h-3.5 w-3.5 cursor-pointer border-0 bg-transparent p-0"
          />
          <span className="max-w-[110px] truncate font-mono text-[9px] text-white">
            {selectedLabel}
          </span>
        </label>
      )}
      <button
        type="button"
        onClick={onReset}
        className="shrink-0 text-[10px] text-white/35 hover:text-white/70"
      >
        Reset
      </button>
    </div>
  );
}
