import { findInGraph } from "./catalog";
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

export interface DesignPattern {
  id: PatternId;
  label: string;
  short: string;
  triggers: string[];
  roles: Record<string, string>;
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
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
        label: "Event Pipeline",
        memberIds: ["ingest_gw", "kafka", "flink", "clickhouse"],
      },
    ],
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
    groups: [
      {
        id: "read_path",
        label: "Read Path",
        memberIds: ["redis", "pg_replica"],
      },
    ],
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
    groups: [
      {
        id: "svc_tier",
        label: "Services",
        memberIds: ["auth_svc", "order_svc", "pay_svc"],
      },
      {
        id: "data_tier",
        label: "Dedicated DBs",
        memberIds: ["auth_db", "order_db", "pay_db"],
      },
    ],
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

export function applyPattern(
  current: CanvasState | undefined,
  pattern: DesignPattern,
  anchor?: string,
): CanvasState {
  if (!current?.nodes.length) {
    return {
      nodes: pattern.nodes.map((node) => ({ ...node })),
      edges: pattern.edges.map((edge) => ({ ...edge })),
      groups: pattern.groups.map((group) => ({
        ...group,
        memberIds: [...group.memberIds],
      })),
    };
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

  for (const group of pattern.groups) {
    const memberIds = group.memberIds
      .map((id) => idMap.get(id))
      .filter((id): id is string => Boolean(id));
    if (memberIds.length < 2) continue;
    next.groups.push({
      id: uniqueId(next, group.id),
      label: group.label,
      memberIds,
      color: group.color,
    });
  }

  if (added.length) {
    next.groups.push({
      id: uniqueId(next, pattern.id.toLowerCase()),
      label: pattern.label,
      memberIds: added,
    });
  }

  return next;
}

export function fallbackPatternAction(): TopologyAction {
  return "PATTERN_MICROSERVICE_MESH";
}
