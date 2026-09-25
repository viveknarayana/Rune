import type { CompilerResult } from "./types";

export function cloneResult(result: CompilerResult): CompilerResult {
  return {
    ...result,
    nodes: result.nodes.map((node) => ({ ...node })),
    edges: result.edges.map((edge) => ({ ...edge })),
    groups: (result.groups ?? []).map((group) => ({
      ...group,
      memberIds: [...group.memberIds],
    })),
    steps: [...result.steps],
  };
}

export function graphSignature(result: CompilerResult | null): string {
  if (!result) return "";
  return JSON.stringify({
    nodes: result.nodes.map((node) => [
      node.id,
      node.label,
      node.type,
      node.color ?? "",
      node.x ?? "",
      node.y ?? "",
    ]),
    edges: result.edges,
    groups: result.groups ?? [],
  });
}

export function isUndoCommand(prompt: string): boolean {
  return /^(undo|oops|go back)(?:\s+(last|that|it))?$/i.test(prompt.trim());
}

export function isRedoCommand(prompt: string): boolean {
  return /^(redo)(?:\s+(that|it|last))?$/i.test(prompt.trim());
}

export function isClearCommand(prompt: string): boolean {
  return /^(clear|wipe|empty|reset)(?:\s+(the\s+)?(diagram|graph|board|canvas|all|colors?))?$/i.test(
    prompt.trim(),
  );
}
