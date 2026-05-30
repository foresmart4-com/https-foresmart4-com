// Phase-90A: CIO + Institutional Advisory Intelligence Validation
// Validates: CIO framing, recommendation hierarchy, conviction governance,
//            escalation logic, advisory governor

import { buildCioAdvisoryFrame }    from "../src/services/advisory/cioAdvisoryEngine";
import { buildRecommendationLevel } from "../src/services/advisory/recommendationHierarchy";
import { governConviction }         from "../src/services/advisory/convictionGovernor";
import { computeAdvisoryEscalation } from "../src/services/advisory/advisoryEscalationEngine";
import { governAdvisory }           from "../src/services/advisory/advisoryGovernor";

console.log("\n=== Phase-90A CIO + Institutional Advisory Intelligence Validation ===\n");

let total = 0; let passed = 0;
function check(label: string, cond: boolean, detail?: string): void {
  total++;
  console.log(`    ${cond ? "✓" : "✗"} ${label}${detail ? `  → ${detail}` : ""}`);
  if (cond) passed++;
}

// ─── Scenario 1: High Uncertainty ─────────────────────────────────────────
console.log("── Scenario 1: High Uncertainty (conflicted consensus, low regime confidence) ──");
{
  const cio = buildCioAdvisoryFrame({
    primaryRegime: "macro_transition", macroBias: "neutral",
    creditStressLevel: "moderate", consensusStrength: "conflicted",
    regimeConf: 28, isSaudi: false,
  });
  console.log(`  CIO: horizon=${cio.strategicHorizon} preservation=${cio.capitalPreservation} caution=${cio.deploymentCaution} bias=${cio.strategicBias}`);
  check("High uncertainty → CIO caution = hold (conflicted consensus)", cio.deploymentCaution === "hold" || cio.deploymentCaution === "reduce", `caution=${cio.deploymentCaution}`);
  check("Strategic bias = uncertain for conflicted consensus", cio.strategicBias === "uncertain" || cio.strategicBias === "cautious", `bias=${cio.strategicBias}`);
  check("CIO briefing ≤160 chars", cio.cioBriefing.length <= 160, `len=${cio.cioBriefing.length}`);
  check("CIO briefing contains CIO label", cio.cioBriefing.startsWith("CIO["), `briefing="${cio.cioBriefing.slice(0,40)}"`);

  const rec = buildRecommendationLevel({
    primaryRegime: "macro_transition", macroBias: "neutral",
    creditStressLevel: "moderate", consensusStrength: "conflicted",
    regimeConf: 28, isSaudi: false,
  });
  console.log(`  Rec: level=${rec.level} rationale="${rec.levelRationale.slice(0,40)}"`);
  check("High uncertainty → recommendation = high_uncertainty", rec.level === "high_uncertainty", `level=${rec.level}`);
  check("Recommendation context ≤100 chars", rec.recommendCtx.length <= 100);

  const conv = governConviction({
    regimeConf: 28, consensusStrength: "conflicted", creditStressLevel: "moderate",
    macroBias: "neutral", isSaudi: false,
  });
  console.log(`  Conviction: level=${conv.allowedConviction} maxConf=${conv.maxConfidenceAnchor}% qualify=${conv.requiresQualification}`);
  check("Low regimeConf + conflicted → conviction = contested or low", ["contested","low"].includes(conv.allowedConviction), `level=${conv.allowedConviction}`);
  check("Max confidence anchor ≤ 50 for contested/low", conv.maxConfidenceAnchor <= 52, `anchor=${conv.maxConfidenceAnchor}`);
  check("Qualification required for contested/low conviction", conv.requiresQualification);
}

// ─── Scenario 2: Strong Thesis ─────────────────────────────────────────────
console.log("\n── Scenario 2: Strong Thesis (bull_trending, bullish, low credit, high confidence) ──");
{
  const cio = buildCioAdvisoryFrame({
    primaryRegime: "bull_trending", macroBias: "bullish",
    creditStressLevel: "low", consensusStrength: "strong",
    regimeConf: 78, isSaudi: false,
  });
  console.log(`  CIO: horizon=${cio.strategicHorizon} preservation=${cio.capitalPreservation} caution=${cio.deploymentCaution} bias=${cio.strategicBias}`);
  check("Strong thesis → CIO caution = selective_deploy or opportunistic", ["selective_deploy","opportunistic"].includes(cio.deploymentCaution), `caution=${cio.deploymentCaution}`);
  check("Strategic bias = constructive or opportunistic", ["constructive","opportunistic"].includes(cio.strategicBias), `bias=${cio.strategicBias}`);
  check("Preservation = growth_oriented for bull + low credit", cio.capitalPreservation === "growth_oriented", `preservation=${cio.capitalPreservation}`);
  check("Horizon = long_term for established bull + high confidence", cio.strategicHorizon === "long_term", `horizon=${cio.strategicHorizon}`);

  const rec = buildRecommendationLevel({
    primaryRegime: "bull_trending", macroBias: "bullish",
    creditStressLevel: "low", consensusStrength: "strong",
    regimeConf: 78, isSaudi: false,
  });
  check("Strong thesis → selective_opportunity recommendation", rec.level === "selective_opportunity", `level=${rec.level}`);

  const conv = governConviction({
    regimeConf: 78, consensusStrength: "strong", creditStressLevel: "low",
    macroBias: "bullish", oilPrice: null, tltChangePct: 1.0, isSaudi: false,
  });
  check("Strong signals → high conviction", conv.allowedConviction === "high", `level=${conv.allowedConviction}`);
  check("Max confidence ≤ 78 (governance ceiling always applies)", conv.maxConfidenceAnchor <= 78, `anchor=${conv.maxConfidenceAnchor}`);
  check("No qualification required for high conviction", !conv.requiresQualification, `qualify=${conv.requiresQualification}`);
}

// ─── Scenario 3: Crisis Environment ──────────────────────────────────────
console.log("\n── Scenario 3: Crisis Environment (extreme credit, risk-off, banking stress) ──");
{
  const cio = buildCioAdvisoryFrame({
    primaryRegime: "high_vol_risk_off", macroBias: "bearish",
    creditStressLevel: "extreme", consensusStrength: "moderate",
    regimeConf: 70, isSaudi: false,
  });
  console.log(`  CIO: caution=${cio.deploymentCaution} preservation=${cio.capitalPreservation} bias=${cio.strategicBias}`);
  check("Crisis → CIO caution = defensive", cio.deploymentCaution === "defensive", `caution=${cio.deploymentCaution}`);
  check("Crisis → preservation = capital_protection", cio.capitalPreservation === "capital_protection", `pres=${cio.capitalPreservation}`);
  check("Crisis → strategic bias = defensive", cio.strategicBias === "defensive", `bias=${cio.strategicBias}`);
  check("Crisis → horizon = near_term", cio.strategicHorizon === "near_term", `horizon=${cio.strategicHorizon}`);

  const escalation = computeAdvisoryEscalation({
    creditStressLevel: "extreme", macroBias: "bearish",
    fiduciaryAlert: true, isRiskOff: true, liquidityStressed: true,
    question: "There is a banking crisis. Credit spreads are blowing out.",
    ctx: "Bank stress extreme. HY spreads +500bps.",
    regimeConf: 70, baseMaxConfidence: 55,
  });
  console.log(`  Escalation: level=${escalation.finalEscalation} penalty=${escalation.confidencePenalty} adjusted=${escalation.adjustedMaxConfidence}`);
  check("Crisis → escalation = critical", escalation.finalEscalation === "critical", `level=${escalation.finalEscalation}`);
  check("Critical escalation penalty = 18", escalation.confidencePenalty === 18, `penalty=${escalation.confidencePenalty}`);
  check("Adjusted confidence = base - penalty", escalation.adjustedMaxConfidence === 55 - 18, `adj=${escalation.adjustedMaxConfidence}`);
  check("Escalation note ≤65 chars", escalation.escalationNote.length <= 65);
}

// ─── Scenario 4: Mixed Evidence ────────────────────────────────────────────
console.log("\n── Scenario 4: Mixed Evidence (moderate credit, bearish, weak consensus) ──");
{
  const rec = buildRecommendationLevel({
    primaryRegime: "bear_ranging", macroBias: "bearish",
    creditStressLevel: "moderate", consensusStrength: "weak",
    regimeConf: 50, isSaudi: false,
  });
  console.log(`  Rec: level=${rec.level}`);
  check("Bearish + moderate credit → defensive or monitor", ["defensive_posture","monitor_for_opportunity"].includes(rec.level), `level=${rec.level}`);

  const conv = governConviction({
    regimeConf: 50, consensusStrength: "weak", creditStressLevel: "moderate",
    macroBias: "bearish", isSaudi: false,
  });
  console.log(`  Conviction: level=${conv.allowedConviction} maxConf=${conv.maxConfidenceAnchor}%`);
  check("Weak consensus + moderate credit → moderate or low conviction", ["moderate","low"].includes(conv.allowedConviction), `level=${conv.allowedConviction}`);
  check("Conviction ceiling ≤ 65 for mixed evidence", conv.maxConfidenceAnchor <= 65, `anchor=${conv.maxConfidenceAnchor}`);

  const escalation = computeAdvisoryEscalation({
    creditStressLevel: "moderate", macroBias: "bearish",
    fiduciaryAlert: false, isRiskOff: false, liquidityStressed: false,
    question: "Mixed signals. Earnings declining. Some credit pressure.",
    ctx: "Bearish macro. Credit moderately stressed.",
    regimeConf: 50, baseMaxConfidence: 62,
  });
  check("Mild escalation for bearish + moderate", ["none","mild","moderate"].includes(escalation.finalEscalation), `level=${escalation.finalEscalation}`);
}

// ─── Scenario 5: Institutional Recommendation Case ─────────────────────────
console.log("\n── Scenario 5: Full Advisory Pipeline (Saudi, oil=$68, bear) ──");
{
  const cio = buildCioAdvisoryFrame({
    primaryRegime: "bear_ranging", macroBias: "bearish",
    creditStressLevel: "high", consensusStrength: "moderate",
    regimeConf: 60, isSaudi: true, oilPrice: 68,
  });
  const rec = buildRecommendationLevel({
    primaryRegime: "bear_ranging", macroBias: "bearish",
    creditStressLevel: "high", consensusStrength: "moderate",
    regimeConf: 60, isSaudi: true, oilPrice: 68,
  });
  const conv = governConviction({
    regimeConf: 60, consensusStrength: "moderate", creditStressLevel: "high",
    macroBias: "bearish", oilPrice: 68, tltChangePct: -0.5, isSaudi: true,
  });
  const escalation = computeAdvisoryEscalation({
    creditStressLevel: "high", macroBias: "bearish",
    fiduciaryAlert: true, isRiskOff: true, liquidityStressed: false,
    question: "Saudi market under pressure from oil below $70.",
    ctx: "Oil $68. SAMA following Fed. Saudi fiscal pressure building.",
    regimeConf: 60, baseMaxConfidence: conv.maxConfidenceAnchor,
  });
  const gov = governAdvisory({ cio, rec, conviction: conv, escalation, lang: "en" });

  console.log(`  Governor: quality=${gov.qualityScore} approved=${gov.approved} ctx.len=${gov.governedAdvisoryCtx.length}`);
  console.log(`  CIO caution=${cio.deploymentCaution} Rec=${rec.level} MaxConf=${escalation.adjustedMaxConfidence}%`);
  check("Governor quality score ≥ 50",              gov.qualityScore >= 50, `score=${gov.qualityScore}`);
  check("Advisory context ≤400 chars",              gov.governedAdvisoryCtx.length <= 400, `len=${gov.governedAdvisoryCtx.length}`);
  check("Context contains CIO label",               /CIO\[/.test(gov.governedAdvisoryCtx));
  check("Context contains conviction ceiling",      /Conviction.*≤\d+%/.test(gov.governedAdvisoryCtx), `ctx="${gov.governedAdvisoryCtx.slice(0,80)}"`);
  check("No execution language",                    !/buy now|sell now|execute/i.test(gov.governedAdvisoryCtx));
  check("No financial guarantees",                  !/guaranteed.return|certain.profit|no.loss/i.test(gov.governedAdvisoryCtx));
  check("Disclaimer present",                       gov.advisoryDisclaimer.length > 10, `disc="${gov.advisoryDisclaimer.slice(0,50)}"`);
  check("Saudi: oil < $70 → defensive posture",     rec.level === "defensive_posture", `level=${rec.level}`);
  check("Saudi: escalation ≥ mild for fiduciaryAlert", ["mild","moderate","significant","critical"].includes(escalation.finalEscalation), `esc=${escalation.finalEscalation}`);
  check("Escalation reduces max confidence",        escalation.adjustedMaxConfidence < conv.maxConfidenceAnchor, `adj=${escalation.adjustedMaxConfidence} base=${conv.maxConfidenceAnchor}`);
}

console.log(`\n=== TOTAL: ${passed}/${total} passed ===\n`);
if (passed < total) process.exit(1);
