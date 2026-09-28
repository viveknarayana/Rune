import {
  applyMentionedExtras,
  applySteps,
  emptyState,
  parsePromptSteps,
} from "./mutations";
import {
  applyCase,
  applyIntent,
  getIntent,
  isIntentAction,
  matchIntent,
  parseHandleCase,
  resolveCase,
} from "./intents";
import {
  applyPattern,
  fallbackPatternAction,
  getPattern,
  inferApplyMode,
  isPatternAction,
  matchPattern,
  type ApplyMode,
} from "./patterns";
import type { CanvasState, TopologyAction } from "./types";

export function isExplicitRebuild(prompt: string): boolean {
  return /\b(reset|rebuild|regenerate|start over|from scratch|new (?:diagram|graph|system)|scratch)\b/i.test(
    prompt,
  );
}

export function inferAction(
  prompt: string,
  hasState: boolean,
): TopologyAction {
  const steps = parsePromptSteps(prompt);
  const fromStep = steps.find((step) => step.kind === "apply_pattern");
  if (fromStep?.kind === "apply_pattern" && isPatternAction(fromStep.pattern)) {
    return fromStep.pattern;
  }
  const intentStep = steps.find((step) => step.kind === "apply_intent");
  if (intentStep?.kind === "apply_intent" && isIntentAction(intentStep.intent)) {
    return intentStep.intent;
  }
  const caseStep = steps.find((step) => step.kind === "apply_case");
  if (caseStep?.kind === "apply_case") {
    const recipe = resolveCase(caseStep.case);
    if (recipe.intent) return recipe.intent;
    if (recipe.pattern) return recipe.pattern;
    return "MUTATE_GRAPH";
  }
  const mutating = steps.some(
    (step) =>
      step.kind !== "apply_pattern" &&
      step.kind !== "apply_intent" &&
      step.kind !== "apply_case",
  );
  if (!mutating) {
    const intent = matchIntent(prompt);
    if (intent) return intent.id;
    const matched = matchPattern(prompt);
    if (matched) return matched.id;
  }

  if (hasState && !isExplicitRebuild(prompt)) {
    return steps.some((step) => step.kind === "outage") && steps.length === 1
      ? "SIMULATE_OUTAGE"
      : "MUTATE_GRAPH";
  }
  if (steps.length && (hasState || steps[0].kind !== "outage")) {
    return steps.some((step) => step.kind === "outage") && steps.length === 1
      ? "SIMULATE_OUTAGE"
      : "MUTATE_GRAPH";
  }
  return fallbackPatternAction();
}

export function processGraphAction(
  action: string,
  prompt: string,
  currentState?: CanvasState,
  options?: { anchor?: string; mode?: ApplyMode; anchorTo?: string },
): { state: CanvasState; steps: string[] } {
  const mutations = parsePromptSteps(prompt);
  const patternStep = mutations.find((step) => step.kind === "apply_pattern");
  const intentStep = mutations.find((step) => step.kind === "apply_intent");
  const caseStep = mutations.find((step) => step.kind === "apply_case");
  const other = mutations.filter(
    (step) =>
      step.kind !== "apply_pattern" &&
      step.kind !== "apply_intent" &&
      step.kind !== "apply_case",
  );

  let state = currentState?.nodes.length ? currentState : emptyState();
  const steps: string[] = [];

  const fromJevPattern = isPatternAction(action) ? getPattern(action) : undefined;
  const fromJevIntent = isIntentAction(action) ? getIntent(action) : undefined;
  const jevOwns =
    Boolean(fromJevPattern || fromJevIntent) || action === "MUTATE_GRAPH";

  const pattern =
    fromJevPattern ||
    (patternStep?.kind === "apply_pattern" && getPattern(patternStep.pattern)) ||
    (jevOwns || other.length ? undefined : matchPattern(prompt));

  const intent =
    fromJevIntent ||
    (intentStep?.kind === "apply_intent" && getIntent(intentStep.intent)) ||
    (jevOwns || other.length ? undefined : matchIntent(prompt));

  const parsedMode =
    options?.mode ||
    (patternStep?.kind === "apply_pattern" &&
      (patternStep.mode as ApplyMode | undefined)) ||
    inferApplyMode(prompt);
  const anchor =
    options?.anchor ??
    (patternStep?.kind === "apply_pattern" ? patternStep.anchor : undefined) ??
    (intentStep?.kind === "apply_intent" ? intentStep.anchor : undefined);
  const anchorTo =
    options?.anchorTo ??
    (patternStep?.kind === "apply_pattern" ? patternStep.anchorTo : undefined);
  const merging = Boolean(currentState?.nodes.length);
  const caseText =
    (caseStep?.kind === "apply_case" && caseStep.case) ||
    (!other.length ? parseHandleCase(prompt) : undefined);

  if (caseText && !fromJevIntent && !fromJevPattern) {
    state = applyCase(merging ? state : undefined, caseText, anchor);
    steps.push(`Handle ${resolveCase(caseText).label}`);
  } else if (intent) {
    state = applyIntent(merging ? state : undefined, intent, anchor);
    steps.push(merging ? `Merged ${intent.label}` : intent.label);
  } else if (pattern) {
    state = applyPattern(merging ? state : undefined, pattern, {
      anchor,
      mode: merging ? parsedMode : undefined,
      anchorTo,
    });
    const verb =
      parsedMode === "inject"
        ? "Attached"
        : parsedMode === "overlay"
          ? "Upgraded with"
          : parsedMode === "split"
            ? "Split into"
            : parsedMode === "bridge"
              ? "Bridged"
              : merging
                ? "Merged"
                : "Built";
    steps.push(`${verb} ${pattern.label}`);
  }

  if (other.length) {
    const seed =
      state.nodes.length || currentState?.nodes.length
        ? state
        : mutations.every(
              (item) =>
                item.kind === "add" ||
                item.kind === "connect" ||
                item.kind === "disconnect" ||
                item.kind === "attach" ||
                item.kind === "insert_between",
            )
          ? emptyState()
          : applyPattern(undefined, getPattern(fallbackPatternAction())!);
    const applied = applySteps(seed, other, options?.anchor);
    return {
      state: applyMentionedExtras(applied.state, prompt),
      steps: [...steps, ...applied.steps],
    };
  }

  if (caseText || intent || pattern) return { state, steps };

  if (currentState?.nodes.length && !isExplicitRebuild(prompt)) {
    return { state: currentState, steps: ["Kept graph"] };
  }

  const fallback = getPattern(fallbackPatternAction())!;
  return {
    state: applyMentionedExtras(applyPattern(undefined, fallback), prompt),
    steps: [`Apply ${fallback.label}`],
  };
}
