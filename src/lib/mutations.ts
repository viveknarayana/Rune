import { bestInGraph, findInGraph, resolveComponent, toNode } from "./catalog";
import { resolveNamedColor } from "./colors";
import {
  applyCase,
  applyIntent,
  getIntent,
  matchIntent,
  parseHandleCase,
  resolveCase,
} from "./intents";
import { applyPattern, getPattern, matchPattern, resolvePattern } from "./patterns";
import type { CanvasState, GraphEdge, GraphGroup, GraphNode } from "./types";

export type Mutation =
  | { kind: "remove"; target: string }
  | { kind: "insert_before"; node: string; before: string }
  | { kind: "insert_after"; node: string; after: string }
  | { kind: "add"; node: string }
  | { kind: "attach"; node: string; target: string }
  | { kind: "connect"; source: string; target: string; label?: string }
  | { kind: "group"; members: string[]; label: string }
  | { kind: "ungroup"; target: string }
  | { kind: "color"; target: string; color: string }
  | { kind: "outage"; target?: string }
  | { kind: "apply_pattern"; pattern: string; anchor?: string }
  | { kind: "apply_intent"; intent: string; anchor?: string }
  | { kind: "apply_case"; case: string; anchor?: string };

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
    /(?:colou?r|paint|make|recolou?r)\s+(?:the )?(.+?)\s+(?:as |to )?([#a-zA-Z][\w-]*)$/i,
  );
  if (color) {
    const hex = resolveNamedColor(color[2]);
    if (hex) return { kind: "color", target: strip(color[1]), color: hex };
  }

  const remove = p.match(
    /(?:remove|delete|drop|strip)\s+(?:the |a |an )?(.+)$/i,
  );
  if (remove) return { kind: "remove", target: strip(remove[1]) };

  const applyPat = p.match(
    /^(?:apply|use)\s+(?:the\s+)?(.+?)(?:\s+pattern)?$/i,
  );
  if (applyPat) {
    const hit = resolvePattern(applyPat[1]);
    if (hit) return { kind: "apply_pattern", pattern: hit.id };
  }

  const attach = p.match(
    /^(?:add|insert|put|hook|wire)\s+(?:a |an |the )?(.+?)\s+(?:to|onto|into|on|into the)\s+(?:the |a |an )?(.+)$/i,
  );
  if (attach) {
    const node = strip(attach[1]);
    const target = strip(attach[2]);
    if (node && target && !/^(graph|board|diagram|canvas)$/i.test(target)) {
      return { kind: "attach", node, target };
    }
  }

  const addQuoted = p.match(
    /(?:add|insert)\s+["“](.+?)["”](?:\s+component)?$/i,
  );
  if (addQuoted) return { kind: "add", node: strip(addQuoted[1]) };

  const addBare = p.match(
    /(?:add|insert)\s+(?:a |an |the )?(.+?)(?:\s+component)?$/i,
  );
  if (addBare) {
    const hit = matchPattern(addBare[1], "named");
    if (hit) return { kind: "apply_pattern", pattern: hit.id };
    return { kind: "add", node: strip(addBare[1]) };
  }

  const whole = matchPattern(p);
  if (whole && p.split(/\s+/).length >= 2) {
    return { kind: "apply_pattern", pattern: whole.id };
  }

  const handleCase = parseHandleCase(p);
  if (handleCase) return { kind: "apply_case", case: handleCase };

  if (/(outage|take down|fail)/i.test(p)) {
    const on = p.match(/(?:on|of|in)\s+(?:the )?(.+)$/i);
    return { kind: "outage", target: on ? strip(on[1]) : undefined };
  }

  const intent = matchIntent(p);
  if (intent) return { kind: "apply_intent", intent: intent.id };

  return null;
}

const NEXT_STEP =
  "(?:add|insert|connect|link|remove|delete|group|wrap|put|square|box|frame|color|paint|ungroup|apply|use|then)";

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
  if (mutation.kind === "attach" && focus) {
    return {
      ...mutation,
      node: isPronoun(mutation.node) ? focus : mutation.node,
      target: isPronoun(mutation.target) ? focus : mutation.target,
    };
  }
  return mutation;
}

export function describeStep(mutation: Mutation): string {
  switch (mutation.kind) {
    case "add":
      return `Add ${mutation.node}`;
    case "attach":
      return `Add ${mutation.node} → ${mutation.target}`;
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
    case "apply_pattern":
      return `Apply ${getPattern(mutation.pattern)?.label ?? mutation.pattern}`;
    case "apply_intent":
      return getIntent(mutation.intent)?.label ?? mutation.intent;
    case "apply_case":
      return `Handle ${resolveCase(mutation.case).label}`;
  }
}

export function applySteps(
  start: CanvasState,
  mutations: Mutation[],
  initialFocus?: string,
): { state: CanvasState; steps: string[] } {
  let state = start;
  let focus: string | undefined = initialFocus;
  const steps: string[] = [];

  for (const raw of mutations) {
    const mutation = bindFocus(raw, focus);
    const before = new Set(state.nodes.map((n) => n.id));
    state =
      mutation.kind === "add"
        ? addNode(state, mutation.node, focus)
        : applyMutation(state, mutation);
    const added = state.nodes.find((n) => !before.has(n.id));
    if (added) focus = added.id;
    else if (mutation.kind === "attach") {
      focus = findInGraph(state.nodes, mutation.node)?.id ?? focus;
    }
    else if (mutation.kind === "connect") {
      focus =
        findInGraph(state.nodes, mutation.source)?.id ??
        findInGraph(state.nodes, mutation.target)?.id ??
        focus;
    }
    if (mutation.kind === "add" && added) {
      const wired = state.edges.find(
        (edge) => edge.source === added.id || edge.target === added.id,
      );
      const otherId =
        wired && (wired.source === added.id ? wired.target : wired.source);
      const other = otherId
        ? state.nodes.find((node) => node.id === otherId)
        : undefined;
      steps.push(
        other ? `Add ${added.label} → ${other.label}` : describeStep(mutation),
      );
    } else {
      steps.push(describeStep(mutation));
    }
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

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "node";
}

function uniqueId(state: CanvasState, base: string): string {
  let index = 2;
  let id = `${base}_${index}`;
  while (state.nodes.some((node) => node.id === id)) {
    index += 1;
    id = `${base}_${index}`;
  }
  return id;
}

function nextCopyLabel(label: string, nodes: GraphNode[]): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const numbered = new RegExp(`^${escaped}(?: (\\d+))?$`, "i");
  let max = 1;
  for (const node of nodes) {
    const match = node.label.match(numbered);
    if (match) max = Math.max(max, match[1] ? Number(match[1]) : 1);
  }
  return `${label} ${max + 1}`;
}

function createFresh(state: CanvasState, text: string): GraphNode {
  const catalog = resolveComponent(text);
  const base = catalog
    ? toNode(catalog)
    : { id: slug(text), label: text, type: "CUSTOM" };
  if (!state.nodes.some((node) => node.id === base.id)) return base;
  return {
    ...base,
    id: uniqueId(state, base.id),
    label: nextCopyLabel(base.label, state.nodes),
  };
}

function resolveOrCreate(state: CanvasState, text: string): GraphNode {
  const existing = findInGraph(state.nodes, text);
  if (existing) return existing;
  return createFresh(state, text);
}

export function insertBefore(
  state: CanvasState,
  nodeText: string,
  beforeText: string,
): CanvasState {
  const next = clone(state);
  const anchor = findInGraph(next.nodes, beforeText);
  if (!anchor) return addNode(next, nodeText);
  const node = createFresh(next, nodeText);
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
  const node = createFresh(next, nodeText);
  if (!next.nodes.some((n) => n.id === node.id)) next.nodes.push(node);

  next.edges = next.edges.map((edge) =>
    edge.source === anchor.id ? { ...edge, source: node.id } : edge,
  );
  if (!next.edges.some((e) => e.source === anchor.id && e.target === node.id)) {
    next.edges.push({ source: anchor.id, target: node.id, label: "Next" });
  }
  return next;
}

const FLOWS: Record<string, string[]> = {
  FRONTEND: ["EDGE", "GATEWAY", "SERVICE"],
  EDGE: ["GATEWAY", "SERVICE"],
  GATEWAY: ["SECURITY", "SERVICE", "CACHE"],
  SECURITY: ["GATEWAY", "SERVICE"],
  SERVICE: ["CACHE", "STORAGE", "TELEMETRY", "SERVICE", "GATEWAY"],
  CACHE: ["STORAGE", "SERVICE"],
  STORAGE: ["SERVICE"],
  TELEMETRY: ["SERVICE", "STORAGE"],
  CUSTOM: ["SERVICE", "GATEWAY", "STORAGE", "TELEMETRY"],
};

function wireLabel(sourceType: string, targetType: string): string {
  if (targetType === "STORAGE") return "Write";
  if (targetType === "CACHE") return "Cache";
  if (targetType === "SECURITY") return "Verify";
  if (targetType === "TELEMETRY") return "Emit";
  if (sourceType === "FRONTEND" || sourceType === "EDGE") return "HTTPS";
  return "Link";
}

function pickWirePartner(
  nodes: GraphNode[],
  added: GraphNode,
  preferId?: string,
): GraphNode | undefined {
  if (preferId) {
    const preferred = nodes.find((node) => node.id === preferId && node.id !== added.id);
    if (preferred) return preferred;
  }
  let best: GraphNode | undefined;
  let score = 0;
  for (const node of nodes) {
    if (node.id === added.id) continue;
    let next = 1;
    if (FLOWS[added.type]?.includes(node.type)) next += 6;
    if (FLOWS[node.type]?.includes(added.type)) next += 5;
    if (node.type === "SERVICE" || node.type === "GATEWAY") next += 1;
    if (next > score) {
      score = next;
      best = node;
    }
  }
  return best;
}

function autoWire(
  state: CanvasState,
  added: GraphNode,
  preferId?: string,
): CanvasState {
  if (state.nodes.length < 2) return state;
  const partner = pickWirePartner(state.nodes, added, preferId);
  if (!partner) return state;
  const addedFlowsToPartner = FLOWS[added.type]?.includes(partner.type);
  const partnerFlowsToAdded = FLOWS[partner.type]?.includes(added.type);
  let source = partner;
  let target = added;
  if (
    addedFlowsToPartner &&
    !partnerFlowsToAdded &&
    !["STORAGE", "CACHE", "TELEMETRY"].includes(added.type)
  ) {
    source = added;
    target = partner;
  } else if (added.type === "FRONTEND" || added.type === "EDGE") {
    source = added;
    target = partner;
  }
  if (
    state.edges.some(
      (edge) => edge.source === source.id && edge.target === target.id,
    )
  ) {
    return state;
  }
  return {
    ...state,
    edges: [
      ...state.edges,
      {
        source: source.id,
        target: target.id,
        label: wireLabel(source.type, target.type),
      },
    ],
  };
}

export function addNode(
  state: CanvasState,
  nodeText: string,
  preferId?: string,
): CanvasState {
  const next = clone(state);
  const node = createFresh(next, nodeText);
  if (!next.nodes.some((item) => item.id === node.id)) next.nodes.push(node);
  return autoWire(next, node, preferId);
}

export function attachNode(
  state: CanvasState,
  nodeText: string,
  targetText: string,
): CanvasState {
  const next = clone(state);
  const node = bestInGraph(next.nodes, nodeText) ?? createFresh(next, nodeText);
  if (!next.nodes.some((item) => item.id === node.id)) next.nodes.push(node);
  const target =
    bestInGraph(next.nodes, targetText) ?? createFresh(next, targetText);
  if (!next.nodes.some((item) => item.id === target.id)) next.nodes.push(target);
  if (
    !next.edges.some((edge) => edge.source === node.id && edge.target === target.id)
  ) {
    next.edges.push({ source: node.id, target: target.id, label: "Link" });
  }
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
    case "attach":
      return attachNode(state, mutation.node, mutation.target);
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
    case "apply_pattern": {
      const pattern = getPattern(mutation.pattern);
      return pattern ? applyPattern(state, pattern, mutation.anchor) : state;
    }
    case "apply_intent": {
      const intent = getIntent(mutation.intent);
      return intent ? applyIntent(state, intent, mutation.anchor) : state;
    }
    case "apply_case":
      return applyCase(state, mutation.case, mutation.anchor);
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
