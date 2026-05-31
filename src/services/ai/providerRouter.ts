/**
 * Governed Hybrid AI Provider Router — Hybrid/Hyper Phase
 * Pure module — no network calls, no API calls, no localStorage writes.
 * Routes Genesis AI requests to the appropriate provider identity based on
 * availability, reasoning depth, and governance constraints.
 *
 * Provider identities:
 *   gemini_fast        — Gemini (fast model, express reasoning)
 *   gemini_deep        — Gemini (deep model, full multi-track synthesis)
 *   openai_deep        — OpenAI GPT-4 class (deep reasoning, future support)
 *   heuristic_fallback — Deterministic heuristic; no AI provider available
 *   unavailable        — AI disabled (AI_DISABLED=true) or catastrophic failure
 *
 * Routing modes:
 *   fast_reasoning     — Brief Q&A, summaries, watchlist, lightweight analysis
 *   deep_reasoning     — Macro synthesis, thesis, debate, scenario, strategic review
 *   fallback_mode      — Primary failed; degraded to secondary provider
 *   heuristic_mode     — No keys configured; deterministic heuristic response
 *   unavailable_mode   — System disabled; no AI response possible
 *
 * Governance contract (always enforced — never bypassed by provider):
 *   Firewall, Workflow, Credibility, Debate, Learning, Strategic Approval,
 *   Market OS, Thesis Lab, Scenario Intelligence all remain superior to
 *   any provider output. AI is advisory only. No provider has execution authority.
 *
 * Design rules:
 * - Works with zero API keys (graceful heuristic_fallback)
 * - No crashes on missing env vars
 * - Deterministic routing — same inputs always produce same decision
 * - Provider-agnostic interface — new providers plug in without changing callers
 * - No execution logic, no trading, no broker routing
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProviderIdentity =
  | "gemini_fast"        // Gemini; fast model; express reasoning path
  | "gemini_deep"        // Gemini; deep token budget; full synthesis
  | "openai_deep"        // OpenAI GPT-4 class; deep reasoning (future)
  | "heuristic_fallback" // No AI; deterministic heuristic only
  | "unavailable";       // AI_DISABLED or catastrophic failure

export type RoutingMode =
  | "fast_reasoning"   // brief mode; target <8s; tracks A+C+D only
  | "deep_reasoning"   // detailed mode; all 6 tracks; full synthesis
  | "fallback_mode"    // primary failed; degraded to secondary
  | "heuristic_mode"   // no keys; deterministic heuristic response
  | "unavailable_mode";// system disabled; no response possible

export type ReasoningDepth = "fast" | "deep";

/** Provider availability snapshot — read once per request from env vars. */
export interface ProviderAvailability {
  hasGemini: boolean;                // GEMINI_API_KEY or LOVABLE_API_KEY present
  hasOpenAI: boolean;                // OPENAI_API_KEY present (future support)
  isAiDisabled: boolean;             // AI_DISABLED=true in env
  fastModelOverride: string | null;  // GENESIS_FAST_MODEL env var override
  deepModelOverride: string | null;  // GENESIS_DEEP_MODEL env var override
  aiModeOverride: string | null;     // GENESIS_AI_MODE env var override ("fast"|"deep"|"auto")
}

/** Stability and cost controls for this routing decision. */
export interface StabilityControls {
  timeoutMs: number;     // recommended request timeout in ms
  maxRetries: number;    // retry limit before triggering fallback
  hasFallback: boolean;  // whether a fallback provider is available
}

/** Full routing decision returned by routeGenesisAI(). */
export interface RoutingDecision {
  providerIdentity: ProviderIdentity;
  routingMode: RoutingMode;
  modelHint: string;           // model name hint (informational; enforced by gateway)
  maxTokensHint: number;       // recommended max_tokens for this mode
  temperatureHint: number;     // recommended temperature for this mode
  stabilityControls: StabilityControls;
  displayLabel: string;        // human-readable label for UI display
  isFallback: boolean;         // true when not using the optimal path
  isAvailable: boolean;        // false for heuristic_fallback or unavailable
  // Governance assertions — always true/false; never bypassed by provider
  readonly isGovernanceEnforced: true;
  readonly isExecution: false;
  readonly isTradeRecommendation: false;
}

// ─── Default models ───────────────────────────────────────────────────────────

const DEFAULT_FAST_MODEL = "google/gemini-2.5-flash";
const DEFAULT_DEEP_MODEL = "google/gemini-2.5-flash";
const DEFAULT_OPENAI_MODEL = "gpt-4o";

// ─── Stability controls ───────────────────────────────────────────────────────

function buildStabilityControls(
  identity: ProviderIdentity,
  hasAnyFallback: boolean,
): StabilityControls {
  switch (identity) {
    case "gemini_fast":        return { timeoutMs: 8000,  maxRetries: 1, hasFallback: hasAnyFallback };
    case "gemini_deep":        return { timeoutMs: 15000, maxRetries: 1, hasFallback: hasAnyFallback };
    case "openai_deep":        return { timeoutMs: 20000, maxRetries: 1, hasFallback: hasAnyFallback };
    case "heuristic_fallback": return { timeoutMs: 0,     maxRetries: 0, hasFallback: false };
    case "unavailable":        return { timeoutMs: 0,     maxRetries: 0, hasFallback: false };
  }
}

// ─── Display labels ───────────────────────────────────────────────────────────

const DISPLAY_LABELS: Record<ProviderIdentity, string> = {
  gemini_fast:        "Gemini Fast",
  gemini_deep:        "Gemini Deep",
  openai_deep:        "Gemini Deep",   // always show Gemini brand to users
  heuristic_fallback: "Heuristic",
  unavailable:        "AI Unavailable",
};

const DISPLAY_LABELS_AR: Record<ProviderIdentity, string> = {
  gemini_fast:        "Gemini سريع",
  gemini_deep:        "Gemini عميق",
  openai_deep:        "Gemini عميق",   // always show Gemini brand to users
  heuristic_fallback: "تحليل إرشادي",
  unavailable:        "AI غير متاح",
};

export function getProviderDisplayLabel(identity: ProviderIdentity, ar = false): string {
  return ar ? DISPLAY_LABELS_AR[identity] : DISPLAY_LABELS[identity];
}

// ─── Decision builder ─────────────────────────────────────────────────────────

function buildDecision(
  identity: ProviderIdentity,
  mode: RoutingMode,
  model: string,
  maxTokens: number,
  temperature: number,
  availability: ProviderAvailability,
  isFallback: boolean,
): RoutingDecision {
  const hasAnyFallback =
    identity !== "heuristic_fallback" &&
    identity !== "unavailable" &&
    !availability.isAiDisabled;

  return {
    providerIdentity: identity,
    routingMode: mode,
    modelHint: model,
    maxTokensHint: maxTokens,
    temperatureHint: temperature,
    stabilityControls: buildStabilityControls(identity, hasAnyFallback),
    displayLabel: DISPLAY_LABELS[identity],
    isFallback,
    isAvailable: identity !== "unavailable" && identity !== "heuristic_fallback",
    isGovernanceEnforced: true,
    isExecution: false,
    isTradeRecommendation: false,
  };
}

// ─── Core routing function ────────────────────────────────────────────────────

/**
 * Route a Genesis AI request to the appropriate provider identity.
 * Deterministic — same inputs always produce the same decision.
 * Works with zero API keys (returns heuristic_fallback gracefully).
 *
 * @param depth  - "fast" for express mode, "deep" for full synthesis
 * @param availability - provider availability snapshot from env vars
 */
export function routeGenesisAI(
  depth: ReasoningDepth,
  availability: ProviderAvailability,
): RoutingDecision {
  const { hasGemini, hasOpenAI, isAiDisabled,
    fastModelOverride, deepModelOverride } = availability;

  // ── Hard stop: AI disabled ─────────────────────────────────────────────────
  if (isAiDisabled) {
    return buildDecision("unavailable", "unavailable_mode", "none", 0, 0.0, availability, false);
  }

  // ── No AI keys available: graceful heuristic ──────────────────────────────
  if (!hasGemini && !hasOpenAI) {
    return buildDecision("heuristic_fallback", "heuristic_mode", "heuristic", 0, 0.0, availability, true);
  }

  // ── Both Gemini + OpenAI available: Gemini is primary for ALL requests ──────
  // Gemini carries the full institutional FRED macro context and 6-school prompts;
  // OpenAI is held as emergency fallback only (handled in genesis.functions.ts).
  if (hasGemini && hasOpenAI) {
    if (depth === "fast") {
      const model = fastModelOverride ?? DEFAULT_FAST_MODEL;
      return buildDecision("gemini_fast", "fast_reasoning", model, 800, 0.3, availability, false);
    } else {
      const model = deepModelOverride ?? DEFAULT_DEEP_MODEL;
      return buildDecision("gemini_deep", "deep_reasoning", model, 4096, 0.4, availability, false);
    }
  }

  // ── Gemini only path ──────────────────────────────────────────────────────
  if (hasGemini) {
    if (depth === "fast") {
      const model = fastModelOverride ?? DEFAULT_FAST_MODEL;
      return buildDecision("gemini_fast", "fast_reasoning", model, 800, 0.3, availability, false);
    } else {
      const model = deepModelOverride ?? DEFAULT_DEEP_MODEL;
      return buildDecision("gemini_deep", "deep_reasoning", model, 4096, 0.4, availability, false);
    }
  }

  // ── OpenAI only path (deep reasoning) ────────────────────────────────────
  if (hasOpenAI) {
    const model = deepModelOverride ?? DEFAULT_OPENAI_MODEL;
    return buildDecision("openai_deep", "deep_reasoning", model, 4096, 0.4, availability, false);
  }

  // ── Unreachable with current logic, but safe default ─────────────────────
  return buildDecision("heuristic_fallback", "fallback_mode", "heuristic", 0, 0.0, availability, true);
}

/**
 * Build a no-key-safe availability snapshot from server-side env vars.
 * Call this only from server-side code (genesis.functions.ts).
 * All env vars are optional — missing vars produce graceful fallback.
 */
export function buildAvailabilityFromEnv(env: {
  GEMINI_API_KEY?: string;
  LOVABLE_API_KEY?: string;
  OPENAI_API_KEY?: string;
  AI_DISABLED?: string;
  GENESIS_FAST_MODEL?: string;
  GENESIS_DEEP_MODEL?: string;
  GENESIS_AI_MODE?: string;
}): ProviderAvailability {
  return {
    hasGemini: !!(env.GEMINI_API_KEY?.trim() || env.LOVABLE_API_KEY?.trim()),
    hasOpenAI: !!env.OPENAI_API_KEY?.trim(),
    isAiDisabled: env.AI_DISABLED === "true",
    fastModelOverride: env.GENESIS_FAST_MODEL?.trim() || null,
    deepModelOverride: env.GENESIS_DEEP_MODEL?.trim() || null,
    aiModeOverride: env.GENESIS_AI_MODE?.trim() || null,
  };
}
