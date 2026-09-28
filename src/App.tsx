import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ColorStudio } from "./components/ColorStudio";
import { CommandBar } from "./components/CommandBar";
import { GlassCanvas } from "./components/GlassCanvas";
import { PatternStack } from "./components/PatternStack";
import { AwsPhysicsPile } from "./components/AwsPhysicsPile";
import { ServiceStack } from "./components/ServiceStack";
import { TideField } from "./components/TideField";
import {
  searchAwsServices,
  magnetAwsIds,
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
  evaluateJevSystemDesign,
  hasJevKey,
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
  const [compileError, setCompileError] = useState<string | null>(null);
  const jevReady = hasJevKey();
  const [decision, setDecision] = useState<CompilerResult | null>(null);
  const [palette, setPalette] = useState<ColorPalette>(DEFAULT_PALETTE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<{
    source: string;
    target: string;
  } | null>(null);
  const [stack, setStack] = useState<AwsService[]>(() => searchAwsServices(""));
  const [jevBoosted, setJevBoosted] = useState(false);
  const magnetHold = useRef<string[]>([]);
  const hudColRef = useRef<HTMLDivElement>(null);
  const patternBlockRef = useRef<HTMLDivElement>(null);
  const [magnetTop, setMagnetTop] = useState(260);
  const activeMagnetIds = useMemo(() => {
    const next = magnetAwsIds(prompt, stack);
    if (!prompt.trim()) {
      magnetHold.current = [];
      return [];
    }
    if (next.length) magnetHold.current = next;
    return magnetHold.current;
  }, [prompt, stack]);
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

  useLayoutEffect(() => {
    if (hasBoard) return;
    const col = hudColRef.current;
    const block = patternBlockRef.current;
    if (!col || !block) return;
    const measure = () => {
      const top = block.getBoundingClientRect().bottom - col.getBoundingClientRect().top;
      setMagnetTop(Math.max(160, Math.round(top + 36)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(col);
    ro.observe(block);
    return () => ro.disconnect();
  }, [hasBoard, hudSize.width, hudSize.height]);

  const selected = decision?.nodes.find((n) => n.id === selectedId);

  useEffect(() => {
    void resizeHud(hudMode);
  }, [hudMode]);

  useEffect(() => {
    if (decision) applyTheme(decision.theme_mode);
  }, [decision]);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, [hasBoard]);

  useEffect(() => {
    const query = prompt.trim();
    const local = searchAwsServices(query, query ? 48 : 72);
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
    setSelectedEdge(null);
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
      if (action.type === "disconnect") {
        patchGraph(
          applyMutation(state, {
            kind: "disconnect",
            source: action.source,
            target: action.target,
          }),
          `unlink ${action.source} ${action.target}`,
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
      setSelectedEdge(null);
    },
    [decision, patchGraph],
  );

  const handleDisconnect = useCallback(
    (source: string, target: string) => {
      if (!decision) return;
      patchGraph(
        applyMutation(
          {
            nodes: decision.nodes,
            edges: decision.edges,
            groups: decision.groups ?? [],
          },
          { kind: "disconnect", source, target },
        ),
        `unlink ${source} ${target}`,
      );
      setSelectedEdge(null);
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
      if (!hasJevKey()) {
        setCompileError("Set VITE_TYPESAFE_API_KEY in .env — Jev is required.");
        return;
      }
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
      setCompileError(null);
      setCompiling(true);

      try {
        const payload = await evaluateJevSystemDesign(value, currentState, {
          anchor: selectedId ?? undefined,
        });
        if (gen !== compileGen.current) return;
        commitDecision((prev) =>
          adoptResult({ ...payload, groups: payload.groups ?? [] }, prev, value),
        );
      } catch (error) {
        if (gen !== compileGen.current) return;
        setCompileError(
          error instanceof Error ? error.message : "Jev compile failed.",
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
        if (selectedId || selectedEdge || linkingFrom) {
          setSelectedId(null);
          setSelectedEdge(null);
          setLinkingFrom(null);
          return;
        }
        try {
          await getCurrentWindow().hide();
        } catch {
          // Browser preview has no Tauri window.
        }
      }
      const target = event.target as HTMLElement | null;
      const inField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        Boolean(target?.closest(".node-inspector"));

      if (event.key === "Backspace" || event.key === "Delete") {
        if (inField) return;
        if (selectedEdge) {
          event.preventDefault();
          handleDisconnect(selectedEdge.source, selectedEdge.target);
          return;
        }
        if (event.key === "Backspace") {
          event.preventDefault();
          setPrompt((value) => value.slice(0, -1));
          inputRef.current?.focus({ preventScroll: true });
        }
        return;
      }

      if (
        !inField &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        event.key.length === 1
      ) {
        event.preventDefault();
        setPrompt((value) => value + event.key);
        inputRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey);
    const onPointerUp = () => {
      window.requestAnimationFrame(() => {
        const active = document.activeElement as HTMLElement | null;
        if (active?.closest(".node-inspector")) return;
        if (active instanceof HTMLInputElement && active.type === "color") return;
        inputRef.current?.focus({ preventScroll: true });
      });
    };
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [undo, redo, selectedId, selectedEdge, linkingFrom, handleDisconnect]);

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
          : "flex h-full w-full items-start justify-center pt-[4vh]"
      }
    >
    <motion.div
      className={`hud-shell surface relative flex min-h-0 overflow-hidden rounded-2xl ${
        hasBoard ? "hud-shell--board flex-row" : "hud-shell--search flex-col"
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
        ref={hudColRef}
        className={`relative flex min-h-0 flex-col overflow-hidden ${
          hasBoard ? "w-[300px] shrink-0 border-r border-sky-100/10" : "min-w-0 flex-1"
        }`}
      >
        <TideField variant={hasBoard ? "rail" : "idle"} />
        {!hasBoard && (
          <div className="absolute inset-0 z-0">
            <AwsPhysicsPile
              activeIds={activeMagnetIds}
              magnetTop={magnetTop}
              onPick={(service) => {
                void compile(`Add ${service.label}`);
              }}
            />
          </div>
        )}
        <div id="titlebar" className="relative z-20 flex items-center justify-between px-3 pt-3 pb-2">
          <p className="font-mono text-[11px] tracking-[0.22em] uppercase text-sky-100/70">
            Rune
          </p>
          <div className="no-drag flex items-center gap-2">
            {hasBoard && (
              <>
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
              </>
            )}
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

        <div
          className={`relative z-20 flex min-h-0 flex-1 flex-col px-3 pb-3 ${
            hasBoard ? "" : "pointer-events-none"
          }`}
        >
          <div className={hasBoard ? undefined : "pointer-events-auto"}>
          <CommandBar
            prompt={prompt}
            compiling={compiling}
            luminous
            jevReady={jevReady}
            onPromptChange={setPrompt}
            onCompile={compile}
            inputRef={inputRef}
          />
          </div>
          {compileError && (
            <p className="pointer-events-auto mt-1.5 px-1 font-mono text-[10px] tracking-tight text-red-300/90">
              {compileError}
            </p>
          )}

          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              ref={patternBlockRef}
              className={`shrink-0 ${hasBoard ? "" : "pointer-events-auto"}`}
            >
            <PatternStack
              rail={hasBoard}
              luminous
              onPick={(pattern) => {
                void compile(`Apply ${pattern.id}`).then(() => setPrompt(""));
              }}
            />
            </div>
            {hasBoard ? (
              <ServiceStack
                services={stack}
                query={prompt}
                jevBoosted={jevBoosted}
                expanded={false}
                rail
                onPick={(service) => {
                  void compile(`Add ${service.label}`).then(() => setPrompt(""));
                }}
              />
            ) : (
              <div className="min-h-0 flex-1" />
            )}
          </div>
        </div>
      </div>

      {hasBoard && decision && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-3 pt-3 pb-3">
          <div className="mb-2 flex items-center gap-2">
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
              selectedEdge={selectedEdge}
              onSelect={(id) => {
                setSelectedId(id);
                if (id) setSelectedEdge(null);
              }}
              onSelectEdge={(edge) => {
                setSelectedEdge(edge);
                if (edge) {
                  setSelectedId(null);
                  setLinkingFrom(null);
                }
              }}
              onNodeMove={moveNode}
              linkingFrom={linkingFrom}
              onNodeAction={handleNodeAction}
              onConnectNodes={handleConnectNodes}
              onDisconnect={handleDisconnect}
            />
          </div>
        </div>
      )}
    </motion.div>
    </div>
  );
}
