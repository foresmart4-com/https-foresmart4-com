// CIO Narrator Engine
// Forces CIO voice into voiceReasoning.allocator with institutional vocabulary.
// Prevents generic market commentary in the allocator voice.
//
// Key problem: CIO framing is computed (horizon, preservation, deployment caution)
// but the AI's allocator voice uses generic language ("allocate cautiously")
// instead of institutional CIO framing ("medium_term horizon | preservation_first |
// hold stance — deploy selectively on credit stabilisation signal").
//
// Fix: generates a specific allocator voice opening directive based on the
// CioAdvisoryFrame, forcing use of institutional capital allocation vocabulary.
//
// No AI calls. No network. Pure deterministic. O(1).

import type { CioAdvisoryFrame } from "@/services/advisory/cioAdvisoryEngine";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CioNarratorResult {
  allocatorVoiceDirective: string;  // ≤140 chars: how allocator voice MUST open
  convictionNote:          string;  // ≤80 chars: conviction ceiling note
  narratorFragment:        string;  // ≤100 chars: snippet for master directive
  postureLabel:            string;  // e.g. "preservation_first|hold"
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function trim(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 3) + "...";
}

// Human-readable labels for the CIO vocabulary
const HORIZON_LABEL: Record<string, string> = {
  near_term:   "near-term horizon",
  medium_term: "medium-term horizon",
  long_term:   "long-term horizon",
};

const PRESERVATION_LABEL: Record<string, string> = {
  growth_oriented:    "growth-oriented posture",
  balanced:           "balanced posture",
  preservation_first: "preservation-first posture",
  capital_protection: "capital-protection posture",
};

const CAUTION_LABEL: Record<string, string> = {
  selective_deploy: "selective deployment",
  hold:             "hold — defer discretionary capital",
  reduce:           "reduce risk exposure",
  defensive:        "defensive — capital preservation over deployment",
  opportunistic:    "opportunistic with asymmetric sizing",
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildCioNarration(input: {
  cioFrame: CioAdvisoryFrame;
}): CioNarratorResult {
  const { cioFrame } = input;
  const { strategicHorizon, capitalPreservation, deploymentCaution, strategicBias, opportunityFraming } = cioFrame;

  const horizonStr      = HORIZON_LABEL[strategicHorizon]     ?? strategicHorizon;
  const preservationStr = PRESERVATION_LABEL[capitalPreservation] ?? capitalPreservation;
  const cautionStr      = CAUTION_LABEL[deploymentCaution]    ?? deploymentCaution;

  // The specific allocator voice opening directive
  const allocatorVoiceDirective = trim(
    `Allocator MUST open: CIO[${strategicHorizon}|${capitalPreservation}|${deploymentCaution}] — ${horizonStr}; ${preservationStr}; ${cautionStr}. Explain WHY regime demands this posture.`,
    140,
  );

  // Conviction ceiling note
  const convictionNote = trim(
    `Strategic bias: ${strategicBias} | Opportunity: ${opportunityFraming}`,
    80,
  );

  // Narrator fragment for master directive
  const narratorFragment = trim(
    `[CIO] voiceReasoning.allocator: MUST open "[${strategicHorizon}|${capitalPreservation}|${deploymentCaution}]" + explain deployment logic`,
    100,
  );

  const postureLabel = `${capitalPreservation}|${deploymentCaution}`;

  return {
    allocatorVoiceDirective,
    convictionNote,
    narratorFragment,
    postureLabel,
  };
}
