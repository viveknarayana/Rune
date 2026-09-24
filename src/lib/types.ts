export type TopologyAction =
  | "SAAS_CONTROL_PLANE"
  | "PAYMENT_AUTH_PIPELINE"
  | "MICROSERVICE_MESH_5"
  | "MUTATE_GRAPH"
  | "SIMULATE_OUTAGE";

export type ThemeMode =
  | "DARK_NEON_CYBER"
  | "SWISS_MINIMAL"
  | "AMBER_ALERT"
  | "DEEP_SPACE";

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  color?: string;
  icon?: string;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
}

export interface GraphGroup {
  id: string;
  label: string;
  memberIds: string[];
  color?: string;
}

export interface CanvasState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
}

export interface CompilerResult extends CanvasState {
  theme_mode: ThemeMode;
  is_anomaly: boolean;
  stiffness: number;
  execution_time_ms: number;
  source: "jev" | "local";
  action: TopologyAction;
  steps: string[];
}

export const NODE_TYPES = [
  "FRONTEND",
  "EDGE",
  "GATEWAY",
  "SECURITY",
  "SERVICE",
  "CACHE",
  "STORAGE",
  "TELEMETRY",
  "CUSTOM",
] as const;

export type NodeTypeName = (typeof NODE_TYPES)[number];
