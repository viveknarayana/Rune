import { findInGraph, resolveComponent, toNode } from "./catalog";
import { resolveNamedColor } from "./colors";
import type { CanvasState, GraphEdge, GraphGroup, GraphNode } from "./types";

export type Mutation =
  | { kind: "remove"; target: string }
  | { kind: "insert_before"; node: string; before: string }
  | { kind: "insert_after"; node: string; after: string }
  | { kind: "add"; node: string }
  | { kind: "connect"; source: string; target: string; label?: string }
  | { kind: "group"; members: string[]; label: string }
  | { kind: "ungroup"; target: string }
  | { kind: "color"; target: string; color: string }
  | { kind: "outage"; target?: string };

function strip(text: string) {
  return text
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/^["“']+|["”']+$/g, "")
    .replace(/\s+component$/i, "")
    .trim();
}

function splitMembers(text: string): string[] {
  return text
    .split(/\s*(?:,| and )\s*/i)
    .map(strip)
    .filter(Boolean);
}

export function parseMutation(prompt: string): Mutation | null {
  const p = prompt.trim().replace(/[.!?]+$/, "");

  const before = p.match(
    /(?:add|insert)\s+(?:a |an |the )?(.+?)\s+(?:before|in front of)\s+(?:the )?(.+)$/i,
  );
  if (before) {
    return {
      kind: "insert_before",
      node: strip(before[1]),
      before: strip(before[2]),
    };
  }

  const after = p.match(
    /(?:add|insert)\s+(?:a |an |the )?(.+?)\s+(?:after|behind)\s+(?:the )?(.+)$/i,
  );
  if (after) {
    return {
      kind: "insert_after",
      node: strip(after[1]),
      after: strip(after[2]),
    };
  }

  const connectTo = p.match(
    /^(?:connect|link)\s+(?:it\s+|that\s+|this\s+)?(?:to|with)\s+(?:the )?(.+)$/i,
  );
  if (connectTo) {
    return { kind: "connect", source: "$last", target: strip(connectTo[1]) };
  }

  const connect =
    p.match(
      /(?:connect|link)\s+(?:the )?(.+?)\s+(?:to|and|with)\s+(?:the )?(.+?)(?:\s+(?:as|labeled|via)\s+(.+))?$/i,
    ) ??
    p.match(
      /(?:add )?(?:a )?connection(?: between)?\s+(?:the )?(.+?)\s+and\s+(?:the )?(.+)$/i,
    );
  if (connect) {
    return {
      kind: "connect",
      source: strip(connect[1]),
      target: strip(connect[2]),
      label: connect[3] ? strip(connect[3]) : undefined,
    };
  }

  const group =
    p.match(
      /^(?:square|box|frame)\s+(.+?)\s+(?:as|called|named)\s+(.+)$/i,
    ) ??
    p.match(/^(?:square|box|frame)\s+(.+)$/i) ??
    p.match(
      /(?:group|wrap|box|put)\s+(.+?)\s+(?:as|in|into|inside)\s+(?:a |an |the )?(.+)$/i,
    ) ??
    p.match(
      /(?:add )?(?:a )?(?:square|box|frame|region|vpc)\s+around\s+(.+?)(?:\s+(?:called|as|named)\s+(.+))?$/i,
    ) ??
    p.match(/^(?:group|wrap)\s+(.+)$/i);
  if (group) {
    const members = splitMembers(group[1]);
    return {
      kind: "group",
      members,
      label: strip(group[2] || members.join(" + ") || "Group"),
    };
  }

  const ungroup = p.match(/ungroup\s+(?:the )?(?:square |box |frame )?(.+)$/i);
  if (ungroup) return { kind: "ungroup", target: strip(ungroup[1]) };

  const color = p.match(
    /(?:color|paint|make|recolor)\s+(?:the )?(.+?)\s+(?:as |to )?([#a-zA-Z][\w-]*)$/i,
  );
  if (color) {
    const hex = resolveNamedColor(color[2]);
    if (hex) return { kind: "color", target: strip(color[1]), color: hex };
  }

  const remove = p.match(
    /(?:remove|delete|drop|strip)\s+(?:the |a |an )?(.+)$/i,
  );
  if (remove) return { kind: "remove", target: strip(remove[1]) };

  const addQuoted = p.match(
    /(?:add|insert)\s+["“](.+?)["”](?:\s+component)?$/i,
  );
  if (addQuoted) return { kind: "add", node: strip(addQuoted[1]) };

  const addBare = p.match(
    /(?:add|insert)\s+(?:a |an |the )?(.+?)(?:\s+component)?$/i,
  );
  if (addBare) return { kind: "add", node: strip(addBare[1]) };

  if (/(outage|take down|fail)/i.test(p)) {
    const on = p.match(/(?:on|of|in)\s+(?:the )?(.+)$/i);
    return { kind: "outage", target: on ? strip(on[1]) : undefined };
  }

  return null;
}

const NEXT_STEP =
  "(?:add|insert|connect|link|remove|delete|group|wrap|put|square|box|frame|color|paint|ungroup|then)";

const STEP_SPLIT = new RegExp(
  `;|\\n+|\\.\\s+(?=${NEXT_STEP})|\\s+then\\s+|\\s+and then\\s+|,\\s*and\\s+(?=${NEXT_STEP})|,\\s*(?=${NEXT_STEP})`,
  "i",
);

export function looksMultiStep(prompt: string): boolean {
  return STEP_SPLIT.test(prompt.trim());
}

export function parsePromptSteps(prompt: string): Mutation[] {
  const trimmed = prompt.trim();
  if (looksMultiStep(trimmed)) {
    return trimmed
      .split(STEP_SPLIT)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => parseMutation(part))
      .filter((step): step is Mutation => Boolean(step));
  }
  const single = parseMutation(trimmed);
  return single ? [single] : [];
}

function isPronoun(text: string) {
  return /^(it|that|this|them|they)$/i.test(text.trim());
}

function bindFocus(mutation: Mutation, focus?: string): Mutation {
  if (mutation.kind === "connect") {
    const source =
      mutation.source === "$last" || isPronoun(mutation.source)
        ? (focus ?? mutation.source)
        : mutation.source;
    const target = isPronoun(mutation.target)
      ? (focus ?? mutation.target)
      : mutation.target;
    return { ...mutation, source, target };
  }
  if (mutation.kind === "color" && isPronoun(mutation.target) && focus) {
    return { ...mutation, target: focus };
  }
  if (mutation.kind === "remove" && isPronoun(mutation.target) && focus) {
    return { ...mutation, target: focus };
  }
  return mutation;
}

export function describeStep(mutation: Mutation): string {
  switch (mutation.kind) {
    case "add":
      return `Add ${mutation.node}`;
    case "insert_before":
      return `Add ${mutation.node} before ${mutation.before}`;
    case "insert_after":
      return `Add ${mutation.node} after ${mutation.after}`;
    case "connect":
      return `Connect ${mutation.source} → ${mutation.target}`;
    case "remove":
      return `Remove ${mutation.target}`;
    case "group":
      return `Group ${mutation.members.join(", ")} as ${mutation.label}`;
    case "ungroup":
      return `Ungroup ${mutation.target}`;
    case "color":
      return `Color ${mutation.target}`;
    case "outage":
      return `Outage on ${mutation.target ?? "service"}`;
  }
}

export function applySteps(
  start: CanvasState,
  mutations: Mutation[],
): { state: CanvasState; steps: string[] } {
  let state = start;
  let focus: string | undefined;
  const steps: string[] = [];

  for (const raw of mutations) {
    const mutation = bindFocus(raw, focus);
    const before = new Set(state.nodes.map((n) => n.id));
    state = applyMutation(state, mutation);
    const added = state.nodes.find((n) => !before.has(n.id));
    if (added) focus = added.id;
    else if (mutation.kind === "connect") {
      focus =
        findInGraph(state.nodes, mutation.source)?.id ??
        findInGraph(state.nodes, mutation.target)?.id ??
        focus;
    }
    steps.push(describeStep(mutation));
  }

  return { state, steps };
}

export function emptyState(): CanvasState {
  return { nodes: [], edges: [], groups: [] };
}

function clone(state: CanvasState): CanvasState {
  return {
    nodes: state.nodes.map((n) => ({ ...n })),
    edges: state.edges.map((e) => ({ ...e })),
    groups: (state.groups ?? []).map((g) => ({
      ...g,
      memberIds: [...g.memberIds],
    })),
  };
}

export function removeNode(state: CanvasState, targetText: string): CanvasState {
  const next = clone(state);
  const target = findInGraph(next.nodes, targetText);
  if (!target) {
    return {
      ...next,
      groups: next.groups.filter(
        (g) => g.id !== targetText && g.label.toLowerCase() !== targetText.toLowerCase(),
      ),
    };
  }

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
    groups: next.groups
      .map((g) => ({
        ...g,
        memberIds: g.memberIds.filter((id) => id !== target.id),
      }))
      .filter((g) => g.memberIds.length > 0),
  };
}

function resolveOrCreate(state: CanvasState, text: string): GraphNode {
  const existing = findInGraph(state.nodes, text);
  if (existing) return existing;
  const catalog = resolveComponent(text);
  if (catalog) return toNode(catalog);
  const id =
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "node";
  const unique = state.nodes.some((n) => n.id === id)
    ? `${id}_${state.nodes.length}`
    : id;
  return { id: unique, label: text, type: "CUSTOM" };
}

export function insertBefore(
  state: CanvasState,
  nodeText: string,
  beforeText: string,
): CanvasState {
  const next = clone(state);
  const anchor = findInGraph(next.nodes, beforeText);
  if (!anchor) return addNode(next, nodeText);
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
  if (!anchor) return addNode(next, nodeText);
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

export function addNode(state: CanvasState, nodeText: string): CanvasState {
  const next = clone(state);
  const node = resolveOrCreate(next, nodeText);
  if (!next.nodes.some((n) => n.id === node.id)) next.nodes.push(node);
  return next;
}

export function connectNodes(
  state: CanvasState,
  sourceText: string,
  targetText: string,
  label?: string,
): CanvasState {
  const next = clone(state);
  const source = resolveOrCreate(next, sourceText);
  const target = resolveOrCreate(next, targetText);
  if (!next.nodes.some((n) => n.id === source.id)) next.nodes.push(source);
  if (!next.nodes.some((n) => n.id === target.id)) next.nodes.push(target);
  if (
    !next.edges.some((e) => e.source === source.id && e.target === target.id)
  ) {
    next.edges.push({
      source: source.id,
      target: target.id,
      label: label ?? "Link",
    });
  }
  return next;
}

export function groupNodes(
  state: CanvasState,
  memberTexts: string[],
  label: string,
): CanvasState {
  const next = clone(state);
  const memberIds = memberTexts
    .map((text) => findInGraph(next.nodes, text)?.id)
    .filter((id): id is string => Boolean(id));
  if (memberIds.length === 0) return next;
  const id = `group_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${next.groups.length}`;
  const group: GraphGroup = { id, label, memberIds };
  next.groups = [
    ...next.groups.filter((g) => g.label.toLowerCase() !== label.toLowerCase()),
    group,
  ];
  return next;
}

export function ungroup(state: CanvasState, target: string): CanvasState {
  const next = clone(state);
  const hay = target.toLowerCase();
  return {
    ...next,
    groups: next.groups.filter(
      (g) => g.label.toLowerCase() !== hay && g.id !== target,
    ),
  };
}

export function colorNode(
  state: CanvasState,
  targetText: string,
  color: string,
): CanvasState {
  const next = clone(state);
  const target = findInGraph(next.nodes, targetText);
  if (!target) {
    return {
      ...next,
      groups: next.groups.map((g) =>
        g.label.toLowerCase() === targetText.toLowerCase()
          ? { ...g, color }
          : g,
      ),
    };
  }
  return {
    ...next,
    nodes: next.nodes.map((n) => (n.id === target.id ? { ...n, color } : n)),
  };
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
    case "add":
      return addNode(state, mutation.node);
    case "connect":
      return connectNodes(state, mutation.source, mutation.target, mutation.label);
    case "group":
      return groupNodes(state, mutation.members, mutation.label);
    case "ungroup":
      return ungroup(state, mutation.target);
    case "color":
      return colorNode(state, mutation.target, mutation.color);
    case "outage":
      return markOutage(state, mutation.target);
  }
}

const OPTIONAL_EXTRAS = [
  "cdn",
  "lb",
  "cache",
  "queue",
  "worker",
  "fraud",
  "obs",
  "object",
  "psp",
  "ledger",
] as const;

export function applyMentionedExtras(
  state: CanvasState,
  prompt: string,
): CanvasState {
  let next = clone(state);
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
