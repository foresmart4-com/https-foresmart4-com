// Phase-88A: Committee Dynamics Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// DISTINCT FROM existing committee modules:
//   committeeDebate.ts (Phase-65):  produces CommitteeStance label (e.g. selective_over_broad)
//   committeeEngine.ts (Phase-82A): generates AI committee voice directives
//   allocatorDecisionEngine.ts (83B): scored stance + conviction %
//
// This module models the DYNAMICS inside an institutional committee:
//   - HOW disagreement forms between different allocator personalities
//   - WHERE the preservation vs growth tension lies
//   - WHICH voice dominates and what minority view exists
//   - HOW strong the internal risk tension is
//
// Outputs a CommitteeDynamics object that gives Genesis structured committee
// reasoning: the dominant voice, the dissenting argument, and the unresolved tension.
//
// Educational/advisory only. No autonomous execution. No broker data.

import type { AllocatorDecision } from "@/services/institutional/allocatorDecisionEngine";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type GrowthPreservationTension =
  | "growth_dominant"       // committee consensus leans toward return capture
  | "preservation_dominant" // committee consensus leans toward capital protection
  | "balanced_tension"      // genuine split — no dominant view
  | "regime_uncertain";     // macro regime too unclear to resolve the tension

export type CommitteeDominantVoice =
  | "macro_economist"       // macro regime and transmission chain dominates
  | "conservative_allocator"// capital preservation and downside protection
  | "growth_manager"        // return capture and earnings growth
  | "risk_manager";         // risk-adjusted return and position sizing

export interface CommitteeDynamics {
  growthVsPreservation:  GrowthPreservationTension;
  riskTension:           number;        // 0-100: intensity of internal risk disagreement
  convictionConflict:    boolean;       // opposing conviction between committee members
  dominantVoice:         CommitteeDominantVoice;
  minorityArgument:      string;        // ≤100 chars: what the dissenting voice argues
  resolutionPath:        string;        // ≤100 chars: how the committee resolves tension
  committeeContext:       string;        // injectable ≤250 chars
}

// ─── Input types ──────────────────────────────────────────────────────────────

interface CommitteeDynamicsInput {
  regime:            string;
  macroBias:         "bullish" | "bearish" | "neutral";
  creditStress:      "low" | "moderate" | "high" | "extreme";
  consensusStrength: "strong" | "moderate" | "weak" | "conflicted";
  consensusScore:    number;       // 0-100
  uncertaintyLevel:  "low" | "moderate" | "high" | "extreme";
  allocatorDecision: AllocatorDecision | null;
  isSaudi:           boolean;
  oilFiscalSupport:  boolean | null;
}

// ─── Growth vs preservation tension ─────────────────────────────────────────

function deriveTension(input: CommitteeDynamicsInput): GrowthPreservationTension {
  const { macroBias, creditStress, uncertaintyLevel, consensusStrength, regime } = input;

  if (regime.toLowerCase().includes("uncertain") || uncertaintyLevel === "extreme") {
    return "regime_uncertain";
  }

  // Clear preservation conditions
  if (
    creditStress === "high" || creditStress === "extreme" ||
    uncertaintyLevel === "high" || macroBias === "bearish"
  ) {
    return "preservation_dominant";
  }

  // Clear growth conditions
  if (
    macroBias === "bullish" && creditStress === "low" &&
    (uncertaintyLevel === "low" || uncertaintyLevel === "moderate") &&
    (consensusStrength === "strong" || consensusStrength === "moderate")
  ) {
    return "growth_dominant";
  }

  return "balanced_tension";
}

// ─── Risk tension score ────────────────────────────────────────────────────────

function computeRiskTension(input: CommitteeDynamicsInput): number {
  let score = 0;
  if (input.creditStress === "moderate") score += 20;
  if (input.creditStress === "high")     score += 45;
  if (input.creditStress === "extreme")  score += 70;
  if (input.uncertaintyLevel === "moderate") score += 15;
  if (input.uncertaintyLevel === "high")     score += 35;
  if (input.uncertaintyLevel === "extreme")  score += 55;
  if (input.consensusStrength === "conflicted") score += 25;
  if (input.consensusStrength === "weak")       score += 15;
  if (input.macroBias === "neutral") score += 10;
  return Math.min(100, score);
}

// ─── Dominant voice logic ─────────────────────────────────────────────────────

const DOMINANT_VOICE_RULES: Array<{
  condition: (i: CommitteeDynamicsInput) => boolean;
  voice: CommitteeDominantVoice;
}> = [
  { voice: "conservative_allocator",
    condition: i => i.creditStress === "high" || i.creditStress === "extreme" || i.uncertaintyLevel === "extreme" },
  { voice: "risk_manager",
    condition: i => i.consensusStrength === "conflicted" || i.uncertaintyLevel === "high" },
  { voice: "macro_economist",
    condition: i => i.regime.toLowerCase().includes("transition") || i.consensusStrength === "weak" },
  { voice: "growth_manager",
    condition: i => i.macroBias === "bullish" && i.creditStress === "low" && i.uncertaintyLevel === "low" },
];

function deriveDominantVoice(input: CommitteeDynamicsInput): CommitteeDominantVoice {
  for (const rule of DOMINANT_VOICE_RULES) {
    if (rule.condition(input)) return rule.voice;
  }
  return "macro_economist";
}

// ─── Minority argument + resolution ──────────────────────────────────────────

const MINORITY_ARGUMENTS: Record<CommitteeDominantVoice, Record<GrowthPreservationTension, string>> = {
  macro_economist: {
    growth_dominant:       "Risk manager: earnings may disappoint if regime deteriorates; size down.",
    preservation_dominant: "Growth manager: regime pessimism may be overstated; don't underallocate.",
    balanced_tension:      "Conservative: macro signals conflict — defer deployment until clarity.",
    regime_uncertain:      "Growth manager: uncertainty creates entry opportunity for long-term allocators.",
  },
  conservative_allocator: {
    growth_dominant:       "Growth manager: credit conditions are constructive; underallocation is costly.",
    preservation_dominant: "Macro economist: preservation consensus may become crowded; revisit upside.",
    balanced_tension:      "Risk manager: mixed signals justify preservation but opportunity cost rises.",
    regime_uncertain:      "Growth manager: uncertainty premium creates attractive risk-reward over time.",
  },
  growth_manager: {
    growth_dominant:       "Risk manager: concentration in growth may amplify drawdown in regime shift.",
    preservation_dominant: "Growth manager (minority): current pessimism overshoots — historical returns favor patience.",
    balanced_tension:      "Conservative: growth conviction not yet supported by earnings trajectory.",
    regime_uncertain:      "Conservative: deploy only into quality names with proven cash flow.",
  },
  risk_manager: {
    growth_dominant:       "Risk manager (majority): agree on constructive bias but size positions for asymmetric risk.",
    preservation_dominant: "Conservative: risk metrics support preservation; growth manager overstates upside.",
    balanced_tension:      "Growth manager: risk tension creates trading opportunity for disciplined buyers.",
    regime_uncertain:      "Conservative: regime uncertainty demands risk parity across scenarios.",
  },
};

const RESOLUTION_PATHS: Record<GrowthPreservationTension, string> = {
  growth_dominant:       "Deploy with selective quality; monitor macro triggers quarterly.",
  preservation_dominant: "Build cash reserve; stage deployment on confirmed improvement.",
  balanced_tension:      "Split mandate: 60% growth thesis, 40% defensive; review in 6 weeks.",
  regime_uncertain:      "Hold current allocation; no new conviction until regime signal clarifies.",
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildCommitteeDynamics(
  input: CommitteeDynamicsInput,
): CommitteeDynamics {
  const tension      = deriveTension(input);
  const riskTension  = computeRiskTension(input);
  const dominantVoice = deriveDominantVoice(input);
  const convictionConflict = riskTension >= 40 || input.consensusStrength === "conflicted";
  const minorityArgument = (MINORITY_ARGUMENTS[dominantVoice]?.[tension] ?? "Minority view: re-examine regime assumptions before final conviction.").slice(0, 100);
  const resolutionPath = (RESOLUTION_PATHS[tension] ?? "Maintain current stance; schedule next review.").slice(0, 100);

  const saudiNote = input.isSaudi && input.oilFiscalSupport !== null
    ? ` Saudi oil-fiscal ${input.oilFiscalSupport ? "support intact" : "under pressure"} modifies the tension.`
    : "";

  const committeeContext = [
    `Committee dynamics [${dominantVoice.replace(/_/g, " ")} dominant]:`,
    `Tension: ${tension.replace(/_/g, " ")}.`,
    `Risk tension: ${riskTension}/100.`,
    convictionConflict ? `Conviction conflict: ${minorityArgument}` : `Committee aligned: ${resolutionPath}`,
    saudiNote,
  ].filter(Boolean).join(" ").slice(0, 250);

  return {
    growthVsPreservation: tension,
    riskTension,
    convictionConflict,
    dominantVoice,
    minorityArgument,
    resolutionPath,
    committeeContext,
  };
}

export function buildCommitteeDynamicsFromTracks(
  regime: string,
  macroBias: "bullish" | "bearish" | "neutral",
  creditStress: "low" | "moderate" | "high" | "extreme",
  consensusStrength: "strong" | "moderate" | "weak" | "conflicted",
  consensusScore: number,
  uncertaintyLevel: "low" | "moderate" | "high" | "extreme",
  allocatorDecision: AllocatorDecision | null,
  isSaudi: boolean,
  oilPrice?: number | null,
): CommitteeDynamics {
  const oilFiscalSupport = oilPrice !== null && oilPrice !== undefined
    ? oilPrice >= 78 : null;
  return buildCommitteeDynamics({
    regime, macroBias, creditStress, consensusStrength, consensusScore,
    uncertaintyLevel, allocatorDecision, isSaudi, oilFiscalSupport,
  });
}
