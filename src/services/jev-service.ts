import { TypeSafeClient } from "@typesafe-ai/sdk";
import {
  inferAction,
  isExplicitRebuild,
  processGraphAction,
} from "../lib/graph-actions";
import { isIntentAction } from "../lib/intents";
import { parsePromptSteps } from "../lib/mutations";
import {
  hangSubsystemNodes,
  inferApplyMode,
  isPatternAction,
  type ApplyMode,
} from "../lib/patterns";
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
    "Mutate the current graph: add a named box, remove a node, connect, group, recolor. Use a PATTERN_* instead if they attach, upgrade, split, or bridge an architecture. Do not wipe the graph.",
  SIMULATE_OUTAGE: "Mark a named node as failed without rebuilding the graph.",
} as const;

const APPLY_MODE_CRITERIA = {
  merge:
    "Default merge: map pattern roles onto existing boxes and add missing ones.",
  inject:
    "Attach a pattern as a side branch onto one named existing node. Do not remap that node into a gateway. Example: attach async workers to Fraud Engine.",
  overlay:
    "Upgrade an existing path in place: insert cache/buffer on the gateway or service to database edge, add replicas. Example: upgrade this API path with caching.",
  split:
    "Fork one write path into CQRS-style command vs query tracks. Example: split our DB path into CQRS.",
  bridge:
    "Connect two existing subsystems (CDC from replicas into search). Pick from_node as source and to_node as intake if needed.",
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

async function placeSubsystemWithJev(
  prompt: string,
  before: CanvasState,
  after: CanvasState,
): Promise<{ state: CanvasState; steps: string[] }> {
  const apiKey = import.meta.env.VITE_TYPESAFE_API_KEY?.trim();
  const added = after.nodes.filter(
    (node) => !before.nodes.some((prior) => prior.id === node.id),
  );
  if (!apiKey || !added.length || !before.nodes.length) {
    return { state: after, steps: [] };
  }

  const extras = added.slice(0, 8);
  const priorIds = before.nodes.map((node) => node.id);
  const client = new TypeSafeClient({
    apiKey,
    defaultModel: "jev-1.13.0",
    dangerouslyAllowBrowser: true,
  });

  const hangChoicesFor = (extraId: string) => {
    const others = extras.filter((node) => node.id !== extraId);
    return [
      ["keep", "Recipe already attached this extra correctly. Rare — only if the inbound edge is already the named producer."],
      ...before.nodes.map((node) => [
        node.id,
        `Existing: ${node.label} [${node.type}] id=${node.id}`,
      ]),
      ...others.map((node) => [
        node.id,
        `New extra: ${node.label} [${node.type}] id=${node.id}`,
      ]),
    ] as [string, string][];
  };

  try {
    const decision = await client.systemOne({
      state: {
        user_prompt: prompt,
        existing_nodes: before.nodes.map((n) => `${n.id}:${n.label}:${n.type}`),
        extras: extras.map((n) => `${n.id}:${n.label}:${n.type}`),
        existing_edges: before.edges.map((e) => `${e.source}->${e.target}`),
      },
      questions: Object.fromEntries(
        extras.map((node) => [
          `hang_${node.id}`,
          {
            type: "choice" as const,
            instructions: `Attach ${node.label} [${node.type}] onto the graph. Prefer the named existing producer (Fraud Engine, Order Service, API). Use another extra only for internal order (queue → worker → store). Do not pick keep unless the recipe already hangs this extra off the right board node.`,
            criteria: Object.fromEntries(hangChoicesFor(node.id)),
          },
        ]),
      ),
    });

    const answers = decision.answers as Record<string, { choice?: string }>;
    const hangs = extras.flatMap((node) => {
      const picked = answers[`hang_${node.id}`]?.choice;
      if (!picked || picked === "keep") return [];
      return [{ extraId: node.id, fromId: picked }];
    });
    if (!hangs.length) return { state: after, steps: [] };

    const state = hangSubsystemNodes(after, hangs, priorIds);
    const steps = hangs.flatMap((hang) => {
      const extra = state.nodes.find((node) => node.id === hang.extraId);
      const from = state.nodes.find((node) => node.id === hang.fromId);
      if (!extra || !from) return [];
      return [`Jev hung ${extra.label} off ${from.label}`];
    });
    return { state, steps };
  } catch {
    return { state: after, steps: [] };
  }
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
          ? "If they attach/apply a named pattern to a node, pick that PATTERN_*. If they upgrade/wrap a path, pick PATTERN_READ_CACHE or the named pattern. If they split into CQRS, pick PATTERN_CQRS_FINTECH. If they sync CDC/search, pick PATTERN_SEARCH_INDEXING. Goals without a named architecture: INTENT_*. Single add/connect/remove: MUTATE_GRAPH. Never wipe."
          : "Map goals to INTENT_* (faster, reliable, secure, writes, async, search). Map named architectures to PATTERN_*. MUTATE_GRAPH only for a single named box.",
        criteria: TOPOLOGY_CRITERIA,
      },
      ...(isMutation
        ? {
            pattern_anchor: {
              type: "choice",
              instructions:
                "Existing node the change hangs off of. Inject: the producer (Fraud Engine, Order Service). Overlay/split: the service or gateway on that path. Bridge: the FROM side (read replica / primary DB). Prefer SERVICE/GATEWAY/SECURITY over STORAGE unless they named a replica or DB. Use auto only if no node is a better fit.",
              criteria: Object.fromEntries(nodeChoices),
            },
            pattern_anchor_to: {
              type: "choice",
              instructions:
                "Only for bridge: the intake node (OpenSearch, search service, Debezium). For inject/overlay/split pick auto.",
              criteria: Object.fromEntries(nodeChoices),
            },
            apply_mode: {
              type: "choice",
              instructions:
                "How to apply a pattern onto the existing board. inject = side branch. overlay = insert on an existing edge. split = fork write vs read. bridge = CDC/connect two subsystems. merge = default role map. Use merge for INTENTS and for MUTATE_GRAPH.",
              criteria: APPLY_MODE_CRITERIA,
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

    const answers = decision.answers as {
      pattern_anchor?: { choice?: string };
      pattern_anchor_to?: { choice?: string };
      apply_mode?: { choice?: string };
    };
    const localStep = parsePromptSteps(prompt).find(
      (step) => step.kind === "apply_pattern",
    );
    const parsedAction =
      localStep?.kind === "apply_pattern" && isPatternAction(localStep.pattern)
        ? localStep.pattern
        : undefined;
    const rawAction = (parsedAction ??
      decision.answers.topology_action.choice) as TopologyAction;
    const keepPattern =
      isPatternAction(rawAction) ||
      isIntentAction(rawAction) ||
      rawAction === "SIMULATE_OUTAGE";
    const action =
      currentState?.nodes.length && !isExplicitRebuild(prompt) && !keepPattern
        ? "MUTATE_GRAPH"
        : rawAction;
    const picked = answers.pattern_anchor?.choice;
    const pickedTo = answers.pattern_anchor_to?.choice;
    const anchor =
      (localStep?.kind === "apply_pattern" && localStep.anchor) ||
      (picked && picked !== "auto" ? picked : undefined) ||
      options?.anchor;
    const anchorTo =
      (localStep?.kind === "apply_pattern" && localStep.anchorTo) ||
      (pickedTo && pickedTo !== "auto" ? pickedTo : undefined);
    const mode = ((localStep?.kind === "apply_pattern" && localStep.mode) ||
      inferApplyMode(prompt) ||
      answers.apply_mode?.choice) as ApplyMode | undefined;
    let { state, steps } = processGraphAction(action, prompt, currentState, {
      anchor,
      mode,
      anchorTo,
    });
    if (currentState?.nodes.length) {
      const placed = await placeSubsystemWithJev(prompt, currentState, state);
      state = placed.state;
      steps = [...steps, ...placed.steps];
    }

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
