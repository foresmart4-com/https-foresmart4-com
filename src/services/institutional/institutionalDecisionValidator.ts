// LCCR-5: Institutional Decision Validator
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Purpose: Score whether the final Genesis reply is institutional-decision-centric
// or regime-engine-centric. Detects and flags when the answer defaulted to macro
// summary without allocation reasoning — the root cause being repaired.
//
// Distinct from existing validators:
//   genesisQualityValidationHarness.ts (83B) — 8-dimension quality harness (general)
//   qualityHarness.ts                        — QualityTier evaluation
//   institutionalDepthEngine.ts              — 10-dimension depth directive
//
// This validator specifically measures INSTITUTIONAL DECISION QUALITY:
//   1. allocation_depth (0-20)    — concrete allocation guidance present
//   2. committee_reasoning (0-20) — multiple committee voices / debate surfaces
//   3. allocator_quality (0-20)   — clear allocator stance and rationale
//   4. debate_quality (0-15)      — genuine bull vs bear represented
//   5. historical_relevance (0-15)— history used with investment meaning
//   6. memo_quality (0-10)        — structured as institutional memo
//   7. regime_dominance (0-5)     — penalty: regime labels without allocation meaning
//
// Total: 0-100. PASS threshold: 70+. FAIL: <70 with improvement list.
// Regime dominance is subtracted if the answer only produces regime labels.

import type { GenesisReply } from "@/lib/genesis.functions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DecisionValidationDimension =
  | "allocation_depth"
  | "committee_reasoning"
  | "allocator_quality"
  | "debate_quality"
  | "historical_relevance"
  | "memo_quality"
  | "regime_dominance";

export interface DecisionDimensionResult {
  id:      DecisionValidationDimension;
  score:   number;    // 0-max for this dimension
  max:     number;    // maximum possible
  signals: string[];  // what was found (positive)
  gaps:    string[];  // what was missing (negative)
}

export interface InstitutionalDecisionValidation {
  totalScore:        number;       // 0-100
  passed:            boolean;      // totalScore >= 70
  grade:             "institutional" | "adequate" | "thin" | "regime_only";
  dimensions:        DecisionDimensionResult[];
  regimeDominance:   boolean;      // true if answer is primarily regime labeling
  improvements:      string[];     // specific things to improve
  validatorLog:      string;       // compact log string for console
}

// ─── Regex patterns ───────────────────────────────────────────────────────────

// Allocation-related signals
const ALLOC_SIGNALS = /\b(overweight|underweight|allocation|allocat|position\s*siz|sizing|deploy|capital\s*deploy|tilt|exposure|weight|defensive\s*anchor|satellite|core\s*holding|underweight|neutral\s*weight|add\s*to|reduce|tranche|scale.?in|wait\s*for\s*catalyst|preservation|preserve\s*capital|horizon|12.?month|24.?month|3.?month)\b/gi;

// Committee/debate signals
const COMMITTEE_SIGNALS = /\b(committee|bull\s*case|bear\s*case|bull\s*thesis|bear\s*thesis|objection|counter.?thesis|prevail|debate|disagree|vs\.|versus|both\s*case|minority\s*view|consensus\s*view|voice|macro\s*voice|allocator\s*voice|policy\s*voice)\b/gi;

// Allocator stance signals
const ALLOCATOR_SIGNALS = /\b(allocator|institutional\s*allocator|wait\s*for|scale\s*in|hold\s*and\s*monitor|avoid|reduce\s*exposure|deploy\s*now|wait\s*catalyst|deployment\s*stance|conviction\s*level|risk.?reward|asymmetr|preservation\s*vs\s*offense|barbell|core.?satellite|full\s*defense|selective\s*entry)\b/gi;

// Debate quality signals
const DEBATE_SIGNALS = /\b(bull\s*case|bear\s*case|strongest\s*objection|probability|%\s*bull|%\s*bear|bull.{0,5}\d+%|bear.{0,5}\d+%|evidence\s*weight|case\s*for|case\s*against|downside\s*scenario|upside\s*scenario|prevail|stalemate)\b/gi;

// Historical with investment meaning
const HIST_INVEST_SIGNALS = /\b(historical\s*episode|capital\s*cycle|analog|2009|2011|2015|2016|2018|2020|2022|prior\s*cycle|allocators?\s*did|early\s*movers?|late\s*movers?|trough\s*entry|what\s*differ|then\s*vs\s*now|historically\s*when|prior\s*instances?)\b/gi;

// Memo structure signals
const MEMO_SIGNALS = /\b(executive\s*summary|investment\s*thesis|bull\s*thesis|bear\s*thesis|conviction|thesis\s*changer|invalidation|committee\s*view|CIO|allocator\s*view|historical\s*analog|what\s*differs|portfolio\s*impact|final\s*stance)\b/gi;

// Regime-only signals (negative — label without allocation consequence)
const REGIME_ONLY_SIGNALS = /\b(bull_trending|bear_ranging|high_vol_risk-off|low_vol_accumulation|macro_transition|bullish\s*regime|bearish\s*regime|risk-on\s*regime|risk-off\s*regime)\b/gi;

// Regime with allocation meaning (positive — regime used with portfolio consequence)
const REGIME_WITH_ALLOC = /\b(regime\s*(supports|implies|means|favors|warrants|demands|drives|forces|signals|causes|leads\s*to)|(bull|bear|risk.on|risk.off)\s*(regime\s*)?(supports|implies|warrants|drives|forces)\s*(allocation|deployment|defensive|cyclical|overweight|underweight|exposure|reduction|capital))\b/gi;

// ─── Dimension scorers ────────────────────────────────────────────────────────

function scoreAllocationDepth(reply: GenesisReply): DecisionDimensionResult {
  const text = [
    reply.outlook ?? "",
    reply.thesis ?? "",
    reply.baseCase ?? "",
    reply.bullCase ?? "",
    reply.bearCase ?? "",
    (reply as Record<string, unknown>).selectionFramework as string ?? "",
    (reply as Record<string, unknown>).voiceReasoning?.allocator as string ?? "",
  ].join(" ");

  const matches = text.match(ALLOC_SIGNALS) ?? [];
  const unique  = new Set(matches.map(m => m.toLowerCase())).size;

  let score = Math.min(20, unique * 3);
  const signals: string[] = [];
  const gaps:    string[] = [];

  if (/position\s*siz|sizing/i.test(text)) { signals.push("position sizing present"); score = Math.min(20, score + 3); }
  if (/deploy|deployment|scale.?in/i.test(text)) { signals.push("deployment logic present"); score = Math.min(20, score + 2); }
  if (/preservation|defensive|protect/i.test(text)) { signals.push("preservation framing present"); score = Math.min(20, score + 2); }
  if (unique < 3) gaps.push("insufficient allocation language — add position sizing and deployment logic");
  if (!/horizon/i.test(text)) gaps.push("no horizon discipline stated");

  return { id: "allocation_depth", score: Math.round(score), max: 20, signals, gaps };
}

function scoreCommitteeReasoning(reply: GenesisReply): DecisionDimensionResult {
  const vr = (reply as Record<string, unknown>).voiceReasoning as Record<string, unknown> | undefined;
  const cs = (reply as Record<string, unknown>).committeeSynthesis as Record<string, unknown> | undefined;
  const text = [
    vr?.macro as string ?? "",
    vr?.policy as string ?? "",
    vr?.allocator as string ?? "",
    vr?.behavioral as string ?? "",
    vr?.historical as string ?? "",
    cs?.agreement as string ?? "",
    cs?.disagreement as string ?? "",
    cs?.finalStance as string ?? "",
    reply.outlook ?? "",
  ].join(" ");

  const voicesSet = vr ? Object.keys(vr).filter(k => (vr[k] as string)?.length > 10).length : 0;
  const signals: string[] = [];
  const gaps:    string[] = [];
  let score = 0;

  score += Math.min(12, voicesSet * 3);
  if (voicesSet >= 3) signals.push(`${voicesSet} committee voices present`);
  else gaps.push(`only ${voicesSet} voices — need at least 3 committee voices`);

  if (cs?.disagreement) { signals.push("disagreement captured"); score += 4; }
  else gaps.push("no committee disagreement stated");

  if (cs?.finalStance) { signals.push("final stance resolved"); score += 4; }
  else gaps.push("no final committee stance");

  const matches = text.match(COMMITTEE_SIGNALS) ?? [];
  if (matches.length >= 3) { signals.push("committee debate language present"); score = Math.min(20, score + 2); }

  return { id: "committee_reasoning", score: Math.min(20, Math.round(score)), max: 20, signals, gaps };
}

function scoreAllocatorQuality(reply: GenesisReply): DecisionDimensionResult {
  const text = [
    reply.outlook ?? "",
    reply.thesis ?? "",
    reply.baseCase ?? "",
    (reply as Record<string, unknown>).voiceReasoning?.allocator as string ?? "",
    (reply as Record<string, unknown>).selectionFramework as string ?? "",
  ].join(" ");

  const matches = text.match(ALLOCATOR_SIGNALS) ?? [];
  const unique  = new Set(matches.map(m => m.toLowerCase())).size;
  const signals: string[] = [];
  const gaps:    string[] = [];
  let score = Math.min(15, unique * 4);

  if (/scale.?in|deploy.?now|wait.?catalyst|wait.?confirmation|preserve/i.test(text)) {
    signals.push("explicit deployment stance stated"); score = Math.min(20, score + 5);
  } else {
    gaps.push("no explicit deployment stance (scale-in/wait/preserve)");
  }

  if (/risk.?reward|asymmetr/i.test(text)) { signals.push("risk/reward framing present"); score = Math.min(20, score + 2); }
  else gaps.push("no risk/reward asymmetry stated");

  if (/conviction|conviction\s*level/i.test(text)) { signals.push("conviction level mentioned"); score = Math.min(20, score + 2); }

  return { id: "allocator_quality", score: Math.min(20, Math.round(score)), max: 20, signals, gaps };
}

function scoreDebateQuality(reply: GenesisReply): DecisionDimensionResult {
  const text = [
    reply.bullCase ?? "",
    reply.bearCase ?? "",
    reply.opposingCase ?? "",
    (reply as Record<string, unknown>).committeeBullCase as string ?? "",
    (reply as Record<string, unknown>).committeeBearCase as string ?? "",
    (reply as Record<string, unknown>).evidenceConflict as string ?? "",
  ].join(" ");

  const matches = text.match(DEBATE_SIGNALS) ?? [];
  const signals: string[] = [];
  const gaps:    string[] = [];
  let score = 0;

  const hasBull = (reply.bullCase?.length ?? 0) > 20 || ((reply as Record<string, unknown>).committeeBullCase as string ?? "").length > 20;
  const hasBear = (reply.bearCase?.length ?? 0) > 20 || ((reply as Record<string, unknown>).committeeBearCase as string ?? "").length > 20;

  if (hasBull) { signals.push("bull case present"); score += 5; }
  else gaps.push("no bull case");

  if (hasBear) { signals.push("bear case present"); score += 5; }
  else gaps.push("no bear case");

  if (hasBull && hasBear) { signals.push("both cases represented"); score += 3; }
  if (matches.length >= 2) { signals.push("debate language present"); score += 2; }

  if (score === 0) gaps.push("answer lacks structured debate — single thesis dominance");

  return { id: "debate_quality", score: Math.min(15, Math.round(score)), max: 15, signals, gaps };
}

function scoreHistoricalRelevance(reply: GenesisReply): DecisionDimensionResult {
  const text = [
    reply.outlook ?? "",
    reply.caveats?.join(" ") ?? "",
    (reply as Record<string, unknown>).voiceReasoning?.historical as string ?? "",
    (reply as Record<string, unknown>).perspectiveMap as string ?? "",
    reply.confidenceCalibration ?? "",
  ].join(" ");

  const matches = text.match(HIST_INVEST_SIGNALS) ?? [];
  const signals: string[] = [];
  const gaps:    string[] = [];
  let score = Math.min(10, matches.length * 2);

  if (/what\s*differ|then\s*vs\s*now|today\s*differ|unlike\s*\d{4}/i.test(text)) {
    signals.push("structural differentiation present (what differs now)"); score = Math.min(15, score + 5);
  } else {
    gaps.push("no structural differentiation — history without 'what differs now' is shallow");
  }

  if (/allocation|allocators?\s*did|deploy|capital\s*cycle/i.test(text)) {
    signals.push("history linked to allocation meaning"); score = Math.min(15, score + 3);
  } else {
    gaps.push("history not linked to allocation decision — cite what allocators did, not just what happened");
  }

  return { id: "historical_relevance", score: Math.min(15, Math.round(score)), max: 15, signals, gaps };
}

function scoreMemoQuality(reply: GenesisReply): DecisionDimensionResult {
  const text = [
    (reply as Record<string, unknown>).institutionalMemo as string ?? "",
    reply.thesis ?? "",
    reply.baseCase ?? "",
    reply.thesisChanger ?? "",
    (reply as Record<string, unknown>).committeeSynthesis?.finalStance as string ?? "",
  ].join(" ");

  const matches = text.match(MEMO_SIGNALS) ?? [];
  const signals: string[] = [];
  const gaps:    string[] = [];
  let score = Math.min(8, matches.length * 2);

  if (reply.thesis && reply.baseCase && reply.thesisChanger) {
    signals.push("memo triad present (thesis + base case + thesis changer)"); score = Math.min(10, score + 4);
  } else {
    if (!reply.thesis) gaps.push("no thesis");
    if (!reply.baseCase) gaps.push("no base case");
    if (!reply.thesisChanger) gaps.push("no thesis changer / invalidation");
  }

  return { id: "memo_quality", score: Math.min(10, Math.round(score)), max: 10, signals, gaps };
}

function scoreRegimeDominance(reply: GenesisReply): DecisionDimensionResult {
  // Regime dominance = regime labels appear but without portfolio consequence
  const text = [reply.outlook ?? "", reply.headline ?? "", reply.thesis ?? ""].join(" ");
  const regimeOnlyMatches  = text.match(REGIME_ONLY_SIGNALS) ?? [];
  const regimeAllocMatches = text.match(REGIME_WITH_ALLOC) ?? [];

  const regimeOnlyCount  = regimeOnlyMatches.length;
  const regimeAllocCount = regimeAllocMatches.length;

  // Score 5 = no dominance problem; lower = more regime-only language without allocation
  let score = 5;
  const signals: string[] = [];
  const gaps:    string[] = [];

  if (regimeOnlyCount > 4 && regimeAllocCount < 2) {
    score = 0;
    gaps.push(`regime-only language dominates (${regimeOnlyCount} labels, ${regimeAllocCount} with allocation meaning)`);
  } else if (regimeOnlyCount > 2 && regimeAllocCount < regimeOnlyCount) {
    score = 2;
    gaps.push("regime labels exceed allocation-linked statements — add portfolio consequence to regime labels");
  } else if (regimeAllocCount >= 2) {
    signals.push("regime labels tied to allocation meaning");
  }

  const isDominant = score <= 1;
  return { id: "regime_dominance", score: Math.round(score), max: 5, signals, gaps, isDominant } as DecisionDimensionResult & { isDominant: boolean };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function validateInstitutionalDecision(reply: GenesisReply): InstitutionalDecisionValidation {
  const dimAlloc    = scoreAllocationDepth(reply);
  const dimCommittee = scoreCommitteeReasoning(reply);
  const dimAllocQ   = scoreAllocatorQuality(reply);
  const dimDebate   = scoreDebateQuality(reply);
  const dimHist     = scoreHistoricalRelevance(reply);
  const dimMemo     = scoreMemoQuality(reply);
  const dimRegime   = scoreRegimeDominance(reply);

  const dimensions = [dimAlloc, dimCommittee, dimAllocQ, dimDebate, dimHist, dimMemo, dimRegime];

  // Regime dominance is subtracted
  const regimePenalty = 5 - dimRegime.score;  // 0-5 penalty
  const rawTotal = dimAlloc.score + dimCommittee.score + dimAllocQ.score + dimDebate.score + dimHist.score + dimMemo.score;
  const totalScore = Math.max(0, Math.min(100, rawTotal - regimePenalty));

  const passed = totalScore >= 70;
  const regimeDominant = (dimRegime as DecisionDimensionResult & { isDominant?: boolean }).isDominant ?? false;

  const grade: InstitutionalDecisionValidation["grade"] = regimeDominant
    ? "regime_only"
    : totalScore >= 85 ? "institutional"
    : totalScore >= 70 ? "adequate"
    : "thin";

  const improvements = dimensions.flatMap(d => d.gaps);

  const validatorLog = `institutional_decision_validator score=${totalScore} grade=${grade} passed=${passed} alloc=${dimAlloc.score}/20 committee=${dimCommittee.score}/20 allocQ=${dimAllocQ.score}/20 debate=${dimDebate.score}/15 hist=${dimHist.score}/15 memo=${dimMemo.score}/10 regime_penalty=${regimePenalty} improvements=[${improvements.slice(0, 3).join("|")}]`;

  return {
    totalScore,
    passed,
    grade,
    dimensions,
    regimeDominance: regimeDominant,
    improvements,
    validatorLog,
  };
}
