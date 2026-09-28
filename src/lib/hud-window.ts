import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

export type HudMode = "idle" | "search" | "board";

export const HUD_SIZE: Record<HudMode, { width: number; height: number }> = {
  idle: { width: 1280, height: 860 },
  search: { width: 1280, height: 860 },
  board: { width: 1680, height: 980 },
};

function browserSize(mode: HudMode) {
  if (typeof window === "undefined") return HUD_SIZE[mode];
  const workW = window.innerWidth;
  const workH = window.innerHeight;
  if (mode === "board") {
    return {
      width: Math.round(Math.min(workW - 48, Math.max(1200, workW * 0.92))),
      height: Math.round(Math.min(workH - 48, Math.max(820, workH * 0.88))),
    };
  }
  return {
    width: Math.round(Math.min(workW * 0.82, Math.max(1080, workW * 0.74))),
    height: Math.round(Math.min(workH * 0.86, Math.max(760, workH * 0.78))),
  };
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
