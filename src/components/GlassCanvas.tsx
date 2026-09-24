import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { NodeShape } from "./NodeShape";
import { ServiceIcon } from "./ServiceIcon";
import { colorForType, withAlpha, type ColorPalette } from "../lib/colors";
import {
  computeGroupFrames,
  edgePath,
  type PositionedNode,
} from "../lib/layout-engine";
import { contentBox } from "../lib/shapes";
import type { GraphEdge, GraphGroup } from "../lib/types";

interface CanvasProps {
  nodes: PositionedNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
  isAnomaly: boolean;
  stiffness: number;
  palette: ColorPalette;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onNodeMove?: (id: string, x: number, y: number) => void;
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
  const liveRef = useRef<Record<string, { x: number; y: number }>>({});
  const [live, setLive] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    const onMove = (event: PointerEvent | MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const x = Math.max(0, drag.origX + event.clientX - drag.startX);
      const y = Math.max(0, drag.origY + event.clientY - drag.startY);
      if (
        Math.abs(event.clientX - drag.startX) > 3 ||
        Math.abs(event.clientY - drag.startY) > 3
      ) {
        drag.moved = true;
      }
      const next = { ...liveRef.current, [drag.id]: { x, y } };
      liveRef.current = next;
      setLive(next);
    };
    const onUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      const pos = liveRef.current[drag.id];
      if (pos && drag.moved) onNodeMove?.(drag.id, pos.x, pos.y);
      dragRef.current = null;
      liveRef.current = {};
      setLive({});
      setDraggingId(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onNodeMove]);

  const displayNodes = nodes.map((node) =>
    live[node.id] ? { ...node, ...live[node.id] } : node,
  );
  const nodeMap = new Map(displayNodes.map((n) => [n.id, n]));
  const frames = computeGroupFrames(groups, displayNodes);
  const bounds = [...displayNodes, ...frames].reduce(
    (acc, item) => ({
      width: Math.max(acc.width, item.x + item.width + 28),
      height: Math.max(acc.height, item.y + item.height + 28),
    }),
    { width: 720, height: 260 },
  );

  return (
    <div className="relative h-full min-h-[280px] max-h-[340px] w-full overflow-auto rounded-2xl border border-white/10 bg-black/20 p-5">
      <div
        className="relative"
        style={{ width: bounds.width, height: Math.max(bounds.height, 260) }}
      >
        {frames.map((frame) => {
          const stroke = frame.color ?? "#34D399";
          return (
            <div
              key={frame.id}
              className="absolute z-0 rounded-2xl border-2 border-dashed"
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
                className="absolute -top-2.5 left-3 rounded-full px-2 py-0.5 font-mono text-[9px] tracking-wider uppercase"
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
          className="pointer-events-none absolute inset-0 z-10"
          width={bounds.width}
          height={Math.max(bounds.height, 260)}
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

          {edges.map((edge, idx) => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);
            if (!source || !target) return null;

            const path = edgePath(source, target);
            const isRed =
              isAnomaly &&
              (target.type === "SECURITY" || target.label.includes("OUTAGE"));
            const color = isRed
              ? "#EF4444"
              : colorForType(source.type, palette, source.color);

            return (
              <g key={`${edge.source}-${edge.target}-${idx}`}>
                <motion.path
                  d={path.d}
                  stroke={color}
                  strokeWidth="2"
                  fill="none"
                  markerEnd={`url(#arrow-${idx})`}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
                {edge.label && (
                  <text
                    x={path.labelX}
                    y={path.labelY}
                    fill="#A1A1AA"
                    fontSize="10"
                    textAnchor="middle"
                    className="font-mono"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <div className="relative z-20 h-full w-full">
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
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.stopPropagation();
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
                  filter: `drop-shadow(0 10px 16px ${withAlpha(accent, 0.28)})`,
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
                      <span
                        className="truncate font-mono text-[8px] tracking-[0.12em] uppercase"
                        style={{ color: accent }}
                      >
                        {node.type}
                      </span>
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${isWarning ? "animate-ping" : ""}`}
                        style={{ background: isWarning ? "#EF4444" : accent }}
                      />
                    </div>
                    <h3 className="truncate text-[11px] leading-tight font-semibold text-white">
                      {node.label}
                    </h3>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
