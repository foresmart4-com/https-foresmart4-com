// Phase-88A: Portfolio Logic Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// DISTINCT FROM existing portfolio modules:
//   allocationIntelligence.ts (Phase-68): broad/selective/defensive/balanced frames
//   allocatorDecisionEngine.ts (Phase-83B): stance + conviction
//
// This module generates committee-level PORTFOLIO CONSTRUCTION LOGIC:
//   - Concentration vs diversification recommendation
//   - Cyclical vs defensive tilt
//   - Regime fit score (how well does the proposed allocation fit?)
//   - Position sizing rationale
//
// This is DOWNSTREAM of committeeDynamicsEngine and convictionCalibrationEngine:
// the committee's tension and calibrated conviction inform HOW the portfolio
// should be constructed, not just WHAT to buy.
//
// Position sizing principles:
//   High conviction + durable thesis + low uncertainty → larger positions
//   Low conviction + fragile thesis + high uncertainty → smaller, staged positions
//   Committee conflict → maximum diversification within mandate
//
// Educational/advisory only. No autonomous execution. No broker data.

import type { CommitteeDynamics } from "./committeeDynamicsEngine";
import type { ConvictionProfile, ThesisDurability } from "./convictionCalibrationEngine";
import type { OpportunityCostSeverity } from "./opportunityCostEngine";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ConcentrationAdvice =
  | "concentrated"     // 3-5 names; high conviction; low uncertainty
  | "selective"        // 6-10 names; moderate conviction; regime-fit driven
  | "diversified"      // 15+ names; sector-balanced; uncertainty hedge
  | "broad_defensive"; // index + defensives; conviction too low for selection

export type CyclicalDefensiveTilt =
  | "cyclical_overweight"  // growth / pro-cyclical assets dominate
  | "balanced"             // no material tilt; blend of cyclical + defensive
  | "defensive_overweight";// defensives / cash / quality dominate

export interface PortfolioLogicResult {
  concentrationAdvice: ConcentrationAdvice;
  cyclicalVsDefensive: CyclicalDefensiveTilt;
  regimeFitScore:      number;        // 0-100
  positionSizingLogic: string;        // ≤120 chars
  saudiPortfolioNote:  string;        // ≤100 chars; empty if not Saudi
  portfolioContext:    string;        // injectable ≤240 chars
}

// ─── Concentration logic ──────────────────────────────────────────────────────

function deriveConcentration(
  conviction: number,
  durability: ThesisDurability,
  riskTension: number,
  convictionConflict: boolean,
  uncertainty: string,
): ConcentrationAdvice {
  // broad_defensive only when conflict is paired with severe conditions
  if (uncertainty === "extreme") return "broad_defensive";
  if (convictionConflict && (uncertainty === "high" || uncertainty === "extreme")) return "broad_defensive";
  if (conviction < 45 || riskTension > 65) return "diversified";
  if (conviction >= 70 && durability === "durable" && riskTension <= 30) return "concentrated";
  if (conviction >= 55 && durability !== "fragile") return "selective";
  return "diversified";
}

// ─── Cyclical vs defensive tilt ──────────────────────────────────────────────

function deriveCyclicalTilt(
  growthVsPreservation: string,
  macroBias: "bullish" | "bearish" | "neutral",
  creditStress: string,
  opportunitySeverity: OpportunityCostSeverity,
): CyclicalDefensiveTilt {
  if (growthVsPreservation === "preservation_dominant" || macroBias === "bearish") {
    return "defensive_overweight";
  }
  if (creditStress === "high" || creditStress === "extreme") {
    return "defensive_overweight";
  }
  if (growthVsPreservation === "growth_dominant" && macroBias === "bullish" &&
      opportunitySeverity === "high") {
    return "cyclical_overweight";
  }
  return "balanced";
}

// ─── Regime fit score ─────────────────────────────────────────────────────────

function computeRegimeFitScore(
  concentration: ConcentrationAdvice,
  cyclicalTilt: CyclicalDefensiveTilt,
  macroBias: string,
  regimeConf: number,
): number {
  let score = Math.round(regimeConf * 0.5);  // base: 50% from regime confidence

  // Alignment bonus: does portfolio tilt match macro bias?
  if (macroBias === "bullish" && cyclicalTilt === "cyclical_overweight") score += 20;
  if (macroBias === "bearish" && cyclicalTilt === "defensive_overweight") score += 20;
  if (macroBias === "neutral" && cyclicalTilt === "balanced") score += 15;

  // Concentration alignment: concentrated positions require high regime confidence
  if (concentration === "concentrated" && regimeConf >= 70) score += 10;
  if (concentration === "broad_defensive" && regimeConf < 50) score += 10;

  return Math.min(100, score);
}

// ─── Position sizing logic ────────────────────────────────────────────────────

const SIZING_LOGIC: Record<ConcentrationAdvice, Record<CyclicalDefensiveTilt, string>> = {
  concentrated: {
    cyclical_overweight:   "High-conviction cyclicals: 15-20% per position; max 5 names; hard stop at 10% drawdown.",
    balanced:              "High-conviction quality: 12-18% per position; balance growth and defensive.",
    defensive_overweight:  "High-conviction defensives: 15-20% per position; quality yield focus.",
  },
  selective: {
    cyclical_overweight:   "Selective cyclicals: 8-12% per position; sector-concentrated; trailing stops.",
    balanced:              "Selective balanced: 6-10% per position; blend regime-fit names.",
    defensive_overweight:  "Selective defensives: 8-12%; quality cash flow and dividend stability.",
  },
  diversified: {
    cyclical_overweight:   "Broad cyclical exposure: 3-6% per name; diversify across sub-sectors.",
    balanced:              "Equal-weight blend: 3-5% per name; sector-balanced; low tracking error.",
    defensive_overweight:  "Diversified defensives: 4-6% per name; utilities, staples, healthcare.",
  },
  broad_defensive: {
    cyclical_overweight:   "Index + selective cyclicals: minimal active risk; wait for regime clarity.",
    balanced:              "Index + cash buffer: reduce active positions; wait for conviction.",
    defensive_overweight:  "Cash + short-duration + gold: maximum preservation; no equity beta.",
  },
};

// ─── Saudi portfolio note ────────────────────────────────────────────────────

function buildSaudiNote(
  isSaudi: boolean,
  cyclical: CyclicalDefensiveTilt,
  oilPrice?: number | null,
): string {
  if (!isSaudi) return "";
  const oilSupport = oilPrice !== null && oilPrice !== undefined && oilPrice >= 78;
  if (cyclical === "cyclical_overweight" && oilSupport) {
    return "Saudi cyclicals: banks + Aramco + construction benefit from fiscal surplus.";
  }
  if (cyclical === "defensive_overweight") {
    return "Saudi defensives: dividend payers + utilities insulated from oil volatility.";
  }
  return "Saudi allocation: balanced between oil-linked cyclicals and domestic demand names.";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildPortfolioLogic(
  committee: CommitteeDynamics,
  conviction: ConvictionProfile,
  opportunitySeverity: OpportunityCostSeverity,
  macroBias: "bullish" | "bearish" | "neutral",
  creditStress: "low" | "moderate" | "high" | "extreme",
  uncertaintyLevel: "low" | "moderate" | "high" | "extreme",
  regimeConf: number,
  isSaudi: boolean,
  oilPrice?: number | null,
): PortfolioLogicResult {
  const concentrationAdvice = deriveConcentration(
    conviction.calibratedConviction,
    conviction.thesisDurability,
    committee.riskTension,
    committee.convictionConflict,
    uncertaintyLevel,
  );

  const cyclicalVsDefensive = deriveCyclicalTilt(
    committee.growthVsPreservation,
    macroBias,
    creditStress,
    opportunitySeverity,
  );

  const regimeFitScore = computeRegimeFitScore(
    concentrationAdvice, cyclicalVsDefensive, macroBias, regimeConf,
  );

  const positionSizingLogic = (
    SIZING_LOGIC[concentrationAdvice]?.[cyclicalVsDefensive]
    ?? "Position sizing requires regime clarity; use equal-weight until conviction firms."
  ).slice(0, 120);

  const saudiPortfolioNote = buildSaudiNote(isSaudi, cyclicalVsDefensive, oilPrice);

  const portfolioContext = [
    `Portfolio logic [${concentrationAdvice.replace(/_/g, " ")} / ${cyclicalVsDefensive.replace(/_/g, " ")}]:`,
    `Regime fit: ${regimeFitScore}/100.`,
    positionSizingLogic,
    saudiPortfolioNote ? `Saudi: ${saudiPortfolioNote.slice(0, 80)}` : null,
  ].filter(Boolean).join(" ").slice(0, 240);

  return {
    concentrationAdvice,
    cyclicalVsDefensive,
    regimeFitScore,
    positionSizingLogic,
    saudiPortfolioNote,
    portfolioContext,
  };
}
