// LCCR Live Validation: Institutional Investment Committee Brain
// Validates all 5 LCCR engines against the Saudi CIO benchmark prompt.
// Pure deterministic — no AI calls, no network, O(1).
//
// Saudi CIO prompt:
//   "كيف سيفكر كبير مسؤولي الاستثمار السعودي في تخصيص رأس المال خلال الـ 12 شهراً القادمة؟"
//   "How would a Saudi Chief Investment Officer think about capital allocation for the next 12 months?"
//
// PASS criteria (deterministic engines):
//   [1] Decision core: committee decision frame with allocation logic (not just regime)
//   [2] Debate: bull + bear cases with probability + strongest objection
//   [3] Capital allocator: Saudi/GCC-specific flows (PIF/SAMA logic)
//   [4] Capital cycle: allocation lesson and what differs now
//   [5] Validator: correctly scores institutional vs regime-only replies
//
// All assertions are strict — FAIL on any individual assertion.

import { buildInstitutionalDecisionFrame } from "../institutionalDecisionCore";
import { buildCommitteeDebate }            from "../committeeDebateEngine";
import { buildCapitalAllocatorProfile }    from "../capitalAllocatorEngine";
import { buildCapitalCycleAnalysis }       from "../historicalCapitalCycleEngine";
import { validateInstitutionalDecision }   from "../institutionalDecisionValidator";
import type { GenesisReply }               from "@/lib/genesis.functions";

// ─── Saudi CIO benchmark conditions ──────────────────────────────────────────
// Represents a realistic Saudi investment context: oil ~$78, moderate credit,
// neutral macro, moderate consensus, moderate regime confidence.

const SAUDI_CIO_INPUTS = {
  regime:            "macro_transition",
  macroBias:         "neutral"    as const,
  creditStress:      "moderate"   as const,
  consensusStrength: "moderate"   as const,
  consensusScore:    58,
  regimeConf:        55,
  uncertaintyLevel:  "moderate"   as const,
  isSaudi:           true,
  oilPrice:          78,
  question:          "How would a Saudi Chief Investment Officer think about capital allocation for the next 12 months?",
  lang:              "en"         as const,
};

// ─── Test runner ──────────────────────────────────────────────────────────────

type PassFail = { test: string; passed: boolean; detail: string };

function assert(condition: boolean, testName: string, detail: string): PassFail {
  return { test: testName, passed: condition, detail };
}

// ─── LCCR-1: Institutional Decision Core ─────────────────────────────────────

function validateDecisionCore(): PassFail[] {
  const frame = buildInstitutionalDecisionFrame(SAUDI_CIO_INPUTS);
  return [
    assert(
      typeof frame.allocationSizing === "string" && frame.allocationSizing.length > 0,
      "LCCR-1: allocation sizing is set",
      `allocationSizing=${frame.allocationSizing}`,
    ),
    assert(
      typeof frame.positionFramework === "string",
      "LCCR-1: position framework is set",
      `positionFramework=${frame.positionFramework}`,
    ),
    assert(
      frame.horizonDiscipline === "medium_12m",
      "LCCR-1: Saudi CIO 12-month question → medium_12m horizon",
      `horizonDiscipline=${frame.horizonDiscipline}`,
    ),
    assert(
      frame.preservationScore >= 0 && frame.preservationScore <= 100,
      "LCCR-1: preservation score in valid range",
      `preservationScore=${frame.preservationScore}`,
    ),
    assert(
      ["favorable", "unfavorable", "neutral", "uncertain"].includes(frame.riskRewardAsymmetry),
      "LCCR-1: risk/reward asymmetry is valid",
      `riskRewardAsymmetry=${frame.riskRewardAsymmetry}`,
    ),
    assert(
      frame.decisionFrameContext.length >= 80 && frame.decisionFrameContext.length <= 400,
      "LCCR-1: decision frame context is bounded (80-400 chars)",
      `decisionFrameContextLen=${frame.decisionFrameContext.length}`,
    ),
    assert(
      /allocation|sizing|preservation|horizon|deployment/i.test(frame.decisionFrameContext),
      "LCCR-1: decision frame contains allocation/committee language",
      `contains allocation language: ${/allocation|sizing|preservation|horizon/i.test(frame.decisionFrameContext)}`,
    ),
  ];
}

// ─── LCCR-2: Committee Debate Engine ─────────────────────────────────────────

function validateCommitteeDebate(): PassFail[] {
  const debate = buildCommitteeDebate(SAUDI_CIO_INPUTS);
  return [
    assert(
      debate.bullCase.length >= 30,
      "LCCR-2: bull case is substantive (≥30 chars)",
      `bullCaseLen=${debate.bullCase.length}`,
    ),
    assert(
      debate.bearCase.length >= 30,
      "LCCR-2: bear case is substantive (≥30 chars)",
      `bearCaseLen=${debate.bearCase.length}`,
    ),
    assert(
      debate.strongestObjection.length >= 20,
      "LCCR-2: strongest objection is substantive (≥20 chars)",
      `objectionLen=${debate.strongestObjection.length}`,
    ),
    assert(
      ["strongly_bull","modestly_bull","balanced","modestly_bear","strongly_bear"].includes(debate.evidenceWeighting),
      "LCCR-2: evidence weighting is valid",
      `evidenceWeighting=${debate.evidenceWeighting}`,
    ),
    assert(
      debate.bullProbability >= 15 && debate.bullProbability <= 80,
      "LCCR-2: bull probability in valid range [15-80]",
      `bullProbability=${debate.bullProbability}%`,
    ),
    assert(
      debate.bearProbability >= 15 && debate.bearProbability <= 75,
      "LCCR-2: bear probability in valid range [15-75]",
      `bearProbability=${debate.bearProbability}%`,
    ),
    assert(
      debate.bullProbability + debate.bearProbability <= 100,
      "LCCR-2: bull + bear probabilities ≤ 100",
      `sum=${debate.bullProbability + debate.bearProbability}%`,
    ),
    assert(
      ["bull_prevails","bear_prevails","conditional_bull","conditional_bear","stalemate"].includes(debate.verdict),
      "LCCR-2: verdict is valid",
      `verdict=${debate.verdict}`,
    ),
    assert(
      debate.debateContext.length >= 80 && debate.debateContext.length <= 380,
      "LCCR-2: debate context is bounded (80-380 chars)",
      `debateContextLen=${debate.debateContext.length}`,
    ),
    // Saudi-specific: oil mention when oilPrice provided
    assert(
      /oil|Saudi|GCC|\$78/i.test(debate.bullCase) || /oil|Saudi|GCC|\$78/i.test(debate.debateContext),
      "LCCR-2: Saudi CIO → oil/Saudi context referenced in debate",
      `saudioilRef=${/oil|Saudi|GCC/i.test(debate.bullCase + debate.debateContext)}`,
    ),
  ];
}

// ─── LCCR-3: Capital Allocator Engine ────────────────────────────────────────

function validateCapitalAllocator(): PassFail[] {
  const profile = buildCapitalAllocatorProfile(SAUDI_CIO_INPUTS);
  return [
    assert(
      typeof profile.hidingLocation === "string",
      "LCCR-3: hiding location is set",
      `hidingLocation=${profile.hidingLocation}`,
    ),
    assert(
      typeof profile.deployLocation === "string",
      "LCCR-3: deploy location is set",
      `deployLocation=${profile.deployLocation}`,
    ),
    assert(
      ["strongly_cyclical","modestly_cyclical","neutral","modestly_defensive","strongly_defensive"].includes(profile.cyclicalVsDefensive),
      "LCCR-3: cyclical/defensive tilt is valid",
      `cyclicalVsDefensive=${profile.cyclicalVsDefensive}`,
    ),
    assert(
      profile.sectorFlowMap.overweight.length > 0,
      "LCCR-3: sector flow map has overweight sectors",
      `overweight=${profile.sectorFlowMap.overweight.join(",")}`,
    ),
    assert(
      profile.transmissionChain.length >= 40,
      "LCCR-3: transmission chain is substantive",
      `transmissionChainLen=${profile.transmissionChain.length}`,
    ),
    assert(
      profile.saudiFlowLogic.length >= 30,
      "LCCR-3: Saudi/GCC flow logic is substantive (isSaudi=true)",
      `saudiFlowLogicLen=${profile.saudiFlowLogic.length}`,
    ),
    assert(
      /Saudi|GCC|SAMA|PIF|Vision 2030|oil|\$78/i.test(profile.saudiFlowLogic),
      "LCCR-3: Saudi flow logic references Saudi-specific institutions",
      `saudiRef=${/SAMA|PIF|Vision 2030/i.test(profile.saudiFlowLogic)}`,
    ),
    assert(
      profile.allocatorFlowContext.length >= 80 && profile.allocatorFlowContext.length <= 400,
      "LCCR-3: allocator flow context is bounded (80-400 chars)",
      `flowContextLen=${profile.allocatorFlowContext.length}`,
    ),
    assert(
      /capital|flow|hiding|deploy|tilt|sector/i.test(profile.allocatorFlowContext),
      "LCCR-3: flow context contains capital allocation language",
      `containsFlowLanguage=${/capital|flow|deploy/i.test(profile.allocatorFlowContext)}`,
    ),
  ];
}

// ─── LCCR-4: Historical Capital Cycle Engine ─────────────────────────────────

function validateCapitalCycle(): PassFail[] {
  const cycle = buildCapitalCycleAnalysis(SAUDI_CIO_INPUTS);
  return [
    assert(
      ["early_expansion","mid_expansion","late_expansion","distribution","early_contraction","deep_contraction","transition"].includes(cycle.currentPhase),
      "LCCR-4: capital cycle phase is valid",
      `currentPhase=${cycle.currentPhase}`,
    ),
    assert(
      ["high","moderate","low","negligible"].includes(cycle.analogConfidence),
      "LCCR-4: analog confidence is valid",
      `analogConfidence=${cycle.analogConfidence}`,
    ),
    assert(
      cycle.whatDiffersNow.length >= 30,
      "LCCR-4: 'what differs now' is substantive (≥30 chars)",
      `whatDiffersNowLen=${cycle.whatDiffersNow.length}`,
    ),
    assert(
      cycle.allocationLesson.length >= 30,
      "LCCR-4: allocation lesson is substantive (≥30 chars)",
      `allocationLessonLen=${cycle.allocationLesson.length}`,
    ),
    assert(
      cycle.capitalCycleContext.length >= 80 && cycle.capitalCycleContext.length <= 380,
      "LCCR-4: capital cycle context is bounded (80-380 chars)",
      `cycleContextLen=${cycle.capitalCycleContext.length}`,
    ),
    assert(
      /capital\s*cycle|allocat|episode|differ|lesson|history/i.test(cycle.capitalCycleContext),
      "LCCR-4: cycle context contains investment-relevant language",
      `containsInvLanguage=${/capital|allocat|episode/i.test(cycle.capitalCycleContext)}`,
    ),
  ];
}

// ─── LCCR-5: Institutional Decision Validator ────────────────────────────────

// Mock institutional-quality reply (simulates what REAL Genesis should produce)
const INSTITUTIONAL_REPLY: Partial<GenesisReply> = {
  headline:   "Saudi CIO allocates defensively with selective overweight in Vision 2030 sectors",
  thesis:     "12-month Saudi CIO allocation: neutral-to-underweight on broad Tadawul; overweight Vision 2030 sectors (tourism, tech, NEOM-adjacent) with a barbell defensive anchor.",
  baseCase:   "Oil at $78 sustains fiscal capacity. SAMA policy remains accommodative. Vision 2030 structural flows continue independent of global risk-off.",
  bullCase:   "If oil recovers to $85+ and Fed eases, Saudi risk premium compresses and PIF deployment accelerates — constructive for Tadawul breadth.",
  bearCase:   "If global recession deepens and oil falls below $65, fiscal surplus narrows, SAMA policy tightens, and PIF pauses deployment — defensive posture warranted.",
  caveats:    ["Oil fiscal channel is the primary uncertainty", "PIF deployment pace is discretionary"],
  confidence: 58,
  thesisChanger: "Oil sustained below $65 for 2+ months would require full defensive pivot; Fed pivot within 6 months would allow selective cyclical addition.",
  voiceReasoning: {
    allocator:  "Saudi CIO should size Vision 2030 sectors at 20-25% of equity allocation as structural overweight; maintain 15% defensive buffer in dividend-yielding names. Deploy in tranches on oil dips below $75.",
    historical: "2016 Vision 2030 announcement episode: early allocators earned 30-40% premium by 2017-2018. Today differs — Vision 2030 is in execution (not announcement), so the premium is partially priced.",
    macro:      "Oil-to-fiscal transmission is the anchoring variable: $78 oil supports breakeven; every $5 move changes sovereign deployment capacity by ~$20B.",
  },
  committeeSynthesis: {
    agreement:      "Committee agrees on selective overweight in Vision 2030 and defensive anchor in dividend names.",
    disagreement:   "Debate on timing: growth voice wants to deploy now on current momentum; conservative allocator wants to wait for oil confirmation above $82.",
    finalStance:    "Committee resolves to selective entry in tranches — 50% now, 50% on confirmation. Defensive anchor maintained throughout.",
    dominantVoice:  "allocator",
  },
};

// Mock regime-only reply (what Genesis used to produce — regime labels without portfolio consequence)
const REGIME_ONLY_REPLY: Partial<GenesisReply> = {
  headline: "Saudi market in macro_transition regime — bull_trending signals with high_vol_risk-off caution",
  thesis:   "The bull_trending regime in Saudi equities is supported by bearish macro transition signals. Risk-off regime conditions suggest caution.",
  baseCase: "The macro_transition regime continues. Bull_trending sector exposure remains appropriate. Risk-off signals are present but not dominant.",
  bullCase: "",
  bearCase: "",
  confidence: 55,
};

function validateDecisionValidator(): PassFail[] {
  const institutionalScore = validateInstitutionalDecision(INSTITUTIONAL_REPLY as GenesisReply);
  const regimeOnlyScore    = validateInstitutionalDecision(REGIME_ONLY_REPLY as GenesisReply);

  return [
    assert(
      institutionalScore.totalScore >= 70,
      "LCCR-5: institutional reply scores ≥70 (PASS)",
      `institutionalScore=${institutionalScore.totalScore} grade=${institutionalScore.grade}`,
    ),
    assert(
      institutionalScore.passed,
      "LCCR-5: institutional reply passes the validator",
      `passed=${institutionalScore.passed}`,
    ),
    assert(
      !institutionalScore.regimeDominance,
      "LCCR-5: institutional reply is NOT flagged as regime-dominant",
      `regimeDominance=${institutionalScore.regimeDominance}`,
    ),
    assert(
      regimeOnlyScore.totalScore < 70,
      "LCCR-5: regime-only reply scores <70 (FAIL — correctly identified)",
      `regimeOnlyScore=${regimeOnlyScore.totalScore}`,
    ),
    assert(
      !regimeOnlyScore.passed,
      "LCCR-5: regime-only reply does NOT pass the validator",
      `passed=${regimeOnlyScore.passed}`,
    ),
    assert(
      institutionalScore.totalScore > regimeOnlyScore.totalScore + 20,
      "LCCR-5: institutional reply scores >20 points higher than regime-only",
      `gap=${institutionalScore.totalScore - regimeOnlyScore.totalScore}`,
    ),
    assert(
      typeof institutionalScore.validatorLog === "string" && institutionalScore.validatorLog.includes("institutional_decision_validator"),
      "LCCR-5: validator log is well-formed",
      `log=${institutionalScore.validatorLog.slice(0, 80)}`,
    ),
  ];
}

// ─── Context string quality check ─────────────────────────────────────────────

function validateContextStrings(): PassFail[] {
  const frame   = buildInstitutionalDecisionFrame(SAUDI_CIO_INPUTS);
  const debate  = buildCommitteeDebate(SAUDI_CIO_INPUTS);
  const profile = buildCapitalAllocatorProfile(SAUDI_CIO_INPUTS);
  const cycle   = buildCapitalCycleAnalysis(SAUDI_CIO_INPUTS);

  // All context strings must be usable as prompt injections
  const allContexts = [
    frame.decisionFrameContext,
    debate.debateContext,
    profile.allocatorFlowContext,
    cycle.capitalCycleContext,
  ];

  return [
    assert(
      allContexts.every(c => c.length >= 80),
      "CONTEXT: all 4 context strings are substantive (≥80 chars each)",
      `lengths=${allContexts.map(c => c.length).join(",")}`,
    ),
    assert(
      allContexts.every(c => c.length <= 400),
      "CONTEXT: all 4 context strings are bounded (≤400 chars each)",
      `lengths=${allContexts.map(c => c.length).join(",")}`,
    ),
    assert(
      allContexts.every(c => !c.includes("undefined") && !c.includes("null")),
      "CONTEXT: no undefined/null in any context string",
      `cleanContexts=true`,
    ),
  ];
}

// ─── Main validation runner ───────────────────────────────────────────────────

export function runLCCRValidation(): {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: PassFail[];
  summary: string;
} {
  const allResults: PassFail[] = [
    ...validateDecisionCore(),
    ...validateCommitteeDebate(),
    ...validateCapitalAllocator(),
    ...validateCapitalCycle(),
    ...validateDecisionValidator(),
    ...validateContextStrings(),
  ];

  const passedCount = allResults.filter(r => r.passed).length;
  const failedCount = allResults.filter(r => !r.passed).length;
  const passed      = failedCount === 0;

  const summary = [
    `LCCR Validation: ${passed ? "PASS" : "FAIL"}`,
    `Tests: ${passedCount}/${allResults.length} passed`,
    ...(failedCount > 0
      ? ["FAILED TESTS:", ...allResults.filter(r => !r.passed).map(r => `  ✗ ${r.test}: ${r.detail}`)]
      : ["All tests passed."]),
  ].join("\n");

  return { passed, totalTests: allResults.length, passedTests: passedCount, failedTests: failedCount, results: allResults, summary };
}

// ─── Entry point for direct execution ────────────────────────────────────────

if (typeof require !== "undefined" && require.main === module) {
  const result = runLCCRValidation();
  console.log("\n" + result.summary + "\n");
  if (!result.passed) process.exit(1);
}
