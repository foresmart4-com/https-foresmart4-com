/**
 * Cross-Market Regime Intelligence — Phase 41
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Analyzes relationships between market segments to determine whether
 * equities, commodities, currencies, rates, and crypto support or
 * contradict each other in the current macro environment.
 *
 * Regime labels:
 *   aligned_regime      — markets support each other; multi-segment confirmation
 *   partially_aligned   — partial confirmation; some segments diverge
 *   conflicting_regime  — markets contradict each other; opposing signals active
 *   weak_signal_regime  — insufficient cross-market signal for regime assessment
 *   regime_divergence   — clear leadership divergence between market segments
 *
 * Evaluated dimensions:
 *   dollarPressure      — USD strength / DXY implication for risk assets
 *   ratePressure        — rates / yield environment; CB policy transmission
 *   commodityPressure   — oil, metals, and commodity-market direction
 *   defensiveFlow       — safe-haven / defensive capital allocation signal
 *   riskOnRiskOff       — aggregate risk appetite across segments
 *   inflationPressure   — commodity + macro signals implying inflation dynamics
 *
 * Design rules:
 * - No deterministic prediction: labels describe relationships, not outcomes
 * - No causality claims: cross-market correlation ≠ confirmed transmission
 * - Honest default: weak_signal_regime when evidence is insufficient
 * - Hedged language only in narratives
 */

import type { MarketRegime, StressLevel, RotationSignal } from "@/services/market/marketIntelEngine";
import type { AssetCategory } from "@/lib/market-data";
import type { StrategicBias } from "@/services/intelligence/strategicEngine";
import type { DebateBalance } from "@/services/intelligence/debateEngine";
import type { EventSignificance, MacroEventType } from "@/services/macro/macroEventEngine";
import type { PortfolioRiskLabel } from "@/services/portfolio/portfolioRiskEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CrossMarketRegimeLabel =
  | "aligned_regime"      // multi-segment confirmation; markets support each other
  | "partially_aligned"   // partial confirmation; some divergence present
  | "conflicting_regime"  // opposing signals active; markets contradict each other
  | "weak_signal_regime"  // insufficient signal for regime assessment
  | "regime_divergence";  // clear leadership divergence between segments

export type DimensionSignal = "positive" | "negative" | "neutral" | "conflicted";

export interface CrossMarketDimensions {
  dollarPressure: DimensionSignal;    // USD strength implication
  ratePressure: DimensionSignal;      // yield / CB policy environment
  commodityPressure: DimensionSignal; // oil + metals directional signal
  defensiveFlow: DimensionSignal;     // safe-haven capital allocation
  riskOnRiskOff: DimensionSignal;     // aggregate risk appetite
  inflationPressure: DimensionSignal; // commodity + macro inflation signal
  macroLeadership: string;            // which segment is leading; hedged 1 phrase
}

export interface CrossMarketRegimeInput {
  marketRegime: MarketRegime;
  regimeConf: number;                  // 0-100
  riskOnScore: number;                 // -100..+100
  stressLevel: StressLevel;
  rotationSignal: RotationSignal;
  regimeTransition: boolean;
  divergenceDetected: boolean;
  divergenceDescription: string;
  breadthBullPct: number;              // 0-100
  leadingCategories: AssetCategory[];  // top gaining categories
  laggingCategories: AssetCategory[];  // top losing categories
  strategicBias: StrategicBias;
  hasConflict: boolean;
  debateBalance: DebateBalance;
  hasMaterialDisagreement: boolean;
  macroSignificance: EventSignificance;
  macroEventType: MacroEventType | null;
  portfolioRiskLabel: PortfolioRiskLabel;
  ar: boolean;
}

export interface CrossMarketRegimeResult {
  label: CrossMarketRegimeLabel;
  dimensions: CrossMarketDimensions;
  alignmentScore: number;          // 0-100 internal cross-segment alignment
  narrative: string;               // 1-2 sentences, hedged language
  contextString: string;           // compact ≤130 chars; empty for weak_signal_regime
  hasStrongAlignment: boolean;     // true for aligned_regime only
  hasConflict: boolean;            // true for conflicting_regime / regime_divergence
}

// ─── Dimension analysis ────────────────────────────────────────────────────────

function analyzeDimensions(input: CrossMarketRegimeInput): CrossMarketDimensions {
  const {
    marketRegime, riskOnScore, stressLevel, rotationSignal,
    leadingCategories, laggingCategories, macroEventType,
    macroSignificance, portfolioRiskLabel,
  } = input;

  // ── Dollar pressure (USD/DXY) ──────────────────────────────────────────────
  // defensive_bid rotation → safe-haven = typically USD positive
  // risk_off regime → typically USD positive (safe haven)
  // risk_on with crypto_bid or broad_rally → typically USD negative
  let dollarPressure: DimensionSignal = "neutral";
  if (rotationSignal === "defensive_bid" || (marketRegime === "risk_off" && stressLevel !== "low")) {
    dollarPressure = "positive"; // USD strength signal
  } else if (
    marketRegime === "risk_on" &&
    (rotationSignal === "broad_rally" || rotationSignal === "crypto_bid")
  ) {
    dollarPressure = "negative"; // USD weakness / risk-on outflows
  } else if (stressLevel === "high") {
    dollarPressure = "conflicted"; // extreme stress can pull both ways
  }

  // ── Rate pressure (yield / CB environment) ─────────────────────────────────
  // Rate-relevant macro events, stress, bonds leading/lagging
  let ratePressure: DimensionSignal = "neutral";
  if (
    macroEventType === "interest_rate_decision" ||
    macroEventType === "central_bank_meeting" ||
    macroEventType === "liquidity_monetary"
  ) {
    ratePressure = macroSignificance === "critical" || macroSignificance === "meaningful"
      ? "conflicted" // rate event creates uncertainty
      : "neutral";
  } else if (leadingCategories.includes("bonds")) {
    ratePressure = "positive"; // bonds bid = yield falling = easing bias
  } else if (laggingCategories.includes("bonds") && stressLevel === "high") {
    ratePressure = "negative"; // bonds selling in stress = yield rising
  }

  // ── Commodity pressure (oil + metals) ─────────────────────────────────────
  let commodityPressure: DimensionSignal = "neutral";
  if (
    rotationSignal === "metals_bid" ||
    leadingCategories.includes("metals") ||
    leadingCategories.includes("oil")
  ) {
    commodityPressure = "positive"; // commodities bid
  } else if (
    macroEventType === "oil_price_move" &&
    (laggingCategories.includes("oil") || stressLevel !== "low")
  ) {
    commodityPressure = "negative"; // oil under pressure
  } else if (macroEventType === "cpi_inflation") {
    commodityPressure = "positive"; // inflation event = commodity relevance elevated
  }

  // ── Defensive flow (safe-haven capital) ────────────────────────────────────
  let defensiveFlow: DimensionSignal = "neutral";
  if (
    rotationSignal === "defensive_bid" ||
    rotationSignal === "metals_bid" ||
    (marketRegime === "risk_off" && leadingCategories.includes("metals"))
  ) {
    defensiveFlow = "positive"; // defensive capital actively flowing
  } else if (marketRegime === "risk_on" && rotationSignal === "broad_rally") {
    defensiveFlow = "negative"; // defensive capital not flowing; risk appetite active
  } else if (portfolioRiskLabel === "defensive") {
    defensiveFlow = "positive"; // portfolio reflects defensive posture
  }

  // ── Risk-on / risk-off ─────────────────────────────────────────────────────
  let riskOnRiskOff: DimensionSignal = "neutral";
  if (riskOnScore >= 40) riskOnRiskOff = "positive";      // clear risk-on
  else if (riskOnScore <= -30) riskOnRiskOff = "negative"; // clear risk-off
  else if (Math.abs(riskOnScore) < 15) riskOnRiskOff = "neutral";
  else riskOnRiskOff = "conflicted";

  // ── Inflation pressure ─────────────────────────────────────────────────────
  let inflationPressure: DimensionSignal = "neutral";
  if (
    macroEventType === "cpi_inflation" ||
    macroEventType === "oil_price_move"
  ) {
    inflationPressure = macroSignificance === "critical" || macroSignificance === "meaningful"
      ? "positive" // inflation event driving macro pressure
      : "neutral";
  } else if (
    commodityPressure === "positive" &&
    (leadingCategories.includes("metals") || leadingCategories.includes("oil"))
  ) {
    inflationPressure = "positive"; // commodity bid + metals = inflation hedge behavior
  }

  // ── Macro leadership (which segment leads) ────────────────────────────────
  const leaderStr = leadingCategories.length > 0
    ? leadingCategories.slice(0, 2).join("/") + " leading"
    : "no clear leader";
  const lagStr = laggingCategories.length > 0
    ? laggingCategories.slice(0, 1).join("/") + " lagging"
    : "";
  const macroLeadership = lagStr ? `${leaderStr}; ${lagStr}` : leaderStr;

  return {
    dollarPressure,
    ratePressure,
    commodityPressure,
    defensiveFlow,
    riskOnRiskOff,
    inflationPressure,
    macroLeadership,
  };
}

// ─── Alignment score ──────────────────────────────────────────────────────────

function computeAlignmentScore(
  dims: CrossMarketDimensions,
  input: CrossMarketRegimeInput,
): number {
  let score = 0;

  // Consistent risk-on / risk-off direction adds to alignment
  if (dims.riskOnRiskOff === "positive" || dims.riskOnRiskOff === "negative") score += 20;
  else if (dims.riskOnRiskOff === "conflicted") score -= 10;

  // Dollar + risk-on alignment (risk-on → typically weaker USD → consistent)
  if (dims.riskOnRiskOff === "positive" && dims.dollarPressure === "negative") score += 15;
  if (dims.riskOnRiskOff === "negative" && dims.dollarPressure === "positive") score += 15;

  // Defensive flow consistency
  if (dims.riskOnRiskOff === "negative" && dims.defensiveFlow === "positive") score += 10;
  if (dims.riskOnRiskOff === "positive" && dims.defensiveFlow === "negative") score += 10;

  // Commodity-inflation alignment
  if (dims.commodityPressure === "positive" && dims.inflationPressure === "positive") score += 5;

  // Rate-regime alignment
  if (dims.ratePressure !== "conflicted") score += 5;

  // Divergence and disagreement reduce alignment
  if (input.divergenceDetected) score -= 20;
  if (input.hasMaterialDisagreement) score -= 10;
  if (input.hasConflict) score -= 10;

  // Regime confidence adds alignment
  if (input.regimeConf >= 70) score += 10;
  else if (input.regimeConf < 40) score -= 5;

  return Math.min(100, Math.max(0, score));
}

// ─── Label derivation ─────────────────────────────────────────────────────────

function deriveLabel(
  dims: CrossMarketDimensions,
  alignmentScore: number,
  input: CrossMarketRegimeInput,
): CrossMarketRegimeLabel {
  const { marketRegime, riskOnScore, rotationSignal, stressLevel,
    divergenceDetected, hasMaterialDisagreement, hasConflict,
    leadingCategories, laggingCategories, regimeTransition } = input;
  const absRisk = Math.abs(riskOnScore);

  // Weak signal: neutral regime, no rotation, no stress, no cross-market signal
  if (
    marketRegime === "neutral" &&
    rotationSignal === "none" &&
    stressLevel === "low" &&
    absRisk < 20 &&
    leadingCategories.length === 0
  ) {
    return "weak_signal_regime";
  }

  // Conflicting: divergence + material disagreement simultaneously
  if (divergenceDetected && hasMaterialDisagreement) return "conflicting_regime";

  // Conflicting: opposing dimension signals (risk-on + defensive simultaneously)
  if (dims.riskOnRiskOff === "positive" && dims.defensiveFlow === "positive") {
    return "conflicting_regime";
  }

  // Regime divergence: clear structural segment separation
  if (
    divergenceDetected &&
    leadingCategories.length > 0 &&
    laggingCategories.length > 0
  ) {
    const defensiveLeading = leadingCategories.some((c) =>
      (["metals", "bonds"] as AssetCategory[]).includes(c),
    );
    const riskLeading = leadingCategories.some((c) =>
      (["crypto", "stocks"] as AssetCategory[]).includes(c),
    );
    if (defensiveLeading && riskLeading) return "conflicting_regime";
    return "regime_divergence";
  }

  // Regime divergence: transition + strong rotation
  if (regimeTransition && rotationSignal !== "none" && hasConflict) {
    return "regime_divergence";
  }

  // Aligned: strong multi-segment consensus
  if (alignmentScore >= 50 && !divergenceDetected && !hasMaterialDisagreement) {
    return "aligned_regime";
  }

  // Partially aligned: some direction but incomplete cross-market confirmation
  if (alignmentScore >= 25 || rotationSignal !== "none" || absRisk >= 20) {
    return "partially_aligned";
  }

  // Default: weak signal
  return "weak_signal_regime";
}

// ─── Narrative builder ────────────────────────────────────────────────────────

function buildNarrative(
  label: CrossMarketRegimeLabel,
  dims: CrossMarketDimensions,
  ar: boolean,
): string {
  const leadership = dims.macroLeadership;
  if (ar) {
    switch (label) {
      case "aligned_regime":
        return `الأسواق المتعددة تُشير إلى توافق في النظام؛ الإشارات الاتجاهية متسقة جزئياً (${leadership}). التأكيد متعدد الأصول يقترح — لا يُثبت — تماسك هيكلياً.`;
      case "partially_aligned":
        return `التوافق العابر للأسواق جزئي؛ بعض القطاعات تدعم الاتجاه السائد بينما تتباعد أخرى. التأكيد محدود.`;
      case "conflicting_regime":
        return `الأسواق تُرسل إشارات متضاربة؛ قطاعات متعارضة نشطة في آن واحد. الوضوح التوجيهي للنظام منخفض.`;
      case "regime_divergence":
        return `قيادة القطاعات متباعدة بوضوح؛ تحوّل هيكلي محتمل. التأكيد من مصادر خارجية مناسب قبل الاستنتاجات.`;
      case "weak_signal_regime":
      default:
        return `إشارة التأكيد العابرة للأسواق ضعيفة في الوقت الحالي؛ النظام غير كافٍ للاستنتاجات الاتجاهية القوية.`;
    }
  }
  switch (label) {
    case "aligned_regime":
      return `Multi-market signals suggest regime alignment; directional evidence is partially consistent (${leadership}). Cross-asset confirmation implies — not confirms — structural coherence.`;
    case "partially_aligned":
      return `Cross-market alignment is partial; some segments support the dominant direction while others diverge. Confirmation is limited.`;
    case "conflicting_regime":
      return `Markets are signalling conflicting regimes; opposing segments are simultaneously active. Directional regime clarity is low.`;
    case "regime_divergence":
      return `Segment leadership is clearly diverging; structural rotation may be underway. External confirmation from multiple sources is appropriate before drawing conclusions.`;
    case "weak_signal_regime":
    default:
      return `Cross-market confirmation signal is weak at present; regime evidence is insufficient for strong directional conclusions.`;
  }
}

// ─── Context string ───────────────────────────────────────────────────────────

function buildContextString(
  label: CrossMarketRegimeLabel,
  dims: CrossMarketDimensions,
  alignmentScore: number,
): string {
  // No injection when signal too weak
  if (label === "weak_signal_regime") return "";
  const leaderNote = dims.macroLeadership !== "no clear leader"
    ? `; ${dims.macroLeadership}`
    : "";
  return `Cross-market: ${label.replace(/_/g, " ")}; alignment ${alignmentScore}%${leaderNote}`.slice(0, 130);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeCrossMarketRegime(
  input: CrossMarketRegimeInput,
): CrossMarketRegimeResult {
  const { ar } = input;

  const dimensions = analyzeDimensions(input);
  const alignmentScore = computeAlignmentScore(dimensions, input);
  const label = deriveLabel(dimensions, alignmentScore, input);
  const narrative = buildNarrative(label, dimensions, ar);
  const contextString = buildContextString(label, dimensions, alignmentScore);

  return {
    label,
    dimensions,
    alignmentScore,
    narrative,
    contextString,
    hasStrongAlignment: label === "aligned_regime",
    hasConflict: label === "conflicting_regime" || label === "regime_divergence",
  };
}
