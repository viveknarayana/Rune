export type TopologyAction =
  | "PATTERN_EVENT_PIPELINE"
  | "PATTERN_READ_CACHE"
  | "PATTERN_ASYNC_WORKER"
  | "PATTERN_MICROSERVICE_MESH"
  | "PATTERN_CQRS_FINTECH"
  | "PATTERN_SEARCH_INDEXING"
  | "INTENT_FASTER"
  | "INTENT_RELIABLE"
  | "INTENT_SECURE"
  | "INTENT_HIGH_WRITE"
  | "INTENT_ASYNC"
  | "INTENT_SEARCH"
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
