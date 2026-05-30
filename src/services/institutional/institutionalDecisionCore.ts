// LCCR-1: Institutional Decision Core
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Root cause addressed: Genesis reasons as a macro/regime engine rather than as an
// investment committee. This module injects the committee DECISION FRAME early in
// the prompt so the AI reasons allocation-first, regime-second:
//   — Position sizing (core/satellite/tactical tranche logic)
//   — Preservation vs offense stance calibration
//   — Horizon discipline (1M / 3M / 12M / 24M)
//   — Risk/reward asymmetry framing
//   — Capital deployment vs wait logic
//
// Distinct from existing modules:
//   allocatorDecisionEngine.ts (83B) — scored stance (scale_in/hold/avoid) from signals
//   committeeDynamicsEngine.ts (88A) — internal committee tension/minority argument
//   allocationIntelligence.ts (68)   — broad/selective/defensive/balanced frame
//
// This module produces the DECISION REASONING FRAME: the structured set of questions
// an investment committee must answer before regime analysis drives conclusions.
// Educational/advisory only. No execution language. No broker data.

import type { Lang } from "@/lib/ai/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AllocationSizing =
  | "overweight"       // higher than benchmark; conditions support above-average exposure
  | "neutral"          // benchmark weight; no strong conviction either direction
  | "underweight"      // below benchmark; reduce selectively; protect core
  | "no_new_capital";  // preserve cash; do not add new exposure in current conditions

export type PositionFramework =
  | "core_satellite"   // large core holding + small satellite tactical bets
  | "barbell"          // split: defensive anchor + high-conviction growth; avoid middle
  | "full_defense"     // capital preservation mandate; no new growth tilt
  | "selective_entry"; // patient entry on specific dislocations; not momentum chasing

export type HorizonDiscipline =
  | "tactical_1m"     // 1-month horizon: news-flow and momentum driven
  | "cyclical_3m"     // 3-month horizon: cycle-phase and earnings driven
  | "medium_12m"      // 12-month horizon: macro regime and valuation driven
  | "structural_24m"; // 24-month horizon: multi-cycle structural thesis

export type RiskRewardAsymmetry = "favorable" | "unfavorable" | "neutral" | "uncertain";

export type CapitalDeploymentStance =
  | "deploy_now"           // conditions support immediate gradual deployment
  | "wait_catalyst"        // clear catalyst identified; deploy on its confirmation
  | "wait_confirmation"    // wait for regime to clarify before committing capital
  | "preserve";            // protect existing capital; new deployment not warranted

export interface InstitutionalDecisionFrame {
  allocationSizing:        AllocationSizing;
  positionFramework:       PositionFramework;
  horizonDiscipline:       HorizonDiscipline;
  preservationScore:       number;             // 0-100: 0=full offense, 100=full preservation
  riskRewardAsymmetry:     RiskRewardAsymmetry;
  capitalDeploymentStance: CapitalDeploymentStance;
  deploymentRationale:     string;             // ≤130 chars
  positionSizingNote:      string;             // ≤130 chars
  horizonNote:             string;             // ≤100 chars
  decisionFrameContext:    string;             // injectable ≤400 chars
}

interface DecisionCoreInput {
  regime:            string;
  macroBias:         "bullish" | "bearish" | "neutral";
  creditStress:      "low" | "moderate" | "high" | "extreme";
  consensusStrength: "strong" | "moderate" | "weak" | "conflicted";
  consensusScore:    number;           // 0-100
  regimeConf:        number;           // 0-100
  uncertaintyLevel:  "low" | "moderate" | "high" | "extreme";
  isSaudi:           boolean;
  oilPrice:          number | null;
  question:          string;
  lang:              Lang;
}

// ─── Derivation: allocation sizing ───────────────────────────────────────────

function deriveAllocationSizing(i: DecisionCoreInput): AllocationSizing {
  if (i.creditStress === "extreme") return "no_new_capital";
  if (i.creditStress === "high" && i.macroBias === "bearish") return "no_new_capital";
  if (i.consensusStrength === "conflicted" && i.uncertaintyLevel === "extreme") return "no_new_capital";
  if (i.isSaudi && i.oilPrice !== null && i.oilPrice < 65 && i.creditStress !== "low") return "underweight";
  if (i.creditStress === "high") return "underweight";
  if (i.consensusStrength === "conflicted" || i.uncertaintyLevel === "high") return "underweight";
  if (i.macroBias === "bearish" && i.consensusStrength !== "strong") return "underweight";
  if (i.macroBias === "bullish" && i.creditStress === "low" && i.consensusStrength === "strong") return "overweight";
  if (i.macroBias === "bullish" && i.consensusStrength === "moderate") return "neutral";
  return "neutral";
}

// ─── Derivation: position framework ─────────────────────────────────────────

function derivePositionFramework(
  sizing: AllocationSizing,
  credit: string,
  bias: string,
  uncertainty: string,
): PositionFramework {
  if (sizing === "no_new_capital" || credit === "extreme") return "full_defense";
  if (credit === "high") return "barbell";
  if (bias === "bearish" && uncertainty !== "low") return "barbell";
  if (sizing === "underweight" && uncertainty === "moderate") return "selective_entry";
  if (sizing === "overweight" && credit === "low") return "core_satellite";
  if (sizing === "neutral") return "core_satellite";
  return "selective_entry";
}

// ─── Derivation: horizon discipline ──────────────────────────────────────────

function deriveHorizon(
  regime: string,
  credit: string,
  consensusStrength: string,
  isSaudi: boolean,
  question: string,
): HorizonDiscipline {
  const q = question.toLowerCase();
  if (/1\s*month|1m\b|short.?term|tactical|momentum|news.?flow/.test(q)) return "tactical_1m";
  if (/24\s*month|2\s*year|multi.?cycle|structural|long.?term|vision 2030/.test(q)) return "structural_24m";
  if (/12\s*month|1\s*year|medium/.test(q)) return "medium_12m";
  if (/quarter|3\s*month|q[1-4]\b|earnings/.test(q)) return "cyclical_3m";
  if (credit === "extreme" || credit === "high") return "cyclical_3m";
  if (/transition|mixed/.test(regime) || consensusStrength === "conflicted") return "cyclical_3m";
  if (isSaudi) return "medium_12m";
  return "medium_12m";
}

// ─── Derivation: preservation score ─────────────────────────────────────────

function derivePreservationScore(
  credit: string,
  bias: string,
  consensusStrength: string,
  uncertainty: string,
  regimeConf: number,
): number {
  let score = 50;
  if (credit === "extreme") score += 40;
  else if (credit === "high") score += 25;
  else if (credit === "moderate") score += 10;
  else score -= 10;
  if (bias === "bearish") score += 15;
  else if (bias === "bullish") score -= 15;
  if (consensusStrength === "conflicted") score += 10;
  else if (consensusStrength === "strong" && bias === "bullish") score -= 10;
  if (uncertainty === "extreme") score += 10;
  else if (uncertainty === "low") score -= 10;
  if (regimeConf < 40) score += 10;
  else if (regimeConf > 75) score -= 5;
  return Math.max(0, Math.min(100, score));
}

// ─── Derivation: risk/reward asymmetry ───────────────────────────────────────

function deriveRiskReward(
  bias: string,
  credit: string,
  consensusStrength: string,
  regimeConf: number,
  preservationScore: number,
): RiskRewardAsymmetry {
  if (credit === "extreme") return "unfavorable";
  if (credit === "high" && bias === "bearish") return "unfavorable";
  if (consensusStrength === "conflicted") return "uncertain";
  if (regimeConf < 40) return "uncertain";
  if (preservationScore > 70) return "unfavorable";
  if (bias === "bullish" && credit !== "high" && consensusStrength === "strong") return "favorable";
  if (preservationScore < 35 && regimeConf > 65) return "favorable";
  return "neutral";
}

// ─── Derivation: capital deployment stance ───────────────────────────────────

function deriveDeploymentStance(
  sizing: AllocationSizing,
  asymmetry: RiskRewardAsymmetry,
  consensusStrength: string,
  regimeConf: number,
): CapitalDeploymentStance {
  if (sizing === "no_new_capital") return "preserve";
  if (asymmetry === "unfavorable") return "preserve";
  if (consensusStrength === "conflicted" || asymmetry === "uncertain") return "wait_confirmation";
  if (regimeConf < 45 && sizing !== "overweight") return "wait_catalyst";
  if (asymmetry === "favorable" && sizing === "overweight") return "deploy_now";
  if (sizing === "neutral" && regimeConf >= 55) return "wait_catalyst";
  if (sizing === "underweight") return "wait_catalyst";
  return "wait_confirmation";
}

// ─── Context string builders ─────────────────────────────────────────────────

const SIZING_LABELS: Record<AllocationSizing, string> = {
  overweight:      "overweight — conditions support above-benchmark exposure",
  neutral:         "neutral — benchmark weight; conviction insufficient for tilt",
  underweight:     "underweight — reduce selectively; protect core position",
  no_new_capital:  "no new capital — preserve existing; conditions adverse for deployment",
};

const FRAMEWORK_LABELS: Record<PositionFramework, string> = {
  core_satellite:  "core + satellite: anchor core, small satellite bets on dislocations",
  barbell:         "barbell: defensive anchor + high-conviction growth; avoid middle-ground",
  full_defense:    "full defense: capital preservation mandate; no growth addition",
  selective_entry: "selective entry: patient positioning on specific dislocations only",
};

const HORIZON_LABELS: Record<HorizonDiscipline, string> = {
  tactical_1m:    "1-month tactical: momentum and news-flow framing",
  cyclical_3m:    "3-month cyclical: earnings cycle and regime-phase framing",
  medium_12m:     "12-month medium: macro regime and valuation framing",
  structural_24m: "24-month structural: multi-cycle and fundamental thesis framing",
};

const DEPLOYMENT_LABELS: Record<CapitalDeploymentStance, string> = {
  deploy_now:          "deploy gradually — setup is constructive; tranching reduces timing risk",
  wait_catalyst:       "wait for named catalyst — identified but not yet confirmed",
  wait_confirmation:   "wait for regime confirmation — signals unclear; patience preserves optionality",
  preserve:            "preserve capital — conditions adversarial; new deployment not warranted",
};

function buildDeploymentRationale(i: DecisionCoreInput, stance: CapitalDeploymentStance): string {
  if (stance === "preserve") {
    const reason = i.creditStress === "extreme" ? "extreme credit stress"
      : i.creditStress === "high" ? "elevated credit stress"
      : i.consensusStrength === "conflicted" ? "consensus conflict"
      : "adverse conditions";
    return `Preserve capital — ${reason} makes new deployment asymmetrically risky.`;
  }
  if (stance === "deploy_now") {
    return `Gradual deployment in tranches — risk/reward is favorable and regime is directional.`;
  }
  if (stance === "wait_catalyst") {
    return `Wait for a named catalyst — setup is forming but not yet confirmed for deployment.`;
  }
  return `Wait for regime confirmation — consensus is insufficient to justify committing capital now.`;
}

function buildPositionSizingNote(framework: PositionFramework, sizing: AllocationSizing): string {
  if (framework === "full_defense") return "No new sizing — maintain defensive holdings only; reduce high-beta exposure.";
  if (framework === "barbell") return "Size the defensive anchor at 60-70%; the high-conviction satellite at 15-20%.";
  if (framework === "selective_entry") return "Concentrated entry only on high-conviction dislocations; 3-5% per name maximum.";
  if (sizing === "overweight") return "Add to core positions incrementally; avoid momentum chasing; use tranche entries.";
  return "Maintain existing core; deploy satellite capital only on confirmed dislocation opportunities.";
}

function buildHorizonNote(horizon: HorizonDiscipline, isSaudi: boolean): string {
  if (horizon === "tactical_1m") return "1-month frame: monitor news-flow catalysts; do not project cycle conclusions.";
  if (horizon === "cyclical_3m") return "3-month frame: earnings + credit cycle are the primary anchors for the thesis.";
  if (horizon === "structural_24m") {
    return isSaudi
      ? "24-month frame: Vision 2030 transformation and oil-fiscal capacity are structural drivers."
      : "24-month frame: multi-cycle positioning; short-term vol is expected and should be absorbed.";
  }
  return isSaudi
    ? "12-month frame: oil-fiscal channel + SAMA policy path are the anchoring variables."
    : "12-month frame: macro regime and valuation anchor thesis; re-evaluate if regime rotates.";
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildInstitutionalDecisionFrame(input: DecisionCoreInput): InstitutionalDecisionFrame {
  const sizing     = deriveAllocationSizing(input);
  const framework  = derivePositionFramework(sizing, input.creditStress, input.macroBias, input.uncertaintyLevel);
  const horizon    = deriveHorizon(input.regime, input.creditStress, input.consensusStrength, input.isSaudi, input.question);
  const presScore  = derivePreservationScore(input.creditStress, input.macroBias, input.consensusStrength, input.uncertaintyLevel, input.regimeConf);
  const asymmetry  = deriveRiskReward(input.macroBias, input.creditStress, input.consensusStrength, input.regimeConf, presScore);
  const deployment = deriveDeploymentStance(sizing, asymmetry, input.consensusStrength, input.regimeConf);

  const deploymentRationale = buildDeploymentRationale(input, deployment);
  const positionSizingNote  = buildPositionSizingNote(framework, sizing);
  const horizonNote         = buildHorizonNote(horizon, input.isSaudi);

  const isAr = input.lang === "ar";

  const decisionFrameContext = isAr
    ? [
        `إطار القرار الاستثماري للجنة [${SIZING_LABELS[sizing]}]:`,
        `الموقف: ${DEPLOYMENT_LABELS[deployment]}`,
        `الإطار: ${FRAMEWORK_LABELS[framework]}`,
        `الأفق: ${HORIZON_LABELS[horizon]}`,
        `التماثل: ${asymmetry}`,
        `ملاحظة: الرد يجب أن يشمل منطق التخصيص وليس فقط تصنيف النظام السوقي.`,
      ].join(" | ").slice(0, 400)
    : [
        `Committee decision frame [${SIZING_LABELS[sizing]}]:`,
        `Deployment: ${DEPLOYMENT_LABELS[deployment]}`,
        `Framework: ${FRAMEWORK_LABELS[framework]}`,
        `Horizon: ${HORIZON_LABELS[horizon]}`,
        `Risk/reward: ${asymmetry}`,
        `Mandate: answer must include allocation logic and position sizing — not only regime classification.`,
      ].join(" | ").slice(0, 400);

  return {
    allocationSizing:        sizing,
    positionFramework:       framework,
    horizonDiscipline:       horizon,
    preservationScore:       presScore,
    riskRewardAsymmetry:     asymmetry,
    capitalDeploymentStance: deployment,
    deploymentRationale,
    positionSizingNote,
    horizonNote,
    decisionFrameContext,
  };
}
