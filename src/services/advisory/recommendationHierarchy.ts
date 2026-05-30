// Phase-90A: Recommendation Hierarchy Engine
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Distinct from existing recommendation-adjacent modules:
//   committeeDebate.ts: committee STANCE labels (selective_over_broad/defensive/etc.)
//   allocatorDecisionEngine.ts: TACTICAL deployment stance per session
//   recommendationHierarchy (90A): INSTITUTIONAL RECOMMENDATION LADDER —
//                                   5 levels of advisory specificity from "watch"
//                                   to "selective_opportunity" to "high_uncertainty"
//
// The recommendation ladder is about the QUALITY and SPECIFICITY of the advisory
// output — not the direction (that's handled by macroBias/strategicBias). It answers:
//   "How actionable should this advisory framing be?"
//
// 5 levels (ascending advisory specificity):
//   watch:                    early-stage signal; monitor but no advisory stance yet
//   monitor_for_opportunity:  developing situation; conditions to watch before acting
//   selective_opportunity:    asymmetric setup; quality-differentiated deployment warranted
//   defensive_posture:        capital preservation leads; risk reduction priority
//   high_uncertainty:         evidence too thin or conflicting; no actionable stance
//
// Level derivation: regime + credit + consensus + regimeConf + oilContext
// Each level carries criteria, advisory text, and escalation conditions.
//
// Educational/advisory only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type RecommendationLevel =
  | "watch"
  | "monitor_for_opportunity"
  | "selective_opportunity"
  | "defensive_posture"
  | "high_uncertainty";

export interface RecommendationEntry {
  level:              RecommendationLevel;
  advisory:           string;  // ≤65 chars: what this means for allocators
  escalationUp:       string;  // ≤55 chars: what would raise the level
  escalationDown:     string;  // ≤55 chars: what would lower the level
  confidenceRange:    [number, number]; // appropriate confidence anchor range
}

export interface RecommendationResult {
  level:              RecommendationLevel;
  entry:              RecommendationEntry;
  levelRationale:     string;  // ≤60 chars: why this level
  recommendCtx:       string;  // ≤100 chars injectable
}

// ─── Recommendation library ───────────────────────────────────────────────────

const RECOMMENDATION_ENTRIES: Record<RecommendationLevel, RecommendationEntry> = {
  watch: {
    level:           "watch",
    advisory:        "Monitor; early-stage signal — no advisory stance warranted yet",
    escalationUp:    "Move to monitor_for_opportunity when signal strengthens",
    escalationDown:  "Stable — maintain watch posture",
    confidenceRange: [30, 50],
  },
  monitor_for_opportunity: {
    level:           "monitor_for_opportunity",
    advisory:        "Track specific conditions; selective entry if triggers confirm",
    escalationUp:    "Upgrade to selective_opportunity on confirmation signal",
    escalationDown:  "Return to watch if signals weaken or evidence deteriorates",
    confidenceRange: [42, 62],
  },
  selective_opportunity: {
    level:           "selective_opportunity",
    advisory:        "Asymmetric setup — selective quality deployment; evidence-weighted framing",
    escalationUp:    "Escalate to defensive_posture if credit stress rises materially",
    escalationDown:  "Downgrade to monitor if evidence weakens or regime shifts",
    confidenceRange: [55, 75],
  },
  defensive_posture: {
    level:           "defensive_posture",
    advisory:        "Capital preservation priority; reduce risk; deploy only in defensive names",
    escalationUp:    "Escalate toward high_uncertainty if evidence contradicts or crisis deepens",
    escalationDown:  "Return to monitor when credit stress normalises and CB backstop confirmed",
    confidenceRange: [35, 60],
  },
  high_uncertainty: {
    level:           "high_uncertainty",
    advisory:        "Evidence insufficient or conflicting; no actionable advisory position",
    escalationUp:    "Maintain high_uncertainty until evidence strengthens",
    escalationDown:  "Move to watch when at least one confirming signal appears",
    confidenceRange: [20, 45],
  },
};

// ─── Level derivation ─────────────────────────────────────────────────────────

function deriveLevel(
  primaryRegime:  string,
  macroBias:      "bullish" | "bearish" | "neutral",
  creditStress:   "low" | "moderate" | "high" | "extreme",
  consStrength:   "strong" | "moderate" | "weak" | "conflicted",
  regimeConf:     number,
  isSaudi:        boolean,
  oilPrice:       number | null | undefined,
): { level: RecommendationLevel; rationale: string } {
  const r = (primaryRegime ?? "").toLowerCase().replace(/[-\s]/g, "_");

  // High uncertainty conditions first
  if (regimeConf < 35 || consStrength === "conflicted") {
    return { level: "high_uncertainty", rationale: `regimeConf=${regimeConf}; consensus=${consStrength}` };
  }
  if (/macro_transition/.test(r) && consStrength === "weak") {
    return { level: "high_uncertainty", rationale: "transition + weak consensus" };
  }

  // Defensive conditions
  if (creditStress === "extreme") {
    return { level: "defensive_posture", rationale: "extreme credit stress" };
  }
  if (creditStress === "high" && macroBias === "bearish") {
    return { level: "defensive_posture", rationale: "high credit + bearish bias" };
  }
  if (/high_vol_risk_off/.test(r) && macroBias === "bearish") {
    return { level: "defensive_posture", rationale: "risk-off regime + bearish" };
  }

  // Saudi oil-specific downgrade
  if (isSaudi && oilPrice != null && oilPrice < 70 && creditStress !== "low") {
    return { level: "defensive_posture", rationale: `Saudi oil $${oilPrice} < $70 + credit pressure` };
  }

  // Selective opportunity
  if (macroBias === "bullish" && (creditStress === "low" || creditStress === "moderate") && regimeConf >= 55) {
    return { level: "selective_opportunity", rationale: `bullish + ${creditStress} credit + regimeConf=${regimeConf}` };
  }
  if (macroBias === "bullish" && consStrength === "strong") {
    return { level: "selective_opportunity", rationale: "bullish + strong consensus" };
  }
  if (isSaudi && oilPrice != null && oilPrice > 82 && macroBias !== "bearish") {
    return { level: "selective_opportunity", rationale: `Saudi oil $${oilPrice} > $82; fiscal supportive` };
  }

  // Monitor for opportunity
  if (/macro_transition/.test(r) || regimeConf < 55) {
    return { level: "monitor_for_opportunity", rationale: `transition; regimeConf=${regimeConf}` };
  }
  if (macroBias === "neutral") {
    return { level: "monitor_for_opportunity", rationale: "neutral macro bias" };
  }

  // Default: watch
  return { level: "watch", rationale: "insufficient signal for stronger recommendation" };
}

// ─── Context builder ──────────────────────────────────────────────────────────

function buildRecommendCtx(level: RecommendationLevel, rationale: string, advisory: string): string {
  return `Rec[${level}]: ${advisory.slice(0, 60)} (${rationale.slice(0, 35)})`.slice(0, 100);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildRecommendationLevel(input: {
  primaryRegime:     string;
  macroBias:         "bullish" | "bearish" | "neutral";
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
  consensusStrength: "strong" | "moderate" | "weak" | "conflicted";
  regimeConf:        number;
  isSaudi:           boolean;
  oilPrice?:         number | null;
}): RecommendationResult {
  const { primaryRegime, macroBias, creditStressLevel, consensusStrength, regimeConf, isSaudi, oilPrice } = input;

  const { level, rationale } = deriveLevel(primaryRegime, macroBias, creditStressLevel, consensusStrength, regimeConf, isSaudi, oilPrice);
  const entry = RECOMMENDATION_ENTRIES[level];

  return {
    level,
    entry,
    levelRationale:  rationale.slice(0, 60),
    recommendCtx:    buildRecommendCtx(level, rationale, entry.advisory),
  };
}
