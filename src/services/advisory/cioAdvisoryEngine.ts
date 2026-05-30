// Phase-90A: CIO Advisory Engine
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Distinct from allocatorDecisionEngine.ts (Phase-83B):
//   allocatorDecisionEngine: TACTICAL DEPLOYMENT STANCE per session
//                            (scale_in_gradual/wait_confirmation/avoid_or_reduce)
//   cioAdvisoryEngine (90A): STRATEGIC CIO FRAMING across three time horizons —
//                             near_term (<3M), medium_term (3-12M), long_term (12M+);
//                             capital preservation posture; deployment caution;
//                             institutional opportunity framing as CIO VOICE
//
// The CIO voice is distinct from the analyst/allocator voice:
//   Analyst: "The macro regime is bear_ranging with high credit stress"
//   Allocator: "wait_confirmation — deploy selectively on CB pivot signal"
//   CIO: "Strategic allocation discipline: preservation-first posture warranted;
//          medium-term framework suggests selective quality deployment when credit
//          stabilises; avoid broad index exposure until spread peak confirmed"
//
// Output: CioAdvisoryFrame with injectable cioBriefing ≤160 chars.
// No execution language. Educational/advisory only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type StrategicHorizon     = "near_term" | "medium_term" | "long_term";
export type CapitalPreservation  = "growth_oriented" | "balanced" | "preservation_first" | "capital_protection";
export type DeploymentCaution    = "selective_deploy" | "hold" | "reduce" | "defensive" | "opportunistic";
export type StrategicBiasLabel   = "constructive" | "opportunistic" | "neutral" | "cautious" | "defensive" | "uncertain";

export interface CioAdvisoryFrame {
  strategicHorizon:       StrategicHorizon;
  capitalPreservation:    CapitalPreservation;
  deploymentCaution:      DeploymentCaution;
  strategicBias:          StrategicBiasLabel;
  opportunityFraming:     string;   // ≤75 chars: CIO-voice characterisation
  cioBriefing:            string;   // ≤160 chars injectable
}

// ─── Strategic horizon ────────────────────────────────────────────────────────

function deriveStrategicHorizon(
  primaryRegime: string,
  creditStress:  "low" | "moderate" | "high" | "extreme",
  regimeConf:    number,
): StrategicHorizon {
  const r = (primaryRegime ?? "").toLowerCase().replace(/[-\s]/g, "_");
  if (creditStress === "extreme") return "near_term";
  if (creditStress === "high" && /high_vol|risk_off|bear/.test(r)) return "near_term";
  if (/macro_transition/.test(r) || regimeConf < 45) return "medium_term";
  if (/bull_trending|low_vol_accumulation/.test(r) && creditStress === "low") return "long_term";
  return "medium_term";
}

// ─── Capital preservation posture ────────────────────────────────────────────

function deriveCapitalPreservation(
  macroBias:    "bullish" | "bearish" | "neutral",
  creditStress: "low" | "moderate" | "high" | "extreme",
): CapitalPreservation {
  if (creditStress === "extreme") return "capital_protection";
  if (creditStress === "high")    return "preservation_first";
  if (macroBias === "bearish" && creditStress === "moderate") return "preservation_first";
  if (macroBias === "bullish" && creditStress === "low")      return "growth_oriented";
  return "balanced";
}

// ─── Deployment caution ───────────────────────────────────────────────────────

function deriveDeploymentCaution(
  macroBias:       "bullish" | "bearish" | "neutral",
  creditStress:    "low" | "moderate" | "high" | "extreme",
  preservation:    CapitalPreservation,
  consStrength:    "strong" | "moderate" | "weak" | "conflicted",
): DeploymentCaution {
  if (preservation === "capital_protection") return "defensive";
  if (preservation === "preservation_first" && macroBias === "bearish") return "reduce";
  if (consStrength === "conflicted") return "hold";
  if (macroBias === "bullish" && creditStress === "low") return "selective_deploy";
  if (macroBias === "bullish" && creditStress === "moderate" && consStrength === "strong") return "opportunistic";
  if (macroBias === "bearish") return "reduce";
  return "hold";
}

// ─── Strategic bias label ─────────────────────────────────────────────────────

function deriveStrategicBias(
  macroBias:    "bullish" | "bearish" | "neutral",
  caution:      DeploymentCaution,
  creditStress: "low" | "moderate" | "high" | "extreme",
  consStrength: "strong" | "moderate" | "weak" | "conflicted",
): StrategicBiasLabel {
  if (creditStress === "extreme")                         return "defensive";
  if (caution === "defensive" || caution === "reduce")    return "defensive";
  if (caution === "opportunistic")                        return "opportunistic";
  if (consStrength === "conflicted")                      return "uncertain";
  if (macroBias === "bullish" && caution === "selective_deploy") return "constructive";
  if (macroBias === "neutral" || caution === "hold")      return "neutral";
  if (macroBias === "bearish")                            return "cautious";
  return "neutral";
}

// ─── Opportunity framing ──────────────────────────────────────────────────────

type PreservMap = Record<CapitalPreservation, Record<DeploymentCaution, string>>;
const OPP_FRAMING: Partial<PreservMap> = {
  capital_protection: {
    defensive:       "Capital protection priority: credit stress warrants cash/DM sovereign focus",
    reduce:          "Reduce risk exposure: credit conditions do not support new deployment",
    hold:            "Hold quality; no new capital at risk until credit stabilises",
    selective_deploy: "Selective only: capital protection still primary; quality names with defensive characteristics",
    opportunistic:   "Cautious opportunity: asymmetric upside IF credit stabilises; small tranches only",
  },
  preservation_first: {
    defensive:       "Preservation-first: protect capital above all; defensives + cash",
    reduce:          "Trim cyclicals; concentrate in quality and cash-generative names",
    hold:            "Hold strategic allocation; defer discretionary deployment",
    selective_deploy: "Selective quality deployment: sector-differentiated within preservation framework",
    opportunistic:   "Opportunistic entry: preservation posture intact; small asymmetric positions",
  },
  balanced: {
    hold:            "Balanced allocation: no directional tilt until clarity emerges",
    selective_deploy: "Selective deployment: balanced risk/return framework; quality preference",
    opportunistic:   "Opportunistic: balanced posture allows selective asymmetric opportunities",
    defensive:       "Balanced but defensive: tilt toward quality and shorter duration",
    reduce:          "Rebalance toward quality: trim high-beta within balanced framework",
  },
  growth_oriented: {
    selective_deploy: "Growth-oriented selective deployment: regime supports quality risk accumulation",
    opportunistic:   "Opportunistic growth: strong macro backdrop supports systematic deployment",
    hold:            "Growth framework intact; hold; await better entry timing",
    defensive:       "Growth framework challenged; shift toward quality within growth mandate",
    reduce:          "Growth mandate: trim overweight; rebalance without abandoning risk framework",
  },
};

function buildOpportunityFraming(preservation: CapitalPreservation, caution: DeploymentCaution): string {
  return (OPP_FRAMING[preservation]?.[caution] ?? `Strategic allocation: ${preservation} posture; ${caution} deployment`).slice(0, 75);
}

// ─── CIO briefing ─────────────────────────────────────────────────────────────

function buildCioBriefing(
  horizon:      StrategicHorizon,
  preservation: CapitalPreservation,
  caution:      DeploymentCaution,
  bias:         StrategicBiasLabel,
  opp:          string,
): string {
  return `CIO[${horizon}|${preservation}|${caution}|${bias}]: ${opp.slice(0, 100)}`.slice(0, 160);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildCioAdvisoryFrame(input: {
  primaryRegime:     string;
  macroBias:         "bullish" | "bearish" | "neutral";
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
  consensusStrength: "strong" | "moderate" | "weak" | "conflicted";
  regimeConf:        number;
  isSaudi:           boolean;
  oilPrice?:         number | null;
}): CioAdvisoryFrame {
  const { primaryRegime, macroBias, creditStressLevel, consensusStrength, regimeConf, isSaudi, oilPrice } = input;

  // Saudi fiscal context adjustment
  let adjustedBias: typeof macroBias = macroBias;
  if (isSaudi && oilPrice != null && oilPrice < 70 && macroBias !== "bearish") {
    adjustedBias = "neutral";  // Saudi oil below breakeven dampens otherwise bullish framing
  }

  const horizon     = deriveStrategicHorizon(primaryRegime, creditStressLevel, regimeConf);
  const preservation = deriveCapitalPreservation(adjustedBias, creditStressLevel);
  const caution     = deriveDeploymentCaution(adjustedBias, creditStressLevel, preservation, consensusStrength);
  const bias        = deriveStrategicBias(adjustedBias, caution, creditStressLevel, consensusStrength);
  const opp         = buildOpportunityFraming(preservation, caution);

  return {
    strategicHorizon:    horizon,
    capitalPreservation: preservation,
    deploymentCaution:   caution,
    strategicBias:       bias,
    opportunityFraming:  opp,
    cioBriefing:         buildCioBriefing(horizon, preservation, caution, bias, opp),
  };
}
