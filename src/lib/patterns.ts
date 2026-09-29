import { findInGraph } from "./catalog";
import { insertBuffer, pickWriteBundle } from "./buffers";
import { resolveAwsService } from "./aws-catalog";
import type {
  CanvasState,
  GraphEdge,
  GraphGroup,
  GraphNode,
  TopologyAction,
} from "./types";

export type PatternId =
  | "PATTERN_EVENT_PIPELINE"
  | "PATTERN_READ_CACHE"
  | "PATTERN_ASYNC_WORKER"
  | "PATTERN_MICROSERVICE_MESH"
  | "PATTERN_CQRS_FINTECH"
  | "PATTERN_SEARCH_INDEXING";

export const PATTERN_IDS: PatternId[] = [
  "PATTERN_EVENT_PIPELINE",
  "PATTERN_READ_CACHE",
  "PATTERN_ASYNC_WORKER",
  "PATTERN_MICROSERVICE_MESH",
  "PATTERN_CQRS_FINTECH",
  "PATTERN_SEARCH_INDEXING",
];

export function isPatternAction(action: string): action is PatternId {
  return PATTERN_IDS.includes(action as PatternId);
}

export type ApplyMode = "merge" | "inject" | "overlay" | "split" | "bridge";

export interface PatternApplyOptions {
  anchor?: string;
  anchorTo?: string;
  mode?: ApplyMode;
}

export interface DesignPattern {
  id: PatternId;
  label: string;
  short: string;
  triggers: string[];
  roles: Record<string, string>;
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
  inject?: { extras: string[] };
  overlay?: { insert: string[]; replica?: string };
  split?: { write: string[]; read: string[] };
  bridge?: { extras: string[]; intake: string; via?: string };
}

function icon(...names: string[]): string | undefined {
  for (const name of names) {
    const hit = resolveAwsService(name);
    if (hit?.icon) return hit.icon;
  }
  return undefined;
}

function n(
  id: string,
  label: string,
  type: GraphNode["type"],
  ...icons: string[]
): GraphNode {
  return { id, label, type, icon: icon(...icons) };
}

export const PATTERNS: DesignPattern[] = [
  {
    id: "PATTERN_EVENT_PIPELINE",
    label: "Write-Heavy Event Pipeline",
    short: "Events",
    triggers: [
      "real-time analytics",
      "clickstream",
      "high throughput",
      "telemetry",
      "log ingestion",
      "event pipeline",
      "kafka",
      "kinesis",
      "flink",
      "clickhouse",
    ],
    roles: {
      gateway: "ingest_gw",
      queue: "kafka",
    },
    nodes: [
      n("ingest_gw", "Ingestion API Gateway", "GATEWAY", "api gateway"),
      n("kafka", "Apache Kafka / Kinesis", "TELEMETRY", "kinesis", "msk"),
      n("flink", "Stream Processor", "SERVICE", "emr", "lambda"),
      n("clickhouse", "ClickHouse / TimescaleDB", "STORAGE", "redshift", "rds"),
    ],
    edges: [
      { source: "ingest_gw", target: "kafka", label: "Produce" },
      { source: "kafka", target: "flink", label: "Consume" },
      { source: "flink", target: "clickhouse", label: "Sink" },
    ],
    groups: [
      {
        id: "evt_pipe",
        label: "Stream Processor",
        memberIds: ["kafka", "flink", "clickhouse"],
      },
    ],
    inject: { extras: ["kafka", "flink", "clickhouse"] },
    overlay: { insert: ["kafka"] },
  },
  {
    id: "PATTERN_READ_CACHE",
    label: "High-Read Caching",
    short: "Cache",
    triggers: [
      "high-traffic api",
      "high traffic",
      "user profile",
      "product catalog",
      "sub-10ms",
      "read latency",
      "caching",
      "cache hit",
      "high-read caching",
      "redis",
      "memcached",
    ],
    roles: {
      edge: "cdn",
      gateway: "cache_gw",
      app: "cache_app",
      cache: "redis",
      db: "pg_primary",
      replica: "pg_replica",
    },
    nodes: [
      n("cdn", "CDN / Edge", "EDGE", "cloudfront"),
      n("cache_gw", "API Gateway", "GATEWAY", "api gateway"),
      n("cache_app", "App Services", "SERVICE", "ecs"),
      n("redis", "Redis / Memcached", "CACHE", "elasticache"),
      n("pg_primary", "PostgreSQL Primary", "STORAGE", "rds", "aurora"),
      n("pg_replica", "Read Replicas", "STORAGE", "rds", "aurora"),
    ],
    edges: [
      { source: "cdn", target: "cache_gw", label: "HTTPS" },
      { source: "cache_gw", target: "cache_app", label: "Route" },
      { source: "cache_app", target: "redis", label: "Cache Hit" },
      { source: "cache_app", target: "pg_replica", label: "Cache Miss" },
      { source: "pg_primary", target: "pg_replica", label: "Replicate" },
    ],
    groups: [],
    overlay: { insert: ["redis"], replica: "pg_replica" },
    inject: { extras: ["redis", "pg_replica", "cdn"] },
  },
  {
    id: "PATTERN_ASYNC_WORKER",
    label: "Async Job Processing",
    short: "Workers",
    triggers: [
      "background task",
      "ai image",
      "image generation",
      "pdf generator",
      "video transcode",
      "video encoding",
      "long-running",
      "async worker",
      "asynchronous job",
      "job worker",
      "job queue",
      "inference",
    ],
    roles: {
      client: "job_client",
      gateway: "job_gw",
      app: "producer",
      queue: "job_queue",
    },
    nodes: [
      n("job_client", "Client", "FRONTEND", "amplify"),
      n("job_gw", "API Gateway", "GATEWAY", "api gateway"),
      n("producer", "Task Producer", "SERVICE", "lambda"),
      n("job_queue", "Message Queue", "TELEMETRY", "sqs"),
      n("worker_a", "Worker A", "SERVICE", "ecs"),
      n("worker_b", "Worker B", "SERVICE", "ecs"),
      n("worker_c", "Worker C", "SERVICE", "ecs"),
      n("job_s3", "Object Storage", "STORAGE", "s3"),
      n("webhook", "Webhook Notifier", "TELEMETRY", "sns", "ses"),
    ],
    edges: [
      { source: "job_client", target: "job_gw", label: "Submit" },
      { source: "job_gw", target: "producer", label: "Enqueue" },
      { source: "producer", target: "job_queue", label: "Publish" },
      { source: "job_queue", target: "worker_a", label: "Fan-out" },
      { source: "job_queue", target: "worker_b", label: "Fan-out" },
      { source: "job_queue", target: "worker_c", label: "Fan-out" },
      { source: "worker_a", target: "job_s3", label: "Write" },
      { source: "worker_b", target: "job_s3", label: "Write" },
      { source: "worker_c", target: "job_s3", label: "Write" },
      { source: "worker_a", target: "webhook", label: "Notify" },
      { source: "worker_b", target: "webhook", label: "Notify" },
      { source: "worker_c", target: "webhook", label: "Notify" },
    ],
    groups: [
      {
        id: "worker_pool",
        label: "Worker Pool",
        memberIds: ["worker_a", "worker_b", "worker_c"],
      },
    ],
    inject: {
      extras: ["job_queue", "worker_a", "worker_b", "worker_c", "job_s3", "webhook"],
    },
  },
  {
    id: "PATTERN_MICROSERVICE_MESH",
    label: "API Gateway & Service Mesh",
    short: "Mesh",
    triggers: [
      "e-commerce checkout",
      "banking app",
      "microservice",
      "service mesh",
      "distributed system",
      "enterprise",
      "kong",
      "envoy",
    ],
    roles: {
      client: "mesh_client",
      gateway: "mesh_gw",
      auth: "auth_svc",
    },
    nodes: [
      n("mesh_client", "Client", "FRONTEND", "amplify"),
      n("mesh_gw", "API Gateway", "GATEWAY", "api gateway"),
      n("auth_svc", "Auth Service", "SECURITY", "cognito", "iam"),
      n("order_svc", "Order Service", "SERVICE", "ecs"),
      n("pay_svc", "Payment Service", "SERVICE", "ecs"),
      n("auth_db", "Auth DB", "STORAGE", "rds"),
      n("order_db", "Order DB", "STORAGE", "rds"),
      n("pay_db", "Payment DB", "STORAGE", "rds"),
    ],
    edges: [
      { source: "mesh_client", target: "mesh_gw", label: "HTTPS" },
      { source: "mesh_gw", target: "auth_svc", label: "Verify" },
      { source: "mesh_gw", target: "order_svc", label: "/orders" },
      { source: "mesh_gw", target: "pay_svc", label: "/pay" },
      { source: "auth_svc", target: "auth_db", label: "OLTP" },
      { source: "order_svc", target: "order_db", label: "OLTP" },
      { source: "pay_svc", target: "pay_db", label: "OLTP" },
    ],
    groups: [],
  },
  {
    id: "PATTERN_CQRS_FINTECH",
    label: "CQRS & Event Sourcing",
    short: "CQRS",
    triggers: [
      "fintech",
      "ledger",
      "banking transaction",
      "immutable",
      "audit log",
      "audit trail",
      "cqrs",
      "event sourcing",
    ],
    roles: {
      client: "cqrs_client",
      gateway: "command_api",
    },
    nodes: [
      n("cqrs_client", "Client", "FRONTEND", "amplify"),
      n("command_api", "Command API", "GATEWAY", "api gateway"),
      n("event_store", "Event Store", "STORAGE", "dynamodb"),
      n("event_bus", "Event Bus", "TELEMETRY", "eventbridge", "sns"),
      n("read_db", "Read DB", "STORAGE", "opensearch", "documentdb"),
      n("query_api", "Query API", "GATEWAY", "api gateway"),
    ],
    edges: [
      { source: "cqrs_client", target: "command_api", label: "Command" },
      { source: "command_api", target: "event_store", label: "Append" },
      { source: "event_store", target: "event_bus", label: "Publish" },
      { source: "event_bus", target: "read_db", label: "Project" },
      { source: "cqrs_client", target: "query_api", label: "Query" },
      { source: "query_api", target: "read_db", label: "Read" },
    ],
    groups: [
      {
        id: "write_path",
        label: "Write Path",
        memberIds: ["command_api", "event_store"],
      },
      {
        id: "read_cqrs",
        label: "Read Path",
        memberIds: ["query_api", "read_db"],
      },
    ],
    split: {
      write: ["event_store", "event_bus"],
      read: ["query_api", "read_db"],
    },
    inject: { extras: ["event_store", "event_bus", "query_api", "read_db"] },
  },
  {
    id: "PATTERN_SEARCH_INDEXING",
    label: "Search & Indexing",
    short: "Search",
    triggers: [
      "search engine",
      "catalog filter",
      "autocomplete",
      "full-text",
      "opensearch",
      "elasticsearch",
      "indexing",
      "debezium",
      "cdc",
    ],
    roles: {
      client: "search_client",
      gateway: "search_gw",
      app: "search_svc",
      db: "search_primary",
      search: "opensearch",
    },
    nodes: [
      n("search_client", "Client", "FRONTEND", "amplify"),
      n("search_gw", "API Gateway", "GATEWAY", "api gateway"),
      n("search_svc", "Search Service", "SERVICE", "ecs"),
      n("opensearch", "OpenSearch Cluster", "STORAGE", "opensearch"),
      n("search_primary", "Primary DB", "STORAGE", "rds"),
      n("debezium", "CDC Sync", "TELEMETRY", "dms", "kinesis"),
    ],
    edges: [
      { source: "search_client", target: "search_gw", label: "Query" },
      { source: "search_gw", target: "search_svc", label: "Route" },
      { source: "search_svc", target: "opensearch", label: "Search" },
      { source: "search_primary", target: "debezium", label: "CDC" },
      { source: "debezium", target: "opensearch", label: "Index" },
    ],
    groups: [
      {
        id: "cdc_loop",
        label: "CDC Loop",
        memberIds: ["search_primary", "debezium", "opensearch"],
      },
    ],
    bridge: {
      extras: ["search_svc", "opensearch", "debezium"],
      intake: "opensearch",
      via: "debezium",
    },
    inject: { extras: ["search_svc", "opensearch", "debezium"] },
  },
];

const BY_ID = new Map(PATTERNS.map((pattern) => [pattern.id, pattern]));

export function getPattern(id: string): DesignPattern | undefined {
  return BY_ID.get(id as PatternId);
}

export function resolvePattern(
  text: string,
  mode: "loose" | "named" = "loose",
): DesignPattern | undefined {
  const hay = text.trim();
  if (!hay) return undefined;
  const compact = hay.replace(/\s+/g, "_").toUpperCase();
  const direct =
    getPattern(hay) ??
    getPattern(compact) ??
    getPattern(`PATTERN_${compact.replace(/^PATTERN_/, "")}`);
  if (direct) return direct;
  const named = PATTERNS.find(
    (pattern) =>
      pattern.short.toLowerCase() === hay.toLowerCase() ||
      pattern.label.toLowerCase() === hay.toLowerCase(),
  );
  if (named) return named;
  return matchPattern(hay, mode);
}

export function matchPattern(
  text: string,
  mode: "loose" | "named" = "loose",
): DesignPattern | undefined {
  const hay = text.toLowerCase().trim();
  if (!hay) return undefined;
  let best: DesignPattern | undefined;
  let score = 0;
  for (const pattern of PATTERNS) {
    let hits = 0;
    for (const trigger of pattern.triggers) {
      if (!hay.includes(trigger)) continue;
      const named =
        trigger.includes(" ") ||
        /cqrs|caching|pipeline|mesh|indexing|architecture/.test(trigger);
      if (mode === "named" && !named) continue;
      hits += trigger.includes(" ") ? 2 : 1;
    }
    if (hay.includes(pattern.short.toLowerCase())) hits += 2;
    if (hay.includes(pattern.label.toLowerCase())) hits += 3;
    if (hits > score) {
      score = hits;
      best = pattern;
    }
  }
  return score > 0 ? best : undefined;
}

function uniqueId(state: CanvasState, base: string): string {
  if (!state.nodes.some((node) => node.id === base) &&
      !state.groups.some((group) => group.id === base)) {
    return base;
  }
  let index = 2;
  let id = `${base}_${index}`;
  while (
    state.nodes.some((node) => node.id === id) ||
    state.groups.some((group) => group.id === id)
  ) {
    index += 1;
    id = `${base}_${index}`;
  }
  return id;
}

function cloneState(state: CanvasState): CanvasState {
  return {
    nodes: state.nodes.map((node) => ({ ...node })),
    edges: state.edges.map((edge) => ({ ...edge })),
    groups: (state.groups ?? []).map((group) => ({
      ...group,
      memberIds: [...group.memberIds],
    })),
  };
}

const ROLE_TYPES: Record<string, string[]> = {
  client: ["FRONTEND"],
  edge: ["EDGE"],
  gateway: ["GATEWAY"],
  cache: ["CACHE"],
  queue: ["TELEMETRY"],
  auth: ["SECURITY"],
  app: ["SERVICE"],
  replica: ["STORAGE"],
  search: ["STORAGE", "SERVICE"],
  db: ["STORAGE"],
};

const ROLE_HINTS: Record<string, string[]> = {
  client: ["client", "web", "mobile", "frontend"],
  edge: ["cdn", "edge", "cloudfront"],
  gateway: ["gateway", "gw", "ingress", "kong", "envoy"],
  cache: ["cache", "redis", "memcached"],
  queue: ["queue", "kafka", "kinesis", "sqs", "bus"],
  auth: ["auth", "identity", "iam", "cognito"],
  app: ["app", "service", "producer", "worker"],
  replica: ["replica", "read"],
  search: ["search", "elastic", "opensearch"],
  db: ["database", "postgres", "primary", "db"],
};

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "svc",
  "a",
  "an",
  "of",
  "to",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP.has(token));
}

function tokenOverlap(left: string, right: string): number {
  const have = new Set(tokens(left));
  return tokens(right).filter((token) => have.has(token)).length;
}

function scoreRoleFit(node: GraphNode, role: string, sample?: GraphNode): number {
  let score = 0;
  if ((ROLE_TYPES[role] ?? []).includes(node.type)) score += 4;
  if (ROLE_HINTS[role]?.some((hint) => node.label.toLowerCase().includes(hint))) {
    score += 5;
  }
  if (sample) {
    if (node.id.toLowerCase() === sample.id.toLowerCase()) score += 10;
    if (node.label.toLowerCase() === sample.label.toLowerCase()) score += 12;
    score += tokenOverlap(`${node.label} ${node.id}`, `${sample.label} ${role}`) * 3;
  }
  if (node.type === "CUSTOM" && score > 0) score += 1;
  return score;
}

function findRole(
  nodes: GraphNode[],
  role: string,
  sample: GraphNode | undefined,
  taken: Set<string>,
): GraphNode | undefined {
  let best: GraphNode | undefined;
  let bestScore = 4;
  for (const node of nodes) {
    if (taken.has(node.id)) continue;
    const score = scoreRoleFit(node, role, sample);
    if (score > bestScore) {
      best = node;
      bestScore = score;
    }
  }
  return best;
}

function applyMerge(
  current: CanvasState | undefined,
  pattern: DesignPattern,
  anchor?: string,
): CanvasState {
  if (!current?.nodes.length) {
    const stamped: CanvasState = {
      nodes: pattern.nodes.map((node) => ({ ...node })),
      edges: pattern.edges.map((edge) => ({ ...edge })),
      groups: [],
    };
    return adoptPatternGroups(
      stamped,
      pattern,
      new Map(pattern.nodes.map((node) => [node.id, node.id])),
    );
  }

  const next = cloneState(current);
  const idMap = new Map<string, string>();
  const added: string[] = [];
  const taken = new Set<string>();
  const originalIds = new Set(current.nodes.map((node) => node.id));

  if (anchor && anchor !== "auto") {
    const existing = findInGraph(next.nodes, anchor);
    const bind =
      pattern.roles.gateway ??
      pattern.roles.app ??
      pattern.roles.client ??
      pattern.nodes[0]?.id;
    if (existing && bind) {
      idMap.set(bind, existing.id);
      taken.add(existing.id);
    }
  }

  const roleOrder = Object.entries(pattern.roles).sort((left, right) => {
    const sampleL = pattern.nodes.find((node) => node.id === left[1]);
    const sampleR = pattern.nodes.find((node) => node.id === right[1]);
    const bestL = Math.max(
      0,
      ...next.nodes.map((node) =>
        taken.has(node.id) ? 0 : scoreRoleFit(node, left[0], sampleL),
      ),
    );
    const bestR = Math.max(
      0,
      ...next.nodes.map((node) =>
        taken.has(node.id) ? 0 : scoreRoleFit(node, right[0], sampleR),
      ),
    );
    return bestR - bestL;
  });

  for (const [role, patternId] of roleOrder) {
    if (idMap.has(patternId)) continue;
    const sample = pattern.nodes.find((node) => node.id === patternId);
    const hit = findRole(next.nodes, role, sample, taken);
    if (hit) {
      idMap.set(patternId, hit.id);
      taken.add(hit.id);
    }
  }

  for (const node of pattern.nodes) {
    if (idMap.has(node.id)) continue;
    const existing =
      findInGraph(next.nodes, node.label) ?? findInGraph(next.nodes, node.id);
    if (existing && !taken.has(existing.id)) {
      idMap.set(node.id, existing.id);
      taken.add(existing.id);
      continue;
    }
    const { x: _x, y: _y, ...rest } = node;
    const freshId = uniqueId(next, rest.id);
    next.nodes.push({ ...rest, id: freshId });
    idMap.set(node.id, freshId);
    added.push(freshId);
  }

  for (const edge of pattern.edges) {
    const source = idMap.get(edge.source);
    const target = idMap.get(edge.target);
    if (!source || !target) continue;
    if (next.edges.some((item) => item.source === source && item.target === target)) {
      continue;
    }
    next.edges.push({ source, target, label: edge.label });
  }

  const reused = [...idMap.values()].filter((id) => originalIds.has(id));
  const entryId = idMap.get(
    pattern.roles.gateway ??
      pattern.roles.app ??
      pattern.roles.client ??
      pattern.nodes[0]?.id ??
      "",
  );
  const linked = next.edges.some(
    (edge) =>
      (originalIds.has(edge.source) && added.includes(edge.target)) ||
      (added.includes(edge.source) && originalIds.has(edge.target)) ||
      reused.includes(edge.source) ||
      reused.includes(edge.target),
  );
  if (added.length && entryId && !linked) {
    let hook: GraphNode | undefined;
    if (anchor && anchor !== "auto") hook = findInGraph(next.nodes, anchor);
    if (!hook) {
      hook = next.nodes
        .filter((node) => originalIds.has(node.id))
        .sort(
          (left, right) =>
            scoreRoleFit(
              right,
              "app",
              pattern.nodes.find((node) => node.id === (pattern.roles.gateway ?? pattern.nodes[0]?.id)),
            ) -
            scoreRoleFit(
              left,
              "app",
              pattern.nodes.find((node) => node.id === (pattern.roles.gateway ?? pattern.nodes[0]?.id)),
            ),
        )[0];
    }
    if (hook && hook.id !== entryId) {
      next.edges.push({ source: hook.id, target: entryId, label: "Into pattern" });
    }
  }

  return adoptPatternGroups(next, pattern, idMap);
}

function alreadyLinked(
  edges: GraphEdge[],
  source: string,
  target: string,
) {
  return edges.some((edge) => edge.source === source && edge.target === target);
}

function nodeHay(node: GraphNode) {
  return `${node.id} ${node.label}`;
}

export function isPublicHopNode(node: GraphNode) {
  if (node.type === "EDGE") return true;
  return /waf|cloudfront|\bcdn\b|shield/i.test(nodeHay(node));
}

export function isIamNode(node: GraphNode) {
  return (
    /iam\b|identity and access/i.test(nodeHay(node)) &&
    !/waf/i.test(nodeHay(node))
  );
}

function isReplicaNode(node: GraphNode) {
  return node.type === "STORAGE" && /replica/i.test(nodeHay(node));
}

function hangEdgeLabel(from: GraphNode, extra: GraphNode) {
  if (extra.type === "CACHE") return "Cache Hit";
  if (isReplicaNode(extra) && from.type === "STORAGE") return "Replicate";
  if (isReplicaNode(extra)) return "Cache Miss";
  return "Attach";
}

/** Keep Gateway → services (including Payment). Put WAF/CDN on Client → Gateway. */
export function repairRequestGraph(state: CanvasState): CanvasState {
  const next = cloneState(state);
  const node = (id: string) => next.nodes.find((item) => item.id === id);

  next.edges = next.edges.filter((edge) => {
    const source = node(edge.source);
    const target = node(edge.target);
    if (!source || !target) return true;
    if (isIamNode(target) && source.type !== "SECURITY") return false;
    if (isIamNode(source) && target.type !== "SECURITY") return false;
    if (isPublicHopNode(source) && target.type === "SERVICE") return false;
    if (source.type === "SERVICE" && isPublicHopNode(target)) return false;
    if (source.type === "GATEWAY" && isPublicHopNode(target)) return false;
    if (source.type === "FRONTEND" && target.type === "SERVICE") return false;
    return true;
  });

  const iam = next.nodes.find(isIamNode);
  const auth = next.nodes.find(
    (item) =>
      item.type === "SECURITY" && !isIamNode(item) && !isPublicHopNode(item),
  );
  if (iam && auth && !alreadyLinked(next.edges, auth.id, iam.id)) {
    next.edges.push({ source: auth.id, target: iam.id, label: "Policies" });
  }

  const hasCache = next.nodes.some((item) => item.type === "CACHE");
  next.edges = next.edges.map((edge) => {
    const source = node(edge.source);
    const target = node(edge.target);
    if (!source || !target) return edge;
    if (target.type === "CACHE" && (source.type === "SERVICE" || source.type === "GATEWAY")) {
      return { ...edge, label: "Cache Hit" };
    }
    if (isReplicaNode(target) && source.type === "STORAGE") {
      return { ...edge, label: "Replicate" };
    }
    if (isReplicaNode(target) && source.type === "SERVICE") {
      return { ...edge, label: "Cache Miss" };
    }
    if (
      hasCache &&
      target.type === "STORAGE" &&
      !isReplicaNode(target) &&
      source.type === "SERVICE" &&
      (!edge.label || /attach|write|link|produce/i.test(edge.label))
    ) {
      return { ...edge, label: "Cache Miss" };
    }
    return edge;
  });

  const clients = next.nodes.filter((item) => item.type === "FRONTEND");
  const gateways = next.nodes.filter((item) => item.type === "GATEWAY");
  const wafs = next.nodes.filter((item) => /waf/i.test(nodeHay(item)));
  const cdns = next.nodes.filter(
    (item) =>
      (item.type === "EDGE" || /cloudfront|\bcdn\b/i.test(nodeHay(item))) &&
      !/waf/i.test(nodeHay(item)),
  );

  if (wafs.length && cdns.length) {
    next.edges = next.edges.filter((edge) => {
      const source = node(edge.source);
      const target = node(edge.target);
      if (!source || !target) return true;
      if (wafs.some((waf) => waf.id === source.id) && target.type === "GATEWAY") {
        return false;
      }
      return true;
    });
  }

  const firstHop = wafs[0] ?? cdns[0] ?? gateways[0];
  const afterWaf = cdns[0] ?? gateways[0];
  const afterCdn = gateways[0];

  for (const client of clients) {
    next.edges = next.edges.filter((edge) => edge.source !== client.id);
    if (firstHop && firstHop.id !== client.id) {
      next.edges.push({
        source: client.id,
        target: firstHop.id,
        label: "HTTPS",
      });
    }
  }
  if (
    wafs[0] &&
    afterWaf &&
    wafs[0].id !== afterWaf.id &&
    !alreadyLinked(next.edges, wafs[0].id, afterWaf.id)
  ) {
    next.edges.push({
      source: wafs[0].id,
      target: afterWaf.id,
      label: "Inspect",
    });
  }
  if (
    cdns[0] &&
    afterCdn &&
    cdns[0].id !== afterCdn.id &&
    !alreadyLinked(next.edges, cdns[0].id, afterCdn.id)
  ) {
    next.edges.push({
      source: cdns[0].id,
      target: afterCdn.id,
      label: "Edge",
    });
  }

  return next;
}

function materialize(
  state: CanvasState,
  pattern: DesignPattern,
  ids: string[],
): { state: CanvasState; idMap: Map<string, string>; added: string[] } {
  const next = cloneState(state);
  const idMap = new Map<string, string>();
  const added: string[] = [];
  for (const patternId of ids) {
    const sample = pattern.nodes.find((node) => node.id === patternId);
    if (!sample) continue;
    const existing =
      findInGraph(next.nodes, sample.label) ?? findInGraph(next.nodes, sample.id);
    if (existing) {
      idMap.set(patternId, existing.id);
      continue;
    }
    const freshId = uniqueId(next, sample.id);
    const { x: _x, y: _y, ...rest } = sample;
    next.nodes.push({ ...rest, id: freshId });
    idMap.set(patternId, freshId);
    added.push(freshId);
  }
  for (const edge of pattern.edges) {
    const source = idMap.get(edge.source);
    const target = idMap.get(edge.target);
    if (!source || !target) continue;
    if (alreadyLinked(next.edges, source, target)) continue;
    next.edges.push({ source, target, label: edge.label });
  }
  return {
    state: adoptPatternGroups(next, pattern, idMap),
    idMap,
    added,
  };
}

function isTrueCluster(memberIds: string[], state: CanvasState): boolean {
  if (memberIds.length < 2) return false;
  if (memberIds.length >= state.nodes.length) return false;
  const set = new Set(memberIds);
  const internal = state.edges.filter(
    (edge) => set.has(edge.source) && set.has(edge.target),
  );
  const seen = new Set<string>([memberIds[0]]);
  const queue = [memberIds[0]];
  while (queue.length) {
    const id = queue.shift()!;
    for (const edge of internal) {
      const next = edge.source === id ? edge.target : edge.target === id ? edge.source : null;
      if (!next || seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  if (internal.length && seen.size === memberIds.length) return true;

  const types = new Set(
    memberIds.map((id) => state.nodes.find((node) => node.id === id)?.type),
  );
  if (types.size !== 1) return false;
  const inboundHits = new Map<string, number>();
  for (const edge of state.edges) {
    if (set.has(edge.target) && !set.has(edge.source)) {
      inboundHits.set(edge.source, (inboundHits.get(edge.source) ?? 0) + 1);
    }
  }
  const sharedParent = [...inboundHits.values()].some(
    (count) => count === memberIds.length,
  );
  if (!sharedParent) return false;
  const exclusiveOwners = memberIds.filter((id) =>
    state.edges.some((edge) => {
      if (edge.source !== id || set.has(edge.target)) return false;
      return !memberIds.some(
        (other) =>
          other !== id &&
          state.edges.some(
            (item) => item.source === other && item.target === edge.target,
          ),
      );
    }),
  );
  return exclusiveOwners.length !== memberIds.length;
}

function adoptPatternGroups(
  state: CanvasState,
  pattern: DesignPattern,
  idMap: Map<string, string>,
): CanvasState {
  for (const group of pattern.groups) {
    const memberIds = [
      ...new Set(
        group.memberIds
          .map((id) => idMap.get(id))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (!isTrueCluster(memberIds, state)) continue;
    const key = [...memberIds].sort().join("+");
    if (
      state.groups.some(
        (existing) => [...existing.memberIds].sort().join("+") === key,
      )
    ) {
      continue;
    }
    state.groups.push({
      id: uniqueId(state, group.id),
      label: group.label,
      memberIds,
      color: group.color,
    });
  }
  return state;
}

function injectExtras(pattern: DesignPattern): string[] {
  if (pattern.inject?.extras.length) return pattern.inject.extras;
  const skip = new Set(
    [pattern.roles.client, pattern.roles.gateway, pattern.roles.app].filter(
      Boolean,
    ),
  );
  return pattern.nodes.map((node) => node.id).filter((id) => !skip.has(id));
}

function attachTarget(
  pattern: DesignPattern,
  extras: string[],
): string | undefined {
  const skip = new Set(
    [pattern.roles.client, pattern.roles.gateway, pattern.roles.app].filter(
      Boolean,
    ),
  );
  const hit = pattern.edges.find(
    (edge) => skip.has(edge.source) && extras.includes(edge.target),
  );
  return hit?.target ?? extras[0];
}

function applyInject(
  current: CanvasState,
  pattern: DesignPattern,
  anchor?: string,
): CanvasState {
  const extras = injectExtras(pattern);
  const { state, idMap } = materialize(current, pattern, extras);
  const hook =
    (anchor && anchor !== "auto" ? findInGraph(state.nodes, anchor) : undefined) ??
    state.nodes.find((node) => node.type === "SERVICE") ??
    state.nodes.find((node) => node.type === "GATEWAY") ??
    state.nodes.find((node) => node.type === "SECURITY");
  const entryKey = attachTarget(pattern, extras);
  const entry = entryKey ? idMap.get(entryKey) : undefined;
  if (hook && entry && hook.id !== entry && !alreadyLinked(state.edges, hook.id, entry)) {
    state.edges.push({ source: hook.id, target: entry, label: "Enqueue" });
  }
  return state;
}

function applyOverlay(
  current: CanvasState,
  pattern: DesignPattern,
  anchor?: string,
): CanvasState {
  const insertKey = pattern.overlay?.insert[0] ?? pattern.roles.cache;
  const sample = pattern.nodes.find((node) => node.id === insertKey);
  if (!sample) return applyInject(current, pattern, anchor);
  let next = cloneState(current);
  const writer = next.nodes.find(
    (node) =>
      node.type === "SERVICE" &&
      next.edges.some((edge) => {
        const target = next.nodes.find((item) => item.id === edge.target);
        return edge.source === node.id && target?.type === "STORAGE";
      }),
  );
  const prefer =
    (anchor && anchor !== "auto"
      ? findInGraph(next.nodes, anchor)?.id
      : undefined) ?? writer?.id;
  if (!findInGraph(next.nodes, sample.id) && !findInGraph(next.nodes, sample.label)) {
    const fresh = { ...sample, id: uniqueId(next, sample.id) };
    delete (fresh as { x?: number }).x;
    delete (fresh as { y?: number }).y;
    next.nodes.push(fresh);
    if (fresh.type === "CACHE") {
      const writer =
        next.nodes.find((node) => node.id === prefer) ??
        next.nodes.find((node) => node.type === "SERVICE");
      if (writer && !alreadyLinked(next.edges, writer.id, fresh.id)) {
        next.edges.push({
          source: writer.id,
          target: fresh.id,
          label: "Cache Hit",
        });
      }
      if (writer) {
        next.edges = next.edges.map((edge) => {
          if (edge.source !== writer.id) return edge;
          const target = next.nodes.find((node) => node.id === edge.target);
          if (target?.type !== "STORAGE") return edge;
          return { ...edge, label: "Cache Miss" };
        });
      }
    } else {
      next = insertBuffer(next, fresh, prefer);
    }
  }
  const replicaKey = pattern.overlay?.replica;
  const replicaSample = replicaKey
    ? pattern.nodes.find((node) => node.id === replicaKey)
    : undefined;
  if (replicaSample && !findInGraph(next.nodes, replicaSample.label)) {
    const replica = {
      ...replicaSample,
      id: uniqueId(next, replicaSample.id),
    };
    delete (replica as { x?: number }).x;
    delete (replica as { y?: number }).y;
    next.nodes.push(replica);
    const bundle = pickWriteBundle(next, replica.id, prefer);
    const producers = new Set(bundle.map((edge) => edge.source));
    const stores = new Set(bundle.map((edge) => edge.target));
    if (!producers.size) {
      const app =
        (prefer ? next.nodes.find((node) => node.id === prefer) : undefined) ??
        next.nodes.find((node) => node.type === "SERVICE");
      if (app) producers.add(app.id);
      const db = next.nodes.find(
        (node) => node.type === "STORAGE" && node.id !== replica.id,
      );
      if (db) stores.add(db.id);
    }
    for (const source of producers) {
      if (!alreadyLinked(next.edges, source, replica.id)) {
        next.edges.push({ source, target: replica.id, label: "Cache Miss" });
      }
    }
    for (const store of stores) {
      if (store !== replica.id && !alreadyLinked(next.edges, store, replica.id)) {
        next.edges.push({ source: store, target: replica.id, label: "Replicate" });
      }
    }
  }
  return next;
}

function applySplit(
  current: CanvasState,
  pattern: DesignPattern,
  anchor?: string,
): CanvasState {
  const write = pattern.split?.write ?? [];
  const read = pattern.split?.read ?? [];
  const extras = [...write, ...read];
  if (!extras.length) return applyInject(current, pattern, anchor);
  const { state, idMap } = materialize(current, pattern, extras);
  const writer = state.nodes.find(
    (node) =>
      node.type === "SERVICE" &&
      state.edges.some((edge) => {
        const target = state.nodes.find((item) => item.id === edge.target);
        return edge.source === node.id && target?.type === "STORAGE";
      }),
  );
  const prefer =
    (anchor && anchor !== "auto"
      ? findInGraph(state.nodes, anchor)?.id
      : undefined) ?? writer?.id;
  const bundle = pickWriteBundle(state, extras[0] ?? "", prefer);
  const producer =
    (prefer ? state.nodes.find((node) => node.id === prefer) : undefined) ??
    (bundle[0]
      ? state.nodes.find((node) => node.id === bundle[0].source)
      : undefined) ??
    state.nodes.find((node) => node.type === "SERVICE") ??
    state.nodes.find((node) => node.type === "GATEWAY");
  const writeHead = write[0] ? idMap.get(write[0]) : undefined;
  if (producer && writeHead && !alreadyLinked(state.edges, producer.id, writeHead)) {
    state.edges.push({ source: producer.id, target: writeHead, label: "Command" });
  }
  if (bundle.length && writeHead) {
    state.edges = state.edges.map((edge) =>
      bundle.some(
        (item) => item.source === edge.source && item.target === edge.target,
      )
        ? { ...edge, target: writeHead, label: "Command" }
        : edge,
    );
  }
  const gateway = state.nodes.find((node) => node.type === "GATEWAY");
  const query = read[0] ? idMap.get(read[0]) : undefined;
  if (gateway && query && gateway.id !== query && !alreadyLinked(state.edges, gateway.id, query)) {
    state.edges.push({ source: gateway.id, target: query, label: "Query" });
  }
  return state;
}

function applyBridge(
  current: CanvasState,
  pattern: DesignPattern,
  fromHint?: string,
  toHint?: string,
): CanvasState {
  const extras = pattern.bridge?.extras ?? injectExtras(pattern);
  const { state, idMap } = materialize(current, pattern, extras);
  const from =
    (fromHint && fromHint !== "auto"
      ? findInGraph(state.nodes, fromHint)
      : undefined) ??
    state.nodes.find((node) => /replica|read/i.test(`${node.id} ${node.label}`)) ??
    state.nodes.find((node) => node.type === "STORAGE");
  const intakeKey = pattern.bridge?.intake ?? extras[extras.length - 1];
  const viaKey = pattern.bridge?.via;
  const to =
    (toHint && toHint !== "auto" ? findInGraph(state.nodes, toHint) : undefined) ??
    (intakeKey ? state.nodes.find((node) => node.id === idMap.get(intakeKey)) : undefined);
  const via = viaKey
    ? state.nodes.find((node) => node.id === idMap.get(viaKey))
    : undefined;
  if (from && via && from.id !== via.id && !alreadyLinked(state.edges, from.id, via.id)) {
    state.edges.push({ source: from.id, target: via.id, label: "CDC" });
  }
  if (via && to && via.id !== to.id && !alreadyLinked(state.edges, via.id, to.id)) {
    state.edges.push({ source: via.id, target: to.id, label: "Index" });
  } else if (from && to && !via && from.id !== to.id && !alreadyLinked(state.edges, from.id, to.id)) {
    state.edges.push({ source: from.id, target: to.id, label: "Sync" });
  }
  return state;
}

export function inferApplyMode(prompt: string): ApplyMode | undefined {
  const p = prompt.trim();
  if (
    /(?:attach|graft)\b.{0,96}\b(?:to|onto|on)\b/i.test(p) ||
    /(?:apply|use)\b.{0,64}pattern\b.{0,32}\b(?:to|onto|on)\b/i.test(p)
  ) {
    return "inject";
  }
  if (/\b(?:upgrade|wrap|overlay)\b/i.test(p)) return "overlay";
  if (/\bsplit\b.{0,48}\b(?:into|with)\b/i.test(p)) return "split";
  if (
    /\b(?:cdc|debezium)\b/i.test(p) ||
    /\b(?:sync|bridge)\b.{0,48}\bfrom\b/i.test(p) ||
    /\bconnect\b.{0,64}\b(?:cdc|replica|indexing|opensearch|search)\b/i.test(p)
  ) {
    return "bridge";
  }
  return undefined;
}

export function omitNodes(state: CanvasState, ids: Iterable<string>): CanvasState {
  const drop = new Set(ids);
  if (!drop.size) return repairRequestGraph(state);
  const next = cloneState(state);
  next.nodes = next.nodes.filter((node) => !drop.has(node.id));
  next.edges = next.edges.filter(
    (edge) => !drop.has(edge.source) && !drop.has(edge.target),
  );
  next.groups = next.groups
    .map((group) => ({
      ...group,
      memberIds: group.memberIds.filter((id) => !drop.has(id)),
    }))
    .filter((group) => group.memberIds.length > 0);
  return repairRequestGraph(next);
}

function canHangExtra(extra: GraphNode, from: GraphNode) {
  if (isPublicHopNode(extra)) {
    return from.type === "FRONTEND" || from.type === "GATEWAY";
  }
  if (isIamNode(extra)) return from.type === "SECURITY" && !isIamNode(from);
  return true;
}

export function hangSubsystemNodes(
  state: CanvasState,
  hangs: Array<{ extraId: string; fromId: string }>,
  priorIds?: Iterable<string>,
): CanvasState {
  const next = cloneState(state);
  const prior = new Set(priorIds ?? []);
  for (const hang of hangs) {
    if (hang.extraId === hang.fromId) continue;
    if (!next.nodes.some((node) => node.id === hang.extraId)) continue;
    if (!next.nodes.some((node) => node.id === hang.fromId)) continue;
    if (prior.size && prior.has(hang.fromId)) {
      const frontendIds = new Set(
        next.nodes.filter((node) => node.type === "FRONTEND").map((node) => node.id),
      );
      next.edges = next.edges.filter(
        (edge) =>
          !(
            edge.target === hang.extraId &&
            prior.has(edge.source) &&
            edge.source !== hang.fromId &&
            !frontendIds.has(edge.source)
          ),
      );
    }
    const extra = next.nodes.find((item) => item.id === hang.extraId);
    const from = next.nodes.find((item) => item.id === hang.fromId);
    if (!extra || !from) continue;
    if (!canHangExtra(extra, from)) continue;
    if (alreadyLinked(next.edges, hang.fromId, hang.extraId)) continue;
    next.edges.push({
      source: hang.fromId,
      target: hang.extraId,
      label: hangEdgeLabel(from, extra),
    });
  }
  return repairRequestGraph(next);
}

export function applyPattern(
  current: CanvasState | undefined,
  pattern: DesignPattern,
  options?: string | PatternApplyOptions,
): CanvasState {
  const opts: PatternApplyOptions =
    typeof options === "string" ? { anchor: options } : (options ?? {});
  if (!current?.nodes.length) {
    return applyMerge(undefined, pattern);
  }
  const mode = opts.mode ?? "merge";
  if (mode === "inject") {
    return repairRequestGraph(applyInject(current, pattern, opts.anchor));
  }
  if (mode === "overlay") {
    return repairRequestGraph(applyOverlay(current, pattern, opts.anchor));
  }
  if (mode === "split") {
    return repairRequestGraph(applySplit(current, pattern, opts.anchor));
  }
  if (mode === "bridge") {
    return repairRequestGraph(
      applyBridge(current, pattern, opts.anchor, opts.anchorTo),
    );
  }
  return repairRequestGraph(applyMerge(current, pattern, opts.anchor));
}

export function fallbackPatternAction(): TopologyAction {
  return "PATTERN_MICROSERVICE_MESH";
}
