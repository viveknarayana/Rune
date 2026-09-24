import dagre from "dagre";
import type { GraphEdge, GraphNode } from "./types";

export interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

const NODE_WIDTH = 168;
const NODE_HEIGHT = 72;

export function computeGraphLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { positionedNodes: PositionedNode[]; edges: GraphEdge[]; layoutMs: number } {
  const started = performance.now();
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    nodesep: 28,
    ranksep: 46,
    marginx: 12,
    marginy: 12,
  });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) =>
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }),
  );
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  dagre.layout(g);

  const positionedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      x: pos.x - NODE_WIDTH / 2,
      y: pos.y - NODE_HEIGHT / 2,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
  });

  return {
    positionedNodes,
    edges,
    layoutMs: Number((performance.now() - started).toFixed(2)),
  };
}

export function edgePath(
  source: PositionedNode,
  target: PositionedNode,
): { d: string; labelX: number; labelY: number } {
  const sourceCx = source.x + source.width / 2;
  const sourceCy = source.y + source.height / 2;
  const targetCx = target.x + target.width / 2;
  const targetCy = target.y + target.height / 2;
  const dx = targetCx - sourceCx;
  const dy = targetCy - sourceCy;

  let startX: number;
  let startY: number;
  let endX: number;
  let endY: number;
  let c1x: number;
  let c1y: number;
  let c2x: number;
  let c2y: number;

  if (Math.abs(dy) >= Math.abs(dx)) {
    startX = sourceCx;
    startY = dy > 0 ? source.y + source.height : source.y;
    endX = targetCx;
    endY = dy > 0 ? target.y : target.y + target.height;
    const lift = Math.max(28, Math.abs(endY - startY) * 0.45);
    c1x = startX;
    c1y = startY + (dy > 0 ? lift : -lift);
    c2x = endX;
    c2y = endY + (dy > 0 ? -lift : lift);
  } else {
    startX = dx > 0 ? source.x + source.width : source.x;
    startY = sourceCy;
    endX = dx > 0 ? target.x : target.x + target.width;
    endY = targetCy;
    const pull = Math.max(28, Math.abs(endX - startX) * 0.45);
    c1x = startX + (dx > 0 ? pull : -pull);
    c1y = startY;
    c2x = endX + (dx > 0 ? -pull : pull);
    c2y = endY;
  }

  return {
    d: `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`,
    labelX: (startX + endX) / 2,
    labelY: (startY + endY) / 2 - 8,
  };
}
