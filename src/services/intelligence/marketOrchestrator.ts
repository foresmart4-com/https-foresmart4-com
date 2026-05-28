/**
 * Market OS Orchestration Intelligence — Phase 40
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Evaluates whether markets are behaving as a coherent interacting system
 * or as disconnected, fragmented, or transitioning signals.
 *
 * Orchestration states:
 *   fragmented_market  — signals disconnected; no coherent market narrative
 *   coordinated_market — multi-market agreement; coherent regime in force
 *   transition_market  — regime rotation or changing structure in progress
 *   unstable_market    — conflicting or fragile market structure
 *   regime_rotation    — macro leadership shift or structural regime transition
 *
 * Pressure types:
 *   bullish_pressure   — directional upside pressure with breadth support
 *   bearish_pressure   — directional downside pressure; risk-off signals
 *   neutral_pressure   — balanced; no dominant directional pressure
 *   conflict_pressure  — competing signals creating pressure uncertainty
 *   liquidity_pressure — stress-driven funding or liquidity concern
 *
 * Design rules:
 * - No fake certainty: states describe structure, not direction
 * - No forced regime: fragmented_market is valid and common
 * - No execution logic: intelligence only
 * - Deterministic: all gates derive from observable market signals
 */

import type { MarketRegime, StressLevel, RotationSignal } from "@/services/market/marketIntelEngine";
import type { StrategicBias } from "@/services/intelligence/strategicEngine";
import type { DebateBalance } from "@/services/intelligence/debateEngine";
import type { FirewallState } from "@/services/governance/decisionFirewall";
import type { PortfolioRiskLabel } from "@/services/portfolio/portfolioRiskEngine";
import type { EventSignificance } from "@/services/macro/macroEventEngine";
import type { TrustState } from "@/services/intelligence/trustStrategyEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarketOrchestratorState =
  | "fragmented_market"   // signals disconnected; no coherent market narrative
  | "coordinated_market"  // multi-market agreement; coherent regime
  | "transition_market"   // regime rotation or structural change in progress
  | "unstable_market"     // conflicting or fragile market structure
  | "regime_rotation";    // macro leadership shift; structural regime transition

export type PressureType =
  | "bullish_pressure"    // directional upside with breadth support
  | "bearish_pressure"    // directional downside; risk-off signals
  | "neutral_pressure"    // balanced; no dominant directional pressure
  | "conflict_pressure"   // competing signals creating uncertainty
  | "liquidity_pressure"; // stress-driven funding / liquidity concern

export interface MarketOrchestratorInput {
  marketRegime: MarketRegime;
  regimeConf: number;               // 0-100
  riskOnScore: number;              // -100..+100
  stressLevel: StressLevel;
  stressScore: number;              // 0-100
  rotationSignal: RotationSignal;
  regimeTransition: boolean;
  divergenceDetected: boolean;
  breadthBullPct: number;           // 0-100
  strategicBias: StrategicBias;
  hasConflict: boolean;
  debateBalance: DebateBalance;
  hasMaterialDisagreement: boolean;
  firewallState: FirewallState;
  portfolioRiskLabel: PortfolioRiskLabel;
  macroSignificance: EventSignificance;
  trustState: TrustState;
  ar: boolean;
}

export interface MarketOrchestratorResult {
  state: MarketOrchestratorState;
  pressureType: PressureType;
  coherenceScore: number;          // 0-100 internal signal alignment
  pressureSummary: string;         // 1 sentence, hedged language
  narrative: string;               // 1-2 sentences, hedged language
  contextString: string;           // compact ≤130 chars; empty for fragmented_market
  hasCoordination: boolean;        // true for coordinated_market
  hasInstability: boolean;         // true for unstable_market or regime_rotation
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

interface ScoreResult {
  coherence: number;  // 0-100
  conflict: number;   // 0-100
}

function computeScores(input: MarketOrchestratorInput): ScoreResult {
  const {
    marketRegime, regimeConf, riskOnScore, stressLevel, stressScore,
    rotationSignal, divergenceDetected, breadthBullPct, strategicBias,
    hasConflict, hasMaterialDisagreement, firewallState, trustState,
  } = input;

  let coherence = 0;
  let conflict = 0;

  // ── Regime clarity ────────────────────────────────────────────────────────
  if (marketRegime === "risk_on" || marketRegime === "risk_off") {
    coherence += 20;
  } else if (marketRegime === "volatile" || marketRegime === "mixed") {
    conflict += 8;
  }
  // neutral: 0 pts

  // ── Regime confidence ─────────────────────────────────────────────────────
  if (regimeConf >= 70) coherence += 15;
  else if (regimeConf >= 50) coherence += 8;
  else if (regimeConf < 35) conflict += 5;

  // ── Risk-on / risk-off signal strength ────────────────────────────────────
  const absRisk = Math.abs(riskOnScore);
  if (absRisk >= 50) coherence += 10;
  else if (absRisk >= 30) coherence += 5;
  else if (absRisk < 15) conflict += 3;

  // ── Strategic bias ────────────────────────────────────────────────────────
  if (strategicBias === "constructive" || strategicBias === "defensive") {
    coherence += 10;
  } else if (strategicBias === "uncertain") {
    conflict += 10;
  }

  // ── Rotation signal ───────────────────────────────────────────────────────
  if (rotationSignal !== "none") coherence += 5;

  // ── Breadth ───────────────────────────────────────────────────────────────
  if (breadthBullPct >= 70 || breadthBullPct <= 30) coherence += 10;
  else if (breadthBullPct >= 45 && breadthBullPct <= 55) conflict += 5;

  // ── Divergence ────────────────────────────────────────────────────────────
  if (!divergenceDetected) coherence += 5;
  else conflict += 20;

  // ── Debate / disagreement ─────────────────────────────────────────────────
  if (!hasMaterialDisagreement) coherence += 5;
  else conflict += 10;

  // ── Strategic conflict ────────────────────────────────────────────────────
  if (!hasConflict) coherence += 5;
  else conflict += 15;

  // ── Firewall ──────────────────────────────────────────────────────────────
  if (firewallState === "blocked") conflict += 10;
  else if (firewallState === "constrained") conflict += 5;

  // ── Stress ────────────────────────────────────────────────────────────────
  if (stressLevel === "high") { conflict += 10; coherence = Math.max(0, coherence - 10); }
  else if (stressLevel === "elevated") conflict += 5;

  // ── Trust ─────────────────────────────────────────────────────────────────
  if (trustState === "fragile_calibration") conflict += 5;

  // Clamp both to 0-100
  return {
    coherence: Math.min(100, Math.max(0, coherence)),
    conflict: Math.min(100, Math.max(0, conflict)),
  };
}

// ─── State derivation ─────────────────────────────────────────────────────────

function deriveState(
  scores: ScoreResult,
  input: MarketOrchestratorInput,
): MarketOrchestratorState {
  const { regimeTransition, rotationSignal, stressLevel, divergenceDetected,
    hasMaterialDisagreement, hasConflict, firewallState } = input;
  const { coherence, conflict } = scores;

  // Regime rotation: structural transition with explicit rotation signal
  if (regimeTransition && (rotationSignal !== "none" || coherence >= 40)) {
    return "regime_rotation";
  }

  // Unstable: severe conflict from multiple fragility signals
  if (
    conflict >= 30 ||
    (stressLevel === "high" && divergenceDetected) ||
    (firewallState === "blocked" && hasMaterialDisagreement)
  ) {
    return "unstable_market";
  }

  // Coordinated: strong coherence, limited conflict
  if (coherence >= 55 && conflict < 15) return "coordinated_market";

  // Transition: direction changing but not yet unstable
  if (regimeTransition || (rotationSignal !== "none" && conflict < 20)) {
    return "transition_market";
  }

  // Fragmented: default low-coherence state
  return "fragmented_market";
}

// ─── Pressure derivation ──────────────────────────────────────────────────────

function derivePressure(input: MarketOrchestratorInput): PressureType {
  const { riskOnScore, stressScore, breadthBullPct, strategicBias,
    hasMaterialDisagreement, divergenceDetected, stressLevel,
    macroSignificance } = input;

  // Liquidity pressure: macro stress + high stress score
  if (stressLevel === "high" && (stressScore >= 65 || macroSignificance === "critical")) {
    return "liquidity_pressure";
  }

  // Conflict pressure: disagreement + divergence simultaneously
  if (hasMaterialDisagreement && divergenceDetected) return "conflict_pressure";

  // Bullish pressure: risk-on alignment with breadth
  if (riskOnScore >= 40 && breadthBullPct >= 60 && strategicBias === "constructive") {
    return "bullish_pressure";
  }

  // Bearish pressure: risk-off with downside signals
  if (riskOnScore <= -30 && (stressScore >= 45 || strategicBias === "defensive")) {
    return "bearish_pressure";
  }

  // Neutral: no dominant directional pressure
  return "neutral_pressure";
}

// ─── Pressure summary ─────────────────────────────────────────────────────────

function buildPressureSummary(
  pressure: PressureType,
  state: MarketOrchestratorState,
  ar: boolean,
): string {
  if (ar) {
    const pressureText: Record<PressureType, string> = {
      bullish_pressure:   "ضغط صعودي مع دعم الاتساع",
      bearish_pressure:   "ضغط هبوطي مع إشارات تحوط",
      neutral_pressure:   "ضغط متوازن دون اتجاه مهيمن",
      conflict_pressure:  "ضغط متضارب — إشارات متنافسة",
      liquidity_pressure: "ضغط سيولة — توتر مالي ملحوظ",
    };
    const stateText: Record<MarketOrchestratorState, string> = {
      coordinated_market: "الأسواق منسّقة",
      fragmented_market:  "الأسواق مفككة",
      transition_market:  "الأسواق في مرحلة تحول",
      unstable_market:    "الأسواق غير مستقرة",
      regime_rotation:    "دوران النظام قائم",
    };
    return `${stateText[state]}؛ ${pressureText[pressure]}.`;
  }
  const pressureText: Record<PressureType, string> = {
    bullish_pressure:   "pressure increasing with breadth support",
    bearish_pressure:   "bearish pressure with risk-off signals",
    neutral_pressure:   "pressure balanced; no dominant directional signal",
    conflict_pressure:  "pressure mixed; competing signals",
    liquidity_pressure: "liquidity pressure detected; macro stress elevated",
  };
  const stateText: Record<MarketOrchestratorState, string> = {
    coordinated_market: "Market coordination present",
    fragmented_market:  "Market signals fragmented",
    transition_market:  "Market in transition",
    unstable_market:    "Market structure unstable",
    regime_rotation:    "Regime rotation in progress",
  };
  return `${stateText[state]}; ${pressureText[pressure]}.`;
}

// ─── Narrative builder ────────────────────────────────────────────────────────

function buildNarrative(
  state: MarketOrchestratorState,
  pressure: PressureType,
  scores: ScoreResult,
  ar: boolean,
): string {
  const conf = scores.coherence;
  if (ar) {
    switch (state) {
      case "coordinated_market":
        return `تناسق الأسواق المتعددة يُشير إلى نظام متماسك (توافق ${conf}%)؛ الإشارات تدعم بعضها بشكل جزئي. استشاري فقط.`;
      case "regime_rotation":
        return `دوران هيكلي محتمل في النظام؛ الإشارات القيادية تتغيّر. التحقق من مصادر متعددة مناسب.`;
      case "unstable_market":
        return `البنية السوقية تُظهر تضارباً؛ إشارات متنافسة تُقيّد الوضوح التوجيهي. موقف محافظ مناسب للتحليل.`;
      case "transition_market":
        return `الأسواق في مرحلة تحوّل هيكلي؛ الدوران الكلي قيد التطور. التأكيد العابر للأصول محدود.`;
      case "fragmented_market":
      default:
        return `إشارات السوق متشتتة؛ لا يوجد سرد سوقي متماسك واضح. قيمة التنسيق المتعدد الأسواق منخفضة.`;
    }
  }
  switch (state) {
    case "coordinated_market":
      return `Cross-market signals suggest a coherent regime (${conf}% alignment); evidence partially supports coordination. Advisory only.`;
    case "regime_rotation":
      return `Structural regime rotation may be in progress; leadership signals are shifting. Cross-asset confirmation from multiple sources is appropriate.`;
    case "unstable_market":
      return `Market structure shows material conflict; competing signals limit directional clarity. Conservative analytical posture is appropriate.`;
    case "transition_market":
      return `Markets appear in structural transition; macro rotation is evolving. Cross-asset confirmation is currently limited.`;
    case "fragmented_market":
    default:
      return `Market signals are fragmented; no coherent cross-market narrative is evident. Multi-market coordination value is low.`;
  }
}

// ─── Context string ───────────────────────────────────────────────────────────

function buildContextString(
  state: MarketOrchestratorState,
  pressure: PressureType,
  coherence: number,
): string {
  // No injection for fragmented — not signal-rich enough to be useful
  if (state === "fragmented_market") return "";
  const pressureStr = pressure.replace(/_/g, " ");
  return `Market OS: ${state.replace(/_/g, " ")}; ${pressureStr}; coherence ${coherence}%`.slice(0, 130);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeMarketOrchestrator(
  input: MarketOrchestratorInput,
): MarketOrchestratorResult {
  const { ar } = input;

  const scores = computeScores(input);
  const state = deriveState(scores, input);
  const pressureType = derivePressure(input);
  const pressureSummary = buildPressureSummary(pressureType, state, ar);
  const narrative = buildNarrative(state, pressureType, scores, ar);
  const contextString = buildContextString(state, pressureType, scores.coherence);

  return {
    state,
    pressureType,
    coherenceScore: scores.coherence,
    pressureSummary,
    narrative,
    contextString,
    hasCoordination: state === "coordinated_market",
    hasInstability: state === "unstable_market" || state === "regime_rotation",
  };
}
