// Phase-89B: Capital Flow Engine
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Distinct from existing regional flow intelligence:
//   crossMarketFusion (67): "regional_flow_rotation" is one narrative dimension
//                           describing TASI/Gulf foreign capital direction
//   capitalFlowEngine (89B): INSTITUTIONAL CAPITAL ALLOCATION FRAMEWORK —
//                           models the EM vs DM tilt decision, GCC-specific
//                           flow dynamics, safe-haven demand, and the risk
//                           mode that drives all of these decisions
//
// 4 capital-flow dimensions:
//
//   1. riskMode: aggregate risk posture driving cross-border allocation
//      risk_on: DXY soft + credit tight → EM/risk assets attracting capital
//      risk_off: DXY strong + credit stress → DM/safe haven capital concentration
//      transitioning: mixed signals; no dominant allocation bias
//
//   2. emDmBias: EM vs DM relative allocation tilt
//      em_positive: USD weakening → EM real return improvement → EM inflow
//      dm_positive: USD strengthening → DM outperforms → EM capital drain
//
//   3. gccAllocation: GCC/Gulf-specific capital flow attractiveness
//      supportive: oil above breakeven + regional risk-on + petrodollar recycling
//      headwind: oil below breakeven OR risk-off + DXY strong
//
//   4. safeHavenDemand: institutional demand for gold/USD/DM sovereigns
//      active: credit extreme + equity stress → safety flight
//      moderate: uncertainty rising but not systemic
//      dormant: risk appetite intact
//
// Educational/advisory framing only. No execution language.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type RiskMode        = "risk_on" | "risk_off" | "transitioning";
export type EmDmBias        = "em_positive" | "dm_positive" | "neutral";
export type GccAllocation   = "supportive" | "neutral" | "headwind";
export type SafeHavenDemand = "active" | "moderate" | "dormant";

export interface CapitalFlowProfile {
  riskMode:         RiskMode;
  emDmBias:         EmDmBias;
  gccAllocation:    GccAllocation;
  safeHavenDemand:  SafeHavenDemand;
  flowCtx:          string;       // ≤180 chars injectable
  gccNote:          string | null; // ≤65 chars Saudi/GCC-specific note if isSaudi
}

// ─── Risk mode derivation ─────────────────────────────────────────────────────

function parsePrimaryRegime(regime: string): string {
  return (regime ?? "macro_transition").toLowerCase().replace(/[-\s]/g, "_");
}

function deriveRiskMode(
  macroBias:    "bullish" | "bearish" | "neutral",
  creditStress: "low" | "moderate" | "high" | "extreme",
  spyChangePct: number | null | undefined,
  eurUsd:       number | null | undefined,
): RiskMode {
  // Risk-off: bearish macro + high stress + equity selling + DXY strength
  const dxyStrong = eurUsd != null && eurUsd < 1.06;
  const equityWeak = spyChangePct != null && spyChangePct < -1.0;
  if ((creditStress === "high" || creditStress === "extreme") &&
      (macroBias === "bearish" || equityWeak)) return "risk_off";
  if (dxyStrong && (creditStress === "moderate" || creditStress === "high") && macroBias !== "bullish") return "risk_off";

  // Risk-on: bullish macro + low stress + DXY soft
  const dxySoft = eurUsd != null && eurUsd > 1.10;
  const equityBid = spyChangePct != null && spyChangePct > 0;
  if (creditStress === "low" && (macroBias === "bullish" || dxySoft) && (equityBid || macroBias === "bullish")) return "risk_on";

  return "transitioning";
}

// ─── EM vs DM bias ────────────────────────────────────────────────────────────

function deriveEmDmBias(
  eurUsd:    number | null | undefined,
  riskMode:  RiskMode,
): EmDmBias {
  if (eurUsd == null) return "neutral";
  if (eurUsd < 1.05 || riskMode === "risk_off") return "dm_positive";
  if (eurUsd > 1.12 && riskMode !== "risk_off") return "em_positive";
  return "neutral";
}

// ─── GCC allocation ───────────────────────────────────────────────────────────

function deriveGccAllocation(
  oilPrice:    number | null | undefined,
  oilChangePct: number | null | undefined,
  riskMode:    RiskMode,
  eurUsd:      number | null | undefined,
): GccAllocation {
  if (oilPrice == null) return riskMode === "risk_on" ? "supportive" : riskMode === "risk_off" ? "headwind" : "neutral";
  // DXY very strong = GCC headwind even with decent oil (capital repatriation)
  const dxyVeryStrong = eurUsd != null && eurUsd < 1.02;
  if (oilPrice >= 80 && riskMode !== "risk_off" && !dxyVeryStrong) return "supportive";
  if (oilPrice < 70 || riskMode === "risk_off" || dxyVeryStrong) return "headwind";
  return "neutral";
}

// ─── Safe-haven demand ────────────────────────────────────────────────────────

function deriveSafeHavenDemand(
  creditStress: "low" | "moderate" | "high" | "extreme",
  spyChangePct: number | null | undefined,
  macroBias:    "bullish" | "bearish" | "neutral",
): SafeHavenDemand {
  if (creditStress === "extreme") return "active";
  if (creditStress === "high" && (spyChangePct == null || spyChangePct < -2)) return "active";
  if (creditStress === "moderate" && macroBias === "bearish") return "moderate";
  if (creditStress === "high") return "moderate";
  return "dormant";
}

// ─── GCC note ─────────────────────────────────────────────────────────────────

function buildGccNote(
  gcc:      GccAllocation,
  oilPrice: number | null | undefined,
  riskMode: RiskMode,
): string {
  if (gcc === "supportive") {
    return `GCC supportive: oil $${oilPrice ?? "??"} + risk-on → regional inflow`;
  }
  if (gcc === "headwind") {
    return oilPrice != null && oilPrice < 70
      ? `GCC headwind: oil $${oilPrice} below $70 → fiscal channel stress`
      : `GCC headwind: risk-off + DXY strength → regional outflow`;
  }
  return `GCC allocation neutral: oil near breakeven; peg insulates SAR`;
}

// ─── Context builder ──────────────────────────────────────────────────────────

const RISK_MODE_LABELS: Record<RiskMode, string> = {
  risk_on:       "Risk-ON: capital rotating into EM/risk assets",
  risk_off:      "Risk-OFF: capital concentrating in DM/safe haven",
  transitioning: "Risk mode transitioning: mixed signals — no clear allocation bias",
};

const EM_DM_LABELS: Record<EmDmBias, string> = {
  em_positive: "EM inflow bias (USD soft)",
  dm_positive: "DM inflow bias (USD strong)",
  neutral:     "EM/DM neutral",
};

const HAVEN_LABELS: Record<SafeHavenDemand, string> = {
  active:   "Safe-haven active: gold/USD/DM bonds bid",
  moderate: "Safe-haven moderate: partial defence allocation",
  dormant:  "Safe-haven dormant: risk appetite intact",
};

function buildFlowCtx(
  risk:  RiskMode,
  emDm:  EmDmBias,
  haven: SafeHavenDemand,
): string {
  return `Flows[${risk}]: ${EM_DM_LABELS[emDm]} | ${HAVEN_LABELS[haven]}`.slice(0, 180);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildCapitalFlowProfile(input: {
  regime:            string;
  macroBias:         "bullish" | "bearish" | "neutral";
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
  oilPrice?:         number | null;
  oilChangePct?:     number | null;
  eurUsd?:           number | null;
  spyChangePct?:     number | null;
  isSaudi:           boolean;
}): CapitalFlowProfile {
  const { macroBias, creditStressLevel, oilPrice, oilChangePct, eurUsd, spyChangePct, isSaudi } = input;

  const riskMode       = deriveRiskMode(macroBias, creditStressLevel, spyChangePct, eurUsd);
  const emDmBias       = deriveEmDmBias(eurUsd, riskMode);
  const gccAllocation  = deriveGccAllocation(oilPrice, oilChangePct, riskMode, eurUsd);
  const safeHavenDemand = deriveSafeHavenDemand(creditStressLevel, spyChangePct, macroBias);
  const gccNote        = isSaudi ? buildGccNote(gccAllocation, oilPrice, riskMode) : null;

  return {
    riskMode,
    emDmBias,
    gccAllocation,
    safeHavenDemand,
    flowCtx:  buildFlowCtx(riskMode, emDmBias, safeHavenDemand),
    gccNote:  gccNote?.slice(0, 65) ?? null,
  };
}
