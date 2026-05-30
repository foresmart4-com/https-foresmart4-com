// Phase-87B: Meta-Cognition + Institutional Maturity Validation
// Validates: regime ontology, durable expectation memory, question intent,
//            context merge, unified institutional reasoning

import { buildRegimeProfile } from "../src/services/research/regimeOntologyEngine";
import {
  computeExpectationPersistence,
  recordExpectation,
  clearExpectationBuffer,
  getExpectationBufferSize,
  checkExpectationPersisted,
} from "../src/services/research/expectationMemoryEngine";
import { classifyQuestionIntent } from "../src/services/research/questionIntentClassifier";
import { governContextMerge } from "../src/services/research/contextMergeGovernor";
import { buildSemanticImpact } from "../src/services/research/semanticImpactEngine";
import { buildPolicyExpectation } from "../src/services/research/policyExpectationModel";
import { buildPolicyIntelligence } from "../src/services/research/policyIntelligenceEngine";
import { assessLiveMacroEvents, resetLiveMacroCache } from "../src/services/research/liveMacroMonitor";
import { selectMacroChains } from "../src/services/research/macroTransmissionEngine";
import { buildArabicThinkerContext } from "../src/services/research/arabicThinkerDetection";
import { buildThinkerContext } from "../src/services/research/institutionalThinkerLibrary";
import { buildUnifiedCognition } from "../src/services/research/unifiedCognitionGovernor";

console.log("\n=== Phase-87B Meta-Cognition + Institutional Maturity Validation ===\n");

let total = 0; let passed = 0;
function check(label: string, cond: boolean, detail?: string): void {
  total++;
  console.log(`    ${cond ? "✓" : "✗"} ${label}${detail ? `  → ${detail}` : ""}`);
  if (cond) passed++;
}

// ─── Scenario 1: Composite Regime Ontology ───────────────────────────────────
console.log("── Scenario 1: Composite Regime (tightening + credit stress + oil shock) ──");
{
  const profile = buildRegimeProfile("bear_ranging", {
    creditStressLevel: "high",
    ratesEnv:    "Fed remains hawkish, tightening bias maintained, rates restrictive",
    oilLiquidity: "oil shock down -5%, DXY rising, credit spreads widened 80bps",
    oilChangePct: -5.2,
    tltChangePct: -1.8,
    macroBias:   "bearish",
    isGulfMarket: true,
  });
  console.log(`  Primary: ${profile.primaryRegime} | Overlays: [${profile.overlays.join(",")}]`);
  console.log(`  Composite: ${profile.compositeLabel}`);
  console.log(`  Framing: "${profile.institutionalFraming.slice(0, 80)}..."`);

  check("Primary regime parsed as bear_ranging", profile.primaryRegime === "bear_ranging");
  check("Tightening overlay detected from ratesEnv",    profile.overlays.includes("tightening_overlay"),  `overlays=[${profile.overlays}]`);
  check("Credit stress detected from creditStressLevel", profile.overlays.includes("credit_stress"),       `overlays=[${profile.overlays}]`);
  check("Commodity stress from oil -5.2%",              profile.overlays.includes("commodity_stress"),    `overlays=[${profile.overlays}]`);
  check("Fiduciary alert triggered (≥2 stress overlays)", profile.fiduciaryAlert, `stressCount=check overlaps`);
  check("Composite label is non-trivial",               profile.compositeLabel.includes("+"), `label=${profile.compositeLabel}`);
  check("Institutional framing includes capital preservation", /preserv|drawdown|capital|caution|defens/i.test(profile.institutionalFraming));
  check("Gulf note present (isSaudi + commodity stress)", /saudi|gulf|oil|fiscal/i.test(profile.institutionalFraming));
  check("Regime confidence ≥ 60 (multiple signals)",   profile.regimeConfidence >= 60, `conf=${profile.regimeConfidence}`);

  // Bull trending test
  const bull = buildRegimeProfile("bull_trending", { ratesEnv: "easing, Fed cutting rates", tltChangePct: 1.5 });
  check("Bull regime parsed correctly",      bull.primaryRegime === "bull_trending");
  check("Easing overlay detected",           bull.overlays.includes("easing_overlay"), `overlays=[${bull.overlays}]`);
  check("No fiduciary alert in clean bull",  !bull.fiduciaryAlert || bull.overlays.filter(o => ["credit_stress","tightening_overlay","commodity_stress","inflation_elevated","liquidity_tight"].includes(o)).length < 2);
}

// ─── Scenario 2: Durable Expectation Memory (restart simulation) ─────────────
console.log("\n── Scenario 2: Durable Expectation Memory (restart-safe buffer) ──");
{
  clearExpectationBuffer();
  check("Buffer starts empty after clear", getExpectationBufferSize() === 0, `size=${getExpectationBufferSize()}`);

  // Simulate pre-existing expectation (as if loaded from durable storage)
  recordExpectation("fed_pivot_easing", "Fed will cut");
  recordExpectation("tightening_cycle", "rates to stay higher");
  recordExpectation("fed_pivot_easing", "market pricing 3 cuts");  // second appearance → cross-call persistence
  check("Buffer populated with expectations", getExpectationBufferSize() === 3, `size=${getExpectationBufferSize()}`);

  // Cross-call persistence check
  check("Fed pivot expectation persisted (checkExpectationPersisted)",
    checkExpectationPersisted("fed_pivot_easing", 60 * 60 * 1000),
    "should find within 1 hour window");
  check("Tightening cycle persisted",
    checkExpectationPersisted("tightening_cycle", 60 * 60 * 1000));
  check("Unknown expectation not persisted",
    !checkExpectationPersisted("nonexistent_regime", 60 * 60 * 1000));

  // Amplification: long-held + broad consensus
  const longHeld = computeExpectationPersistence(
    "Markets have for months been pricing 3 rate cuts with broad consensus",
    "Widely expected and broadly priced. Long-standing market consensus.",
    "fed_pivot_easing",
  );
  console.log(`  Long-held: duration=${longHeld.duration} consensus=${longHeld.consensusStrength} persistence=${longHeld.persistenceScore} amp=${longHeld.amplificationFactor.toFixed(2)}`);
  check("Long-held expectation gets high persistence",  longHeld.persistenceScore >= 70, `score=${longHeld.persistenceScore}`);
  check("Amplification factor > 1.30 for long+strong",  longHeld.amplificationFactor >= 1.30, `amp=${longHeld.amplificationFactor}`);
  check("Cross-call bonus applied (buffer hit)",        longHeld.durationScore >= 90, `dScore=${longHeld.durationScore}`);

  // Short + weak expectation
  const shortNew = computeExpectationPersistence(
    "Just this week the market shifted its view, uncertain and divided",
    "Sudden new expectation, debated among analysts.",
  );
  check("Short/weak expectation gets low persistence",  shortNew.persistenceScore <= 35, `score=${shortNew.persistenceScore}`);
  check("Short amplification is minimal (≤1.20)",       shortNew.amplificationFactor <= 1.20, `amp=${shortNew.amplificationFactor}`);
}

// ─── Scenario 3: Mixed Arabic/English Expert Question ────────────────────────
console.log("\n── Scenario 3: Mixed Arabic/English Context Merge ──");
{
  const arabicCtx  = "كينز يدعم دور الطلب الكلي في تحفيز الاقتصاد. داليو يرى التيسير النقدي إيجابياً للأصول الخطرة. مدرسة القيمة تُركز على هامش الأمان.";
  const englishCtx = "Dalio all-weather framework: balanced risk allocation. Minsky cycle: debt expansion phases followed by deleveraging. Credit spread compression signal.";
  const qAr        = "كيف يؤثر خفض الفائدة من الفيدرالي على السوق السعودي تاسي؟";
  const qEn        = "How does the Fed easing cycle transmit to TASI through the oil-fiscal channel?";

  // Arabic question → should prefer Arabic context
  const arResult = governContextMerge({ arabicCtx, englishCtx, question: qAr, isSaudi: true, maxChars: 400 });
  console.log(`  Arabic question merge: bias=${arResult.mergeBias} quality=${arResult.mergeQuality} overlap=${arResult.semanticOverlapScore}`);
  check("Arabic question leads to arabic-dominant or balanced merge",
    ["arabic_dominant", "arabic_only", "balanced"].includes(arResult.mergeBias),
    `got bias=${arResult.mergeBias}`);
  check("Merged context is non-empty for Arabic question", arResult.mergedContext.length > 20, `len=${arResult.mergedContext.length}`);
  check("Arabic merge respects 400-char budget",          arResult.mergedContext.length <= 403);
  check("Advisory continuity note present",               arResult.advisoryContinuity.length > 5);

  // English question + high-quality English ctx → should prefer English
  const highQualityEn = "Dalio all-weather: balanced risk parity approach, volatility-weighted allocation, risk premium targeting across macro regimes. Minsky cycle phase analysis: credit expansion driving liquidity premium compression. Institutional framework suggests 35% equity, 25% long bonds, 15% intermediate bonds, 7.5% gold, 7.5% commodities. Fed easing cycles historically support duration.";
  const lowQualityAr  = "السوق";  // very short/low quality
  const enResult = governContextMerge({ arabicCtx: lowQualityAr, englishCtx: highQualityEn, question: qEn, isSaudi: false, maxChars: 400 });
  console.log(`  English question merge: bias=${enResult.mergeBias} arQ=${enResult.arQuality} enQ=${enResult.enQuality}`);
  check("Low-quality Arabic → english_only merge",
    enResult.mergeBias === "english_only",
    `got bias=${enResult.mergeBias}`);

  // Semantic overlap: both contain Dalio/credit → should detect overlap
  const arWithDalio  = "داليو يرى انتقال الائتمان. credit cycle مرحلة التوسع.";
  const enWithDalio  = "Dalio credit cycle: expansion phase, leverage building, spread compression.";
  const overlapResult = governContextMerge({ arabicCtx: arWithDalio, englishCtx: enWithDalio, question: "How does credit cycle affect allocations?", isSaudi: false, maxChars: 300 });
  console.log(`  Overlap test: score=${overlapResult.semanticOverlapScore} bias=${overlapResult.mergeBias}`);
  check("Semantic overlap detected when both reference dalio/credit", overlapResult.semanticOverlapScore > 0, `overlap=${overlapResult.semanticOverlapScore}`);
}

// ─── Scenario 4: Complex Intent Classification ────────────────────────────────
console.log("\n── Scenario 4: Multi-Dimensional Intent Classification ──");
{
  // Scenario: hypothetical/what-if
  const q1 = "What if oil falls below $70 — how would that affect Saudi fiscal spending and TASI earnings?";
  const r1 = classifyQuestionIntent(q1, "");
  console.log(`  Scenario Q: intent=${r1.intent} conf=${r1.intentConfidence} form=${r1.formFactor}`);
  check("Hypothetical question → scenario_stress_test",  r1.intent === "scenario_stress_test", `got ${r1.intent}`);

  // Advisory / should-I
  const q2 = "Should I increase my TASI allocation given the current oil-tightening environment?";
  const r2 = classifyQuestionIntent(q2, "");
  console.log(`  Advisory Q: intent=${r2.intent} action=${r2.actionability} adv=${r2.advisorySensitivity}`);
  check("Should-I question → advisory_framing or fiduciary_assessment", ["advisory_framing","fiduciary_assessment"].includes(r2.intent), `got ${r2.intent}`);
  check("Advisory sensitivity flag set for should-I",   r2.advisorySensitivity >= 60, `adv=${r2.advisorySensitivity}`);

  // Comparative
  const q3 = "Compare the macro transmission of oil shocks to Saudi equities versus UAE equities";
  const r3 = classifyQuestionIntent(q3, "");
  console.log(`  Comparative Q: intent=${r3.intent} form=${r3.formFactor}`);
  check("Compare question → comparative_research",     r3.intent === "comparative_research", `got ${r3.intent}`);

  // Fiduciary / suitability
  const q4 = "Is it appropriate for a fiduciary to hold 60% in TASI given concentration risk and mandate obligations?";
  const r4 = classifyQuestionIntent(q4, "");
  console.log(`  Fiduciary Q: intent=${r4.intent} advSens=${r4.advisorySensitivity}`);
  check("Fiduciary question → fiduciary_assessment",   r4.intent === "fiduciary_assessment", `got ${r4.intent}`);
  check("Fiduciary flag raised",                       r4.fiduciaryFlag, `flag=${r4.fiduciaryFlag}`);

  // Deep analytical with institutional context
  const q5 = "Explain the second-order liquidity channel transmission from Fed tightening through credit spreads to TASI valuations";
  const r5 = classifyQuestionIntent(q5, "regime: tightening, credit spread: high, institutional framework active");
  console.log(`  Deep Q: intent=${r5.intent} depth=${r5.domainDepth}`);
  check("Institutional/analytical question → deep_analytical or macro_policy_synthesis", ["deep_analytical","macro_policy_synthesis","educational_inquiry"].includes(r5.intent), `got ${r5.intent}`);
  check("High domain depth for institutional question", r5.domainDepth >= 55, `depth=${r5.domainDepth}`);

  // Layer hints exist for all intents
  check("Scenario layer hints include macro",   (r1.layerHints.macro  ?? 0) > 0, `macro hint=${r1.layerHints.macro}`);
  check("Advisory layer hints include expert",  (r2.layerHints.expert ?? 0) > 0, `expert hint=${r2.layerHints.expert}`);
  check("Fiduciary layer hints include authority", (r4.layerHints.authority ?? 0) > 0, `auth hint=${r4.layerHints.authority}`);
}

// ─── Scenario 5: Unified Institutional Reasoning ─────────────────────────────
console.log("\n── Scenario 5: Unified Institutional Reasoning (full pipeline) ──");
{
  const q   = "How does the Fed tightening cycle transmit to TASI given Saudi fiscal policy and the oil-fiscal channel?";
  const ctx = "Fed hawkish. Oil at $78. SAMA follows Fed. Riyal peg intact. Saudi budget in surplus.";
  const isSaudi = true;
  resetLiveMacroCache();

  const policyIntel = buildPolicyIntelligence(q, ctx);
  const liveEvents  = assessLiveMacroEvents(78, 1.0, -1.2, 0.5, null, null, null, isSaudi);
  const semantic    = buildSemanticImpact(q, ctx, liveEvents, policyIntel, isSaudi);
  const policyDelta = buildPolicyExpectation(q, ctx, policyIntel);
  const chains      = selectMacroChains(q, ctx, 78, 1.0, -1.2, isSaudi);
  const arabicCtx   = buildArabicThinkerContext("كينز داليو التيسير النقدي SAMA", isSaudi);
  const thinkerCtx  = buildThinkerContext(q, ctx, isSaudi);

  // Build regime profile
  const regimeProfile = buildRegimeProfile("high_vol_risk_off", {
    creditStressLevel: "moderate",
    ratesEnv:    "Fed hawkish, tightening bias",
    oilLiquidity: "oil stable, DXY rising",
    tltChangePct: -1.2,
    isGulfMarket: isSaudi,
  });
  console.log(`  Regime: ${regimeProfile.compositeLabel} alert=${regimeProfile.fiduciaryAlert}`);

  const unified = buildUnifiedCognition({
    authority85b:    "",
    expertKnowledge: thinkerCtx,
    macroSynthesis:  chains.transmissionCtx,
    semanticImpact:  semantic,
    policyDelta,
    arabicCtx:       arabicCtx || undefined,
    question: q, isSaudi, isInvestment: true,
    regimeProfile,
  });
  console.log(`  Unified: coverage=${unified.coverageLabel} chars=${unified.totalChars} intent=${unified.intentLabel ?? "n/a"} merge=${unified.mergeGovernance ?? "n/a"}`);

  check("Unified cognition non-empty",           !unified.isEmpty,          `coverage=${unified.coverageLabel}`);
  check("Budget respected (≤700 chars)",          unified.totalChars <= 700, `chars=${unified.totalChars}`);
  check("Intent label populated (Phase-87B)",     unified.intentLabel !== undefined && unified.intentLabel.length > 0, `intent=${unified.intentLabel}`);
  check("Merge governance label populated",       unified.mergeGovernance !== undefined, `bias=${unified.mergeGovernance}`);
  check("Coverage includes macro layer",          unified.coverageLabel.includes("macro"), `coverage=${unified.coverageLabel}`);
  check("Regime framing available for Gulf",      unified.regimeFraming !== undefined || regimeProfile.overlays.length === 0, `overlays=${regimeProfile.overlays}`);

  // Fiduciary-safe: no trading, no execution language
  check("No execution language in unified context",
    !/\b(buy now|sell now|enter position|place order|execute)\b/i.test(unified.unifiedContext));

  // Governance continuity: intent hint weights are valid
  const intentResult = classifyQuestionIntent(q, chains.transmissionCtx.slice(0, 200));
  const hintTotal = Object.values(intentResult.layerHints).reduce((s, v) => s + (v ?? 0), 0);
  check("Layer hint weights sum to ~100",
    hintTotal >= 95 && hintTotal <= 105, `sum=${hintTotal}`);
}

console.log(`\n=== TOTAL: ${passed}/${total} passed ===\n`);
if (passed < total) process.exit(1);
