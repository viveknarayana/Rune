import dagre from "dagre";
import type { GraphEdge, GraphGroup, GraphNode } from "./types";

export interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const NODE_WIDTH = 176;
export const NODE_HEIGHT = 84;

function hasPosition(node: GraphNode): node is GraphNode & { x: number; y: number } {
  return Number.isFinite(node.x) && Number.isFinite(node.y);
}

function structureKey(nodes: GraphNode[], edges: GraphEdge[], groups?: GraphGroup[]) {
  const nodeIds = nodes.map((node) => node.id).sort().join(",");
  const edgeIds = edges
    .map((edge) => `${edge.source}>${edge.target}`)
    .sort()
    .join(",");
  const groupIds = (groups ?? [])
    .map((group) => `${group.id}:${[...group.memberIds].sort().join("+")}`)
    .sort()
    .join(",");
  return `${nodeIds}|${edgeIds}|${groupIds}`;
}

function runDagre(
  nodes: GraphNode[],
  edges: GraphEdge[],
  groups?: GraphGroup[],
): PositionedNode[] {
  const g = new dagre.graphlib.Graph({ compound: true, directed: true });
  g.setGraph({
    rankdir: "TB",
    nodesep: 36,
    ranksep: 56,
    edgesep: 18,
    marginx: 16,
    marginy: 16,
  });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((node) =>
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }),
  );
  const known = new Set(nodes.map((node) => node.id));
  for (const group of groups ?? []) {
    const members = group.memberIds.filter((id) => known.has(id));
    if (members.length < 2) continue;
    g.setNode(group.id, { width: 0, height: 0 });
    for (const id of members) g.setParent(id, group.id);
  }
  edges.forEach((edge) => {
    if (known.has(edge.source) && known.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  });
  dagre.layout(g);
  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      x: (pos?.x ?? 0) - NODE_WIDTH / 2,
      y: (pos?.y ?? 0) - NODE_HEIGHT / 2,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
  });
}

export function computeGraphLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  groups?: GraphGroup[],
): { positionedNodes: PositionedNode[]; edges: GraphEdge[]; layoutMs: number } {
  const started = performance.now();
  const canReuse = nodes.length > 0 && nodes.every(hasPosition);
  const positionedNodes = canReuse
    ? nodes.map((node) => ({
        ...node,
        x: node.x as number,
        y: node.y as number,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      }))
    : runDagre(nodes, edges, groups);

  return {
    positionedNodes,
    edges,
    layoutMs: Number((performance.now() - started).toFixed(2)),
  };
}

export function persistNodePositions(
  nodes: GraphNode[],
  edges: GraphEdge[],
  groups?: GraphGroup[],
) {
  const fresh = nodes.map(({ x: _x, y: _y, ...node }) => node);
  return computeGraphLayout(fresh, edges, groups).positionedNodes.map(
    ({ width: _w, height: _h, ...node }) => node,
  );
}

export function keepOrRelayout(
  next: GraphNode[],
  edges: GraphEdge[],
  previous?: GraphNode[],
  groups?: GraphGroup[],
  previousEdges?: GraphEdge[],
  previousGroups?: GraphGroup[],
) {
  const same =
    previous &&
    previousEdges &&
    structureKey(next, edges, groups) ===
      structureKey(previous, previousEdges, previousGroups);
  if (same && previous.every(hasPosition)) {
    const byId = new Map(previous.map((node) => [node.id, node]));
    return next.map((node) => {
      const old = byId.get(node.id);
      return old && hasPosition(old) ? { ...node, x: old.x, y: old.y } : node;
    });
  }
  return persistNodePositions(next, edges, groups);
}

function outboundFace(source: PositionedNode, target: PositionedNode): "n" | "s" | "e" | "w" {
  const dx = target.x + target.width / 2 - (source.x + source.width / 2);
  const dy = target.y + target.height / 2 - (source.y + source.height / 2);
  if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? "s" : "n";
  return dx >= 0 ? "e" : "w";
}

export function edgeLane(
  edges: GraphEdge[],
  index: number,
  locate: (id: string) => PositionedNode | undefined,
): number {
  const edge = edges[index];
  const source = locate(edge.source);
  const target = locate(edge.target);
  if (!source || !target) return 0;
  const face = outboundFace(source, target);
  const lanes = edges
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => {
      if (item.source !== edge.source) return false;
      const other = locate(item.target);
      return Boolean(other && outboundFace(source, other) === face);
    });
  const rank = lanes.findIndex(({ idx }) => idx === index);
  return (rank === -1 ? 0 : rank) - (lanes.length - 1) / 2;
}

export function edgePath(
  source: PositionedNode,
  target: PositionedNode,
  lane = 0,
): { d: string; labelX: number; labelY: number } {
  const sourceCx = source.x + source.width / 2;
  const sourceCy = source.y + source.height / 2;
  const targetCx = target.x + target.width / 2;
  const targetCy = target.y + target.height / 2;
  const dx = targetCx - sourceCx;
  const dy = targetCy - sourceCy;
  const spread = lane * 16;

  let startX: number;
  let startY: number;
  let endX: number;
  let endY: number;
  let c1x: number;
  let c1y: number;
  let c2x: number;
  let c2y: number;

  if (Math.abs(dy) >= Math.abs(dx)) {
    startX = sourceCx + spread;
    startY = dy > 0 ? source.y + source.height : source.y;
    endX = targetCx + spread;
    endY = dy > 0 ? target.y : target.y + target.height;
    const lift = Math.max(28, Math.abs(endY - startY) * 0.45);
    c1x = startX + spread * 0.35;
    c1y = startY + (dy > 0 ? lift : -lift);
    c2x = endX + spread * 0.35;
    c2y = endY + (dy > 0 ? -lift : lift);
  } else {
    startX = dx > 0 ? source.x + source.width : source.x;
    startY = sourceCy + spread;
    endX = dx > 0 ? target.x : target.x + target.width;
    endY = targetCy + spread;
    const pull = Math.max(28, Math.abs(endX - startX) * 0.45);
    c1x = startX + (dx > 0 ? pull : -pull);
    c1y = startY + spread * 0.35;
    c2x = endX + (dx > 0 ? -pull : pull);
    c2y = endY + spread * 0.35;
  }

  return {
    d: `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`,
    labelX: (startX + endX) / 2,
    labelY: (startY + endY) / 2 - 8,
  };
}

export interface GroupFrame {
  id: string;
  label: string;
  color?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeGroupFrames(
  groups: GraphGroup[],
  nodes: PositionedNode[],
  padding = 18,
): GroupFrame[] {
  const frames: GroupFrame[] = [];
  for (const group of groups) {
    const members = nodes.filter((n) => group.memberIds.includes(n.id));
    if (!members.length) continue;
    const left = Math.min(...members.map((n) => n.x)) - padding;
    const top = Math.min(...members.map((n) => n.y)) - padding - 14;
    const right = Math.max(...members.map((n) => n.x + n.width)) + padding;
    const bottom = Math.max(...members.map((n) => n.y + n.height)) + padding;
    frames.push({
      id: group.id,
      label: group.label,
      color: group.color,
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    });
  }
  return frames;
}
