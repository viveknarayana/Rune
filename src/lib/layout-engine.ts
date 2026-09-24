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
const GAP = 28;

function hasPosition(node: GraphNode): node is GraphNode & { x: number; y: number } {
  return Number.isFinite(node.x) && Number.isFinite(node.y);
}

function boxOf(node: { x: number; y: number }): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return { x: node.x, y: node.y, width: NODE_WIDTH, height: NODE_HEIGHT };
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return !(
    a.x + a.width + GAP <= b.x ||
    b.x + b.width + GAP <= a.x ||
    a.y + a.height + GAP <= b.y ||
    b.y + b.height + GAP <= a.y
  );
}

function resolveCollision(
  pos: { x: number; y: number },
  others: PositionedNode[],
): { x: number; y: number } {
  let { x, y } = pos;
  for (let i = 0; i < 48; i += 1) {
    const box = { x, y, width: NODE_WIDTH, height: NODE_HEIGHT };
    const hit = others.find((other) => overlaps(box, boxOf(other)));
    if (!hit) break;
    y = hit.y + NODE_HEIGHT + GAP;
  }
  return { x: Math.max(8, x), y: Math.max(8, y) };
}

function placeUnlocked(
  node: GraphNode,
  placed: PositionedNode[],
  edges: GraphEdge[],
): PositionedNode {
  const incoming = edges
    .filter((edge) => edge.target === node.id)
    .map((edge) => placed.find((item) => item.id === edge.source))
    .filter((item): item is PositionedNode => Boolean(item));
  const outgoing = edges
    .filter((edge) => edge.source === node.id)
    .map((edge) => placed.find((item) => item.id === edge.target))
    .filter((item): item is PositionedNode => Boolean(item));

  let x = 8;
  let y = 8;

  if (incoming.length) {
    x = incoming.reduce((sum, item) => sum + item.x, 0) / incoming.length;
    y = Math.max(...incoming.map((item) => item.y + NODE_HEIGHT)) + GAP;
  } else if (outgoing.length) {
    x = outgoing.reduce((sum, item) => sum + item.x, 0) / outgoing.length;
    y = Math.min(...outgoing.map((item) => item.y)) - NODE_HEIGHT - GAP;
    if (y < 8) {
      y = outgoing[0].y;
      x = Math.min(...outgoing.map((item) => item.x)) - NODE_WIDTH - GAP;
    }
  } else if (placed.length) {
    x = Math.max(...placed.map((item) => item.x + item.width)) + GAP;
    y = Math.min(...placed.map((item) => item.y));
  }

  const resolved = resolveCollision({ x, y }, placed);
  return {
    ...node,
    ...resolved,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  };
}

export function computeGraphLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { positionedNodes: PositionedNode[]; edges: GraphEdge[]; layoutMs: number } {
  const started = performance.now();
  const locked = nodes.filter(hasPosition);
  const unlocked = nodes.filter((node) => !hasPosition(node));

  let positionedNodes: PositionedNode[];

  if (unlocked.length === 0) {
    positionedNodes = nodes.map((node) => ({
      ...node,
      x: node.x as number,
      y: node.y as number,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }));
  } else if (locked.length === 0) {
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
    positionedNodes = nodes.map((node) => {
      const pos = g.node(node.id);
      return {
        ...node,
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      };
    });
  } else {
    const placed: PositionedNode[] = locked.map((node) => ({
      ...node,
      x: node.x,
      y: node.y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }));
    for (const node of unlocked) {
      placed.push(placeUnlocked(node, placed, edges));
    }
    const byId = new Map(placed.map((node) => [node.id, node]));
    positionedNodes = nodes.map((node) => byId.get(node.id)!);
  }

  return {
    positionedNodes,
    edges,
    layoutMs: Number((performance.now() - started).toFixed(2)),
  };
}

export function persistNodePositions(nodes: GraphNode[], edges: GraphEdge[]) {
  return computeGraphLayout(nodes, edges).positionedNodes.map(
    ({ width: _w, height: _h, ...node }) => node,
  );
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
