import type { NodeTypeName } from "./types";

export type ColorPalette = Record<NodeTypeName, string>;

export const DEFAULT_PALETTE: ColorPalette = {
  FRONTEND: "#60A5FA",
  EDGE: "#A78BFA",
  GATEWAY: "#F59E0B",
  SECURITY: "#F43F5E",
  SERVICE: "#34D399",
  CACHE: "#FB7185",
  STORAGE: "#818CF8",
  TELEMETRY: "#22D3EE",
  CUSTOM: "#E5E7EB",
};

export const NAMED_COLORS: Record<string, string> = {
  red: "#EF4444",
  orange: "#F59E0B",
  amber: "#F59E0B",
  yellow: "#EAB308",
  green: "#22C55E",
  emerald: "#34D399",
  teal: "#14B8A6",
  cyan: "#22D3EE",
  blue: "#3B82F6",
  indigo: "#818CF8",
  purple: "#A78BFA",
  pink: "#FB7185",
  rose: "#F43F5E",
  white: "#F8FAFC",
  gray: "#94A3B8",
  grey: "#94A3B8",
  black: "#111113",
  charcoal: "#1F1F23",
  ink: "#0D0E11",
  slate: "#64748B",
  navy: "#1E3A8A",
  gold: "#EAB308",
  brown: "#B45309",
  lime: "#84CC16",
  magenta: "#E879F9",
  violet: "#8B5CF6",
};

const STORAGE_KEY = "rune.palette";

export function loadPalette(): ColorPalette {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PALETTE };
    return { ...DEFAULT_PALETTE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PALETTE };
  }
}

export function savePalette(palette: ColorPalette) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(palette));
}

export function resolveNamedColor(text: string): string | undefined {
  const t = text.trim().toLowerCase();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(t)) return t;
  return NAMED_COLORS[t];
}

export function colorForType(
  type: string,
  palette: ColorPalette,
  override?: string,
): string {
  if (override) return override;
  if (type in palette) return palette[type as NodeTypeName];
  return palette.CUSTOM;
}

export function withAlpha(hex: string, alpha: number): string {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.slice(0, 6);
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
