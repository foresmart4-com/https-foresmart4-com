/**
 * Adaptive Session Monitoring — Phase 61
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Improves monitoring accuracy by weighting recent session exchanges more
 * heavily than distant history. Complements Phase-56 (broad session) and
 * Phase-60 (all-session stability) with a recent-window focused signal.
 *
 * Adaptive states:
 *   healthy_recent_window   — recent exchanges show consistent AI delivery
 *   degraded_recent_window  — recent window has elevated fallback rate
 *   fallback_window         — majority of recent exchanges used fallback path
 *   unstable_recent_behavior— recent deterioration relative to session baseline
 *   confidence_shift        — significant confidence drop in recent AI responses
 *   insufficient_window     — too few recent exchanges to classify
 *
 * Design rules:
 * - Bounded recent window only (last N exchanges, N≤5)
 * - No full-history dominance — recent signal can override historical pattern
 * - No unbounded memory accumulation
 * - Deterministic — same inputs always produce same output
 * - No autonomous adaptation — observation and advisory only
 * - Governance remains superior; adaptive signal is informational
 *
 * Safety assertions:
 *   isAutonomousAdaptation — always false; no self-modification
 *   isExecution            — always false; advisory only
 *   isUnboundedMemory      — always false; bounded window enforced by caller
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_WINDOW_FOR_SIGNAL        = 3;   // minimum exchanges in window to classify
const FALLBACK_WINDOW_RATE         = 0.60; // ≥60% recent heuristic = fallback_window
const DEGRADED_WINDOW_RATE         = 0.40; // ≥40% recent heuristic = degraded
const UNSTABLE_DRIFT_THRESHOLD     = 0.20; // recent rate exceeds session rate by this margin
const CONFIDENCE_SHIFT_DROP        = 15;  // recent avg confidence drops this much vs all-session

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdaptiveState =
  | "healthy_recent_window"    // recent exchanges show consistent AI delivery
  | "degraded_recent_window"   // recent window has elevated fallback rate
  | "fallback_window"          // majority of recent exchanges used fallback path
  | "unstable_recent_behavior" // recent deterioration relative to session baseline
  | "confidence_shift"         // significant confidence drop in recent AI responses
  | "insufficient_window";     // too few recent exchanges to classify

export interface AdaptiveMonitoringInput {
  windowSize: number;                  // actual recent window size (≤5)
  recentHeuristicCount: number;        // heuristic responses in recent window
  recentOpenAICount: number;           // OpenAI fallback uses in recent window
  recentAISuccessCount: number;        // successful primary-AI responses in recent window
  allSessionHeuristicRate: number;     // all-session heuristic rate 0-1 (baseline)
  recentConfidenceAvg: number | null;  // avg confidence of recent AI responses; null if no AI
  allSessionConfidenceAvg: number | null; // avg confidence all-session; null if no AI
  ar: boolean;
}

export interface AdaptiveMonitoringResult {
  adaptiveState: AdaptiveState;
  recentHealthNote: string | null;     // 1 sentence; null when healthy or insufficient
  recentFallbackNote: string | null;   // 1 sentence on recent fallback pattern; null when clean
  confidenceShiftNote: string | null;  // 1 sentence on confidence change; null when stable
  contextString: string;               // compact ≤120 chars; empty when healthy or insufficient
  // Safety assertions — always enforced; no exceptions
  readonly isAutonomousAdaptation: false;
  readonly isExecution: false;
  readonly isUnboundedMemory: false;
}

// ─── Adaptive state derivation ────────────────────────────────────────────────

function deriveAdaptiveState(input: AdaptiveMonitoringInput): AdaptiveState {
  const {
    windowSize, recentHeuristicCount, allSessionHeuristicRate,
    recentConfidenceAvg, allSessionConfidenceAvg,
  } = input;

  if (windowSize < MIN_WINDOW_FOR_SIGNAL) return "insufficient_window";

  const recentHeuristicRate = recentHeuristicCount / windowSize;

  // fallback_window: most recent exchanges are heuristic fallbacks
  if (recentHeuristicRate >= FALLBACK_WINDOW_RATE) return "fallback_window";

  // unstable_recent_behavior: recent rate significantly worse than all-session baseline
  // (the session was healthier before; recent exchanges are degrading)
  if (
    recentHeuristicRate >= DEGRADED_WINDOW_RATE &&
    recentHeuristicRate - allSessionHeuristicRate >= UNSTABLE_DRIFT_THRESHOLD
  ) {
    return "unstable_recent_behavior";
  }

  // confidence_shift: significant drop in confidence of recent AI responses
  if (
    recentConfidenceAvg !== null &&
    allSessionConfidenceAvg !== null &&
    allSessionConfidenceAvg - recentConfidenceAvg >= CONFIDENCE_SHIFT_DROP
  ) {
    return "confidence_shift";
  }

  // degraded_recent_window: elevated fallback without unstable acceleration
  if (recentHeuristicRate >= DEGRADED_WINDOW_RATE) return "degraded_recent_window";

  return "healthy_recent_window";
}

// ─── Note builders ────────────────────────────────────────────────────────────

function buildRecentHealthNote(state: AdaptiveState, input: AdaptiveMonitoringInput, ar: boolean): string | null {
  if (state === "healthy_recent_window" || state === "insufficient_window") return null;

  const { windowSize, recentHeuristicCount } = input;
  const pct = Math.round((recentHeuristicCount / windowSize) * 100);

  if (ar) {
    switch (state) {
      case "fallback_window":
        return `أغلب الردود الأخيرة (${pct}%) في النافذة استخدمت المسار الاحتياطي — التحليل الحالي يعتمد بشكل رئيسي على الأنماط المحلية.`;
      case "unstable_recent_behavior":
        return `الأداء الأخير أسوأ بشكل ملحوظ من متوسط الجلسة — نمط التراجع يتصاعد وليس مستقراً.`;
      case "confidence_shift":
        return `متوسط الثقة في الردود الأخيرة انخفض بشكل لافت مقارنةً بالجلسة الكاملة — تراجع ملحوظ في تماسك التحليل.`;
      case "degraded_recent_window":
        return `معدل الاحتياطي في النافذة الأخيرة (${pct}%) مرتفع، لكن أعلى من الجلسة الكاملة بفارق معتدل.`;
    }
  } else {
    switch (state) {
      case "fallback_window":
        return `Majority of recent exchanges (${pct}%) in window used fallback path — current analysis relies primarily on local patterns.`;
      case "unstable_recent_behavior":
        return `Recent performance is materially worse than the session average — the degradation pattern is accelerating rather than stable.`;
      case "confidence_shift":
        return `Recent AI response confidence average has dropped materially below session baseline — notable decline in analysis coherence.`;
      case "degraded_recent_window":
        return `Recent window fallback rate (${pct}%) is elevated, though exceeds the all-session rate by a moderate margin.`;
    }
  }
  return null;
}

function buildRecentFallbackNote(state: AdaptiveState, input: AdaptiveMonitoringInput, ar: boolean): string | null {
  if (state !== "fallback_window" && state !== "degraded_recent_window" && state !== "unstable_recent_behavior") return null;

  const { recentOpenAICount, windowSize } = input;

  if (ar) {
    if (recentOpenAICount > 0) {
      return `OpenAI استُخدم ${recentOpenAICount === 1 ? "مرة" : `${recentOpenAICount} مرات`} في النافذة الأخيرة (${windowSize} تبادلات) — الحوكمة سليمة.`;
    }
    return `الردود الاحتياطية الإرشادية نشطة في النافذة الأخيرة — لا استجابة مباشرة من AI في التحليل الحالي.`;
  } else {
    if (recentOpenAICount > 0) {
      return `OpenAI used ${recentOpenAICount} ${recentOpenAICount === 1 ? "time" : "times"} in the recent window (${windowSize} exchanges) — governance unaffected.`;
    }
    return `Heuristic fallback responses active in the recent window — no direct AI response in current analysis.`;
  }
}

function buildConfidenceShiftNote(state: AdaptiveState, input: AdaptiveMonitoringInput, ar: boolean): string | null {
  if (state !== "confidence_shift") return null;
  if (input.recentConfidenceAvg === null || input.allSessionConfidenceAvg === null) return null;

  const drop = Math.round(input.allSessionConfidenceAvg - input.recentConfidenceAvg);

  if (ar) {
    return `الثقة الأخيرة أقل بـ${drop} نقطة من متوسط الجلسة — انخفاض معتدل يُشير إلى تراجع في تناسق الأدلة أو استجابات الجلسة الأخيرة.`;
  } else {
    return `Recent confidence is ${drop} pts below session average — moderate drop suggests declining evidence coherence in recent responses.`;
  }
}

// ─── Context string builder ───────────────────────────────────────────────────

function buildContextString(state: AdaptiveState, input: AdaptiveMonitoringInput): string {
  if (state === "healthy_recent_window" || state === "insufficient_window") return "";
  const stateLabel = state.replace(/_/g, " ");

  if (state === "confidence_shift" && input.recentConfidenceAvg !== null) {
    return `Recent monitoring: ${stateLabel} | avg confidence ${Math.round(input.recentConfidenceAvg)}%`.slice(0, 120);
  }
  return `Recent monitoring: ${stateLabel}`.slice(0, 120);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeAdaptiveMonitoring(input: AdaptiveMonitoringInput): AdaptiveMonitoringResult {
  const adaptiveState = deriveAdaptiveState(input);
  const recentHealthNote = buildRecentHealthNote(adaptiveState, input, input.ar);
  const recentFallbackNote = buildRecentFallbackNote(adaptiveState, input, input.ar);
  const confidenceShiftNote = buildConfidenceShiftNote(adaptiveState, input, input.ar);
  const contextString = buildContextString(adaptiveState, input);

  return {
    adaptiveState,
    recentHealthNote,
    recentFallbackNote,
    confidenceShiftNote,
    contextString,
    isAutonomousAdaptation: false,
    isExecution: false,
    isUnboundedMemory: false,
  };
}
