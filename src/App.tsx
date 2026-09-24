import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ColorStudio } from "./components/ColorStudio";
import { CommandBar } from "./components/CommandBar";
import { GlassCanvas } from "./components/GlassCanvas";
import { LatencyHud } from "./components/LatencyHud";
import { ServiceStack } from "./components/ServiceStack";
import {
  searchAwsServices,
  type AwsService,
} from "./lib/aws-catalog";
import { rankAwsWithJev } from "./services/jev-search";
import {
  DEFAULT_PALETTE,
  loadPalette,
  savePalette,
  type ColorPalette,
} from "./lib/colors";
import { computeGraphLayout, persistNodePositions } from "./lib/layout-engine";
import { applyTheme } from "./lib/themes";
import type { CanvasState, CompilerResult, NodeTypeName } from "./lib/types";
import {
  compileLocal,
  evaluateJevSystemDesign,
} from "./services/jev-service";

function lockPositions(
  result: CompilerResult,
  previous?: CompilerResult | null,
): CompilerResult {
  const keep =
    result.action === "MUTATE_GRAPH" || result.action === "SIMULATE_OUTAGE";
  const nodes = result.nodes.map((node) => {
    if (!keep) {
      const { x: _x, y: _y, ...rest } = node;
      return rest;
    }
    const old = previous?.nodes.find((item) => item.id === node.id);
    if (old?.x != null && old.y != null) {
      return { ...node, x: old.x, y: old.y };
    }
    const { x: _nx, y: _ny, ...rest } = node;
    return rest;
  });
  return {
    ...result,
    nodes: persistNodePositions(nodes, result.edges),
  };
}

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [compiling, setCompiling] = useState(false);
  const [decision, setDecision] = useState<CompilerResult | null>(null);
  const [fps, setFps] = useState(120);
  const [palette, setPalette] = useState<ColorPalette>(DEFAULT_PALETTE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stack, setStack] = useState<AwsService[]>(() => searchAwsServices(""));
  const [jevBoosted, setJevBoosted] = useState(false);

  useEffect(() => {
    setPalette(loadPalette());
  }, []);

  const layout = useMemo(
    () =>
      decision
        ? computeGraphLayout(decision.nodes, decision.edges)
        : { positionedNodes: [], edges: [], layoutMs: 0 },
    [decision],
  );

  const hasBoard = Boolean(decision?.nodes.length);
  const selected = decision?.nodes.find((n) => n.id === selectedId);

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

  useEffect(() => {
    const query = prompt.trim();
    const local = searchAwsServices(query);
    setStack(local);
    setJevBoosted(false);
    if (!query) return;

    const handle = window.setTimeout(() => {
      void rankAwsWithJev(query, local.slice(0, 8)).then((winner) => {
        if (!winner) return;
        setStack((current) => {
          const hit = current.find((s) => s.id === winner);
          if (!hit) return current;
          return [hit, ...current.filter((s) => s.id !== winner)];
        });
        setJevBoosted(true);
      });
    }, 220);
    return () => window.clearTimeout(handle);
  }, [prompt]);

  const moveNode = useCallback((id: string, x: number, y: number) => {
    setDecision((prev) =>
      prev
        ? {
            ...prev,
            nodes: prev.nodes.map((node) =>
              node.id === id ? { ...node, x, y } : node,
            ),
          }
        : prev,
    );
  }, []);

  const compile = useCallback(
    async (nextPrompt?: string) => {
      const value = (nextPrompt ?? prompt).trim();
      if (!value) return;

      const currentState: CanvasState | undefined = decision
        ? {
            nodes: decision.nodes,
            edges: decision.edges,
            groups: decision.groups ?? [],
          }
        : undefined;
      setDecision((prev) => lockPositions(compileLocal(value, currentState), prev));
      setCompiling(true);

      try {
        const payload = await evaluateJevSystemDesign(value, currentState);
        setDecision((prev) =>
          lockPositions({ ...payload, groups: payload.groups ?? [] }, prev),
        );
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

  function updatePalette(type: NodeTypeName, color: string) {
    const next = { ...palette, [type]: color };
    setPalette(next);
    savePalette(next);
  }

  return (
    <div className="hud-shell flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/12 bg-zinc-950/35 px-4 pt-3 pb-3 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
      <div id="titlebar" className="mb-1 flex items-center justify-between">
        <p className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">
          Rune
        </p>
        <LatencyHud
          jevMs={decision?.execution_time_ms ?? 0}
          dagreMs={layout.layoutMs}
          fps={fps}
          source={decision?.source ?? "local"}
        />
      </div>
      <CommandBar
        prompt={prompt}
        compiling={compiling}
        steps={hasBoard ? decision?.steps : undefined}
        showPresets={hasBoard}
        onPromptChange={setPrompt}
        onCompile={compile}
        inputRef={inputRef}
      />

      <div className={`mt-2 ${hasBoard ? "" : "min-h-0 flex-1"}`}>
        <ServiceStack
          services={stack}
          query={prompt}
          jevBoosted={jevBoosted}
          expanded={!hasBoard}
          onPick={(service) => {
            setPrompt(`Add ${service.label}`);
            void compile(`Add ${service.label}`);
          }}
        />
      </div>

      {hasBoard && (
      <div className="mt-2">
      <ColorStudio
        palette={palette}
        selectedLabel={selected?.label}
        selectedColor={selected?.color}
        onPaletteChange={updatePalette}
        onSelectedColor={(color) => {
          if (!decision || !selectedId) return;
          setDecision({
            ...decision,
            nodes: decision.nodes.map((n) =>
              n.id === selectedId ? { ...n, color } : n,
            ),
          });
        }}
        onReset={() => {
          setPalette(DEFAULT_PALETTE);
          savePalette(DEFAULT_PALETTE);
        }}
      />
      </div>
      )}

      {hasBoard && decision && (
      <div className="mt-3 min-h-0 flex-1">
          <GlassCanvas
            nodes={layout.positionedNodes}
            edges={layout.edges}
            groups={decision.groups ?? []}
            isAnomaly={decision.is_anomaly}
            stiffness={decision.stiffness}
            palette={palette}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onNodeMove={moveNode}
          />
      </div>
      )}
    </div>
  );
}
