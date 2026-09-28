import type { CanvasState, GraphEdge, GraphNode } from "./types";

const BUFFER_HINT =
  /\b(kafka|msk|kinesis|sqs|sns|eventbridge|activemq|amazon mq|\bmq\b|rabbit|nats|redpanda|pubsub|queue|stream|buffer|bus|topic)\b/i;
const NOT_BUFFER =
  /\b(cloudwatch|cloudtrail|x-?ray|otel|observab|metrics|traces?|logs?)\b/i;

export function isBufferText(text: string): boolean {
  const hay = text.trim();
  if (!hay) return false;
  if (NOT_BUFFER.test(hay) && !BUFFER_HINT.test(hay)) return false;
  return BUFFER_HINT.test(hay);
}

export function isBufferNode(node: GraphNode): boolean {
  return isBufferText(`${node.id} ${node.label} ${node.type}`);
}

function clone(state: CanvasState): CanvasState {
  return {
    nodes: state.nodes.map((node) => ({ ...node })),
    edges: state.edges.map((edge) => ({ ...edge })),
    groups: (state.groups ?? []).map((group) => ({
      ...group,
      memberIds: [...group.memberIds],
    })),
  };
}

function already(edges: GraphEdge[], source: string, target: string) {
  return edges.some((edge) => edge.source === source && edge.target === target);
}

function splitThrough(
  state: CanvasState,
  buffer: GraphNode,
  chosen: GraphEdge[],
): CanvasState {
  if (!chosen.length) return state;
  const keys = new Set(chosen.map((edge) => `${edge.source}>${edge.target}`));
  let edges = state.edges.map((edge) =>
    keys.has(`${edge.source}>${edge.target}`)
      ? { ...edge, target: buffer.id, label: edge.label ?? "Produce" }
      : edge,
  );
  const seen = new Set<string>();
  for (const edge of chosen) {
    if (seen.has(edge.target)) continue;
    seen.add(edge.target);
    if (!already(edges, buffer.id, edge.target)) {
      edges.push({ source: buffer.id, target: edge.target, label: "Consume" });
    }
  }
  return { ...state, edges };
}

function typedEdges(state: CanvasState, addedId: string) {
  return state.edges
    .map((edge) => ({
      edge,
      source: state.nodes.find((node) => node.id === edge.source),
      target: state.nodes.find((node) => node.id === edge.target),
    }))
    .filter(
      (
        item,
      ): item is {
        edge: GraphEdge;
        source: GraphNode;
        target: GraphNode;
      } =>
        Boolean(
          item.source &&
            item.target &&
            item.source.id !== addedId &&
            item.target.id !== addedId,
        ),
    );
}

export function pickWriteBundle(
  state: CanvasState,
  addedId: string,
  preferId?: string,
): GraphEdge[] {
  const rows = typedEdges(state, addedId);
  const prefer = preferId
    ? state.nodes.find((node) => node.id === preferId)
    : undefined;

  const take = (
    from: string[],
    to: string[],
    filter?: (source: GraphNode, target: GraphNode) => boolean,
  ) =>
    rows
      .filter(
        ({ source, target }) =>
          from.includes(source.type) &&
          to.includes(target.type) &&
          (!filter || filter(source, target)),
      )
      .map((row) => row.edge);

  if (prefer) {
    const fromPrefer = take(
      ["SERVICE", "GATEWAY"],
      ["STORAGE", "CACHE", "SERVICE"],
      (source) => source.id === prefer.id,
    );
    if (fromPrefer.length) return fromPrefer;
    const intoPrefer = take(
      ["GATEWAY", "SERVICE", "FRONTEND"],
      ["SERVICE", "STORAGE"],
      (_source, target) => target.id === prefer.id,
    );
    if (intoPrefer.length) return intoPrefer;
  }

  const gatewayToService = take(["GATEWAY"], ["SERVICE"]);
  if (gatewayToService.length) return gatewayToService;

  const serviceToStore = take(["SERVICE"], ["STORAGE", "CACHE"]);
  if (serviceToStore.length) {
    const counts = new Map<string, GraphEdge[]>();
    for (const edge of serviceToStore) {
      const list = counts.get(edge.source) ?? [];
      list.push(edge);
      counts.set(edge.source, list);
    }
    let bestId = serviceToStore[0].source;
    let best = -1;
    for (const [id, list] of counts) {
      const node = state.nodes.find((item) => item.id === id);
      const bonus = /order|checkout|api|app|ingest|writer/i.test(
        `${node?.id ?? ""} ${node?.label ?? ""}`,
      )
        ? 2
        : 0;
      const score = list.length + bonus;
      if (score > best) {
        best = score;
        bestId = id;
      }
    }
    return counts.get(bestId) ?? serviceToStore.slice(0, 1);
  }

  const serviceToService = take(["SERVICE"], ["SERVICE"]);
  if (serviceToService.length) return [serviceToService[0]];

  return [];
}

export function insertBuffer(
  state: CanvasState,
  buffer: GraphNode,
  preferId?: string,
): CanvasState {
  const next = clone(state);
  if (!next.nodes.some((node) => node.id === buffer.id)) {
    next.nodes.push({ ...buffer });
  }
  const chosen = pickWriteBundle(next, buffer.id, preferId);
  if (chosen.length) return splitThrough(next, buffer, chosen);

  const producer =
    (preferId ? next.nodes.find((node) => node.id === preferId) : undefined) ??
    next.nodes.find((node) => node.type === "SERVICE") ??
    next.nodes.find((node) => node.type === "GATEWAY");
  if (
    producer &&
    !already(next.edges, producer.id, buffer.id)
  ) {
    next.edges.push({
      source: producer.id,
      target: buffer.id,
      label: "Produce",
    });
  }
  return next;
}

export function insertBetween(
  state: CanvasState,
  buffer: GraphNode,
  leftId: string,
  rightId: string,
): CanvasState {
  const next = clone(state);
  if (!next.nodes.some((node) => node.id === buffer.id)) {
    next.nodes.push({ ...buffer });
  }
  const hit = next.edges.filter(
    (edge) =>
      (edge.source === leftId && edge.target === rightId) ||
      (edge.source === rightId && edge.target === leftId),
  );
  if (hit.length) return splitThrough(next, buffer, hit);
  if (!already(next.edges, leftId, buffer.id)) {
    next.edges.push({ source: leftId, target: buffer.id, label: "Produce" });
  }
  if (!already(next.edges, buffer.id, rightId)) {
    next.edges.push({ source: buffer.id, target: rightId, label: "Consume" });
  }
  return next;
}
