import { TypeSafeClient } from "@typesafe-ai/sdk";
import {
  inferAction,
  isExplicitRebuild,
  processGraphAction,
} from "../lib/graph-actions";
import { isIntentAction } from "../lib/intents";
import { isPatternAction } from "../lib/patterns";
import type {
  CanvasState,
  CompilerResult,
  ThemeMode,
  TopologyAction,
} from "../lib/types";

const TOPOLOGY_CRITERIA = {
  PATTERN_EVENT_PIPELINE:
    "Write-heavy event pipeline: real-time analytics, clickstream, high-throughput logs, telemetry. Ingestion gateway → Kafka/Kinesis → Flink → ClickHouse.",
  PATTERN_READ_CACHE:
    "High-read caching: high-traffic API, user profile, product catalog, sub-10ms reads. CDN → gateway → app → Redis → Postgres + replicas.",
  PATTERN_ASYNC_WORKER:
    "Async jobs: AI image generation, PDF, video transcode, long-running tasks. Client → gateway → producer → queue → worker pool → S3 + webhook.",
  PATTERN_MICROSERVICE_MESH:
    "Enterprise mesh: e-commerce checkout, banking app, microservices, distributed system. Client → Kong/Envoy → Auth/Order/Payment each with its own DB.",
  PATTERN_CQRS_FINTECH:
    "CQRS and event sourcing: fintech ledger, banking transactions, immutable audit log. Command API → event store → bus → read DB → query API.",
  PATTERN_SEARCH_INDEXING:
    "Search and indexing: search engine, catalog filter, autocomplete, full-text. Gateway → search service → OpenSearch, plus CDC from primary DB.",
  INTENT_FASTER:
    "User wants the system faster: lower latency or cheaper reads. Merge CDN, Redis, and read replicas. Do not wipe the graph.",
  INTENT_RELIABLE:
    "User wants reliability or high availability. Keep existing nodes; add replicas and a queue buffer.",
  INTENT_SECURE:
    "User wants tighter security. Add edge/WAF and IAM without removing existing boxes.",
  INTENT_HIGH_WRITE:
    "User wants write/ingest scale or traffic spikes. Merge the event pipeline.",
  INTENT_ASYNC:
    "User wants work off the request path: background jobs, video, PDFs, inference.",
  INTENT_SEARCH:
    "User wants search, autocomplete, or catalog filters. Merge OpenSearch and CDC.",
  MUTATE_GRAPH:
    "Mutate the current graph: add a named box, remove a node, connect, group, recolor, or apply a pattern into existing nodes. Do not wipe the graph.",
  SIMULATE_OUTAGE: "Mark a named node as failed without rebuilding the graph.",
} as const;

const THEME_CRITERIA = {
  DARK_NEON_CYBER: "Dark neon cyber glass",
  SWISS_MINIMAL: "Light swiss editorial minimal",
  AMBER_ALERT: "Red alert war-room",
  DEEP_SPACE: "Indigo deep space",
} as const;

const STIFFNESS_CRITERIA = [
  "unused",
  "fluid loose",
  "very soft",
  "soft",
  "relaxed",
  "balanced",
  "slightly snappy",
  "default product",
  "developer snappy",
  "security stiff",
  "maximum stiffness",
] as const;

function pickTheme(prompt: string, anomaly: boolean): ThemeMode {
  const p = prompt.toLowerCase();
  if (anomaly || /(outage|alert|breach|incident)/.test(p)) return "AMBER_ALERT";
  if (/(swiss|minimal|clean)/.test(p)) return "SWISS_MINIMAL";
  if (/(space|deep|cosmic)/.test(p)) return "DEEP_SPACE";
  return "DARK_NEON_CYBER";
}

function compileLocal(
  prompt: string,
  currentState?: CanvasState,
  anchor?: string,
): CompilerResult {
  const started = performance.now();
  const action = inferAction(prompt, Boolean(currentState?.nodes.length));
  const { state, steps } = processGraphAction(action, prompt, currentState, {
    anchor,
  });
  const anomaly = action === "SIMULATE_OUTAGE";

  return {
    ...state,
    groups: state.groups ?? [],
    theme_mode: pickTheme(prompt, anomaly),
    is_anomaly: anomaly,
    stiffness: 8,
    execution_time_ms: Number((performance.now() - started).toFixed(2)),
    source: "local",
    action,
    steps,
  };
}

async function evaluateWithJev(prompt: string, currentState?: CanvasState) {
  const apiKey = import.meta.env.VITE_TYPESAFE_API_KEY?.trim();
  if (!apiKey) return null;

  const isMutation = Boolean(currentState?.nodes.length);
  const client = new TypeSafeClient({
    apiKey,
    defaultModel: "jev-1.13.0",
    dangerouslyAllowBrowser: true,
  });

  const nodeChoices = [
    ["auto", "Infer the attach point from the request path (client / gateway / app). Never prefer a database unless the user named it."],
    ...(currentState?.nodes.map((node) => [
      node.id,
      `${node.label} [${node.type}] id=${node.id}`,
    ]) ?? []),
  ] as [string, string][];

  return client.systemOne({
    state: {
      user_prompt: prompt,
      current_graph_nodes: isMutation
        ? currentState!.nodes.map((n) => `${n.id}:${n.label}:${n.type}`)
        : [],
      current_graph_node_ids: isMutation
        ? currentState!.nodes.map((n) => n.id)
        : [],
      is_mutation_mode: isMutation,
    },
    questions: {
      topology_action: {
        type: "choice",
        instructions: isMutation
          ? "If the user states a goal or a situation (faster, handle case like Black Friday, payment failure, EU users, uploads), pick the closest INTENT_*. If they name an architecture, pick PATTERN_*. Merge — do not wipe. Use MUTATE_GRAPH for add/remove/color/connect. Use SIMULATE_OUTAGE for failures."
          : "Map goals to INTENT_* (faster, reliable, secure, writes, async, search). Map named architectures to PATTERN_*. MUTATE_GRAPH only for a single named box.",
        criteria: TOPOLOGY_CRITERIA,
      },
      ...(isMutation
        ? {
            pattern_anchor: {
              type: "choice",
              instructions:
                "Choose exactly one existing node id from the criteria as the attach point for new pattern, intent, or harden nodes. Every node on the board is listed. Prefer the public request path (client, gateway, producer) for security/CDN/WAF. Use auto only if no node is a better fit.",
              criteria: Object.fromEntries(nodeChoices),
            },
          }
        : {}),
      theme_mode: {
        type: "choice",
        instructions: "Select the aesthetic design system token set.",
        criteria: THEME_CRITERIA,
      },
      is_anomaly_detected: {
        type: "noul",
        instructions:
          "Score high (>0.7) if the prompt implies an error, outage, breach, or threat.",
      },
      spring_stiffness_score: {
        type: "score",
        instructions:
          "Score 10 for snappy/stiff transitions, 1 for fluid/loose transitions.",
        criteria: STIFFNESS_CRITERIA,
      },
    },
  });
}

export async function evaluateJevSystemDesign(
  prompt: string,
  currentState?: CanvasState,
  options?: { anchor?: string },
): Promise<CompilerResult> {
  const started = performance.now();
  const local = compileLocal(prompt, currentState, options?.anchor);

  try {
    const decision = await evaluateWithJev(prompt, currentState);
    if (!decision) return local;

    const rawAction = decision.answers.topology_action.choice as TopologyAction;
    const keepPattern =
      isPatternAction(rawAction) ||
      isIntentAction(rawAction) ||
      rawAction === "SIMULATE_OUTAGE";
    const action =
      currentState?.nodes.length && !isExplicitRebuild(prompt) && !keepPattern
        ? "MUTATE_GRAPH"
        : rawAction;
    const picked = (
      decision.answers as { pattern_anchor?: { choice?: string } }
    ).pattern_anchor?.choice;
    const anchor =
      picked && picked !== "auto" ? picked : options?.anchor;
    const { state, steps } = processGraphAction(action, prompt, currentState, {
      anchor,
    });

    return {
      ...state,
      groups: state.groups ?? [],
      theme_mode: decision.answers.theme_mode.choice as ThemeMode,
      is_anomaly: decision.answers.is_anomaly_detected.noul > 0.7,
      stiffness: Math.min(
        10,
        Math.max(1, Math.round(decision.answers.spring_stiffness_score.score)),
      ),
      execution_time_ms: Number((performance.now() - started).toFixed(2)),
      source: "jev",
      action,
      steps,
    };
  } catch {
    return local;
  }
}

export { compileLocal };
