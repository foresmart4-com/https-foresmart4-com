// Phase-86B: Policy Expectation Model
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Extends policyIntelligenceEngine.ts (Phase-86A) with a richer model of
// the GAP between what markets expected and what was detected.
//
// Phase-86A surprise score: binary — "expected hawkish + got dovish = 60/100"
// Phase-86B delta model: classifies the TYPE of surprise and its implications
//
// Delta types:
//   direction_surprise:   CB moving opposite to expected direction (cuts when hike expected)
//   timing_surprise:      CB moving sooner or later than expected timeline
//   magnitude_surprise:   CB moved the expected direction but faster/slower
//   communication_surprise: Language shift without rate action ("open mouth operations")
//   confirmed:            Market expectation exactly matched detected policy
//   no_surprise:          Market had no strong expectation; any outcome expected
//
// SAMA exception: SAMA always follows Fed mechanically — no independent surprise.
//   SAMA delta type is always "confirmed" with delta=0.
//
// Market expectation inference: extracted from question/context language patterns
//   ("pricing 3 cuts", "expecting hike", "fully priced", "markets expect",
//    "consensus is", "futures pricing", "expected to hold")
//
// No polling. No external fetches. Text-only inference.
// Educational/advisory only.

import type { PolicyIntelligenceResult, PolicyRegime, CBLanguageTier } from "./policyIntelligenceEngine";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DeltaType =
  | "direction_surprise"
  | "timing_surprise"
  | "magnitude_surprise"
  | "communication_surprise"
  | "confirmed"
  | "no_surprise";

export interface PolicyExpectationDelta {
  expectedRegime:  PolicyRegime | "unknown";
  expectedTier:    CBLanguageTier | "unknown";
  detectedRegime:  PolicyRegime;
  detectedTier:    CBLanguageTier;
  deltaType:       DeltaType;
  deltaScore:      number;  // 0-100: magnitude of the gap
  deltaSummary:    string;  // ≤160 chars
  isSamaContext:   boolean;
  expectationCtx:  string;  // injectable ≤200 chars
}

// ─── Market expectation inference ────────────────────────────────────────────

interface ExpectationSignal {
  expectedRegime: PolicyRegime | "unknown";
  expectedTier:   CBLanguageTier | "unknown";
  confidence:     number;  // 0-1: how strongly this expectation is held
}

const EXPECTATION_RULES: Array<{
  pattern: RegExp;
  regime: PolicyRegime | "unknown";
  tier:   CBLanguageTier | "unknown";
  confidence: number;
}> = [
  // Strong hawkish expectation
  { pattern: /\b(expecting hike|priced for hike|hike (fully )?priced|market(s)? expect (a )?hike|consensus (is )?hike|futures pricing hike)\b/i,
    regime: "tightening_cycle", tier: "hawkish_explicit", confidence: 0.9 },
  // Moderate hawkish (uncertainty about hike)
  { pattern: /\b(possible hike|hike (risk|scenario)|considering hike|might hike|could hike)\b/i,
    regime: "tightening_cycle", tier: "hawkish_lean", confidence: 0.6 },
  // Strong dovish expectation — multiple pattern forms for natural language
  { pattern: /\bpricing \d+ (rate )?cuts?\b/i,
    regime: "easing_cycle", tier: "dovish_explicit", confidence: 0.9 },
  { pattern: /\b(market(s)? (had )?priced|had priced|already priced).{0,20}cuts?\b/i,
    regime: "easing_cycle", tier: "dovish_explicit", confidence: 0.85 },
  { pattern: /\b(priced \d+bps|\d+bps of cuts|expecting cut|cut (fully )?priced|market(s)? expect (a )?cut|futures pricing cut|(\d+ (rate )?)?cuts? priced|consensus (is )?cut)\b/i,
    regime: "easing_cycle", tier: "dovish_explicit", confidence: 0.9 },
  // Moderate dovish (pivot expected)
  { pattern: /\b(pivot expected|expecting pivot|pricing pivot|first cut|beginning of cuts|when (they|fed) start(s)? cutting)\b/i,
    regime: "pre_pivot", tier: "pivot_signal", confidence: 0.75 },
  // On-hold expectation
  { pattern: /\b(on hold expected|expected to (hold|pause)|pause (expected|priced)|hold rates|no (hike|cut) expected|steady rates)\b/i,
    regime: "on_hold", tier: "neutral", confidence: 0.85 },
  // Uncertain
  { pattern: /\b(uncertain|unclear|data.dependent outlook|50.50|coin flip|divided|disagreement on path)\b/i,
    regime: "uncertain", tier: "neutral", confidence: 0.5 },
];

function inferMarketExpectation(text: string): ExpectationSignal {
  for (const rule of EXPECTATION_RULES) {
    if (rule.pattern.test(text)) {
      return { expectedRegime: rule.regime, expectedTier: rule.tier, confidence: rule.confidence };
    }
  }
  return { expectedRegime: "unknown", expectedTier: "unknown", confidence: 0 };
}

// ─── Delta classification ─────────────────────────────────────────────────────

const REGIME_DIRECTION: Record<PolicyRegime, "hawkish" | "dovish" | "neutral"> = {
  tightening_cycle: "hawkish",
  easing_cycle:     "dovish",
  pre_pivot:        "dovish",
  on_hold:          "neutral",
  uncertain:        "neutral",
};

function classifyDelta(
  expected: ExpectationSignal,
  detectedRegime: PolicyRegime,
  detectedTier: CBLanguageTier,
): { deltaType: DeltaType; deltaScore: number } {
  if (expected.confidence < 0.3) {
    return { deltaType: "no_surprise", deltaScore: 0 };
  }

  const expDir  = REGIME_DIRECTION[expected.expectedRegime as PolicyRegime] ?? "neutral";
  const detDir  = REGIME_DIRECTION[detectedRegime];

  // Direction surprise: opposite sides of hawkish/dovish divide
  if (expDir !== detDir && expDir !== "neutral" && detDir !== "neutral") {
    return {
      deltaType: "direction_surprise",
      deltaScore: Math.round(expected.confidence * 100 * 0.8),
    };
  }

  // Communication surprise: language shifted but no new rate action expected
  if (expected.expectedRegime === "on_hold" && detectedTier === "pivot_signal") {
    return { deltaType: "communication_surprise", deltaScore: 50 };
  }

  // Timing surprise: both dovish but one is pre_pivot and other is easing_cycle
  if (expDir === "dovish" && detDir === "dovish") {
    if (
      (expected.expectedRegime === "pre_pivot" && detectedRegime === "easing_cycle") ||
      (expected.expectedRegime === "easing_cycle" && detectedRegime === "pre_pivot")
    ) {
      return { deltaType: "timing_surprise", deltaScore: 35 };
    }
    // Both dovish, same regime — confirmed
    return { deltaType: "confirmed", deltaScore: 0 };
  }

  // Magnitude surprise: same direction, different intensity
  const tierIntensity: Record<CBLanguageTier, number> = {
    hawkish_explicit: 5, hawkish_lean: 4, neutral: 3,
    dovish_lean: 2, dovish_explicit: 1, pivot_signal: 1,
  };
  const expIntensity = expected.expectedTier !== "unknown"
    ? (tierIntensity[expected.expectedTier as CBLanguageTier] ?? 3)
    : 3;
  const detIntensity = tierIntensity[detectedTier] ?? 3;
  if (Math.abs(expIntensity - detIntensity) >= 2) {
    return {
      deltaType: "magnitude_surprise",
      deltaScore: Math.round(Math.abs(expIntensity - detIntensity) * 15),
    };
  }

  return { deltaType: "confirmed", deltaScore: 0 };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildPolicyExpectation(
  question: string,
  ctx: string,
  policyIntel: PolicyIntelligenceResult,
  regime?: string,
): PolicyExpectationDelta {
  const text = `${question} ${ctx}`;
  const isSamaContext = policyIntel.isSaudiRelevant &&
    (policyIntel.dominantSignal?.cb === "sama" || /\bsama\b/i.test(text));

  const noSignalResult: PolicyExpectationDelta = {
    expectedRegime:  "unknown",
    expectedTier:    "unknown",
    detectedRegime:  "uncertain",
    detectedTier:    "neutral",
    deltaType:       "no_surprise",
    deltaScore:      0,
    deltaSummary:    "",
    isSamaContext,
    expectationCtx:  "",
  };

  if (!policyIntel.dominantSignal) return noSignalResult;

  // SAMA never surprises — it follows Fed mechanically
  if (isSamaContext && policyIntel.dominantSignal.cb === "sama") {
    return {
      ...noSignalResult,
      expectedRegime:  policyIntel.dominantSignal.policyRegime,
      detectedRegime:  policyIntel.dominantSignal.policyRegime,
      detectedTier:    policyIntel.dominantSignal.languageTier,
      deltaType:       "confirmed",
      deltaScore:      0,
      deltaSummary:    "SAMA follows Fed mechanically — no independent policy surprise possible.",
      expectationCtx:  "",
    };
  }

  const marketExpectation = inferMarketExpectation(text);
  const detectedRegime  = policyIntel.dominantSignal.policyRegime;
  const detectedTier    = policyIntel.dominantSignal.languageTier;

  if (marketExpectation.expectedRegime === "unknown") {
    return {
      ...noSignalResult,
      detectedRegime,
      detectedTier,
      expectedRegime: "unknown",
      expectedTier:   "unknown",
    };
  }

  const { deltaType, deltaScore } = classifyDelta(marketExpectation, detectedRegime, detectedTier);

  const deltaLines: Record<DeltaType, string> = {
    direction_surprise:    `Direction surprise (${marketExpectation.expectedRegime?.replace(/_/g, " ")} expected → ${detectedRegime.replace(/_/g, " ")} detected): markets were positioned for the wrong direction.`,
    timing_surprise:       `Timing surprise: CB direction correct but pace differs from market expectation — re-pricing of rate path ahead.`,
    magnitude_surprise:    `Magnitude surprise: CB signal stronger/weaker than market priced — position adjustment needed.`,
    communication_surprise:`Communication surprise: language shifted without rate action — CB managing expectations ahead of next meeting.`,
    confirmed:             `Policy confirmed: detected language matches market expectation — no re-pricing pressure.`,
    no_surprise:           "",
  };

  const deltaSummary = deltaLines[deltaType] ?? "";

  const expectationCtx = deltaType !== "no_surprise" && deltaType !== "confirmed" && deltaSummary
    ? `Policy expectation delta [${deltaType.replace(/_/g, " ")}]: ${deltaSummary.slice(0, 160)}`.slice(0, 200)
    : "";

  return {
    expectedRegime:  marketExpectation.expectedRegime,
    expectedTier:    marketExpectation.expectedTier,
    detectedRegime,
    detectedTier,
    deltaType,
    deltaScore,
    deltaSummary,
    isSamaContext,
    expectationCtx,
  };
}
