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
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
}

export interface CanvasState {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface CompilerResult extends CanvasState {
  theme_mode: ThemeMode;
  is_anomaly: boolean;
  stiffness: number;
  execution_time_ms: number;
  source: "jev" | "local";
  action: TopologyAction;
}
