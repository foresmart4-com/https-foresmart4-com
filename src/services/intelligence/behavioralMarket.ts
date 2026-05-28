/**
 * Behavioral Market Intelligence — Phase 44
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Evaluates crowd behavior, positioning pressure, sentiment dynamics,
 * and narrative distortion from observable market signals.
 *
 * Behavioral labels:
 *   fear_dominant      — risk-off stress, panic-like signals, defensive rotation
 *   greed_dominant     — risk-on excess, overconfidence, crowded upside positioning
 *   crowded_positioning — one-directional signal saturation without fundamental backing
 *   narrative_driven   — macro narrative dominating over underlying fundamentals
 *   balanced_behavior  — no dominant behavioral distortion; signals reasonably balanced
 *   unclear_behavior   — insufficient signal for behavioral assessment
 *
 * Design rules:
 * - Behavior is context, not proof: sentiment does not guarantee direction
 * - No urgency language: no "buy/sell because crowd" framing
 * - No forced escalation: unclear_behavior when signals are thin
 * - Hedged language only: "suggests", "may indicate", "pattern consistent with"
 * - No phantom data: observations derived strictly from available market signals
 */

import type { StressLevel, RotationSignal } from "@/services/market/marketIntelEngine";
import type { StrategicBias } from "@/services/intelligence/strategicEngine";
import type { FirewallState } from "@/services/governance/decisionFirewall";
import type { DebateBalance } from "@/services/intelligence/debateEngine";
import type { EventSignificance } from "@/services/macro/macroEventEngine";
import type { CalibrationScore } from "@/services/learning/decisionScoring";
import type { TrustState } from "@/services/intelligence/trustStrategyEngine";
import type { MarketOrchestratorState } from "@/services/intelligence/marketOrchestrator";
import type { CrossMarketRegimeLabel } from "@/services/intelligence/crossMarketRegime";
import type { MacroCycleState } from "@/services/macro/globalMacroMemory";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BehavioralLabel =
  | "fear_dominant"        // risk-off stress; panic-like patterns; defensive flows
  | "greed_dominant"       // risk-on excess; overconfidence; crowded upside
  | "crowded_positioning"  // one-directional saturation without fundamental support
  | "narrative_driven"     // macro narrative dominating fundamental assessment
  | "balanced_behavior"    // no dominant behavioral distortion
  | "unclear_behavior";    // insufficient signal for assessment

export type BehavioralDimension =
  | "fear_stress"          // explicit stress + risk-off signals
  | "greed_excess"         // excessive optimism / overconfidence patterns
  | "positioning_crowding" // crowd concentration in one direction
  | "narrative_momentum"   // narrative-driven price action
  | "reflexivity"          // self-reinforcing market feedback
  | "overconfidence";      // confidence exceeding evidence quality

export interface BehavioralMarketInput {
  riskOnScore: number;                          // -100..+100
  stressLevel: StressLevel;
  stressScore: number;                          // 0-100
  breadthBullPct: number;                       // 0-100
  rotationSignal: RotationSignal;
  debateBalance: DebateBalance;
  hasMaterialDisagreement: boolean;
  strategicBias: StrategicBias;
  hasStrategicConflict: boolean;
  macroSignificance: EventSignificance;
  firewallState: FirewallState;
  calibrationScore: CalibrationScore;
  trustState: TrustState;
  orchestratorState: MarketOrchestratorState;
  crossMarketLabel: CrossMarketRegimeLabel;
  macroCycle: MacroCycleState;
  ar: boolean;
}

export interface BehavioralMarketResult {
  label: BehavioralLabel;
  activeDimensions: BehavioralDimension[];
  fearScore: number;        // 0-20 internal dimension score
  greedScore: number;       // 0-20 internal dimension score
  crowdingScore: number;    // 0-16 internal dimension score
  narrativeScore: number;   // 0-12 internal dimension score
  sentimentNote: string;    // 1 sentence, hedged language
  narrative: string;        // 1-2 sentences, hedged language
  contextString: string;    // compact ≤110 chars; empty for unclear_behavior
}

// ─── Dimension scoring ────────────────────────────────────────────────────────

interface DimensionScores {
  fear: number;
  greed: number;
  crowding: number;
  narrativeScore: number;
  activeDimensions: BehavioralDimension[];
}

function scoreDimensions(input: BehavioralMarketInput): DimensionScores {
  const {
    riskOnScore, stressLevel, stressScore, breadthBullPct, rotationSignal,
    debateBalance, hasMaterialDisagreement, strategicBias, hasStrategicConflict,
    macroSignificance, firewallState, calibrationScore, trustState,
    orchestratorState, crossMarketLabel, macroCycle,
  } = input;

  let fear = 0;
  let greed = 0;
  let crowding = 0;
  let narrativeScore = 0;
  const dims = new Set<BehavioralDimension>();

  // ── Fear signals ──────────────────────────────────────────────────────────
  if (stressLevel === "high") { fear += 4; dims.add("fear_stress"); }
  else if (stressLevel === "elevated") { fear += 2; dims.add("fear_stress"); }
  if (riskOnScore <= -50) { fear += 3; }
  else if (riskOnScore <= -25) { fear += 2; }
  if (rotationSignal === "defensive_bid") { fear += 2; dims.add("fear_stress"); }
  if (breadthBullPct <= 30) { fear += 2; }
  if (debateBalance === "bear_dominant") { fear += 1; }
  if (firewallState === "blocked") { fear += 1; }
  if (stressScore >= 65) { fear += 2; }
  if (macroCycle === "tightening_cycle") { fear += 1; }

  // ── Greed signals ─────────────────────────────────────────────────────────
  if (riskOnScore >= 60) { greed += 4; dims.add("greed_excess"); }
  else if (riskOnScore >= 40) { greed += 2; dims.add("greed_excess"); }
  if (breadthBullPct >= 78) { greed += 3; dims.add("greed_excess"); }
  else if (breadthBullPct >= 68) { greed += 2; }
  if (rotationSignal === "broad_rally") { greed += 2; }
  if (rotationSignal === "crypto_bid") { greed += 1; }
  if (stressLevel === "low" && riskOnScore >= 30) { greed += 2; }
  if (debateBalance === "bull_dominant") { greed += 1; }
  if (macroCycle === "easing_cycle") { greed += 1; }

  // Overconfidence: calibration weak + high greed signals
  if (
    (calibrationScore === "weakly_calibrated" || trustState === "fragile_calibration") &&
    greed >= 4
  ) { dims.add("overconfidence"); }

  // ── Crowding signals ──────────────────────────────────────────────────────
  // Crowding: one-directional saturation with limited pushback
  if (
    !hasMaterialDisagreement &&
    (debateBalance === "bull_dominant" || debateBalance === "bear_dominant") &&
    Math.abs(riskOnScore) >= 40
  ) { crowding += 4; dims.add("positioning_crowding"); }
  if (crossMarketLabel === "aligned_regime" && Math.abs(riskOnScore) >= 35) { crowding += 2; dims.add("positioning_crowding"); }
  if (orchestratorState === "coordinated_market" && Math.abs(riskOnScore) >= 40) { crowding += 2; }
  if (!hasStrategicConflict && Math.abs(riskOnScore) >= 45) { crowding += 2; }
  if (calibrationScore === "insufficient_data") { crowding += 1; } // thin pushback = potential crowding
  if (rotationSignal === "broad_rally" && debateBalance === "bull_dominant") { crowding += 2; }
  if (rotationSignal === "broad_selloff") { crowding += 1; }

  // Reflexivity: self-reinforcing in either direction
  if (
    orchestratorState === "coordinated_market" &&
    (Math.abs(riskOnScore) >= 50 || breadthBullPct >= 75 || breadthBullPct <= 25)
  ) { dims.add("reflexivity"); }

  // ── Narrative signals ─────────────────────────────────────────────────────
  if (macroSignificance === "critical") { narrativeScore += 3; dims.add("narrative_momentum"); }
  else if (macroSignificance === "meaningful") { narrativeScore += 1; }
  if (!hasStrategicConflict && strategicBias !== "neutral" && strategicBias !== "uncertain") {
    narrativeScore += 2; dims.add("narrative_momentum");
  }
  if (orchestratorState === "coordinated_market" && !hasMaterialDisagreement) { narrativeScore += 2; }
  if (crossMarketLabel === "aligned_regime" && macroSignificance !== "secondary") { narrativeScore += 2; }
  if (macroCycle === "transition_cycle" && macroSignificance === "critical") { narrativeScore += 2; }

  return {
    fear: Math.min(20, fear),
    greed: Math.min(20, greed),
    crowding: Math.min(16, crowding),
    narrativeScore: Math.min(12, narrativeScore),
    activeDimensions: [...dims],
  };
}

// ─── Label derivation ─────────────────────────────────────────────────────────

function deriveLabel(scores: DimensionScores): BehavioralLabel {
  const { fear, greed, crowding, narrativeScore } = scores;
  const total = fear + greed + crowding + narrativeScore;

  // Insufficient signal
  if (total < 4) return "unclear_behavior";

  // Fear dominant: fear significantly outweighs greed, total signal meaningful
  if (fear >= 6 && fear > greed + 3) return "fear_dominant";

  // Greed dominant: greed significantly outweighs fear
  if (greed >= 6 && greed > fear + 3) return "greed_dominant";

  // Crowded positioning: one-directional saturation dominates
  if (crowding >= 6 && crowding >= fear && crowding >= greed) return "crowded_positioning";

  // Narrative driven: macro narrative is the dominant force
  if (narrativeScore >= 6 && narrativeScore > fear && narrativeScore > greed && crowding < 5) {
    return "narrative_driven";
  }

  // Balanced: signals present but no dominant distortion
  if (total >= 4) return "balanced_behavior";

  return "unclear_behavior";
}

// ─── Sentiment note builder ───────────────────────────────────────────────────

function buildSentimentNote(
  label: BehavioralLabel,
  scores: DimensionScores,
  ar: boolean,
): string {
  if (ar) {
    switch (label) {
      case "fear_dominant":       return "المشاعر السائدة تُشير إلى ضغط تحوطي؛ إشارات الخوف نشطة — لا تضمن الاتجاه.";
      case "greed_dominant":      return "المشاعر السائدة تُشير إلى شهية مخاطرة مرتفعة؛ أنماط الطمع ملحوظة — قد تسبق التصحيح.";
      case "crowded_positioning": return "التموضع السوقي يبدو مكتظاً في اتجاه واحد؛ نقاط ضعف المزاحمة قد تكون عالية.";
      case "narrative_driven":    return "الرواية الكلية السائدة قد تطغى على التقييم الأساسي — لا يُثبت الاتجاه.";
      case "balanced_behavior":   return "السلوك السوقي متوازن نسبياً؛ لا تشويه سلوكي مهيمن ملحوظ.";
      default:                    return "إشارة السلوك غير كافية للتقييم الموثوق في الوقت الحالي.";
    }
  }
  switch (label) {
    case "fear_dominant":       return "Sentiment suggests risk-off pressure; fear signals active — direction not guaranteed.";
    case "greed_dominant":      return "Sentiment suggests elevated risk appetite; greed patterns observed — may precede correction.";
    case "crowded_positioning": return "Market positioning appears crowded in one direction; crowding vulnerability may be elevated.";
    case "narrative_driven":    return "Dominant macro narrative may be overshadowing fundamental assessment — direction not proven.";
    case "balanced_behavior":   return "Market behavior is relatively balanced; no dominant behavioral distortion observed.";
    default:                    return "Behavioral signal is insufficient for reliable assessment at this time.";
  }
}

// ─── Narrative builder ────────────────────────────────────────────────────────

function buildNarrative(
  label: BehavioralLabel,
  dims: BehavioralDimension[],
  ar: boolean,
): string {
  const dimNote = dims.length > 0
    ? (ar
        ? ` (أبعاد نشطة: ${dims.slice(0, 2).map(d => d.replace(/_/g, " ")).join("، ")})`
        : ` (active: ${dims.slice(0, 2).map(d => d.replace(/_/g, " ")).join(", ")})`)
    : "";

  if (ar) {
    switch (label) {
      case "fear_dominant":
        return `ضغط تحوطي سائد${dimNote}؛ السلوك الجماعي يُشير إلى حذر مرتفع. البيانات الهيكلية أهم من المشاعر قصيرة الأجل.`;
      case "greed_dominant":
        return `شهية مخاطرة مرتفعة${dimNote}؛ إشارة تحذيرية محتملة — التمدد الزائد يسبق عادةً التصحيح.`;
      case "crowded_positioning":
        return `تموضع مكتظ محتمل${dimNote}؛ التزاحم يضخّم المخاطر — لا تأكيد للاتجاه.`;
      case "narrative_driven":
        return `الرواية الكلية قد تشكّل الديناميكيات الحالية${dimNote}؛ التشكيك في الرواية يُضاف إلى التحليل.`;
      case "balanced_behavior":
        return `السلوك السوقي متوازن${dimNote}؛ لا ضغط سلوكي واحد يهيمن.`;
      default:
        return `سياق سلوكي محدود${dimNote}؛ تقييم موثوق يتطلب إشارات إضافية.`;
    }
  }
  switch (label) {
    case "fear_dominant":
      return `Risk-off pressure dominant${dimNote}; crowd behavior suggests elevated caution. Structural data matters more than short-term sentiment.`;
    case "greed_dominant":
      return `Elevated risk appetite${dimNote}; potential warning signal — extension often precedes correction.`;
    case "crowded_positioning":
      return `Potential crowded positioning${dimNote}; crowding amplifies risk — no directional confirmation.`;
    case "narrative_driven":
      return `Macro narrative may be shaping current dynamics${dimNote}; questioning the narrative is part of sound analysis.`;
    case "balanced_behavior":
      return `Market behavior is balanced${dimNote}; no single behavioral pressure dominates.`;
    default:
      return `Limited behavioral context${dimNote}; reliable assessment requires additional signals.`;
  }
}

// ─── Context string ───────────────────────────────────────────────────────────

function buildContextString(label: BehavioralLabel, scores: DimensionScores): string {
  if (label === "unclear_behavior" || label === "balanced_behavior") return "";
  const scoreNote = label === "fear_dominant" ? `; fear ${scores.fear}`
    : label === "greed_dominant" ? `; greed ${scores.greed}`
    : label === "crowded_positioning" ? `; crowding ${scores.crowding}`
    : "";
  return `Behavioral: ${label.replace(/_/g, " ")}${scoreNote}`.slice(0, 110);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeBehavioralMarket(input: BehavioralMarketInput): BehavioralMarketResult {
  const { ar } = input;

  const scores = scoreDimensions(input);
  const label = deriveLabel(scores);
  const sentimentNote = buildSentimentNote(label, scores, ar);
  const narrative = buildNarrative(label, scores.activeDimensions, ar);
  const contextString = buildContextString(label, scores);

  return {
    label,
    activeDimensions: scores.activeDimensions,
    fearScore: scores.fear,
    greedScore: scores.greed,
    crowdingScore: scores.crowding,
    narrativeScore: scores.narrativeScore,
    sentimentNote,
    narrative,
    contextString,
  };
}
