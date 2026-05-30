// Live Narrative Quality Validator
// Audits the final Genesis reply for evidence of institutional intelligence surfacing.
//
// Measures whether the narrator directive was obeyed — i.e., whether the AI
// actually surfaced CIO framing, historical analog, thesis competition, and
// desk-level differentiation in the final response fields.
//
// Scoring dimensions (0-100 total):
//   cioVisibility     (0-20): allocator voice uses CIO vocabulary
//   historyUsage      (0-20): perspectiveMap HISTORICAL or caveats names specific era
//   thesisVisibility  (0-20): opposingCase or committeeBearCase names counter thesis
//   institutionalDepth(0-20): macroChain + secondOrderRisks + sectorLens populated with specifics
//   foresightVisible  (0-10): scenarios use conditional triggers, not generic labels
//   surfacePenalty    (0-10 deducted): generic phrases detected
//
// Generic failure flag: overallScore < 50
//
// No AI calls. No network. Pure deterministic. O(1).

import type { InstitutionalNarratorResult } from "./institutionalNarratorGovernor";

// ─── Minimal reply shape ──────────────────────────────────────────────────────
// Avoid importing GenesisReply directly (circular risk); extract only needed fields.

export interface ValidatableReply {
  voiceReasoning?: {
    allocator?: string;
    macro?:     string;
    historical?: string;
    policy?:    string;
    behavioral?: string;
  };
  committeeSynthesis?: {
    finalStance?:  string;
    agreement?:    string;
    disagreement?: string;
    dominantVoice?: string;
  };
  perspectiveMap?:     string;
  opposingCase?:       string;
  committeeBearCase?:  string;
  committeeBullCase?:  string;
  thesis?:             string;
  macroChain?:         string;
  outlook?:            string;
  secondOrderRisks?:   string;
  caveats?:            string[];
  evidence?:           string[];
  sectorLens?:         string;
  activatedKnowledge?: string;
  scenarios?:          Array<{ label: string; probability: string; impact: string }>;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NarrativeQualityResult {
  overallScore:       number;  // 0-100
  cioVisibility:      number;  // 0-20
  historyUsage:       number;  // 0-20
  thesisVisibility:   number;  // 0-20
  institutionalDepth: number;  // 0-20
  foresightVisible:   number;  // 0-10
  surfacePenalty:     number;  // 0-10 deducted
  genericFailureFlag: boolean;
  improvements:       string[];
  validatorLog:       string;
}

// ─── Generic language patterns ────────────────────────────────────────────────

const GENERIC_PATTERNS = [
  /\bsignificant(ly)?\s+uncertain(ty)?\b/i,
  /\binvestors?\s+should\s+watch\b/i,
  /\bmomentum\s+suggests?\s+(upside|downside|growth|improvement)\b/i,
  /\bimportant\s+to\s+note\b/i,
  /\bexciting\s+opportunity\b/i,
  /\bgenerally\s+(bullish|bearish|positive|negative)\b/i,
  /\bcould\s+potentially\s+(rise|fall|improve|deteriorate)\b/i,
  /\bit\s+is\s+worth\s+(noting|mentioning)\b/i,
  /\bmarket(s|)\s+(go|went|will\s+go)\s+up\s+and\s+down\b/i,
  /\bno\s+one\s+can\s+(predict|know|say)\b/i,
];

// CIO vocabulary that should appear in allocator voice
const CIO_VOCABULARY = [
  /\bhorizon\b/i,
  /\bpreservation\b/i,
  /\bdeployment\b/i,
  /\bcapital\s+(protection|preservation|allocation)\b/i,
  /\bposture\b/i,
  /\bselective\s+deploy\b/i,
  /\bdefer\s+(discretionary|new\s+capital)\b/i,
  /\bconviction\s+(ceiling|floor|level)\b/i,
];

// Historical era vocabulary
const HISTORICAL_ERAS = [
  /\b1970s?\b/i, /\bstagflation\b/i,
  /\b1994\b/i, /\btightening\b/i,
  /\b1998\b/i, /\bltcm\b/i,
  /\b2000\b/i, /\bdotcom\b/i,
  /\b2008\b/i, /\bgfc\b/i, /\bfinancial\s+crisis\b/i,
  /\b2013\b/i, /\btaper\s+tantrum\b/i,
  /\b2020\b/i, /\bcovid\b/i,
  /\b2022\b/i, /\bvolcker\b/i,
  /\b2014\b/i, /\boil\s+collapse\b/i,
  /\banalog\b/i, /\bprecedent\b/i, /\bhistorical\s+(episode|cycle|period)\b/i,
];

// Thesis competition vocabulary
const THESIS_COMPETITION_VOCAB = [
  /\bcounter\s+thesis\b/i,
  /\bcompeting\s+thesis\b/i,
  /\bbear\s+thesis\b/i,
  /\bbull\s+thesis\b/i,
  /\bevidence\s+weight\b/i,
  /\bbase\s+thesis\b/i,
  /\ww\s*=\s*\d+\b/i,  // weight notation "w=42"
  /\blopsided\b/i,
  /\bheavily.contested\b/i,
  /\bcounterarg\b/i,
];

// Conditional scenario triggers
const CONDITIONAL_TRIGGER_RE = /\bif\s+[A-Z]/i;

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreCioVisibility(reply: ValidatableReply): number {
  const allocatorText = [
    reply.voiceReasoning?.allocator ?? "",
    reply.committeeSynthesis?.finalStance ?? "",
  ].join(" ");

  if (!allocatorText.trim()) return 0;
  const hits = CIO_VOCABULARY.filter(re => re.test(allocatorText)).length;
  if (hits >= 4) return 20;
  if (hits >= 2) return 14;
  if (hits >= 1) return 7;
  return 0;
}

function scoreHistoryUsage(reply: ValidatableReply): number {
  const histText = [
    reply.perspectiveMap ?? "",
    reply.voiceReasoning?.historical ?? "",
    (reply.caveats ?? []).join(" "),
    reply.outlook ?? "",
    reply.macroChain ?? "",
  ].join(" ");

  if (!histText.trim()) return 0;
  const hits = HISTORICAL_ERAS.filter(re => re.test(histText)).length;
  if (hits >= 3) return 20;
  if (hits >= 2) return 14;
  if (hits >= 1) return 8;
  return 0;
}

function scoreThesisVisibility(reply: ValidatableReply): number {
  const thesisText = [
    reply.opposingCase ?? "",
    reply.committeeBearCase ?? "",
    reply.committeeBullCase ?? "",
    reply.committeeSynthesis?.disagreement ?? "",
  ].join(" ");

  if (!thesisText.trim()) return 0;
  const hits = THESIS_COMPETITION_VOCAB.filter(re => re.test(thesisText)).length;
  if (hits >= 3) return 20;
  if (hits >= 1) return 12;
  // Even if no thesis vocab, if opposingCase is specific (>30 chars), partial credit
  if (reply.opposingCase && reply.opposingCase.length > 30) return 7;
  return 0;
}

function scoreInstitutionalDepth(reply: ValidatableReply): number {
  let score = 0;
  // macroChain with arrows
  if (reply.macroChain && /→/.test(reply.macroChain) && reply.macroChain.length > 40) score += 7;
  // secondOrderRisks with arrows or chain notation
  if (reply.secondOrderRisks && reply.secondOrderRisks.length > 40) score += 6;
  // sectorLens with sector names
  if (reply.sectorLens && reply.sectorLens.length > 40) score += 4;
  // evidence array with specific items
  if (reply.evidence && reply.evidence.length >= 2 && reply.evidence.every(e => e.length > 20)) score += 3;
  return Math.min(20, score);
}

function scoreForesightVisible(reply: ValidatableReply): number {
  if (!reply.scenarios || reply.scenarios.length === 0) return 0;
  // At least one scenario uses conditional trigger
  const hasConditional = reply.scenarios.some(s => CONDITIONAL_TRIGGER_RE.test(s.label));
  return hasConditional ? 10 : 4;
}

function scoreSurfacePenalty(reply: ValidatableReply): number {
  const allText = [
    reply.outlook ?? "",
    reply.thesis ?? "",
    reply.macroChain ?? "",
    reply.voiceReasoning?.macro ?? "",
    reply.voiceReasoning?.allocator ?? "",
    (reply.evidence ?? []).join(" "),
  ].join(" ");

  const hits = GENERIC_PATTERNS.filter(re => re.test(allText)).length;
  if (hits >= 4) return 10;
  if (hits >= 2) return 6;
  if (hits >= 1) return 3;
  return 0;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function validateNarrativeQuality(
  reply: ValidatableReply,
  narrator: InstitutionalNarratorResult,
): NarrativeQualityResult {
  const cioVisibility      = scoreCioVisibility(reply);
  const historyUsage       = scoreHistoryUsage(reply);
  const thesisVisibility   = scoreThesisVisibility(reply);
  const institutionalDepth = scoreInstitutionalDepth(reply);
  const foresightVisible   = scoreForesightVisible(reply);
  const surfacePenalty     = scoreSurfacePenalty(reply);

  const raw = cioVisibility + historyUsage + thesisVisibility + institutionalDepth + foresightVisible;
  const overallScore = Math.max(0, Math.min(100, raw - surfacePenalty));

  const genericFailureFlag = overallScore < 50;

  // Build improvement suggestions
  const improvements: string[] = [];
  if (cioVisibility < 10 && narrator.layerCoverage.includes("cio")) {
    improvements.push("voiceReasoning.allocator lacks CIO vocabulary (horizon/preservation/deployment posture)");
  }
  if (historyUsage < 8 && narrator.layerCoverage.includes("history")) {
    improvements.push("perspectiveMap HISTORICAL missing: no specific era or analog referenced");
  }
  if (thesisVisibility < 10 && narrator.layerCoverage.includes("thesis")) {
    improvements.push("opposingCase/committeeBearCase missing: counter thesis not named with evidence weight");
  }
  if (institutionalDepth < 12) {
    improvements.push("macroChain or secondOrderRisks lacks causal arrows or specific transmission chain");
  }
  if (surfacePenalty >= 6) {
    improvements.push("Generic surface language detected — replace with specific conditional claims");
  }

  const validatorLog = [
    `narrator score=${overallScore}`,
    `cio=${cioVisibility}/20`,
    `history=${historyUsage}/20`,
    `thesis=${thesisVisibility}/20`,
    `depth=${institutionalDepth}/20`,
    `foresight=${foresightVisible}/10`,
    `penalty=${surfacePenalty}`,
    `layers=[${narrator.layerCoverage.join(",")||"none"}]`,
    `flag=${genericFailureFlag}`,
  ].join(" ");

  return {
    overallScore,
    cioVisibility,
    historyUsage,
    thesisVisibility,
    institutionalDepth,
    foresightVisible,
    surfacePenalty,
    genericFailureFlag,
    improvements,
    validatorLog,
  };
}
