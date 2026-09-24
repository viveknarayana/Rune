import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommandBar } from "./components/CommandBar";
import { GlassCanvas } from "./components/GlassCanvas";
import { LatencyHud } from "./components/LatencyHud";
import { computeGraphLayout } from "./lib/layout-engine";
import { applyTheme } from "./lib/themes";
import type { CanvasState, CompilerResult } from "./lib/types";
import {
  compileLocal,
  evaluateJevSystemDesign,
} from "./services/jev-service";

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [compiling, setCompiling] = useState(false);
  const [decision, setDecision] = useState<CompilerResult | null>(null);
  const [fps, setFps] = useState(120);

  const layout = useMemo(
    () =>
      decision
        ? computeGraphLayout(decision.nodes, decision.edges)
        : { positionedNodes: [], edges: [], layoutMs: 0 },
    [decision],
  );

  useEffect(() => {
    if (decision) applyTheme(decision.theme_mode);
  }, [decision]);

  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      frames += 1;
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const compile = useCallback(
    async (nextPrompt?: string) => {
      const value = (nextPrompt ?? prompt).trim();
      if (!value) return;

      const currentState: CanvasState | undefined = decision
        ? { nodes: decision.nodes, edges: decision.edges }
        : undefined;
      setDecision(compileLocal(value, currentState));
      setCompiling(true);

      try {
        const payload = await evaluateJevSystemDesign(value, currentState);
        setDecision(payload);
      } finally {
        setCompiling(false);
      }
    },
    [prompt, decision],
  );

  useEffect(() => {
    const onKey = async (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        try {
          await getCurrentWindow().hide();
        } catch {
          // Browser preview has no Tauri window.
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="hud-shell flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/15 bg-white/8 px-4 pt-3 pb-3 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
      <div id="titlebar" className="mb-2 h-2" />
      <CommandBar
        prompt={prompt}
        compiling={compiling}
        onPromptChange={setPrompt}
        onCompile={compile}
        inputRef={inputRef}
      />

      <div className="mt-4 flex-1">
        {decision ? (
          <GlassCanvas
            nodes={layout.positionedNodes}
            edges={layout.edges}
            isAnomaly={decision.is_anomaly}
            stiffness={decision.stiffness}
          />
        ) : (
          <div className="flex h-[280px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm text-white/55 backdrop-blur-xl">
            Lean graph first. Then: “add a CDN before the API gateway” or “remove the CDN”.
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <LatencyHud
          jevMs={decision?.execution_time_ms ?? 0}
          dagreMs={layout.layoutMs}
          fps={fps}
          source={decision?.source ?? "local"}
        />
      </div>
    </div>
  );
}
