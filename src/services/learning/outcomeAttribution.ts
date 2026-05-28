/**
 * Outcome Attribution Intelligence — Phase 37
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Evaluates WHY thesis outcomes occurred by weighing observable evidence
 * factors. Attribution is explanatory and probabilistic — never causal.
 *
 * Attribution labels:
 *   evidence_aligned    — outcome consistent with signal quality
 *   regime_supported    — regime alignment was primary explanatory factor
 *   catalyst_supported  — catalyst / debate direction was primary driver
 *   mixed_attribution   — multiple factors partially explain; no single dominant factor
 *   luck_or_noise       — outcome pattern not explained by evidence quality
 *   attribution_unclear — insufficient context to attribute meaningfully
 *
 * Design rules:
 * - Explanatory only: correlation ≠ causation; never assert proven cause
 * - Honest default: attribution_unclear when evidence is insufficient
 * - Uncertainty allowed: mixed_attribution is valid and informative
 * - No fabricated improvement: never claim attribution without observable evidence
 * - Hedged language only: "likely driven by", "partially explained by",
 *   "evidence aligned with", "attribution uncertain", "outcome not fully explained"
 * - Deterministic: derived from existing computed signals, no randomness
 */

import type { OutcomeSummary } from "@/services/learning/outcomeEngine";
import type { CalibrationScore } from "@/services/learning/decisionScoring";
import type { TrustState } from "@/services/intelligence/trustStrategyEngine";
import type { CredibilityLabel } from "@/services/credibility/credibilityEngine";
import type { DebateBalance } from "@/services/intelligence/debateEngine";
import type { FirewallState } from "@/services/governance/decisionFirewall";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttributionLabel =
  | "evidence_aligned"      // outcome consistent with evidence quality and signal alignment
  | "regime_supported"      // regime identification was primary explanatory factor
  | "catalyst_supported"    // catalyst / debate direction was primary explanatory driver
  | "mixed_attribution"     // multiple factors partially explain; no single dominant factor
  | "luck_or_noise"         // outcome pattern not explained by evidence or regime quality
  | "attribution_unclear";  // insufficient observable context to attribute meaningfully

export type AttributionFactor =
  | "regime_alignment"       // did regime match thesis direction?
  | "macro_alignment"        // did macro signals align with outcome?
  | "cross_asset_support"    // did cross-asset signals support?
  | "credibility_quality"    // was source credibility sufficient?
  | "debate_outcome"         // which debate side prevailed?
  | "portfolio_pressure"     // did portfolio vulnerability influence outcome?
  | "catalyst_accuracy"      // were predicted catalysts present?
  | "invalidation_quality";  // was invalidation trigger clearly defined?

export interface AttributionFactorResult {
  factor: AttributionFactor;
  contribution: "strong" | "partial" | "weak" | "absent";
  note: string;  // hedged 1-sentence advisory, no certainty language
}

export interface OutcomeAttributionInput {
  outcomeSummary: OutcomeSummary;
  calibrationScore: CalibrationScore;
  trustState: TrustState;
  credibilityLabel: CredibilityLabel;
  debateBalance: DebateBalance;
  hasMaterialDisagreement: boolean;
  firewallState: FirewallState;
  hasActiveVulnerability: boolean;
  regime: string;
  ar: boolean;
}

export interface OutcomeAttributionResult {
  label: AttributionLabel;
  dominantFactor: AttributionFactor | null;
  factors: AttributionFactorResult[];
  summary: string;          // 1-2 sentences, hedged language only
  contextString: string;    // compact ≤130 chars for AI injection
  hasAttribution: boolean;  // false when attribution_unclear
  readonly isCausal: false; // always false — attribution is explanatory, never causal
}

// ─── Signal scoring ───────────────────────────────────────────────────────────

interface SignalScore {
  points: number;
  factors: Partial<Record<AttributionFactor, "strong" | "partial" | "weak" | "absent">>;
}

function scoreSignals(input: OutcomeAttributionInput): SignalScore {
  const { calibrationScore, trustState, credibilityLabel, debateBalance,
    hasMaterialDisagreement, firewallState, hasActiveVulnerability,
    outcomeSummary, regime } = input;

  let points = 0;
  const factors: SignalScore["factors"] = {};

  // ── Calibration / trust ───────────────────────────────────────────────────
  if (calibrationScore === "well_calibrated") {
    points += 3;
    factors["catalyst_accuracy"] = "strong";
  } else if (calibrationScore === "moderately_calibrated") {
    points += 1;
    factors["catalyst_accuracy"] = "partial";
  } else if (calibrationScore === "weakly_calibrated") {
    points -= 3;
    factors["catalyst_accuracy"] = "weak";
  } else {
    // insufficient_data
    factors["catalyst_accuracy"] = "absent";
  }

  if (trustState === "stable_calibration" || trustState === "improving_calibration") {
    points += 2;
  } else if (trustState === "fragile_calibration") {
    points -= 2;
  }

  // ── Credibility quality ───────────────────────────────────────────────────
  if (credibilityLabel === "high_credibility") {
    points += 3;
    factors["credibility_quality"] = "strong";
  } else if (credibilityLabel === "medium_credibility") {
    points += 1;
    factors["credibility_quality"] = "partial";
  } else if (credibilityLabel === "low_credibility") {
    points -= 3;
    factors["credibility_quality"] = "absent";
  } else {
    // uncertain_credibility — neutral
    factors["credibility_quality"] = "weak";
  }

  // ── Firewall / governance ─────────────────────────────────────────────────
  if (firewallState === "cleared") {
    points += 2;
    factors["invalidation_quality"] = "strong";
  } else if (firewallState === "caution") {
    points += 1;
    factors["invalidation_quality"] = "partial";
  } else if (firewallState === "constrained") {
    points -= 1;
    factors["invalidation_quality"] = "weak";
  } else {
    // blocked
    points -= 3;
    factors["invalidation_quality"] = "absent";
  }

  // ── Debate outcome ────────────────────────────────────────────────────────
  if (!hasMaterialDisagreement && (debateBalance === "bull_dominant" || debateBalance === "bear_dominant")) {
    points += 1;
    factors["debate_outcome"] = "partial";
  } else if (hasMaterialDisagreement || debateBalance === "contested") {
    points -= 2;
    factors["debate_outcome"] = "weak";
  } else {
    // inconclusive
    factors["debate_outcome"] = "absent";
  }

  // ── Regime alignment ──────────────────────────────────────────────────────
  const hasRegime = regime.trim().length > 3;
  if (hasRegime && firewallState !== "blocked") {
    points += 1;
    factors["regime_alignment"] = hasRegime && !hasMaterialDisagreement ? "partial" : "weak";
  } else if (hasRegime) {
    factors["regime_alignment"] = "weak";
  } else {
    factors["regime_alignment"] = "absent";
  }

  // ── Outcome pattern ───────────────────────────────────────────────────────
  const actionable = outcomeSummary.confirmed + outcomeSummary.weakened + outcomeSummary.invalidated;
  if (actionable > 0) {
    if (outcomeSummary.confirmed > outcomeSummary.weakened + outcomeSummary.invalidated) {
      points += 2;
      factors["macro_alignment"] = "partial";
    } else if (outcomeSummary.invalidated > outcomeSummary.confirmed) {
      points -= 2;
      factors["macro_alignment"] = "weak";
    } else {
      factors["macro_alignment"] = "partial";
    }
  } else {
    factors["macro_alignment"] = "absent";
  }

  // ── Portfolio pressure ────────────────────────────────────────────────────
  if (hasActiveVulnerability && outcomeSummary.weakened > 0) {
    points -= 1;
    factors["portfolio_pressure"] = "strong";
  } else if (hasActiveVulnerability) {
    points -= 1;
    factors["portfolio_pressure"] = "partial";
  } else {
    factors["portfolio_pressure"] = "absent";
  }

  // ── Cross-asset support (derived from debate + regime) ────────────────────
  factors["cross_asset_support"] =
    firewallState === "cleared" && !hasMaterialDisagreement ? "partial" :
    firewallState === "blocked" ? "absent" : "weak";

  return { points, factors };
}

// ─── Label derivation ─────────────────────────────────────────────────────────

function deriveLabel(
  score: SignalScore,
  input: OutcomeAttributionInput,
): AttributionLabel {
  const { points } = score;
  const { calibrationScore, outcomeSummary, firewallState, hasMaterialDisagreement,
    trustState, debateBalance } = input;

  const actionable = outcomeSummary.confirmed + outcomeSummary.weakened + outcomeSummary.invalidated;
  const hasOutcomeData = outcomeSummary.hasActionableOutcome || actionable > 0;

  // No data at all → attribution_unclear
  if (calibrationScore === "insufficient_data" && !hasOutcomeData) {
    return "attribution_unclear";
  }

  // Strong negative: luck_or_noise
  if (points <= -4 || (hasMaterialDisagreement && outcomeSummary.weakened > outcomeSummary.confirmed + 1)) {
    return "luck_or_noise";
  }

  // Strong positive: evidence_aligned
  if (points >= 8 && calibrationScore === "well_calibrated" &&
      (trustState === "stable_calibration" || trustState === "improving_calibration")) {
    return "evidence_aligned";
  }

  // Regime-led explanation
  if (points >= 5 && input.regime.trim().length > 3 && !hasMaterialDisagreement &&
      firewallState !== "blocked" && calibrationScore !== "weakly_calibrated") {
    return "regime_supported";
  }

  // Catalyst / debate explanation
  if (points >= 3 && (debateBalance === "bull_dominant" || debateBalance === "bear_dominant") &&
      !hasMaterialDisagreement && calibrationScore !== "weakly_calibrated") {
    return "catalyst_supported";
  }

  // Positive but mixed
  if (points > 0) {
    return "mixed_attribution";
  }

  // Near-zero with no outcome data → unclear
  if (!hasOutcomeData || calibrationScore === "insufficient_data") {
    return "attribution_unclear";
  }

  return "mixed_attribution";
}

// ─── Dominant factor selection ────────────────────────────────────────────────

function selectDominantFactor(
  label: AttributionLabel,
  factors: SignalScore["factors"],
): AttributionFactor | null {
  if (label === "attribution_unclear") return null;

  // Ordered preference by label
  if (label === "evidence_aligned") {
    return "catalyst_accuracy";
  }
  if (label === "regime_supported") {
    return "regime_alignment";
  }
  if (label === "catalyst_supported") {
    return "debate_outcome";
  }
  if (label === "luck_or_noise") {
    return factors["portfolio_pressure"] === "strong" ? "portfolio_pressure" : "debate_outcome";
  }
  // mixed_attribution → highest-contribution positive factor
  const order: AttributionFactor[] = [
    "credibility_quality", "regime_alignment", "debate_outcome",
    "catalyst_accuracy", "macro_alignment", "cross_asset_support",
    "invalidation_quality", "portfolio_pressure",
  ];
  for (const f of order) {
    if (factors[f] === "strong" || factors[f] === "partial") return f;
  }
  return null;
}

// ─── Factor result builder ────────────────────────────────────────────────────

function buildFactorResults(
  factors: SignalScore["factors"],
  input: OutcomeAttributionInput,
  ar: boolean,
): AttributionFactorResult[] {
  const ALL_FACTORS: AttributionFactor[] = [
    "regime_alignment", "macro_alignment", "cross_asset_support",
    "credibility_quality", "debate_outcome", "portfolio_pressure",
    "catalyst_accuracy", "invalidation_quality",
  ];

  const NOTES_EN: Record<AttributionFactor, Record<"strong" | "partial" | "weak" | "absent", string>> = {
    regime_alignment: {
      strong: "Regime likely drove outcome direction; regime identification was consistent.",
      partial: "Regime partially aligned with outcome; correlation observed, not proven.",
      weak: "Regime alignment weak; outcome partially consistent with regime framing.",
      absent: "No clear regime data; regime factor absent from attribution.",
    },
    macro_alignment: {
      strong: "Macro signal pattern consistent with confirmed outcomes; evidence aligned.",
      partial: "Macro signals partially explain outcome; mixed evidence quality.",
      weak: "Macro alignment weak; conflicting signals reduce explanatory power.",
      absent: "No actionable macro outcome data to attribute.",
    },
    cross_asset_support: {
      strong: "Cross-asset signals likely supported the outcome direction.",
      partial: "Cross-asset signals partially correlated with outcome.",
      weak: "Cross-asset signals diverged; explanatory value limited.",
      absent: "Insufficient cross-asset context to attribute.",
    },
    credibility_quality: {
      strong: "High-credibility source context; evidence quality likely contributed.",
      partial: "Moderate credibility; partially explained by source quality.",
      weak: "Credibility uncertain; evidence quality attribution unclear.",
      absent: "Low-credibility signals; credibility factor likely absent.",
    },
    debate_outcome: {
      strong: "Dominant debate position aligned with observed outcome.",
      partial: "Debate balance partially explained outcome direction.",
      weak: "Contested debate; debate outcome attribution uncertain.",
      absent: "No clear debate signal; factor not explanatory.",
    },
    portfolio_pressure: {
      strong: "Active portfolio vulnerability likely influenced outcome pressure.",
      partial: "Portfolio exposure partially contributed to observed outcome.",
      weak: "Mild portfolio pressure; limited explanatory contribution.",
      absent: "No portfolio vulnerability detected; factor absent.",
    },
    catalyst_accuracy: {
      strong: "Well-calibrated signals; catalysts likely explanatory.",
      partial: "Moderate calibration; catalysts partially explained outcome.",
      weak: "Weak calibration; catalyst accuracy attribution uncertain.",
      absent: "Insufficient calibration data; catalyst factor not attributable.",
    },
    invalidation_quality: {
      strong: "Governance cleared; invalidation conditions were clearly defined.",
      partial: "Partial governance; invalidation quality contributed.",
      weak: "Constrained governance; invalidation definition reduced clarity.",
      absent: "Firewall blocked; invalidation quality attribution absent.",
    },
  };

  const NOTES_AR: Record<AttributionFactor, Record<"strong" | "partial" | "weak" | "absent", string>> = {
    regime_alignment: {
      strong: "النظام يُرجَّح أنه قاد اتجاه النتيجة؛ تحديد النظام كان متسقاً.",
      partial: "توافق النظام جزئياً مع النتيجة؛ ارتباط ملاحظ لا مُثبت.",
      weak: "توافق النظام ضعيف؛ النتيجة متسقة جزئياً مع إطار النظام.",
      absent: "لا بيانات نظام واضحة؛ عامل النظام غائب عن الإسناد.",
    },
    macro_alignment: {
      strong: "نمط الإشارات الكلية متسق مع النتائج المؤكدة؛ الأدلة متوافقة.",
      partial: "الإشارات الكلية تُفسّر النتيجة جزئياً؛ جودة أدلة مختلطة.",
      weak: "توافق كلي ضعيف؛ إشارات متضاربة تقلل من القوة التفسيرية.",
      absent: "لا بيانات نتائج كلية قابلة للتنفيذ للإسناد.",
    },
    cross_asset_support: {
      strong: "إشارات متعددة الأصول يُرجَّح أنها دعمت اتجاه النتيجة.",
      partial: "إشارات متعددة الأصول ارتبطت جزئياً بالنتيجة.",
      weak: "تباين إشارات متعددة الأصول؛ قيمة تفسيرية محدودة.",
      absent: "سياق متعدد الأصول غير كافٍ للإسناد.",
    },
    credibility_quality: {
      strong: "سياق مصدر عالي المصداقية؛ جودة الأدلة يُرجَّح أنها أسهمت.",
      partial: "مصداقية معتدلة؛ مُفسَّر جزئياً بجودة المصدر.",
      weak: "مصداقية غير محددة؛ إسناد جودة الأدلة غير واضح.",
      absent: "إشارات مصداقية منخفضة؛ عامل المصداقية يُرجَّح أنه غائب.",
    },
    debate_outcome: {
      strong: "الموقف الغالب في النقاش توافق مع النتيجة الملاحظة.",
      partial: "توازن النقاش فسَّر جزئياً اتجاه النتيجة.",
      weak: "نقاش متنازع؛ إسناد نتيجة النقاش غير مؤكد.",
      absent: "لا إشارة نقاشية واضحة؛ العامل غير تفسيري.",
    },
    portfolio_pressure: {
      strong: "ثغرة المحفظة النشطة يُرجَّح أنها أثرت في ضغط النتيجة.",
      partial: "تعرض المحفظة أسهم جزئياً في النتيجة الملاحظة.",
      weak: "ضغط محفظة خفيف؛ إسهام تفسيري محدود.",
      absent: "لم يُكتشف أي ثغرة في المحفظة؛ العامل غائب.",
    },
    catalyst_accuracy: {
      strong: "إشارات معايَرة جيداً؛ دقة المحفزات يُرجَّح أنها تفسيرية.",
      partial: "معايرة معتدلة؛ المحفزات فسَّرت النتيجة جزئياً.",
      weak: "معايرة ضعيفة؛ إسناد دقة المحفزات غير مؤكد.",
      absent: "بيانات معايرة غير كافية؛ عامل المحفز غير قابل للإسناد.",
    },
    invalidation_quality: {
      strong: "الحوكمة واضحة؛ شروط الإلغاء كانت محددة بوضوح.",
      partial: "حوكمة جزئية؛ جودة الإلغاء أسهمت.",
      weak: "حوكمة مقيَّدة؛ تعريف الإلغاء قلل من الوضوح.",
      absent: "جدار الحماية محظور؛ إسناد جودة الإلغاء غائب.",
    },
  };

  const notes = ar ? NOTES_AR : NOTES_EN;

  return ALL_FACTORS.map((f) => {
    const contribution = factors[f] ?? "absent";
    return {
      factor: f,
      contribution,
      note: notes[f][contribution],
    };
  });
}

// ─── Summary builder ──────────────────────────────────────────────────────────

function buildSummary(label: AttributionLabel, dominant: AttributionFactor | null, ar: boolean): string {
  const factorLabel = dominant ? dominant.replace(/_/g, " ") : "";
  if (ar) {
    switch (label) {
      case "evidence_aligned":
        return `النتيجة متوافقة مع الأدلة${factorLabel ? `؛ يُرجَّح أنها مدفوعة بـ ${factorLabel}` : ""}. الإشارات كانت متسقة داخلياً.`;
      case "regime_supported":
        return `النتيجة مُفسَّرة جزئياً بتوافق النظام؛ الإشارات الاتجاهية كانت متسقة${dominant ? ` مع ${factorLabel}` : ""}.`;
      case "catalyst_supported":
        return `الأدلة متوافقة مع اتجاه النقاش${factorLabel ? `؛ ${factorLabel} يُرجَّح أنه أسهم` : ""}. إسناد مُحتمل لا مؤكد.`;
      case "mixed_attribution":
        return `الإسناد غير مؤكد؛ عوامل متعددة تُفسّر النتيجة جزئياً. لا يوجد عامل مهيمن واحد.`;
      case "luck_or_noise":
        return `النمط الناتج غير مُفسَّر بالكامل بجودة الأدلة. الإسناد يبقى غير مؤكد.`;
      case "attribution_unclear":
      default:
        return `سياق غير كافٍ لإسناد ذي معنى. الإسناد يتطلب مزيداً من البيانات القابلة للملاحظة.`;
    }
  }
  switch (label) {
    case "evidence_aligned":
      return `Outcome consistent with evidence quality${factorLabel ? `; likely driven by ${factorLabel}` : ""}. Signals were internally coherent.`;
    case "regime_supported":
      return `Outcome partially explained by regime alignment; directional signals were coherent${dominant ? ` with ${factorLabel}` : ""}.`;
    case "catalyst_supported":
      return `Evidence aligned with debate direction${factorLabel ? `; ${factorLabel} likely contributed` : ""}. Attribution is probable, not proven.`;
    case "mixed_attribution":
      return `Attribution uncertain; multiple factors partially explain the outcome pattern. No single dominant factor.`;
    case "luck_or_noise":
      return `Outcome pattern not fully explained by evidence quality. Attribution remains uncertain.`;
    case "attribution_unclear":
    default:
      return `Insufficient context for meaningful attribution. Attribution requires further observable data.`;
  }
}

// ─── Context string builder ───────────────────────────────────────────────────

function buildContextString(label: AttributionLabel, dominant: AttributionFactor | null): string {
  if (label === "attribution_unclear") return "";
  const factorStr = dominant ? `; ${dominant.replace(/_/g, " ")}` : "";
  return `Attribution: ${label.replace(/_/g, " ")}${factorStr}`.slice(0, 130);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeOutcomeAttribution(input: OutcomeAttributionInput): OutcomeAttributionResult {
  const { ar } = input;

  const scored = scoreSignals(input);
  const label = deriveLabel(scored, input);
  const dominant = selectDominantFactor(label, scored.factors);
  const factorResults = buildFactorResults(scored.factors, input, ar);
  const summary = buildSummary(label, dominant, ar);
  const contextString = buildContextString(label, dominant);

  return {
    label,
    dominantFactor: dominant,
    factors: factorResults,
    summary,
    contextString,
    hasAttribution: label !== "attribution_unclear",
    isCausal: false,
  };
}
