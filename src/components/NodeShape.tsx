import { withAlpha } from "../lib/colors";
import { shapeForType, type DiagramShape } from "../lib/shapes";

interface NodeShapeProps {
  type: string;
  accent: string;
  selected?: boolean;
  warning?: boolean;
}

function fill(_accent: string, warning?: boolean) {
  return warning ? "rgba(36, 14, 14, 0.97)" : "rgba(28, 30, 36, 0.96)";
}

function stroke(accent: string, selected?: boolean) {
  return selected ? accent : withAlpha(accent, 0.82);
}

function Cylinder({ accent, selected, warning }: Omit<NodeShapeProps, "type">) {
  return (
    <>
      <path
        d="M6 12 C6 5 94 5 94 12 L94 46 C94 53 6 53 6 46 Z"
        fill={fill(accent, warning)}
        stroke={stroke(accent, selected)}
        strokeWidth="1.6"
      />
      <ellipse
        cx="50"
        cy="12"
        rx="44"
        ry="7"
        fill={withAlpha(accent, 0.28)}
        stroke={stroke(accent, selected)}
        strokeWidth="1.6"
      />
    </>
  );
}

function Cache({ accent, selected, warning }: Omit<NodeShapeProps, "type">) {
  return (
    <>
      <rect
        x="3"
        y="5"
        width="94"
        height="46"
        rx="12"
        fill={fill(accent, warning)}
        stroke={stroke(accent, selected)}
        strokeWidth="1.6"
      />
      <rect
        x="3"
        y="5"
        width="14"
        height="46"
        rx="6"
        fill={withAlpha(accent, 0.38)}
      />
      <ellipse cx="10" cy="16" rx="6" ry="3" fill={withAlpha(accent, 0.7)} />
      <ellipse cx="10" cy="28" rx="6" ry="3" fill={withAlpha(accent, 0.5)} />
      <ellipse cx="10" cy="40" rx="6" ry="3" fill={withAlpha(accent, 0.32)} />
    </>
  );
}

function Queue({ accent, selected, warning }: Omit<NodeShapeProps, "type">) {
  return (
    <>
      <rect
        x="3"
        y="5"
        width="94"
        height="46"
        rx="12"
        fill={fill(accent, warning)}
        stroke={stroke(accent, selected)}
        strokeWidth="1.6"
      />
      <rect
        x="3"
        y="5"
        width="8"
        height="46"
        rx="4"
        fill={withAlpha(accent, 0.42)}
      />
    </>
  );
}

function Cloud({ accent, selected, warning }: Omit<NodeShapeProps, "type">) {
  return (
    <path
      d="M18 46 C6 46 2 34 12 28 C10 16 24 8 38 12 C46 4 66 4 74 14 C88 12 98 24 92 36 C98 38 96 50 82 50 L24 50 C20 50 18 48 18 46 Z"
      fill={fill(accent, warning)}
      stroke={stroke(accent, selected)}
      strokeWidth="1.6"
    />
  );
}

function Hexagon({ accent, selected, warning }: Omit<NodeShapeProps, "type">) {
  return (
    <polygon
      points="14,4 86,4 98,28 86,52 14,52 2,28"
      fill={fill(accent, warning)}
      stroke={stroke(accent, selected)}
      strokeWidth="1.6"
    />
  );
}

function Shield({ accent, selected, warning }: Omit<NodeShapeProps, "type">) {
  return (
    <path
      d="M50 3 L94 10 L92 28 C88 42 70 50 50 54 C30 50 12 42 8 28 L6 10 Z"
      fill={fill(accent, warning)}
      stroke={stroke(accent, selected)}
      strokeWidth="1.6"
    />
  );
}

function Browser({ accent, selected, warning }: Omit<NodeShapeProps, "type">) {
  return (
    <>
      <rect
        x="3"
        y="4"
        width="94"
        height="48"
        rx="6"
        fill={fill(accent, warning)}
        stroke={stroke(accent, selected)}
        strokeWidth="1.6"
      />
      <rect x="3" y="4" width="94" height="11" rx="6" fill={withAlpha(accent, 0.35)} />
      <circle cx="12" cy="9.5" r="1.7" fill={accent} />
      <circle cx="18" cy="9.5" r="1.7" fill={withAlpha(accent, 0.7)} />
      <circle cx="24" cy="9.5" r="1.7" fill={withAlpha(accent, 0.45)} />
    </>
  );
}

function Rounded({ accent, selected, warning }: Omit<NodeShapeProps, "type">) {
  return (
    <rect
      x="3"
      y="4"
      width="94"
      height="48"
      rx="10"
      fill={fill(accent, warning)}
      stroke={stroke(accent, selected)}
      strokeWidth="1.6"
    />
  );
}

function Square({ accent, selected, warning }: Omit<NodeShapeProps, "type">) {
  return (
    <rect
      x="6"
      y="4"
      width="88"
      height="48"
      rx="4"
      fill={fill(accent, warning)}
      stroke={stroke(accent, selected)}
      strokeWidth="1.6"
    />
  );
}

const SHAPES: Record<DiagramShape, typeof Rounded> = {
  cylinder: Cylinder,
  cache: Cache,
  queue: Queue,
  cloud: Cloud,
  hexagon: Hexagon,
  shield: Shield,
  browser: Browser,
  rounded: Rounded,
  square: Square,
};

export function NodeShape({ type, accent, selected = false, warning = false }: NodeShapeProps) {
  const Shape = SHAPES[shapeForType(type)];
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 56"
      preserveAspectRatio="none"
    >
      <Shape accent={accent} selected={selected} warning={warning} />
    </svg>
  );
}
