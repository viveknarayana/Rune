import { motion } from "framer-motion";
import { edgePath, type PositionedNode } from "../lib/layout-engine";
import type { GraphEdge } from "../lib/types";

interface CanvasProps {
  nodes: PositionedNode[];
  edges: GraphEdge[];
  isAnomaly: boolean;
  stiffness: number;
}

export function GlassCanvas({
  nodes,
  edges,
  isAnomaly,
  stiffness,
}: CanvasProps) {
  const springConfig = {
    type: "spring" as const,
    stiffness: stiffness * 35,
    damping: 22,
  };

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const bounds = nodes.reduce(
    (acc, node) => ({
      width: Math.max(acc.width, node.x + node.width + 24),
      height: Math.max(acc.height, node.y + node.height + 24),
    }),
    { width: 720, height: 280 },
  );

  return (
    <div className="relative h-full max-h-[340px] w-full overflow-auto rounded-2xl border border-white/12 bg-white/6 p-4 backdrop-blur-xl">
      <div
        className="relative"
        style={{ width: bounds.width, height: Math.max(bounds.height, 280) }}
      >
        <svg
          className="pointer-events-none absolute inset-0 z-10"
          width={bounds.width}
          height={Math.max(bounds.height, 280)}
        >
          <defs>
            <marker
              id="arrow-emerald"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#10B981" />
            </marker>
            <marker
              id="arrow-red"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#EF4444" />
            </marker>
          </defs>

          {edges.map((edge, idx) => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);
            if (!source || !target) return null;

            const path = edgePath(source, target);
            const isRed =
              isAnomaly &&
              (target.type === "SECURITY" ||
                target.label.includes("OUTAGE") ||
                idx === edges.length - 1);

            return (
              <g key={`${edge.source}-${edge.target}-${idx}`}>
                <motion.path
                  d={path.d}
                  stroke={isRed ? "#EF4444" : "#10B981"}
                  strokeWidth="2"
                  fill="none"
                  markerEnd={isRed ? "url(#arrow-red)" : "url(#arrow-emerald)"}
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
          {nodes.map((node) => {
            const isWarning =
              isAnomaly &&
              (node.type === "SECURITY" ||
                node.id === "db" ||
                node.label.includes("OUTAGE"));

            return (
              <motion.div
                key={node.id}
                layout
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1, left: node.x, top: node.y }}
                transition={springConfig}
                style={{
                  position: "absolute",
                  width: node.width,
                  height: node.height,
                }}
                className={`flex flex-col justify-between rounded-xl border p-3.5 shadow-xl backdrop-blur-xl ${
                  isWarning
                    ? "border-red-500/60 bg-red-950/50 shadow-red-500/20"
                    : "border-white/20 bg-zinc-900/80 hover:border-emerald-400/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-wider text-zinc-400 uppercase">
                    {node.type}
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isWarning
                        ? "animate-ping bg-red-500"
                        : "bg-emerald-400"
                    }`}
                  />
                </div>
                <h3 className="text-xs font-semibold text-white">{node.label}</h3>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
