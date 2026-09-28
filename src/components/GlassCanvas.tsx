import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NodeShape } from "./NodeShape";
import { ServiceIcon } from "./ServiceIcon";
import { colorForType, withAlpha, type ColorPalette } from "../lib/colors";
import {
  computeGroupFrames,
  edgeLane,
  edgePath,
  type PositionedNode,
} from "../lib/layout-engine";
import { contentBox } from "../lib/shapes";
import type { GraphEdge, GraphGroup } from "../lib/types";
import { NodeMenu, type NodeLink, type NodeMenuAction } from "./NodeMenu";

const MIN_ZOOM = 0.12;
const MAX_ZOOM = 3.5;
const GRID = 16;

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

interface CanvasProps {
  nodes: PositionedNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
  isAnomaly: boolean;
  stiffness: number;
  palette: ColorPalette;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onNodeMove?: (id: string, x: number, y: number) => void;
  linkingFrom?: string | null;
  selectedEdge?: { source: string; target: string } | null;
  onNodeAction?: (id: string, action: NodeMenuAction) => void;
  onConnectNodes?: (source: string, target: string) => void;
  onDisconnect?: (source: string, target: string) => void;
  onSelectEdge?: (edge: { source: string; target: string } | null) => void;
}

function worldToScreen(x: number, y: number, camera: Camera) {
  return {
    x: x * camera.zoom + camera.x,
    y: y * camera.zoom + camera.y,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function worldBounds(items: { x: number; y: number; width: number; height: number }[]) {
  if (!items.length) {
    return { minX: 0, minY: 0, width: 800, height: 600 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  }
  minX -= 80;
  minY -= 80;
  maxX += 80;
  maxY += 80;
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

function fitCamera(
  bounds: { minX: number; minY: number; width: number; height: number },
  viewport: { width: number; height: number },
): Camera {
  const pad = 72;
  const zoom = clamp(
    Math.min(
      (viewport.width - pad) / Math.max(bounds.width, 1),
      (viewport.height - pad) / Math.max(bounds.height, 1),
    ),
    MIN_ZOOM,
    1.15,
  );
  return {
    zoom,
    x: (viewport.width - bounds.width * zoom) / 2 - bounds.minX * zoom,
    y: (viewport.height - bounds.height * zoom) / 2 - bounds.minY * zoom,
  };
}

export function GlassCanvas({
  nodes,
  edges,
  groups,
  isAnomaly,
  stiffness,
  palette,
  selectedId,
  onSelect,
  onNodeMove,
  linkingFrom,
  selectedEdge,
  onNodeAction,
  onConnectNodes,
  onDisconnect,
  onSelectEdge,
}: CanvasProps) {
  const springConfig = {
    type: "spring" as const,
    stiffness: stiffness * 35,
    damping: 22,
  };
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const panRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const liveRef = useRef<Record<string, { x: number; y: number }>>({});
  const cameraRef = useRef<Camera>({ x: 48, y: 48, zoom: 1 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const fittedRef = useRef(false);
  const [live, setLive] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const [viewport, setViewport] = useState({ width: 800, height: 600 });
  const [camera, setCamera] = useState<Camera>(cameraRef.current);

  const applyCamera = (next: Camera) => {
    cameraRef.current = next;
    setCamera(next);
  };

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      setViewport({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent | MouseEvent) => {
      const drag = dragRef.current;
      const zoom = cameraRef.current.zoom || 1;
      if (drag) {
        const x = drag.origX + (event.clientX - drag.startX) / zoom;
        const y = drag.origY + (event.clientY - drag.startY) / zoom;
        if (
          Math.abs(event.clientX - drag.startX) > 3 ||
          Math.abs(event.clientY - drag.startY) > 3
        ) {
          drag.moved = true;
        }
        const next = { ...liveRef.current, [drag.id]: { x, y } };
        liveRef.current = next;
        setLive(next);
        return;
      }
      const pan = panRef.current;
      if (!pan) return;
      applyCamera({
        ...cameraRef.current,
        x: pan.origX + (event.clientX - pan.startX),
        y: pan.origY + (event.clientY - pan.startY),
      });
    };
    const onUp = () => {
      const drag = dragRef.current;
      if (drag) {
        const pos = liveRef.current[drag.id];
        if (pos && drag.moved) onNodeMove?.(drag.id, pos.x, pos.y);
        dragRef.current = null;
        liveRef.current = {};
        setLive({});
        setDraggingId(null);
      }
      if (panRef.current) {
        panRef.current = null;
        setPanning(false);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onNodeMove]);

  const displayNodes = nodes.map((node) =>
    live[node.id] ? { ...node, ...live[node.id] } : node,
  );
  const nodeMap = new Map(displayNodes.map((n) => [n.id, n]));
  const frames = computeGroupFrames(groups, displayNodes);
  const bounds = worldBounds([...displayNodes, ...frames]);

  const zoomAround = (factor: number, cx: number, cy: number) => {
    const current = cameraRef.current;
    const nextZoom = clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    applyCamera({
      zoom: nextZoom,
      x: cx - ((cx - current.x) * nextZoom) / current.zoom,
      y: cy - ((cy - current.y) * nextZoom) / current.zoom,
    });
  };

  const frameContent = () => {
    applyCamera(fitCamera(bounds, viewport));
  };

  useLayoutEffect(() => {
    if (!nodes.length) {
      fittedRef.current = false;
      return;
    }
    if (viewport.width < 40 || viewport.height < 40) return;
    applyCamera(fitCamera(bounds, viewport));
    fittedRef.current = true;
  }, [nodes.length, viewport.width, viewport.height]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = el.getBoundingClientRect();
        const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
        zoomAround(factor, event.clientX - rect.left, event.clientY - rect.top);
        return;
      }
      applyCamera({
        ...cameraRef.current,
        x: cameraRef.current.x - event.deltaX,
        y: cameraRef.current.y - event.deltaY,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={viewportRef}
      className={`dot-grid relative h-full min-h-0 w-full overflow-hidden rounded-xl border border-white/8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] ${
        panning ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{
        backgroundSize: `${GRID * camera.zoom}px ${GRID * camera.zoom}px`,
        backgroundPosition: `${camera.x}px ${camera.y}px`,
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 && event.button !== 1) return;
        if ((event.target as HTMLElement).closest("[data-node-id]")) return;
        if ((event.target as HTMLElement).closest("[data-hud-overlay]")) return;
        event.preventDefault();
        onSelect?.(null);
        panRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          origX: cameraRef.current.x,
          origY: cameraRef.current.y,
        };
        setPanning(true);
      }}
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-node-id]")) return;
        frameContent();
      }}
    >
      <div
        className="absolute left-0 top-0 will-change-transform"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {frames.map((frame) => {
          const stroke = frame.color ?? "#34D399";
          return (
            <div
              key={frame.id}
              className="absolute z-0 rounded-xl border border-dashed"
              style={{
                left: frame.x,
                top: frame.y,
                width: frame.width,
                height: frame.height,
                borderColor: withAlpha(stroke, 0.7),
                background: withAlpha(stroke, 0.08),
              }}
            >
              <span
                className="absolute -top-2.5 left-3 rounded-md px-1.5 py-0.5 font-mono text-[9px] tracking-tight uppercase"
                style={{
                  background: withAlpha(stroke, 0.2),
                  color: stroke,
                }}
              >
                {frame.label}
              </span>
            </div>
          );
        })}

        <svg
          className="absolute z-10 overflow-visible"
          width={bounds.width}
          height={bounds.height}
          style={{ left: bounds.minX, top: bounds.minY, pointerEvents: "none" }}
        >
          <defs>
            {edges.map((edge, idx) => {
              const source = nodeMap.get(edge.source);
              const color = source
                ? colorForType(source.type, palette, source.color)
                : "#10B981";
              return (
                <marker
                  key={`arrow-${idx}`}
                  id={`arrow-${idx}`}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
                </marker>
              );
            })}
          </defs>

          <g transform={`translate(${-bounds.minX} ${-bounds.minY})`}>
            {edges.map((edge, idx) => {
              const source = nodeMap.get(edge.source);
              const target = nodeMap.get(edge.target);
              if (!source || !target) return null;

              const path = edgePath(
                source,
                target,
                edgeLane(edges, idx, (id) => nodeMap.get(id)),
              );
              const hot =
                selectedEdge?.source === edge.source &&
                selectedEdge?.target === edge.target;
              const isRed =
                isAnomaly &&
                (target.type === "SECURITY" || target.label.includes("OUTAGE"));
              const color = isRed
                ? "#EF4444"
                : colorForType(source.type, palette, source.color);

              return (
                <g key={`${edge.source}-${edge.target}-${idx}`}>
                  <path
                    d={path.d}
                    stroke="transparent"
                    strokeWidth="14"
                    fill="none"
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      if (hot) onSelectEdge?.(null);
                      else onSelectEdge?.({ source: edge.source, target: edge.target });
                    }}
                  />
                  <motion.path
                    d={path.d}
                    stroke={color}
                    strokeWidth={hot ? 2.4 : 1.5}
                    fill="none"
                    markerEnd={`url(#arrow-${idx})`}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    style={{ pointerEvents: "none" }}
                  />
                  {edge.label && (
                    <text
                      x={path.labelX}
                      y={path.labelY}
                      fill={hot ? "#E4E4E7" : "#71717A"}
                      fontSize="10"
                      textAnchor="middle"
                      className="font-mono"
                      style={{ pointerEvents: "none" }}
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        <div className="relative z-20">
          {displayNodes.map((node) => {
            const accent = colorForType(node.type, palette, node.color);
            const isWarning = isAnomaly && node.label.includes("OUTAGE");
            const selected = selectedId === node.id;
            const dragging = draggingId === node.id;

            return (
              <motion.div
                key={node.id}
                data-node-id={node.id}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={springConfig}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onSelect?.(node.id);
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.stopPropagation();
                  if (linkingFrom && linkingFrom !== node.id) {
                    onConnectNodes?.(linkingFrom, node.id);
                    return;
                  }
                  onSelect?.(node.id);
                  dragRef.current = {
                    id: node.id,
                    startX: event.clientX,
                    startY: event.clientY,
                    origX: node.x,
                    origY: node.y,
                    moved: false,
                  };
                  setDraggingId(node.id);
                }}
                style={{
                  position: "absolute",
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                  filter: isWarning
                    ? "drop-shadow(0 0 12px rgba(239,68,68,0.22))"
                    : selected
                      ? `drop-shadow(0 0 10px ${withAlpha(accent, 0.28)})`
                      : "drop-shadow(0 8px 16px rgba(0,0,0,0.35))",
                  zIndex: dragging ? 30 : selected ? 24 : 20,
                }}
                className={`select-none touch-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
              >
                <NodeShape
                  type={node.type}
                  accent={accent}
                  selected={selected}
                  warning={isWarning}
                />
                <div
                  className="pointer-events-none relative z-10 flex h-full min-w-0 items-center gap-1.5 overflow-hidden"
                  style={{
                    paddingLeft: contentBox(node.type).padX,
                    paddingRight: contentBox(node.type).padX,
                    paddingTop: contentBox(node.type).padTop,
                    paddingBottom: contentBox(node.type).padBottom,
                  }}
                >
                  {node.icon && (
                    <ServiceIcon src={node.icon} label={node.label} size={22} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate font-mono text-[8px] tracking-[0.14em] text-zinc-500 uppercase">
                        {node.type}
                      </span>
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        {isWarning && (
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
                        )}
                        <span
                          className="relative inline-flex h-1.5 w-1.5 rounded-full"
                          style={{
                            background: isWarning ? "#EF4444" : accent,
                          }}
                        />
                      </span>
                    </div>
                    <h3 className="truncate text-[11px] leading-tight font-medium tracking-tight text-zinc-100">
                      {node.label}
                    </h3>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {(() => {
        const picked = displayNodes.find(
          (node) => node.id === selectedId && draggingId !== node.id,
        );
        if (!picked) return null;
        const links: NodeLink[] = [];
        for (const edge of edges) {
          if (edge.source === picked.id) {
            const other = nodeMap.get(edge.target);
            if (other) {
              links.push({
                source: edge.source,
                target: edge.target,
                label: other.label,
                dir: "out",
              });
            }
          } else if (edge.target === picked.id) {
            const other = nodeMap.get(edge.source);
            if (other) {
              links.push({
                source: edge.source,
                target: edge.target,
                label: other.label,
                dir: "in",
              });
            }
          }
        }
        const anchor = worldToScreen(
          picked.x + picked.width + 12,
          picked.y,
          camera,
        );
        return (
          <div
            data-hud-overlay
            className="no-drag pointer-events-auto absolute z-50"
            style={{
              left: clamp(anchor.x, 8, Math.max(8, viewport.width - 240)),
              top: clamp(anchor.y, 8, Math.max(8, viewport.height - 220)),
            }}
          >
            <NodeMenu
              name={picked.label}
              kind={picked.type}
              linking={linkingFrom === picked.id}
              isOutage={picked.label.includes("OUTAGE")}
              links={links}
              onAction={(action) => onNodeAction?.(picked.id, action)}
            />
          </div>
        );
      })()}
      {selectedEdge &&
        (() => {
          const source = nodeMap.get(selectedEdge.source);
          const target = nodeMap.get(selectedEdge.target);
          if (!source || !target) return null;
          const idx = edges.findIndex(
            (edge) =>
              edge.source === selectedEdge.source &&
              edge.target === selectedEdge.target,
          );
          const path = edgePath(
            source,
            target,
            edgeLane(edges, Math.max(idx, 0), (id) => nodeMap.get(id)),
          );
          const at = worldToScreen(path.labelX, path.labelY + 16, camera);
          return (
            <button
              type="button"
              data-hud-overlay
              className="no-drag absolute z-50 -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-300/25 bg-[#1a1014]/90 px-2.5 py-1 font-mono text-[10px] tracking-tight text-red-200 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md hover:bg-red-500/20"
              style={{ left: at.x, top: at.y }}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.preventDefault();
                onDisconnect?.(selectedEdge.source, selectedEdge.target);
              }}
            >
              Remove link
            </button>
          );
        })()}

      <div className="no-drag absolute right-2 bottom-2 z-40 flex items-center gap-1 rounded-lg border border-white/10 bg-[#0F1015]/90 px-1 py-1 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
        <button
          type="button"
          onClick={() => zoomAround(1 / 1.15, viewport.width / 2, viewport.height / 2)}
          className="h-6 w-6 rounded-md font-mono text-[13px] text-zinc-400 hover:bg-white/8 hover:text-zinc-100"
        >
          −
        </button>
        <button
          type="button"
          onClick={frameContent}
          className="min-w-10 px-1 font-mono text-[10px] tracking-tight text-zinc-500 hover:text-zinc-200"
        >
          {Math.round(camera.zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => zoomAround(1.15, viewport.width / 2, viewport.height / 2)}
          className="h-6 w-6 rounded-md font-mono text-[13px] text-zinc-400 hover:bg-white/8 hover:text-zinc-100"
        >
          +
        </button>
      </div>
    </div>
  );
}
