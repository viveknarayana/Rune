import { TypeSafeClient } from "@typesafe-ai/sdk";
import { inferAction, processGraphAction } from "../lib/graph-actions";
import type {
  CanvasState,
  CompilerResult,
  ThemeMode,
  TopologyAction,
} from "../lib/types";

const TOPOLOGY_CRITERIA = {
  SAAS_CONTROL_PLANE:
    "Generate a lean SaaS graph only: client, gateway, auth, app, database. Do not add extras unless the prompt names them.",
  PAYMENT_AUTH_PIPELINE:
    "Generate a lean payments graph: client, gateway, checkout, payments, database. Add fraud/PSP/ledger only if named.",
  MICROSERVICE_MESH_5:
    "Generate a lean mesh: client, gateway, order, inventory, database. Add cache/queue only if named.",
  MUTATE_GRAPH:
    "Mutate the current graph: add a named box, remove a node, add X before/after Y, connect X to Y, group nodes in a square, or recolor. Do not regenerate.",
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
): CompilerResult {
  const started = performance.now();
  const action = inferAction(prompt, Boolean(currentState?.nodes.length));
  const { state, steps } = processGraphAction(action, prompt, currentState);
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

  return client.systemOne({
    state: {
      user_prompt: prompt,
      current_graph_nodes: isMutation
        ? currentState!.nodes.map((n) => `${n.id}:${n.label}`)
        : [],
      is_mutation_mode: isMutation,
    },
    questions: {
      topology_action: {
        type: "choice",
        instructions:
          "If the user is adding/removing/reordering components on an existing graph, choose MUTATE_GRAPH. Only choose a generate action for a new system.",
        criteria: TOPOLOGY_CRITERIA,
      },
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
): Promise<CompilerResult> {
  const started = performance.now();
  const local = compileLocal(prompt, currentState);

  try {
    const decision = await evaluateWithJev(prompt, currentState);
    if (!decision) return local;

    const action = decision.answers.topology_action.choice as TopologyAction;
    const { state, steps } = processGraphAction(action, prompt, currentState);

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
