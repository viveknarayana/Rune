import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

export type HudMode = "idle" | "search" | "board";

export const HUD_SIZE: Record<HudMode, { width: number; height: number }> = {
  idle: { width: 680, height: 520 },
  search: { width: 680, height: 520 },
  board: { width: 1100, height: 700 },
};

function browserSize(mode: HudMode) {
  if (mode !== "board") return HUD_SIZE.idle;
  return HUD_SIZE.board;
}

export function useHudSize(mode: HudMode) {
  const [size, setSize] = useState(() =>
    typeof window === "undefined" ? HUD_SIZE[mode] : browserSize(mode),
  );

  useEffect(() => {
    const update = () => setSize(browserSize(mode));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mode]);

  return size;
}

export async function resizeHud(mode: HudMode) {
  try {
    await invoke("set_hud_mode", { mode });
  } catch {
    // Browser preview has no native window.
  }
}
