// Phase-88B: Regime Transition Foresight Engine
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Problem: Genesis reasons about the CURRENT regime but does not anticipate
// where the regime is heading. Institutional foresight requires regime
// transition probability — not a prediction, but a structured assessment of
// which transition is most likely given current signals, and what observable
// condition would confirm it.
//
// Solution: for each current regime, pre-defined transition paths with:
//   - trigger conditions: observable, specific, not vague
//   - leading indicators: what to monitor
//   - horizon: near-term (<3m), medium-term (3-12m), extended (>12m)
//   - probability: derived from current signals (not hard-coded)
//
// Saudi-specific adjustments: oil price above/below threshold shifts
// transition probabilities for the Saudi fiscal channel.
//
// Output: TransitionRiskProfile with transitionContext (≤200 chars injectable).
// Educational/advisory foresight only. No certainty claims.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type TransitionHorizon = "near_term" | "medium_term" | "extended";
export type TransitionRisk    = "imminent" | "building" | "remote" | "stable";

export interface RegimeTransitionPath {
  from:             string;
  to:               string;
  label:            string;         // e.g. "CB Pivot"
  triggerCondition: string;         // ≤80 chars: observable condition required
  leadingIndicator: string;         // ≤60 chars: what to watch
  horizon:          TransitionHorizon;
  probability:      number;         // 0-100
}

export interface TransitionRiskProfile {
  currentRegime:         string;
  mostLikelyTransition:  RegimeTransitionPath | null;
  alternativeTransition: RegimeTransitionPath | null;
  transitionRisk:        TransitionRisk;
  transitionContext:     string;   // ≤200 chars injectable
  institutionalWatch:    string;   // ≤80 chars: what allocators must monitor
}

// ─── Transition path library ──────────────────────────────────────────────────

type PrimaryRegimeKey =
  | "bull_trending"
  | "bear_ranging"
  | "high_vol_risk_off"
  | "low_vol_accumulation"
  | "macro_transition";

interface TransitionEntry {
  to:               string;
  label:            string;
  triggerCondition: string;
  leadingIndicator: string;
  horizon:          TransitionHorizon;
  baseProbability:  number;
}

const TRANSITION_LIBRARY: Record<PrimaryRegimeKey, [TransitionEntry, TransitionEntry]> = {
  bull_trending: [
    {
      to:               "macro_transition",
      label:            "Tightening Interruption",
      triggerCondition: "CB hawkish surprise + earnings miss in 2 consecutive quarters",
      leadingIndicator: "Yield curve flattening + forward EPS revisions turning negative",
      horizon:          "medium_term",
      baseProbability:  28,
    },
    {
      to:               "bear_ranging",
      label:            "Multiple Compression",
      triggerCondition: "Real rate exceeds 2% + credit spread widening >50bps",
      leadingIndicator: "Credit spread trend + consumer confidence deterioration",
      horizon:          "extended",
      baseProbability:  18,
    },
  ],
  low_vol_accumulation: [
    {
      to:               "bull_trending",
      label:            "Vol Regime Shift",
      triggerCondition: "VIX sustained <14 + cross-asset momentum turns positive",
      leadingIndicator: "Implied vol surface term structure flattening",
      horizon:          "near_term",
      baseProbability:  38,
    },
    {
      to:               "macro_transition",
      label:            "Catalyst-Triggered Break",
      triggerCondition: "Earnings season miss or geopolitical shock interrupts accumulation",
      leadingIndicator: "Options skew + credit spread directionality",
      horizon:          "near_term",
      baseProbability:  22,
    },
  ],
  macro_transition: [
    {
      to:               "easing_cycle",
      label:            "CB Policy Pivot",
      triggerCondition: "Inflation falls to target AND unemployment rises meaningfully",
      leadingIndicator: "Core CPI 3-month trend + NFP revisions + Fed dot plot shift",
      horizon:          "medium_term",
      baseProbability:  35,
    },
    {
      to:               "tightening_extension",
      label:            "Sticky Inflation Extension",
      triggerCondition: "Inflation stalls above 3% for 2+ quarters with growth resilient",
      leadingIndicator: "Services CPI + wage growth + CB forward guidance language",
      horizon:          "near_term",
      baseProbability:  30,
    },
  ],
  bear_ranging: [
    {
      to:               "recovery",
      label:            "CB Backstop + Recovery",
      triggerCondition: "CB pivots AND credit spreads peak within 60bps of cycle high",
      leadingIndicator: "HY spread momentum reversal + ISM new orders turning",
      horizon:          "medium_term",
      baseProbability:  28,
    },
    {
      to:               "deep_contraction",
      label:            "Recession Confirmation",
      triggerCondition: "Two consecutive negative GDP prints AND unemployment rises >1pp",
      leadingIndicator: "Yield curve inversion depth + credit card delinquency rate",
      horizon:          "extended",
      baseProbability:  22,
    },
  ],
  high_vol_risk_off: [
    {
      to:               "stabilisation",
      label:            "Vol Compression Stabilisation",
      triggerCondition: "VIX falls below 20 for 5+ sessions AND CB provides backstop",
      leadingIndicator: "Realised vol rolling 10-day → VIX spread normalisation",
      horizon:          "near_term",
      baseProbability:  30,
    },
    {
      to:               "bear_market_extension",
      label:            "Contagion Escalation",
      triggerCondition: "HY spreads breach 700bps OR funding market seizure",
      leadingIndicator: "TED spread + SOFR-OIS spread + IG/HY ratio",
      horizon:          "near_term",
      baseProbability:  28,
    },
  ],
};

// ─── Probability adjustment ───────────────────────────────────────────────────

function adjustForSignals(
  base: number,
  creditStress: "low" | "moderate" | "high" | "extreme",
  regimeConf: number,
  oilPrice: number | null | undefined,
  isSaudi: boolean,
  isFirst: boolean,  // true = most likely, false = alternative
): number {
  let p = base;
  // Low regime confidence → both transitions less certain
  if (regimeConf < 40) p -= 8;
  if (regimeConf > 70) p += 5;
  // Credit stress accelerates downside transitions (2nd transition for bull; 1st for bear)
  if (creditStress === "high")    p += isFirst ? -5 : 8;
  if (creditStress === "extreme") p += isFirst ? -10 : 15;
  // Saudi oil price influence on transition risk
  if (isSaudi && oilPrice != null) {
    if (oilPrice < 72 && !isFirst) p += 8;   // accelerates downside path
    if (oilPrice > 85 && isFirst)  p += 5;   // accelerates recovery path
  }
  return Math.max(5, Math.min(75, Math.round(p)));
}

// ─── Transition risk classification ──────────────────────────────────────────

function classifyTransitionRisk(
  primaryRegime: string,
  creditStress: "low" | "moderate" | "high" | "extreme",
  regimeConf: number,
  most: RegimeTransitionPath | null,
): TransitionRisk {
  if (!most) return "stable";
  if (most.probability >= 45 && most.horizon === "near_term") return "imminent";
  if (most.probability >= 35 || creditStress === "high" || creditStress === "extreme") return "building";
  if (most.probability <= 18 || regimeConf >= 70) return "remote";
  return "stable";
}

// ─── Institutional watch note ─────────────────────────────────────────────────

function buildInstitutionalWatch(
  most: RegimeTransitionPath | null,
  isSaudi: boolean,
): string {
  if (!most) return "Monitor current regime stability; no clear transition signal.";
  const base = `Watch: ${most.leadingIndicator.slice(0, 55)}`;
  const saudiSupplement = isSaudi ? " + oil/SAMA signals" : "";
  return (base + saudiSupplement).slice(0, 80);
}

// ─── Context builder ──────────────────────────────────────────────────────────

function buildTransitionContext(
  most: RegimeTransitionPath | null,
  alt: RegimeTransitionPath | null,
  risk: TransitionRisk,
): string {
  if (!most) return "Transition: no dominant path detected — regime appears stable.";
  const mostStr = `→${most.to}(${most.probability}%): ${most.triggerCondition.slice(0, 60)}`;
  const altStr  = alt ? ` | alt→${alt.to}(${alt.probability}%): ${alt.triggerCondition.slice(0, 40)}` : "";
  const riskTag = `[risk:${risk}]`;
  return `Transition: ${mostStr}${altStr} ${riskTag}`.slice(0, 200);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildTransitionForesight(input: {
  primaryRegime:     string;
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
  regimeConf:        number;   // 0-100
  isSaudi:           boolean;
  oilPrice?:         number | null;
}): TransitionRiskProfile {
  const { primaryRegime, creditStressLevel, regimeConf, isSaudi, oilPrice } = input;

  const key: PrimaryRegimeKey =
    /bull.*trend|risk_on/.test(primaryRegime)    ? "bull_trending" :
    /low_vol|accumulation/.test(primaryRegime)   ? "low_vol_accumulation" :
    /high_vol|risk_off/.test(primaryRegime)      ? "high_vol_risk_off" :
    /bear.*rang|contraction/.test(primaryRegime) ? "bear_ranging" :
    "macro_transition";

  const [entry0, entry1] = TRANSITION_LIBRARY[key];

  const p0 = adjustForSignals(entry0.baseProbability, creditStressLevel, regimeConf, oilPrice, isSaudi, true);
  const p1 = adjustForSignals(entry1.baseProbability, creditStressLevel, regimeConf, oilPrice, isSaudi, false);

  const most: RegimeTransitionPath = {
    from: primaryRegime, to: entry0.to, label: entry0.label,
    triggerCondition: entry0.triggerCondition,
    leadingIndicator: entry0.leadingIndicator,
    horizon: entry0.horizon, probability: p0,
  };
  const alt: RegimeTransitionPath = {
    from: primaryRegime, to: entry1.to, label: entry1.label,
    triggerCondition: entry1.triggerCondition,
    leadingIndicator: entry1.leadingIndicator,
    horizon: entry1.horizon, probability: p1,
  };

  const transitionRisk   = classifyTransitionRisk(primaryRegime, creditStressLevel, regimeConf, most);
  const transitionContext = buildTransitionContext(most, alt, transitionRisk);
  const institutionalWatch = buildInstitutionalWatch(most, isSaudi);

  return {
    currentRegime:         primaryRegime,
    mostLikelyTransition:  most,
    alternativeTransition: alt,
    transitionRisk,
    transitionContext,
    institutionalWatch,
  };
}
