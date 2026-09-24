import type { ThemeMode } from "./types";

export const THEME_TOKENS: Record<
  ThemeMode,
  Record<"accent" | "text" | "muted" | "glow", string>
> = {
  DARK_NEON_CYBER: {
    accent: "#10B981",
    text: "#F9FAFB",
    muted: "#A1A1AA",
    glow: "rgba(16, 185, 129, 0.28)",
  },
  SWISS_MINIMAL: {
    accent: "#111827",
    text: "#111827",
    muted: "#6B7280",
    glow: "rgba(0, 0, 0, 0.08)",
  },
  AMBER_ALERT: {
    accent: "#EF4444",
    text: "#FEE2E2",
    muted: "#FCA5A5",
    glow: "rgba(239, 68, 68, 0.35)",
  },
  DEEP_SPACE: {
    accent: "#818CF8",
    text: "#EEF2FF",
    muted: "#A5B4FC",
    glow: "rgba(129, 140, 248, 0.32)",
  },
};

export function applyTheme(theme: ThemeMode) {
  const tokens = THEME_TOKENS[theme];
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.setProperty("--accent", tokens.accent);
  root.style.setProperty("--text", tokens.text);
  root.style.setProperty("--muted", tokens.muted);
  root.style.setProperty("--glow", tokens.glow);
}
