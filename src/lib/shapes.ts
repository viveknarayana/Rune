export type DiagramShape =
  | "cylinder"
  | "cache"
  | "queue"
  | "cloud"
  | "hexagon"
  | "shield"
  | "browser"
  | "rounded"
  | "square";

export const SHAPE_CONTENT: Record<
  DiagramShape,
  { padX: number; padTop: number; padBottom: number }
> = {
  cylinder: { padX: 18, padTop: 20, padBottom: 14 },
  cache: { padX: 16, padTop: 18, padBottom: 12 },
  queue: { padX: 34, padTop: 12, padBottom: 12 },
  cloud: { padX: 22, padTop: 18, padBottom: 14 },
  hexagon: { padX: 22, padTop: 14, padBottom: 14 },
  shield: { padX: 22, padTop: 16, padBottom: 16 },
  browser: { padX: 14, padTop: 20, padBottom: 10 },
  rounded: { padX: 14, padTop: 12, padBottom: 12 },
  square: { padX: 16, padTop: 12, padBottom: 12 },
};

export function shapeForType(type: string): DiagramShape {
  switch (type) {
    case "STORAGE":
      return "cylinder";
    case "CACHE":
      return "cache";
    case "QUEUE":
    case "TELEMETRY":
      return "queue";
    case "EDGE":
      return "cloud";
    case "GATEWAY":
      return "hexagon";
    case "SECURITY":
      return "shield";
    case "FRONTEND":
      return "browser";
    case "CUSTOM":
      return "square";
    default:
      return "rounded";
  }
}

export function contentBox(type: string) {
  return SHAPE_CONTENT[shapeForType(type)];
}
