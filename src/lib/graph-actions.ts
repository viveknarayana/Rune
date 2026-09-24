import { applyMentionedExtras, applyMutation, parseMutation } from "./mutations";
import type { CanvasState, TopologyAction } from "./types";

const SAAS_CORE: CanvasState = {
  nodes: [
    { id: "web", label: "Web / Mobile Clients", type: "FRONTEND" },
    { id: "gateway", label: "API Gateway", type: "GATEWAY" },
    { id: "auth", label: "Identity / Auth", type: "SECURITY" },
    { id: "app", label: "Application Service", type: "SERVICE" },
    { id: "db", label: "Primary Database", type: "STORAGE" },
  ],
  edges: [
    { source: "web", target: "gateway", label: "HTTPS" },
    { source: "gateway", target: "auth", label: "Verify" },
    { source: "gateway", target: "app", label: "Route" },
    { source: "app", target: "db", label: "OLTP" },
  ],
};

const PAYMENT_CORE: CanvasState = {
  nodes: [
    { id: "web", label: "Checkout Client", type: "FRONTEND" },
    { id: "gateway", label: "API Gateway", type: "GATEWAY" },
    { id: "checkout", label: "Checkout Service", type: "SERVICE" },
    { id: "payments", label: "Payments Service", type: "SERVICE" },
    { id: "db", label: "Primary Database", type: "STORAGE" },
  ],
  edges: [
    { source: "web", target: "gateway", label: "HTTPS" },
    { source: "gateway", target: "checkout", label: "POST /pay" },
    { source: "checkout", target: "payments", label: "Capture" },
    { source: "payments", target: "db", label: "Intent" },
  ],
};

const MESH_CORE: CanvasState = {
  nodes: [
    { id: "web", label: "Client Apps", type: "FRONTEND" },
    { id: "gateway", label: "API Gateway", type: "GATEWAY" },
    { id: "svc_a", label: "Order Service", type: "SERVICE" },
    { id: "svc_b", label: "Inventory Service", type: "SERVICE" },
    { id: "db", label: "Primary Database", type: "STORAGE" },
  ],
  edges: [
    { source: "web", target: "gateway", label: "HTTPS" },
    { source: "gateway", target: "svc_a", label: "/orders" },
    { source: "gateway", target: "svc_b", label: "/sku" },
    { source: "svc_a", target: "db", label: "Write" },
    { source: "svc_b", target: "db", label: "Read" },
  ],
};

function baseFor(action: TopologyAction): CanvasState {
  if (action === "PAYMENT_AUTH_PIPELINE") return PAYMENT_CORE;
  if (action === "MICROSERVICE_MESH_5") return MESH_CORE;
  return SAAS_CORE;
}

export function inferAction(
  prompt: string,
  hasState: boolean,
): TopologyAction {
  const mutation = parseMutation(prompt);
  if (hasState && mutation) {
    return mutation.kind === "outage" ? "SIMULATE_OUTAGE" : "MUTATE_GRAPH";
  }
  const p = prompt.toLowerCase();
  if (/(mesh|microservice|distributed)/.test(p)) return "MICROSERVICE_MESH_5";
  if (/(payment|checkout|psp|card|ledger)/.test(p)) return "PAYMENT_AUTH_PIPELINE";
  return "SAAS_CONTROL_PLANE";
}

export function processGraphAction(
  action: string,
  prompt: string,
  currentState?: CanvasState,
): CanvasState {
  const mutation = parseMutation(prompt);
  if (currentState?.nodes.length && mutation) {
    return applyMutation(currentState, mutation);
  }

  const topology = baseFor(action as TopologyAction);
  return applyMentionedExtras(topology, prompt);
}
