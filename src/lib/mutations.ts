import { findInGraph, resolveComponent, toNode } from "./catalog";
import type { CanvasState, GraphEdge, GraphNode } from "./types";

export type Mutation =
  | { kind: "remove"; target: string }
  | { kind: "insert_before"; node: string; before: string }
  | { kind: "insert_after"; node: string; after: string }
  | { kind: "outage"; target?: string };

function strip(text: string) {
  return text.replace(/^(a|an|the)\s+/i, "").trim();
}

export function parseMutation(prompt: string): Mutation | null {
  const p = prompt.trim().replace(/[.!?]+$/, "");

  const before = p.match(
    /(?:add|insert)\s+(?:a |an |the )?(.+?)\s+(?:before|in front of)\s+(?:the )?(.+?)$/i,
  );
  if (before) {
    return {
      kind: "insert_before",
      node: strip(before[1]),
      before: strip(before[2]),
    };
  }

  const after = p.match(
    /(?:add|insert)\s+(?:a |an |the )?(.+?)\s+(?:after|behind)\s+(?:the )?(.+?)$/i,
  );
  if (after) {
    return {
      kind: "insert_after",
      node: strip(after[1]),
      after: strip(after[2]),
    };
  }

  const remove = p.match(
    /(?:remove|delete|drop|strip)\s+(?:the |a |an )?(.+?)$/i,
  );
  if (remove) return { kind: "remove", target: strip(remove[1]) };

  if (/(outage|take down|fail)/i.test(p)) {
    const on = p.match(/(?:on|of|in)\s+(?:the )?(.+?)$/i);
    return { kind: "outage", target: on ? strip(on[1]) : undefined };
  }

  return null;
}

function clone(state: CanvasState): CanvasState {
  return {
    nodes: state.nodes.map((n) => ({ ...n })),
    edges: state.edges.map((e) => ({ ...e })),
  };
}

export function removeNode(state: CanvasState, targetText: string): CanvasState {
  const next = clone(state);
  const target = findInGraph(next.nodes, targetText);
  if (!target) return next;

  const incoming = next.edges.filter((e) => e.target === target.id);
  const outgoing = next.edges.filter((e) => e.source === target.id);
  const rewired: GraphEdge[] = [];
  for (const inn of incoming) {
    for (const out of outgoing) {
      if (inn.source === out.target) continue;
      rewired.push({
        source: inn.source,
        target: out.target,
        label: out.label ?? inn.label,
      });
    }
  }

  return {
    nodes: next.nodes.filter((n) => n.id !== target.id),
    edges: [
      ...next.edges.filter(
        (e) => e.source !== target.id && e.target !== target.id,
      ),
      ...rewired,
    ],
  };
}

function resolveOrCreate(state: CanvasState, text: string): GraphNode {
  const existing = findInGraph(state.nodes, text);
  if (existing) return existing;
  const catalog = resolveComponent(text);
  if (catalog) return toNode(catalog);
  const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "node";
  return { id, label: text, type: "SERVICE" };
}

export function insertBefore(
  state: CanvasState,
  nodeText: string,
  beforeText: string,
): CanvasState {
  const next = clone(state);
  const anchor = findInGraph(next.nodes, beforeText);
  if (!anchor) return next;
  const node = resolveOrCreate(next, nodeText);
  if (!next.nodes.some((n) => n.id === node.id)) next.nodes.push(node);

  next.edges = next.edges.map((edge) =>
    edge.target === anchor.id ? { ...edge, target: node.id } : edge,
  );
  if (!next.edges.some((e) => e.source === node.id && e.target === anchor.id)) {
    next.edges.push({ source: node.id, target: anchor.id, label: "Next" });
  }
  return next;
}

export function insertAfter(
  state: CanvasState,
  nodeText: string,
  afterText: string,
): CanvasState {
  const next = clone(state);
  const anchor = findInGraph(next.nodes, afterText);
  if (!anchor) return next;
  const node = resolveOrCreate(next, nodeText);
  if (!next.nodes.some((n) => n.id === node.id)) next.nodes.push(node);

  next.edges = next.edges.map((edge) =>
    edge.source === anchor.id ? { ...edge, source: node.id } : edge,
  );
  if (!next.edges.some((e) => e.source === anchor.id && e.target === node.id)) {
    next.edges.push({ source: anchor.id, target: node.id, label: "Next" });
  }
  return next;
}

export function markOutage(state: CanvasState, targetText?: string): CanvasState {
  const next = clone(state);
  const target =
    (targetText && findInGraph(next.nodes, targetText)) ||
    next.nodes.find((n) => n.type === "SERVICE") ||
    next.nodes[0];
  if (!target) return next;
  return {
    ...next,
    nodes: next.nodes.map((n) =>
      n.id === target.id
        ? { ...n, label: `${n.label.replace(/ · OUTAGE$/, "")} · OUTAGE` }
        : n,
    ),
  };
}

export function applyMutation(
  state: CanvasState,
  mutation: Mutation,
): CanvasState {
  switch (mutation.kind) {
    case "remove":
      return removeNode(state, mutation.target);
    case "insert_before":
      return insertBefore(state, mutation.node, mutation.before);
    case "insert_after":
      return insertAfter(state, mutation.node, mutation.after);
    case "outage":
      return markOutage(state, mutation.target);
  }
}

const OPTIONAL_EXTRAS = ["cdn", "lb", "cache", "queue", "worker", "fraud", "obs", "object", "psp", "ledger"] as const;

export function applyMentionedExtras(
  state: CanvasState,
  prompt: string,
): CanvasState {
  let next = state;
  const p = prompt.toLowerCase();
  for (const id of OPTIONAL_EXTRAS) {
    const entry = resolveComponent(id);
    if (!entry) continue;
    if (!entry.aliases.some((alias) => p.includes(alias))) continue;
    if (next.nodes.some((n) => n.id === entry.id)) continue;

    if (id === "cdn" || id === "lb") {
      const before =
        findInGraph(next.nodes, "gateway") ??
        next.nodes.find((n) => n.type === "GATEWAY") ??
        next.nodes[1];
      if (before) next = insertBefore(next, id, before.id);
      continue;
    }
    if (id === "cache" || id === "fraud") {
      const before =
        findInGraph(next.nodes, id === "fraud" ? "payments" : "db") ??
        findInGraph(next.nodes, "db");
      if (before) next = insertBefore(next, id, before.id);
      continue;
    }
    const after =
      findInGraph(next.nodes, "app") ??
      findInGraph(next.nodes, "checkout") ??
      next.nodes.find((n) => n.type === "SERVICE");
    if (after) next = insertAfter(next, id, after.id);
  }
  return next;
}
