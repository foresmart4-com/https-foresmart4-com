// Phase-87B: Regime Ontology Engine
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Problem: Genesis historically receives flat regime strings ("bear_ranging",
// "high_vol_risk-off") with no composition logic. Information is lost when
// tightening AND high inflation are simultaneously active, or when liquidity
// stress co-occurs with commodity shocks.
//
// Solution: decompose any incoming regime label + signal context into a
// normalized profile:
//   primaryRegime:        5 canonical base types
//   overlays:             up to 4 concurrent modifier conditions
//   compositeLabel:       compact composite for tracing/logging
//   institutionalFraming: fiduciary-aware 1-sentence framing for prompt injection
//   fiduciaryAlert:       true when ≥2 stress conditions are simultaneously active
//
// Distinct from regimeConflictEngine.ts (Phase-83B) — which detects NAMED conflict
// *pairs*. This engine focuses on *normalizing and compositing* regime state so
// downstream modules (unifiedCognitionGovernor, genesis pipeline) can reason
// about overlapping conditions without re-deriving them independently.
//
// No PII. No broker data. Educational/advisory framing only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type PrimaryRegime =
  | "bull_trending"
  | "bear_ranging"
  | "high_vol_risk_off"
  | "low_vol_accumulation"
  | "macro_transition";

export type RegimeOverlay =
  | "tightening_overlay"     // CB actively tightening / rates rising
  | "easing_overlay"         // CB easing / cutting rates
  | "inflation_elevated"     // inflation materially above target (>4%)
  | "inflation_normalizing"  // inflation declining toward target
  | "liquidity_tight"        // DXY rising / credit spreads wide / funding stress
  | "liquidity_ample"        // DXY soft / spreads tight / QE / accommodative
  | "commodity_stress"       // oil/commodity-driven price or fiscal pressure
  | "credit_stress";         // HY spreads wide / funding market under stress

export interface RegimeSignals {
  creditStressLevel?: "low" | "moderate" | "high" | "extreme";
  ratesEnv?:          string;       // free text: "tightening", "hawkish", "easing", "dovish"…
  oilLiquidity?:      string;       // free text oil+liquidity description from Track A
  oilChangePct?:      number | null;
  tltChangePct?:      number | null; // negative = rates rising (tightening signal)
  macroBias?:         "bullish" | "bearish" | "neutral";
  isGulfMarket?:      boolean;
}

export interface NormalizedRegimeProfile {
  primaryRegime:        PrimaryRegime;
  overlays:             RegimeOverlay[];
  compositeLabel:       string;   // e.g. "bear_ranging+tightening_overlay+credit_stress"
  institutionalFraming: string;   // 1-sentence framing for prompt context
  fiduciaryAlert:       boolean;  // true when ≥2 stress overlays are simultaneously active
  overlapCount:         number;   // total overlay count
  regimeConfidence:     number;   // 0-100 confidence in classification
}

// ─── Primary regime parsing ───────────────────────────────────────────────────

function parsePrimaryRegime(label: string | undefined): PrimaryRegime {
  if (!label) return "macro_transition";
  const l = label.toLowerCase().replace(/[-\s]/g, "_");
  if (/bull|trending|risk_on/.test(l))               return "bull_trending";
  if (/low_vol|accumulation/.test(l))                return "low_vol_accumulation";
  if (/high_vol|risk_off/.test(l))                   return "high_vol_risk_off";
  if (/bear|ranging|contraction|correction/.test(l)) return "bear_ranging";
  if (/transit|shifting|mixed/.test(l))              return "macro_transition";
  if (/bullish/.test(l))                             return "bull_trending";
  if (/bearish/.test(l))                             return "bear_ranging";
  return "macro_transition";
}

// ─── Overlay detection ────────────────────────────────────────────────────────

const TIGHTENING_RE  = /tight|hik|hawkish|restrict|raising.rate|rate.rise|above.neutral/i;
const EASING_RE      = /\beas|cut|dovish|pivot|loosen|rate.cut|below.neutral/i;
const INFLATION_HI   = /inflat.*(high|elev|above.target|above.4|surge|persistent)|cpi.above|cpi.high|wage.inflat/i;
const INFLATION_NORM = /inflat.*(declin|normal|towards.target|fall|cool|moderat)|dis.?inflat/i;
const LIQUIDITY_TIGH = /dxy.ris|dollar.stren|spread.wid|tight.liquid|funding.stress|hg.spread/i;
const LIQUIDITY_AMPL = /dxy.fall|dollar.weak|spread.tight|ample.liquid|qe|quantitative.eas/i;
const COMMODITY_STR  = /oil.shock|oil.crash|oil.fall|commodity.stress|oil.below|oil.slide|oil.down/i;

function detectOverlays(signals: RegimeSignals): RegimeOverlay[] {
  const overlays = new Set<RegimeOverlay>();
  const rates = (signals.ratesEnv    ?? "").toLowerCase();
  const oil   = (signals.oilLiquidity ?? "").toLowerCase();
  const combined = `${rates} ${oil}`;

  // Tightening signals
  if (TIGHTENING_RE.test(rates)) overlays.add("tightening_overlay");
  if (signals.tltChangePct != null && signals.tltChangePct < -1.0) overlays.add("tightening_overlay");

  // Easing signals
  if (EASING_RE.test(rates)) overlays.add("easing_overlay");
  if (signals.tltChangePct != null && signals.tltChangePct > 1.0) overlays.add("easing_overlay");

  // Credit stress
  if (signals.creditStressLevel === "high" || signals.creditStressLevel === "extreme") {
    overlays.add("credit_stress");
  }

  // Commodity stress
  if (COMMODITY_STR.test(oil)) overlays.add("commodity_stress");
  if (signals.oilChangePct != null && signals.oilChangePct < -3) overlays.add("commodity_stress");

  // Liquidity
  if (LIQUIDITY_TIGH.test(combined)) overlays.add("liquidity_tight");
  if (LIQUIDITY_AMPL.test(combined)) overlays.add("liquidity_ample");

  // Inflation
  if (INFLATION_HI.test(combined))   overlays.add("inflation_elevated");
  if (INFLATION_NORM.test(combined)) overlays.add("inflation_normalizing");

  // Resolve contradictions — keep the stronger signal
  if (overlays.has("tightening_overlay") && overlays.has("easing_overlay")) {
    if (overlays.has("credit_stress") || signals.creditStressLevel === "high" || signals.creditStressLevel === "extreme") {
      overlays.delete("easing_overlay");   // tightening wins when credit stressed
    } else {
      overlays.delete("tightening_overlay");
    }
  }
  if (overlays.has("liquidity_tight") && overlays.has("liquidity_ample")) {
    overlays.delete("liquidity_ample"); // tight is the conservative assumption
  }
  if (overlays.has("inflation_elevated") && overlays.has("inflation_normalizing")) {
    overlays.delete("inflation_normalizing"); // elevated takes precedence
  }

  return Array.from(overlays);
}

// ─── Institutional framing ────────────────────────────────────────────────────

const PRIMARY_FRAMING: Record<PrimaryRegime, string> = {
  bull_trending:
    "Risk-on regime favoring equity and growth assets; allocators may deploy tactically with defined invalidation thresholds.",
  bear_ranging:
    "Range-bound bear structure; capital preservation framing is appropriate and directional conviction should remain limited.",
  high_vol_risk_off:
    "Elevated volatility and risk-off conditions active; fiduciary priority shifts toward drawdown control and defensive positioning.",
  low_vol_accumulation:
    "Low-volatility accumulation regime; structural entry conditions present, but liquidity depth must be confirmed before deployment.",
  macro_transition:
    "Macro regime in transition; multiple valid interpretations are live — conditional framing and scenario plurality are mandatory.",
};

const OVERLAY_SUPPLEMENTS: Partial<Record<RegimeOverlay, string>> = {
  tightening_overlay: "Active CB tightening compresses risk multiples and duration.",
  easing_overlay:     "CB easing supports risk appetite and extends duration.",
  inflation_elevated: "Elevated inflation limits CB optionality and compresses real returns.",
  credit_stress:      "Credit spread widening signals funding stress — liquidity preservation takes priority.",
  commodity_stress:   "Commodity-driven price shock transmits to fiscal and earnings channels.",
  liquidity_tight:    "Tight dollar liquidity constrains EM and Gulf cross-border flows.",
};

function buildInstitutionalFraming(
  primary: PrimaryRegime,
  overlays: RegimeOverlay[],
  isGulfMarket: boolean,
): string {
  const base = PRIMARY_FRAMING[primary];
  const STRESS_OVERLAYS: RegimeOverlay[] = [
    "credit_stress", "tightening_overlay", "commodity_stress", "inflation_elevated", "liquidity_tight",
  ];
  const stressSupplements = overlays
    .filter(o => STRESS_OVERLAYS.includes(o))
    .slice(0, 2)
    .map(o => OVERLAY_SUPPLEMENTS[o])
    .filter(Boolean) as string[];

  const gulfNote = isGulfMarket && overlays.includes("commodity_stress")
    ? "Saudi/Gulf fiscal channel is exposed to oil-price transmission — breakeven ~$75-80/bbl."
    : "";

  return [base, ...stressSupplements, gulfNote].filter(Boolean).join(" ").trim();
}

// ─── Confidence scoring ───────────────────────────────────────────────────────

function computeConfidence(label: string | undefined, signals: RegimeSignals): number {
  let score = 40;
  if (label && label.trim().length > 3)                               score += 20;
  if (signals.creditStressLevel && signals.creditStressLevel !== "low") score += 10;
  if (signals.ratesEnv && signals.ratesEnv.length > 5)                 score += 10;
  if (signals.oilLiquidity && signals.oilLiquidity.length > 5)         score += 10;
  if (signals.oilChangePct != null)                                     score +=  5;
  if (signals.tltChangePct != null)                                     score +=  5;
  return Math.min(95, score);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildRegimeProfile(
  regimeLabel: string | undefined,
  signals: RegimeSignals = {},
): NormalizedRegimeProfile {
  const primaryRegime = parsePrimaryRegime(regimeLabel);
  const overlays      = detectOverlays(signals);

  const STRESS: RegimeOverlay[] = [
    "credit_stress", "tightening_overlay", "commodity_stress", "inflation_elevated", "liquidity_tight",
  ];
  const stressCount = overlays.filter(o => STRESS.includes(o)).length;

  const compositeLabel = overlays.length > 0
    ? `${primaryRegime}+${overlays.join("+")}`
    : primaryRegime;

  const institutionalFraming = buildInstitutionalFraming(
    primaryRegime, overlays, signals.isGulfMarket ?? false,
  );

  return {
    primaryRegime,
    overlays,
    compositeLabel,
    institutionalFraming,
    fiduciaryAlert:   stressCount >= 2,
    overlapCount:     overlays.length,
    regimeConfidence: computeConfidence(regimeLabel, signals),
  };
}
