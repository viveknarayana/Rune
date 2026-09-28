import { insertBuffer, isBufferText } from "./buffers";
import { bestInGraph, findInGraph, resolveComponent, toNode } from "./catalog";
import {
  applyPattern,
  getPattern,
  isIamNode,
  isPublicHopNode,
  matchPattern,
  repairRequestGraph,
  type PatternId,
} from "./patterns";
import type { CanvasState, GraphNode } from "./types";

export type IntentId =
  | "INTENT_FASTER"
  | "INTENT_RELIABLE"
  | "INTENT_SECURE"
  | "INTENT_HIGH_WRITE"
  | "INTENT_ASYNC"
  | "INTENT_SEARCH";

export const INTENT_IDS: IntentId[] = [
  "INTENT_FASTER",
  "INTENT_RELIABLE",
  "INTENT_SECURE",
  "INTENT_HIGH_WRITE",
  "INTENT_ASYNC",
  "INTENT_SEARCH",
];

export function isIntentAction(action: string): action is IntentId {
  return INTENT_IDS.includes(action as IntentId);
}

export interface DesignIntent {
  id: IntentId;
  label: string;
  pattern?: PatternId;
  extras?: string[];
  triggers: RegExp[];
  jev: string;
}

export const INTENTS: DesignIntent[] = [
  {
    id: "INTENT_FASTER",
    label: "Make it faster",
    pattern: "PATTERN_READ_CACHE",
    triggers: [
      /make .{0,48}(fast|quicker|snapp(y|ier)|perform)/i,
      /(speed up|too slow|low latency|sub-?10ms|reduce latency)/i,
      /(optimize|improve) .{0,24}(speed|latency|reads?|performance)/i,
    ],
    jev: "User wants the system faster: lower latency or cheaper reads. Merge CDN, Redis, and read replicas. Do not wipe the graph.",
  },
  {
    id: "INTENT_RELIABLE",
    label: "Make it more reliable",
    pattern: "PATTERN_READ_CACHE",
    extras: ["sqs"],
    triggers: [
      /make .{0,48}(reliab|resilien|availab|robust|ha\b)/i,
      /(high availability|fault toleran|more durable|survive|redundan)/i,
    ],
    jev: "User wants reliability or HA. Keep existing nodes; add replicas and a queue buffer.",
  },
  {
    id: "INTENT_SECURE",
    label: "Make it more secure",
    extras: ["cloudfront", "iam", "waf"],
    triggers: [
      /make .{0,48}(secure|safer|harder to hack)/i,
      /(more secure|lock ?down|add (auth|iam|waf)|zero trust)/i,
    ],
    jev: "User wants tighter security. Add edge/WAF and IAM without removing existing boxes.",
  },
  {
    id: "INTENT_HIGH_WRITE",
    label: "Handle heavy writes",
    pattern: "PATTERN_EVENT_PIPELINE",
    triggers: [
      /(high|heavy|huge) .{0,16}(write|ingest|throughput|traffic spike)/i,
      /(ingest|clickstream|telemetry|too many writes)/i,
      /scale .{0,16}(writes?|ingest|events?)/i,
    ],
    jev: "User wants write/ingest scale. Merge the event pipeline (Kafka, stream processor, analytics store).",
  },
  {
    id: "INTENT_ASYNC",
    label: "Move work off the request",
    pattern: "PATTERN_ASYNC_WORKER",
    triggers: [
      /(background|async|long[- ]running|don't block|do not block)/i,
      /(video transcode|pdf|image gen|inference jobs?)/i,
    ],
    jev: "User wants work off the hot path. Merge the async worker pool and queue.",
  },
  {
    id: "INTENT_SEARCH",
    label: "Add search",
    pattern: "PATTERN_SEARCH_INDEXING",
    triggers: [
      /(full[- ]?text|autocomplete|catalog filter|search engine)/i,
      /make .{0,24}search/i,
      /add search/i,
    ],
    jev: "User wants search/indexing. Merge OpenSearch and a CDC path from the primary DB.",
  },
];

export function matchIntent(prompt: string): DesignIntent | undefined {
  const text = prompt.trim();
  if (!text) return undefined;
  return INTENTS.find((intent) => intent.triggers.some((trigger) => trigger.test(text)));
}

export function getIntent(id: string): DesignIntent | undefined {
  return INTENTS.find((intent) => intent.id === id);
}

function clone(state: CanvasState): CanvasState {
  return {
    nodes: state.nodes.map((node) => ({ ...node })),
    edges: state.edges.map((edge) => ({ ...edge })),
    groups: (state.groups ?? []).map((group) => ({
      ...group,
      memberIds: [...group.memberIds],
    })),
  };
}

function requestPathHook(
  nodes: GraphNode[],
  edges: { source: string; target: string }[],
  addedId: string,
  preferId?: string,
) {
  const usable = nodes.filter(
    (node) =>
      node.id !== addedId &&
      node.type !== "STORAGE" &&
      node.type !== "CACHE",
  );
  if (preferId && preferId !== "auto") {
    const preferred = nodes.find((node) => node.id === preferId || node.label === preferId);
    if (preferred && preferred.id !== addedId) {
      if (preferred.type !== "STORAGE" && preferred.type !== "CACHE") return preferred;
      const neighborId = edges.find(
        (edge) => edge.target === preferred.id || edge.source === preferred.id,
      );
      const neighbor = neighborId
        ? usable.find(
            (node) =>
              node.id === neighborId.source || node.id === neighborId.target,
          )
        : undefined;
      if (neighbor) return neighbor;
    }
  }
  return (
    usable.find((node) => node.type === "GATEWAY") ??
    usable.find((node) => node.type === "FRONTEND") ??
    usable.find((node) => node.type === "EDGE") ??
    usable.find((node) => node.type === "SERVICE") ??
    usable[0]
  );
}

function addExtra(state: CanvasState, name: string, preferId?: string): CanvasState {
  if (findInGraph(state.nodes, name) || bestInGraph(state.nodes, name)) return state;
  const next = clone(state);
  const catalog = resolveComponent(name);
  const node = catalog
    ? toNode(catalog)
    : {
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "node",
        label: name,
        type: "CUSTOM",
      };
  if (!next.nodes.some((item) => item.id === node.id)) next.nodes.push({ ...node });

  if (isBufferText(`${node.id} ${node.label} ${name}`)) {
    return insertBuffer(next, next.nodes.find((item) => item.id === node.id)!, preferId);
  }

  const already = (source: string, target: string) =>
    next.edges.some((edge) => edge.source === source && edge.target === target);

  if (isIamNode(node)) {
    const auth = next.nodes.find(
      (item) =>
        item.type === "SECURITY" &&
        item.id !== node.id &&
        !isIamNode(item) &&
        !isPublicHopNode(item),
    );
    if (auth && !already(auth.id, node.id)) {
      next.edges.push({ source: auth.id, target: node.id, label: "Policies" });
    }
    return next;
  }

  const isPublicEdge = isPublicHopNode(node);

  if (isPublicEdge) {
    const client = next.nodes.find(
      (item) => item.type === "FRONTEND" && item.id !== node.id,
    );
    if (client) {
      const outbound = next.edges.filter((edge) => edge.source === client.id);
      const hop =
        outbound[0]?.target ??
        next.nodes.find((item) => item.type === "GATEWAY" && item.id !== node.id)?.id;
      next.edges = next.edges.filter((edge) => edge.source !== client.id);
      if (!already(client.id, node.id)) {
        next.edges.push({ source: client.id, target: node.id, label: "HTTPS" });
      }
      const down = hop && hop !== node.id ? hop : undefined;
      if (down && !already(node.id, down)) {
        next.edges.push({
          source: node.id,
          target: down,
          label: node.type === "SECURITY" ? "Inspect" : "Edge",
        });
      }
      for (const edge of outbound) {
        if (edge.target === node.id || edge.target === down) continue;
        if (!already(node.id, edge.target)) {
          next.edges.push({
            source: node.id,
            target: edge.target,
            label: edge.label ?? "Edge",
          });
        }
      }
      return next;
    }
  }

  const hook = requestPathHook(next.nodes, next.edges, node.id, preferId);
  if (!hook) return next;

  if (!already(hook.id, node.id) && !already(node.id, hook.id)) {
    next.edges.push({
      source: hook.id,
      target: node.id,
      label: node.type === "SECURITY" ? "IAM" : "Link",
    });
  }
  return next;
}

export function applyIntent(
  current: CanvasState | undefined,
  intent: DesignIntent,
  anchor?: string,
): CanvasState {
  let state: CanvasState = current?.nodes.length
    ? clone(current)
    : { nodes: [], edges: [], groups: [] };

  if (intent.pattern) {
    const pattern = getPattern(intent.pattern);
    if (pattern) {
      state = applyPattern(state.nodes.length ? state : undefined, pattern, anchor);
    }
  }

  if (!state.nodes.length && !intent.pattern) {
    const mesh = getPattern("PATTERN_MICROSERVICE_MESH");
    if (mesh) state = applyPattern(undefined, mesh, anchor);
  }

  for (const extra of intent.extras ?? []) {
    state = addExtra(state, extra, anchor);
  }

  return repairRequestGraph(state);
}

export function parseHandleCase(prompt: string): string | undefined {
  const match = prompt.trim().match(
    /^(?:handle|cover|prepare for|what if|in case(?: of)?)\s+(?:the\s+)?(?:case|scenario|situation)?\s*(?:like|of|when|for|where|that)?\s*(.+)$/i,
  );
  const raw = match?.[1]?.trim();
  return raw || undefined;
}

export interface CaseRecipe {
  label: string;
  intent?: IntentId;
  pattern?: PatternId;
  extras?: string[];
}

export function resolveCase(text: string): CaseRecipe {
  const hay = text.trim();
  if (/black friday|cyber monday|flash sale|viral|super bowl|peak traffic|traffic spike|sold out/i.test(hay)) {
    return {
      label: "Peak traffic",
      intent: "INTENT_HIGH_WRITE",
      extras: ["cloudfront"],
    };
  }
  if (/fraud|chargeback|abuse|bot farm/i.test(hay)) {
    return { label: "Fraud / abuse", extras: ["waf", "iam"] };
  }
  if (/eu\b|gdpr|multi-?region|another region|europe/i.test(hay)) {
    return { label: "Multi-region", extras: ["cloudfront", "route53"] };
  }
  if (/upload|transcode|video|pdf|image gen|inference/i.test(hay)) {
    return { label: "Heavy jobs", intent: "INTENT_ASYNC" };
  }
  if (/ddos|breach|attack|hack/i.test(hay)) {
    return { label: "Attack", intent: "INTENT_SECURE" };
  }
  if (/outage|down|fail|timeout|partial/i.test(hay)) {
    return { label: "Failure", intent: "INTENT_RELIABLE" };
  }
  if (/search|typo|autocomplete/i.test(hay)) {
    return { label: "Search load", intent: "INTENT_SEARCH" };
  }
  const intent =
    matchIntent(hay) ??
    matchIntent(`handle ${hay}`) ??
    matchIntent(`make it ${hay}`);
  if (intent) return { label: intent.label, intent: intent.id };
  const pattern = matchPattern(hay);
  if (pattern) return { label: pattern.label, pattern: pattern.id };
  return { label: hay, intent: "INTENT_RELIABLE" };
}

export function applyCase(
  current: CanvasState | undefined,
  caseText: string,
  anchor?: string,
): CanvasState {
  const recipe = resolveCase(caseText);
  let state = current;
  if (recipe.intent) {
    const intent = getIntent(recipe.intent);
    if (intent) state = applyIntent(state, intent, anchor);
  } else if (recipe.pattern) {
    const pattern = getPattern(recipe.pattern);
    if (pattern) {
      state = applyPattern(
        state?.nodes.length ? state : undefined,
        pattern,
        anchor,
      );
    }
  }
  let next = state ?? { nodes: [], edges: [], groups: [] };
  if (!next.nodes.length && recipe.extras?.length) {
    const mesh = getPattern("PATTERN_MICROSERVICE_MESH");
    if (mesh) next = applyPattern(undefined, mesh, anchor);
  }
  for (const extra of recipe.extras ?? []) {
    next = addExtra(next, extra, anchor);
  }
  return repairRequestGraph(next);
}
