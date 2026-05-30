// Phase-89B: Global Liquidity Engine
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Distinct from existing liquidity references:
//   crossMarketFusion (67): "liquidity" is one of 8 narrative dimensions
//   semanticImpactEngine (86B): liquidityCondition is derived for the macro desk
//   globalLiquidityEngine (89B): models the GLOBAL DOLLAR LIQUIDITY SYSTEM as a
//                                 unified state machine — Fed balance sheet trajectory,
//                                 petrodollar recycling, EM funding conditions, and
//                                 dollar scarcity/abundance
//
// The global liquidity system has 4 interlocking components:
//
//   1. liquidityState: overall system posture (tightening/easing/stressed/ample/neutral)
//      — derived from CB balance sheet direction + credit spread level
//
//   2. dollarLiquidity: USD availability in cross-border and EM markets
//      — derived from DXY direction (EUR/USD as inverse proxy) + funding conditions
//
//   3. fundingConditions: short-term funding market health
//      — derived from creditStress + TLT signal + repo/LIBOR proxies
//
//   4. petrodollarFlow: oil exporter recycling contribution to global dollar supply
//      — derived from oil price direction and Saudi context
//
// Institutional note: global liquidity is the PRIMARY driver of cross-asset
// risk premia; when dollar liquidity tightens, ALL risk assets face simultaneous
// multiple compression regardless of underlying fundamentals.
//
// Educational/advisory only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type LiquidityState    = "tightening" | "easing" | "stressed" | "ample" | "neutral";
export type DollarLiquidity   = "scarce" | "adequate" | "abundant";
export type FundingCondition  = "tight" | "normal" | "loose";
export type PetrodollarFlow   = "draining" | "recycling" | "neutral";

export interface GlobalLiquidityState {
  liquidityState:    LiquidityState;
  dollarLiquidity:   DollarLiquidity;
  fundingConditions: FundingCondition;
  petrodollarFlow:   PetrodollarFlow;
  stressSignal:      boolean;   // true when ≥2 concurrent stress indicators
  liquidityCtx:      string;    // ≤180 chars injectable
  institutionalNote: string;    // ≤65 chars: what allocators must consider
}

// ─── State derivation ─────────────────────────────────────────────────────────

function deriveLiquidityState(
  tltChangePct: number | null | undefined,
  creditStress: "low" | "moderate" | "high" | "extreme",
  ratesEnv: string,
): LiquidityState {
  const r = ratesEnv.toLowerCase();
  if (creditStress === "extreme") return "stressed";
  if (creditStress === "high" && tltChangePct != null && tltChangePct < -1.5) return "stressed";
  if (creditStress === "high") return "tightening";
  if (/qt|quantitative.tight|balance.sheet.con|drain/.test(r)) return "tightening";
  if (/qe|inject|expand|ample|unlimited|easing/.test(r)) return "ample";
  if (tltChangePct != null && tltChangePct > 1.5 && creditStress === "low") return "easing";
  if (tltChangePct != null && tltChangePct < -1.0) return "tightening";
  return "neutral";
}

function deriveDollarLiquidity(
  eurUsd: number | null | undefined,
  creditStress: "low" | "moderate" | "high" | "extreme",
): DollarLiquidity {
  if (eurUsd == null) return "adequate";
  if (eurUsd < 1.04 && (creditStress === "high" || creditStress === "extreme")) return "scarce";
  if (eurUsd < 1.06 && creditStress === "moderate") return "scarce";
  if (eurUsd > 1.13 && creditStress === "low") return "abundant";
  if (eurUsd > 1.10) return "abundant";
  return "adequate";
}

function deriveFundingConditions(
  creditStress: "low" | "moderate" | "high" | "extreme",
  tltChangePct: number | null | undefined,
): FundingCondition {
  if (creditStress === "extreme") return "tight";
  if (creditStress === "high")    return "tight";
  if (creditStress === "low" && (tltChangePct == null || tltChangePct > 0)) return "loose";
  return "normal";
}

function derivePetrodollarFlow(
  oilPrice: number | null | undefined,
  oilChangePct: number | null | undefined,
): PetrodollarFlow {
  if (oilPrice == null) return "neutral";
  if (oilPrice > 82 && (oilChangePct == null || oilChangePct >= -1)) return "recycling";
  if (oilPrice < 68 || (oilChangePct != null && oilChangePct < -5)) return "draining";
  return "neutral";
}

// ─── Stress signal ────────────────────────────────────────────────────────────

function computeStressSignal(
  state: LiquidityState,
  dollar: DollarLiquidity,
  funding: FundingCondition,
  petro: PetrodollarFlow,
): boolean {
  let stressCount = 0;
  if (state === "stressed" || state === "tightening") stressCount++;
  if (dollar === "scarce")  stressCount++;
  if (funding === "tight")  stressCount++;
  if (petro === "draining") stressCount++;
  return stressCount >= 2;
}

// ─── Context builder ──────────────────────────────────────────────────────────

const STATE_LABELS: Record<LiquidityState, string> = {
  tightening: "Liquidity tightening — risk premia rising",
  easing:     "Liquidity easing — risk premia compressing",
  stressed:   "Liquidity stressed — cross-asset multiple compression risk",
  ample:      "Liquidity ample — risk-asset supportive environment",
  neutral:    "Liquidity neutral — no dominant signal",
};

const INSTITUTIONAL_NOTES: Record<LiquidityState, string> = {
  tightening: "Reduce concentration; funding cost rising",
  easing:     "Risk asset deployment conditions improving",
  stressed:   "Prioritise liquidity; avoid illiquid positions",
  ample:      "Deployment conditions supportive; monitor reversal",
  neutral:    "Monitor leading indicators for direction change",
};

function buildLiquidityCtx(
  state: LiquidityState,
  dollar: DollarLiquidity,
  funding: FundingCondition,
  petro: PetrodollarFlow,
  stressSignal: boolean,
): string {
  const stressFlag = stressSignal ? " ⚡stress" : "";
  return `Liquidity[${state}${stressFlag}]: dollar=${dollar} funding=${funding} petrodollar=${petro}`.slice(0, 180);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildGlobalLiquidityState(input: {
  tltChangePct:      number | null | undefined;
  oilPrice:          number | null | undefined;
  oilChangePct:      number | null | undefined;
  eurUsd:            number | null | undefined;
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
  ratesEnv:          string;
  macroBias:         "bullish" | "bearish" | "neutral";
}): GlobalLiquidityState {
  const { tltChangePct, oilPrice, oilChangePct, eurUsd, creditStressLevel, ratesEnv } = input;

  const liquidityState    = deriveLiquidityState(tltChangePct, creditStressLevel, ratesEnv);
  const dollarLiquidity   = deriveDollarLiquidity(eurUsd, creditStressLevel);
  const fundingConditions = deriveFundingConditions(creditStressLevel, tltChangePct);
  const petrodollarFlow   = derivePetrodollarFlow(oilPrice, oilChangePct);
  const stressSignal      = computeStressSignal(liquidityState, dollarLiquidity, fundingConditions, petrodollarFlow);

  return {
    liquidityState,
    dollarLiquidity,
    fundingConditions,
    petrodollarFlow,
    stressSignal,
    liquidityCtx:      buildLiquidityCtx(liquidityState, dollarLiquidity, fundingConditions, petrodollarFlow, stressSignal),
    institutionalNote: INSTITUTIONAL_NOTES[liquidityState].slice(0, 65),
  };
}
