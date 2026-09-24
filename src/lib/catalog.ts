import type { GraphNode } from "./types";

export interface CatalogEntry extends GraphNode {
  aliases: string[];
}

export const CATALOG: CatalogEntry[] = [
  { id: "web", label: "Web / Mobile Clients", type: "FRONTEND", aliases: ["client", "clients", "web", "mobile", "frontend"] },
  { id: "cdn", label: "CDN + WAF", type: "EDGE", aliases: ["cdn", "waf", "cloudflare", "fastly", "akamai"] },
  { id: "lb", label: "Load Balancer", type: "GATEWAY", aliases: ["load balancer", "loadbalancer", "lb"] },
  { id: "gateway", label: "API Gateway", type: "GATEWAY", aliases: ["api gateway", "gateway", "ingress"] },
  { id: "auth", label: "Identity / Auth", type: "SECURITY", aliases: ["identity", "auth", "idp", "sso", "jwt"] },
  { id: "app", label: "Application Service", type: "SERVICE", aliases: ["application", "app service", "app"] },
  { id: "checkout", label: "Checkout Service", type: "SERVICE", aliases: ["checkout"] },
  { id: "payments", label: "Payments Service", type: "SERVICE", aliases: ["payments", "payment service"] },
  { id: "fraud", label: "Risk & Fraud Engine", type: "SECURITY", aliases: ["fraud engine", "risk engine", "fraud", "risk"] },
  { id: "psp", label: "Card Network / PSP", type: "GATEWAY", aliases: ["psp", "stripe", "card network"] },
  { id: "ledger", label: "Ledger Service", type: "SERVICE", aliases: ["ledger"] },
  { id: "svc_a", label: "Order Service", type: "SERVICE", aliases: ["order service", "orders"] },
  { id: "svc_b", label: "Inventory Service", type: "SERVICE", aliases: ["inventory service", "inventory"] },
  { id: "notify", label: "Notification Service", type: "SERVICE", aliases: ["notification", "notify"] },
  { id: "worker", label: "Async Workers", type: "SERVICE", aliases: ["workers", "worker", "consumer"] },
  { id: "queue", label: "Event Bus / Queue", type: "TELEMETRY", aliases: ["event bus", "queue", "kafka", "sqs", "bus"] },
  { id: "cache", label: "Redis Cache", type: "CACHE", aliases: ["redis cache", "redis", "cache"] },
  { id: "db", label: "Primary Database", type: "STORAGE", aliases: ["primary database", "database", "postgres", "mysql", "db"] },
  { id: "object", label: "Object Storage", type: "STORAGE", aliases: ["object storage", "s3", "blob"] },
  { id: "obs", label: "Logs / Metrics / Traces", type: "TELEMETRY", aliases: ["observability", "telemetry", "metrics", "traces", "logs", "otel"] },
];

const BY_ALIAS = [...CATALOG]
  .flatMap((entry) =>
    entry.aliases
      .slice()
      .sort((a, b) => b.length - a.length)
      .map((alias) => ({ alias, entry })),
  )
  .sort((a, b) => b.alias.length - a.alias.length);

export function resolveComponent(text: string): CatalogEntry | undefined {
  const hay = text.toLowerCase().trim();
  return BY_ALIAS.find(({ alias }) => hay.includes(alias))?.entry;
}

export function findInGraph(
  nodes: GraphNode[],
  text: string,
): GraphNode | undefined {
  const resolved = resolveComponent(text);
  if (resolved) {
    const exact = nodes.find((n) => n.id === resolved.id);
    if (exact) return exact;
  }
  const hay = text.toLowerCase();
  return nodes.find(
    (n) =>
      n.id.toLowerCase() === hay ||
      n.label.toLowerCase().includes(hay) ||
      hay.includes(n.id.toLowerCase()),
  );
}

export function toNode(entry: CatalogEntry): GraphNode {
  return { id: entry.id, label: entry.label, type: entry.type };
}
