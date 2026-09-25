import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ColorStudio } from "./components/ColorStudio";
import { CommandBar } from "./components/CommandBar";
import { GlassCanvas } from "./components/GlassCanvas";
import { LatencyHud } from "./components/LatencyHud";
import { PatternStack } from "./components/PatternStack";
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
import { resizeHud, useHudSize } from "./lib/hud-window";
import { isExplicitRebuild } from "./lib/graph-actions";
import {
  cloneResult,
  graphSignature,
  isClearCommand,
  isRedoCommand,
  isUndoCommand,
} from "./lib/graph-history";
import { computeGraphLayout, keepOrRelayout } from "./lib/layout-engine";
import { parsePromptSteps } from "./lib/mutations";
import { applyTheme } from "./lib/themes";
import type { CanvasState, CompilerResult, NodeTypeName } from "./lib/types";
import { applyMutation } from "./lib/mutations";
import {
  compileLocal,
  evaluateJevSystemDesign,
} from "./services/jev-service";
import type { NodeMenuAction } from "./components/NodeMenu";

function lockPositions(
  result: CompilerResult,
  previous?: CompilerResult | null,
): CompilerResult {
  return {
    ...result,
    nodes: keepOrRelayout(
      result.nodes,
      result.edges,
      previous?.nodes,
      result.groups,
      previous?.edges,
      previous?.groups,
    ),
  };
}

function adoptResult(
  next: CompilerResult,
  previous: CompilerResult | null | undefined,
  prompt: string,
): CompilerResult {
  if (!previous?.nodes.length) return lockPositions(next, previous);
  if (isExplicitRebuild(prompt)) return lockPositions(next, null);

  const prevIds = new Set(previous.nodes.map((node) => node.id));
  const kept = next.nodes.filter((node) => prevIds.has(node.id)).length;
  const lost = previous.nodes.length - kept;
  const removes = parsePromptSteps(prompt).filter((step) => step.kind === "remove").length;
  if (lost > removes && lost >= Math.max(2, Math.ceil(previous.nodes.length / 2))) {
    return previous;
  }

  return lockPositions(next, previous);
}

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [compiling, setCompiling] = useState(false);
  const [decision, setDecision] = useState<CompilerResult | null>(null);
  const [fps, setFps] = useState(120);
  const [palette, setPalette] = useState<ColorPalette>(DEFAULT_PALETTE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [stack, setStack] = useState<AwsService[]>(() => searchAwsServices(""));
  const [jevBoosted, setJevBoosted] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const decisionRef = useRef<CompilerResult | null>(null);
  const pastRef = useRef<(CompilerResult | null)[]>([]);
  const futureRef = useRef<(CompilerResult | null)[]>([]);
  const compileGen = useRef(0);
  decisionRef.current = decision;
  const canUndo = historyTick >= 0 && pastRef.current.length > 0;
  const canRedo = historyTick >= 0 && futureRef.current.length > 0;

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
  const hudMode = hasBoard ? "board" : "idle";
  const hudSize = useHudSize(hudMode);
  const selected = decision?.nodes.find((n) => n.id === selectedId);

  useEffect(() => {
    void resizeHud(hudMode);
  }, [hudMode]);

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
    const local = searchAwsServices(query, query ? 36 : 12);
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

  const commitDecision = useCallback(
    (updater: (prev: CompilerResult | null) => CompilerResult | null) => {
      setDecision((prev) => {
        const next = updater(prev);
        if (graphSignature(prev) === graphSignature(next)) return prev;
        pastRef.current = [
          ...pastRef.current.slice(-39),
          prev ? cloneResult(prev) : null,
        ];
        futureRef.current = [];
        queueMicrotask(() => setHistoryTick((tick) => tick + 1));
        return next;
      });
    },
    [],
  );

  const undo = useCallback(() => {
    if (!pastRef.current.length) return;
    const prior = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    const current = decisionRef.current;
    futureRef.current = [...futureRef.current, current ? cloneResult(current) : null];
    setDecision(prior);
    setHistoryTick((tick) => tick + 1);
  }, []);

  const clearBoard = useCallback(() => {
    compileGen.current += 1;
    setCompiling(false);
    commitDecision((prev) => (prev?.nodes.length ? null : prev));
    setSelectedId(null);
    setLinkingFrom(null);
  }, [commitDecision]);

  const redo = useCallback(() => {
    if (!futureRef.current.length) return;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    const current = decisionRef.current;
    pastRef.current = [...pastRef.current, current ? cloneResult(current) : null];
    setDecision(next);
    setHistoryTick((tick) => tick + 1);
  }, []);

  const patchGraph = useCallback(
    (next: CanvasState, step: string) => {
      commitDecision((prev) => {
        if (!prev) return prev;
        const anomaly = next.nodes.some((n) => n.label.includes("OUTAGE"));
        return lockPositions(
          {
            ...prev,
            ...next,
            is_anomaly: anomaly,
            action: "MUTATE_GRAPH",
            source: "local",
            steps: [...prev.steps, step],
          },
          prev,
        );
      });
    },
    [commitDecision],
  );

  const handleNodeAction = useCallback(
    (id: string, action: NodeMenuAction) => {
      if (!decision) return;
      const state: CanvasState = {
        nodes: decision.nodes,
        edges: decision.edges,
        groups: decision.groups ?? [],
      };
      if (action.type === "remove") {
        patchGraph(applyMutation(state, { kind: "remove", target: id }), `remove ${id}`);
        setSelectedId((current) => (current === id ? null : current));
        setLinkingFrom((current) => (current === id ? null : current));
        return;
      }
      if (action.type === "outage") {
        const node = decision.nodes.find((n) => n.id === id);
        if (node?.label.includes("OUTAGE")) {
          patchGraph(
            {
              ...state,
              nodes: state.nodes.map((n) =>
                n.id === id
                  ? { ...n, label: n.label.replace(/\s*·\s*OUTAGE$/, "") }
                  : n,
              ),
            },
            `recover ${id}`,
          );
          return;
        }
        patchGraph(applyMutation(state, { kind: "outage", target: id }), `outage ${id}`);
        return;
      }
      if (action.type === "color") {
        patchGraph(
          applyMutation(state, { kind: "color", target: id, color: action.color }),
          `color ${id}`,
        );
        return;
      }
      setLinkingFrom((current) => (current === id ? null : id));
    },
    [decision, patchGraph],
  );

  const handleConnectNodes = useCallback(
    (source: string, target: string) => {
      if (!decision) return;
      patchGraph(
        applyMutation(
          {
            nodes: decision.nodes,
            edges: decision.edges,
            groups: decision.groups ?? [],
          },
          { kind: "connect", source, target },
        ),
        `connect ${source} ${target}`,
      );
      setLinkingFrom(null);
      setSelectedId(target);
    },
    [decision, patchGraph],
  );

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
      if (isUndoCommand(value)) {
        undo();
        setPrompt("");
        return;
      }
      if (isRedoCommand(value)) {
        redo();
        setPrompt("");
        return;
      }
      if (isClearCommand(value)) {
        clearBoard();
        setPrompt("");
        return;
      }

      const currentState: CanvasState | undefined = decision
        ? {
            nodes: decision.nodes,
            edges: decision.edges,
            groups: decision.groups ?? [],
          }
        : undefined;
      const gen = (compileGen.current += 1);
      commitDecision((prev) =>
        adoptResult(compileLocal(value, currentState, selectedId ?? undefined), prev, value),
      );
      setCompiling(true);

      try {
        const payload = await evaluateJevSystemDesign(value, currentState, {
          anchor: selectedId ?? undefined,
        });
        if (gen !== compileGen.current) return;
        commitDecision((prev) =>
          adoptResult({ ...payload, groups: payload.groups ?? [] }, prev, value),
        );
      } finally {
        if (gen === compileGen.current) setCompiling(false);
      }
    },
    [prompt, decision, selectedId, commitDecision, undo, redo, clearBoard],
  );

  useEffect(() => {
    const onKey = async (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key === "y") {
        event.preventDefault();
        redo();
        return;
      }
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
  }, [undo, redo]);

  function updatePalette(type: NodeTypeName, color: string) {
    const next = { ...palette, [type]: color };
    setPalette(next);
    savePalette(next);
  }

  const inTauri = "__TAURI_INTERNALS__" in window;

  return (
    <div
      className={
        inTauri
          ? "h-full w-full"
          : "flex h-full w-full items-center justify-center"
      }
    >
    <motion.div
      className={`hud-shell surface flex min-h-0 overflow-hidden rounded-2xl ${
        hasBoard ? "flex-row" : "flex-col"
      }`}
      initial={false}
      animate={
        inTauri
          ? { width: "100%", height: "100%" }
          : { width: hudSize.width, height: hudSize.height }
      }
      transition={{ type: "spring", stiffness: 170, damping: 24, mass: 0.8 }}
    >
      <div
        className={`flex min-h-0 flex-col ${
          hasBoard ? "w-[268px] shrink-0 border-r border-white/8" : "min-w-0 flex-1"
        }`}
      >
        <div id="titlebar" className="flex items-center justify-between px-3 pt-3 pb-2">
          <p className="font-mono text-[11px] tracking-[0.22em] text-zinc-500 uppercase">
            Rune
          </p>
          <div className="no-drag flex items-center gap-2">
            <button
              type="button"
              disabled={!canUndo}
              onClick={undo}
              className="font-mono text-[10px] tracking-tight text-zinc-500 hover:text-zinc-200 disabled:opacity-25"
            >
              Undo
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={redo}
              className="font-mono text-[10px] tracking-tight text-zinc-500 hover:text-zinc-200 disabled:opacity-25"
            >
              Redo
            </button>
            <button
              type="button"
              disabled={!hasBoard}
              onClick={clearBoard}
              className="font-mono text-[10px] tracking-tight text-zinc-500 hover:text-red-300 disabled:opacity-25"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
          <CommandBar
            prompt={prompt}
            compiling={compiling}
            canUndo={canUndo}
            onPromptChange={setPrompt}
            onCompile={compile}
            onUndo={undo}
            inputRef={inputRef}
          />

          {hasBoard && decision?.steps && decision.steps.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {decision.steps.map((step, index) => (
                <span
                  key={`${step}-${index}`}
                  className="rounded-md border border-white/8 px-1.5 py-0.5 font-mono text-[9px] tracking-tight text-zinc-500"
                >
                  {index + 1}. {step}
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 min-h-0 flex-1">
            <PatternStack
              rail={hasBoard}
              onPick={(pattern) => {
                void compile(`Apply ${pattern.id}`).then(() => setPrompt(""));
              }}
            />
            <ServiceStack
              services={stack}
              query={prompt}
              jevBoosted={jevBoosted}
              expanded={!hasBoard}
              rail={hasBoard}
              onPick={(service) => {
                void compile(`Add ${service.label}`).then(() => setPrompt(""));
              }}
            />
          </div>
        </div>
      </div>

      {hasBoard && decision && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-3 pt-3 pb-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <ColorStudio
              palette={palette}
              selectedLabel={selected?.label}
              selectedColor={selected?.color}
              onPaletteChange={updatePalette}
              onSelectedColor={(color) => {
                if (!selectedId) return;
                commitDecision((prev) =>
                  prev
                    ? {
                        ...prev,
                        nodes: prev.nodes.map((node) =>
                          node.id === selectedId ? { ...node, color } : node,
                        ),
                      }
                    : prev,
                );
              }}
              onReset={clearBoard}
            />
            <LatencyHud
              jevMs={decision.execution_time_ms}
              dagreMs={layout.layoutMs}
              fps={fps}
              source={decision.source}
            />
          </div>
          <div className="min-h-0 flex-1">
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
              linkingFrom={linkingFrom}
              onNodeAction={handleNodeAction}
              onConnectNodes={handleConnectNodes}
            />
          </div>
        </div>
      )}
    </motion.div>
    </div>
  );
}
