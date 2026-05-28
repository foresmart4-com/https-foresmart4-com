/**
 * Production Stability Intelligence — Phase 60
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Audits all-session runtime stability to detect subtle degradation patterns
 * that broad session averages may obscure.
 *
 * Stability states:
 *   stable_runtime       — session shows consistent primary AI delivery
 *   degraded_runtime     — active trailing streak of heuristic/fallback responses
 *   fallback_sensitive   — sustained elevated fallback rate across the session
 *   context_pressure     — long session with deteriorating provider reliability
 *   monitoring_drift     — session was healthy but recently degrading (hidden risk)
 *   recovery_heavy       — repeated parse/quota recovery events; structural instability
 *   insufficient_signal  — too few exchanges for reliable stability classification
 *
 * Design rules:
 * - All-session view (complements Phase-61 adaptive window view)
 * - Detects acceleration patterns, streaks, and long-session degradation
 * - No autonomous remediation — observation and advisory only
 * - Governance remains superior; stability signals are informational
 * - O(1) runtime — all metrics pre-derived by caller
 *
 * Safety assertions:
 *   isAutonomousRemediation — always false; no self-healing actions
 *   isExecution             — always false; advisory only
 *   isProviderSwitching     — always false; no routing authority
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_EXCHANGES_FOR_SIGNAL     = 3;
const SESSION_PRESSURE_THRESHOLD   = 15;  // exchanges above which context pressure applies
const RECOVERY_HEAVY_THRESHOLD     = 3;   // OpenAI recovery events signalling structural issues
const FALLBACK_SENSITIVE_RATE      = 0.40; // 40% all-session heuristic rate
const DEGRADED_STREAK_THRESHOLD    = 3;   // consecutive trailing heuristic = active degradation
const DRIFT_STREAK_THRESHOLD       = 2;   // trailing heuristic ≥2 with good overall = drift

// ─── Types ────────────────────────────────────────────────────────────────────

export type StabilityState =
  | "stable_runtime"      // consistent primary AI delivery throughout session
  | "degraded_runtime"    // active trailing streak of heuristic/fallback responses
  | "fallback_sensitive"  // sustained elevated fallback rate all-session
  | "context_pressure"    // long session with degrading provider reliability
  | "monitoring_drift"    // was healthy; recent responses deteriorating
  | "recovery_heavy"      // repeated parse/quota recovery; structural instability
  | "insufficient_signal";// too few exchanges for reliable classification

export interface ProductionStabilityInput {
  totalExchanges: number;
  heuristicCount: number;            // total heuristic responses all-session
  openAIFallbackCount: number;       // total OpenAI recovery uses (parse/quota) all-session
  consecutiveHeuristicAtEnd: number; // trailing heuristic streak (from end of session)
  longSession: boolean;              // totalExchanges > SESSION_PRESSURE_THRESHOLD
  ar: boolean;
}

export interface ProductionStabilityResult {
  stabilityState: StabilityState;
  runtimeNote: string | null;       // 1 sentence on current runtime condition; null when stable
  degradationNote: string | null;   // 1 sentence on degradation pattern; null when not applicable
  recoveryNote: string | null;      // 1 sentence on recovery concentration; null when not applicable
  contextString: string;            // compact ≤120 chars; empty when stable or insufficient
  // Safety assertions — always enforced; no exceptions
  readonly isAutonomousRemediation: false;
  readonly isExecution: false;
  readonly isProviderSwitching: false;
}

// ─── Stability state derivation ───────────────────────────────────────────────

function deriveStabilityState(input: ProductionStabilityInput): StabilityState {
  const { totalExchanges, heuristicCount, openAIFallbackCount,
    consecutiveHeuristicAtEnd, longSession } = input;

  if (totalExchanges < MIN_EXCHANGES_FOR_SIGNAL) return "insufficient_signal";

  const heuristicRate = heuristicCount / totalExchanges;

  // recovery_heavy: structural instability from repeated parse/quota recovery
  if (openAIFallbackCount >= RECOVERY_HEAVY_THRESHOLD) return "recovery_heavy";

  // degraded_runtime: active trailing streak — most recent responses failing
  if (consecutiveHeuristicAtEnd >= DEGRADED_STREAK_THRESHOLD) return "degraded_runtime";

  // monitoring_drift: session was healthy but recent responses are deteriorating
  // (good overall rate but recent streak suggests emerging problem)
  if (consecutiveHeuristicAtEnd >= DRIFT_STREAK_THRESHOLD && heuristicRate < 0.25) {
    return "monitoring_drift";
  }

  // context_pressure: long session with any heuristic degradation
  if (longSession && heuristicCount > 0 && heuristicRate >= 0.15) return "context_pressure";

  // fallback_sensitive: sustained elevated fallback rate all-session
  if (heuristicRate >= FALLBACK_SENSITIVE_RATE) return "fallback_sensitive";

  return "stable_runtime";
}

// ─── Note builders ────────────────────────────────────────────────────────────

function buildRuntimeNote(state: StabilityState, input: ProductionStabilityInput, ar: boolean): string | null {
  if (state === "stable_runtime" || state === "insufficient_signal") return null;

  const { totalExchanges, consecutiveHeuristicAtEnd } = input;

  if (ar) {
    switch (state) {
      case "recovery_heavy":
        return "حوادث متعددة من التعافي في هذه الجلسة — يُشير إلى ضغط هيكلي متكرر على المزوّد الأساسي.";
      case "degraded_runtime":
        return `السلسلة الأخيرة (${consecutiveHeuristicAtEnd}) من الردود الإرشادية تُشير إلى تراجع نشط — الجلسة الحالية تعتمد على المسار الاحتياطي.`;
      case "monitoring_drift":
        return "الجلسة بدأت بشكل سليم لكن الردود الأخيرة تُظهر تراجعاً — ينبغي مراقبة الاستقرار المستمر.";
      case "context_pressure":
        return `جلسة طويلة (${totalExchanges} تبادلاً) مع وجود مؤشرات على ضغط في الموثوقية — جلسة جديدة قد تُحسّن الأداء.`;
      case "fallback_sensitive":
        return "معدل مرتفع مستمر من الردود الاحتياطية عبر الجلسة — التحليل يعكس مزيجاً من AI والأنماط المحلية.";
    }
  } else {
    switch (state) {
      case "recovery_heavy":
        return "Multiple recovery events in this session — signals recurring structural pressure on the primary provider.";
      case "degraded_runtime":
        return `Trailing streak of ${consecutiveHeuristicAtEnd} heuristic responses signals active degradation — session currently depending on fallback path.`;
      case "monitoring_drift":
        return "Session started healthy but recent responses show deterioration — continued stability warrants observation.";
      case "context_pressure":
        return `Long session (${totalExchanges} exchanges) with reliability pressure detected — a fresh session may improve performance.`;
      case "fallback_sensitive":
        return "Sustained elevated fallback rate across the session — analysis reflects a mix of AI and local pattern responses.";
    }
  }
  return null;
}

function buildDegradationNote(state: StabilityState, input: ProductionStabilityInput, ar: boolean): string | null {
  if (state !== "monitoring_drift" && state !== "degraded_runtime") return null;

  if (ar) {
    if (state === "monitoring_drift") {
      return `النمط العام للجلسة جيد لكن آخر ${input.consecutiveHeuristicAtEnd} ردود إرشادية — هذا التعارض يستحق الانتباه.`;
    }
    return `السلسلة المتتالية من الإخفاقات الأخيرة تُشير إلى تراجع نشط لا مجرد حالات متفرقة — الاستقرار يتطلب تدخلاً خارجياً.`;
  } else {
    if (state === "monitoring_drift") {
      return `Good overall session pattern but last ${input.consecutiveHeuristicAtEnd} responses are heuristic — this divergence warrants attention.`;
    }
    return "Consecutive trailing failures indicate active degradation rather than isolated incidents — stability requires external intervention.";
  }
}

function buildRecoveryNote(state: StabilityState, input: ProductionStabilityInput, ar: boolean): string | null {
  if (state !== "recovery_heavy") return null;

  if (ar) {
    return `${input.openAIFallbackCount} عمليات تعافٍ عبر هذه الجلسة — تعافي OpenAI يُغطّي الإخفاقات الأولية لكنه يُشير إلى هشاشة في الاستقرار.`;
  } else {
    return `${input.openAIFallbackCount} recovery operations this session — OpenAI recovery covers primary failures but signals structural fragility.`;
  }
}

// ─── Context string builder ───────────────────────────────────────────────────

function buildContextString(state: StabilityState): string {
  if (state === "stable_runtime" || state === "insufficient_signal") return "";
  return `Runtime stability: ${state.replace(/_/g, " ")}`.slice(0, 120);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeProductionStability(input: ProductionStabilityInput): ProductionStabilityResult {
  const stabilityState = deriveStabilityState(input);
  const runtimeNote = buildRuntimeNote(stabilityState, input, input.ar);
  const degradationNote = buildDegradationNote(stabilityState, input, input.ar);
  const recoveryNote = buildRecoveryNote(stabilityState, input, input.ar);
  const contextString = buildContextString(stabilityState);

  return {
    stabilityState,
    runtimeNote,
    degradationNote,
    recoveryNote,
    contextString,
    isAutonomousRemediation: false,
    isExecution: false,
    isProviderSwitching: false,
  };
}
