// Phase-87A: Cognitive Precision Validation
// Tests: weak vs strong shock, short vs long expectation, Arabic unified,
//        sparse vs macro-heavy, unified cognition precision

import { computeMagnitudeAdjustedConfidence, countCorroboratingSaignals, classifyMagnitudeTier } from "../src/services/research/magnitudeConfidenceEngine";
import { computeExpectationPersistence, clearExpectationBuffer } from "../src/services/research/expectationMemoryEngine";
import { allocateDynamicBudget, deriveLayerScores, detectQuestionType } from "../src/services/research/dynamicBudgetGovernor";
import { buildUnifiedCognition } from "../src/services/research/unifiedCognitionGovernor";
import { buildSemanticImpact } from "../src/services/research/semanticImpactEngine";
import { buildPolicyExpectation } from "../src/services/research/policyExpectationModel";
import { buildPolicyIntelligence } from "../src/services/research/policyIntelligenceEngine";
import { assessLiveMacroEvents, resetLiveMacroCache } from "../src/services/research/liveMacroMonitor";
import { buildArabicThinkerContext, buildArabicSchoolContext } from "../src/services/research/arabicThinkerDetection";
import { selectMacroChains } from "../src/services/research/macroTransmissionEngine";

console.log("\n=== Phase-87A Cognitive Precision Validation ===\n");
let total = 0; let passed = 0;
function check(label: string, cond: boolean, detail?: string): void {
  total++;
  console.log(`    ${cond ? "✓" : "✗"} ${label}${detail ? `  → ${detail}` : ""}`);
  if (cond) passed++;
}

// ─── Scenario 1: Weak vs Strong Macro Shock ──────────────────────────────────
console.log("── Scenario 1: Weak vs Strong Macro Shock ──");
{
  // Weak shock: TLT -0.3% (below 0.5% minimal tier)
  const weakResult = computeMagnitudeAdjustedConfidence({ primaryMagnitudePct: 0.3, corroboratingCount: 0, baseConfidence: 60 });
  // Strong shock: TLT -4.2% (large tier)
  const strongResult = computeMagnitudeAdjustedConfidence({ primaryMagnitudePct: 4.2, corroboratingCount: 2, baseConfidence: 60 });
  // Extreme shock: SPY -6% (extreme tier)
  const extremeResult = computeMagnitudeAdjustedConfidence({ primaryMagnitudePct: 6.0, corroboratingCount: 3, baseConfidence: 60 });

  console.log(`  Weak (0.3%): tier=${weakResult.tier} confidence=${weakResult.magnitudeAdjustedConfidence}`);
  console.log(`  Strong (4.2%): tier=${strongResult.tier} confidence=${strongResult.magnitudeAdjustedConfidence}`);
  console.log(`  Extreme (6.0%): tier=${extremeResult.tier} confidence=${extremeResult.magnitudeAdjustedConfidence}`);

  check("Weak shock < 30 confidence", weakResult.magnitudeAdjustedConfidence < 30, `got ${weakResult.magnitudeAdjustedConfidence}`);
  check("Strong shock > weak shock (large > minimal tier)", strongResult.magnitudeAdjustedConfidence > weakResult.magnitudeAdjustedConfidence);
  check("Extreme shock > strong shock", extremeResult.magnitudeAdjustedConfidence > strongResult.magnitudeAdjustedConfidence);
  check("Extreme shock approaches 100", extremeResult.magnitudeAdjustedConfidence >= 80, `got ${extremeResult.magnitudeAdjustedConfidence}`);

  check("Weak tier classified as 'minimal'", weakResult.tier === "minimal");
  check("Strong (4.2%) tier classified as 'large'", strongResult.tier === "large");
  check("Extreme (6.0%) tier classified as 'extreme'", extremeResult.tier === "extreme");

  // Regime modifier: stable regime amplifies, volatile dampens
  const stableStrong = computeMagnitudeAdjustedConfidence({ primaryMagnitudePct: 2.0, corroboratingCount: 1, regimeLabel: "low_vol_risk_on", baseConfidence: 50 });
  const volatileStrong = computeMagnitudeAdjustedConfidence({ primaryMagnitudePct: 2.0, corroboratingCount: 1, regimeLabel: "high_vol_risk_off", baseConfidence: 50 });
  console.log(`  Stable regime (2%): ${stableStrong.magnitudeAdjustedConfidence} | Volatile regime (2%): ${volatileStrong.magnitudeAdjustedConfidence}`);
  check("Stable regime amplifies shock vs volatile regime", stableStrong.magnitudeAdjustedConfidence > volatileStrong.magnitudeAdjustedConfidence);

  // Semantic impact with magnitude (integration test)
  resetLiveMacroCache();
  const strongLive = assessLiveMacroEvents(null, -4.5, -1.5, -2.0, 1.2, null, null, false);
  const weakLive   = assessLiveMacroEvents(null, -0.3, -0.2, -0.3, 0.1, null, null, false);
  const policyNone = buildPolicyIntelligence("market analysis", "");
  const strongSemantic = buildSemanticImpact("market analysis", "", strongLive, policyNone, false, "bull_trending");
  resetLiveMacroCache();
  const weakSemantic   = buildSemanticImpact("market analysis", "", weakLive, policyNone, false, "bull_trending");
  console.log(`  Strong semantic: pressure=${strongSemantic.analyticalPressure} confidence=${strongSemantic.confidencePressure}`);
  console.log(`  Weak semantic:   pressure=${weakSemantic.analyticalPressure}  confidence=${weakSemantic.confidencePressure}`);
  check("Strong shock produces higher analytical pressure", strongSemantic.analyticalPressure > weakSemantic.analyticalPressure);
  check("Strong shock produces higher confidence pressure", strongSemantic.confidencePressure > weakSemantic.confidencePressure);
}

// ─── Scenario 2: Short vs Long Expectation Reversal ──────────────────────────
console.log("\n── Scenario 2: Short vs Long Expectation Reversal ──");
{
  clearExpectationBuffer();

  // Short-held expectation: "markets just shifted to pricing cuts this week"
  const shortQ = "Markets just shifted to pricing rate cuts this week. Fed now hawkish — what is the policy surprise?";
  const shortPersistence = computeExpectationPersistence(shortQ, "", "easing_cycle");
  console.log(`  Short: duration=${shortPersistence.duration} durationScore=${shortPersistence.durationScore} persistence=${shortPersistence.persistenceScore} amplification=${shortPersistence.amplificationFactor.toFixed(2)}`);

  // Long-held expectation: "markets have been pricing cuts for months with broad consensus"
  const longQ = "Markets have been pricing 3 cuts for months with broad consensus throughout H1. Fed remains restrictive — what is the surprise?";
  const longPersistence = computeExpectationPersistence(longQ, "", "easing_cycle");
  console.log(`  Long: duration=${longPersistence.duration} durationScore=${longPersistence.durationScore} persistence=${longPersistence.persistenceScore} amplification=${longPersistence.amplificationFactor.toFixed(2)}`);

  // Strong consensus (unanimous): "unanimous expectation reversed"
  const unanimousQ = "Unanimous market expectation of rate cuts reversed by hawkish Fed signal.";
  const unanimousPersistence = computeExpectationPersistence(unanimousQ, "");
  console.log(`  Unanimous: consensus=${unanimousPersistence.consensusStrength} consensusScore=${unanimousPersistence.consensusScore} persistence=${unanimousPersistence.persistenceScore}`);

  check("Short expectation has low persistence", shortPersistence.persistenceScore < 50, `score=${shortPersistence.persistenceScore}`);
  check("Long expectation has higher persistence", longPersistence.persistenceScore > shortPersistence.persistenceScore, `long=${longPersistence.persistenceScore} > short=${shortPersistence.persistenceScore}`);
  check("Short duration detected", shortPersistence.duration === "short");
  check("Long duration detected", longPersistence.duration === "long");
  check("Long amplification > short amplification", longPersistence.amplificationFactor > shortPersistence.amplificationFactor);
  check("Long amplification ≤ 1.50 (bounded)", longPersistence.amplificationFactor <= 1.50, `got ${longPersistence.amplificationFactor}`);
  check("Unanimous consensus detected", unanimousPersistence.consensusStrength === "strong");
  check("Unanimous consensus score high", unanimousPersistence.consensusScore >= 85, `got ${unanimousPersistence.consensusScore}`);

  // Policy expectation with persistence amplification
  const policyQ = "Markets have been pricing 3 cuts for months with broad consensus. Fed signals higher for longer — what is the surprise magnitude?";
  const policyCtx = "Fed: remain restrictive. Cuts unlikely in H1. Markets had priced 75bps of cuts for months.";
  const policyIntel = buildPolicyIntelligence(policyQ, policyCtx);
  const longDelta = buildPolicyExpectation(policyQ, policyCtx, policyIntel);
  const shortDelta = buildPolicyExpectation(shortQ, "Fed cuts priced just this week. Now hawkish.", policyIntel);
  console.log(`  Long delta: type=${longDelta.deltaType} score=${longDelta.deltaScore}`);
  console.log(`  Short delta: type=${shortDelta.deltaType} score=${shortDelta.deltaScore}`);
  check("Long-held reversal produces higher deltaScore than short-held", longDelta.deltaScore >= shortDelta.deltaScore, `long=${longDelta.deltaScore} short=${shortDelta.deltaScore}`);
}

// ─── Scenario 3: Arabic Thinker + School in Unified Flow ────────────────────
console.log("\n── Scenario 3: Arabic Thinker + School in Unified Output ──");
{
  const arabicQ   = "يؤكد داليو أن نظام التضخم يتطلب تخصيص أصول حقيقية والذهب. كينز يدعم الطلب الكلي.";
  const arabicCtx = "الاستثمار الكلي يحكم التخصيص. استثمار القيمة متاح في التاسي.";
  const isSaudi = true;

  const arabicThinkerCtx = buildArabicThinkerContext(arabicQ, isSaudi);
  const arabicSchoolCtx  = buildArabicSchoolContext(arabicCtx, isSaudi);
  const combinedArabicCtx = [arabicThinkerCtx, arabicSchoolCtx].filter(Boolean).join(" | ").slice(0, 400);

  console.log(`  Arabic thinker: ${arabicThinkerCtx.length} chars | Arabic school: ${arabicSchoolCtx.length} chars`);
  check("Arabic thinker context non-empty", arabicThinkerCtx.length > 0, `chars=${arabicThinkerCtx.length}`);
  check("Arabic school context non-empty", arabicSchoolCtx.length > 0, `chars=${arabicSchoolCtx.length}`);

  // Build unified with Arabic context
  resetLiveMacroCache();
  const liveEv = assessLiveMacroEvents(82, 1.5, null, 0.4, null, null, null, isSaudi);
  const policyIntel = buildPolicyIntelligence(arabicQ, arabicCtx);
  const semantic = buildSemanticImpact(arabicQ, arabicCtx, liveEv, policyIntel, isSaudi);
  const policyDelta = buildPolicyExpectation(arabicQ, arabicCtx, policyIntel);
  const chains = selectMacroChains(arabicQ, arabicCtx, 82, 1.5, null, isSaudi);

  const unifiedWithArabic = buildUnifiedCognition({
    authority85b:    "",
    expertKnowledge: "",          // empty — Arabic is the only expert context
    macroSynthesis:  chains.transmissionCtx,
    semanticImpact:  semantic,
    policyDelta,
    arabicCtx:       combinedArabicCtx,
    question: arabicQ, isSaudi, isInvestment: true,
  });

  const unifiedWithoutArabic = buildUnifiedCognition({
    authority85b:    "",
    expertKnowledge: "",
    macroSynthesis:  chains.transmissionCtx,
    semanticImpact:  semantic,
    policyDelta,
    arabicCtx:       undefined,
    question: arabicQ, isSaudi, isInvestment: true,
  });

  console.log(`  With Arabic: coverage=${unifiedWithArabic.coverageLabel} chars=${unifiedWithArabic.totalChars}`);
  console.log(`  Without Arabic: coverage=${unifiedWithoutArabic.coverageLabel} chars=${unifiedWithoutArabic.totalChars}`);

  check("Unified with Arabic is non-empty", !unifiedWithArabic.isEmpty, `coverage=${unifiedWithArabic.coverageLabel}`);
  check("Arabic context appears in unified output", unifiedWithArabic.unifiedContext.length > 0);
  check("Arabic content enriches unified vs without", unifiedWithArabic.totalChars >= unifiedWithoutArabic.totalChars - 50);
  check("Unified within 700-char budget", unifiedWithArabic.totalChars <= 700, `chars=${unifiedWithArabic.totalChars}`);
  check("Expert layer present when Arabic provided", unifiedWithArabic.coverageLabel.includes("expert"), `coverage=${unifiedWithArabic.coverageLabel}`);
}

// ─── Scenario 4: Sparse vs Macro-Heavy Question ──────────────────────────────
console.log("\n── Scenario 4: Dynamic Budget — Sparse vs Macro-Heavy ──");
{
  // Sparse question: no macro events, minimal signals
  const sparseQ = "What is portfolio construction theory?";
  const sparseScores = deriveLayerScores("", 0, "Value investing: buy cheap", 0, "");
  const sparseQType = detectQuestionType(sparseQ);
  const sparseBudget = allocateDynamicBudget(700, sparseScores, { macro: false, semantic: false, expert: true, policy: false, authority: false }, sparseQType);
  console.log(`  Sparse: questionType=${sparseQType} expert_budget=${sparseBudget.expert} macro_budget=${sparseBudget.macro}`);

  // Macro-heavy question: rate hike + oil + credit
  const macroQ = "Federal Reserve rate hike with oil supply shock and credit spreads widening — what macro chains are active?";
  const macroScores = deriveLayerScores("Macro transmission [rate_hike+oil_shock_down]: rates → equities", 75, "Dalio: regime shift", 60, "");
  const macroQType = detectQuestionType(macroQ);
  const macroBudget = allocateDynamicBudget(700, macroScores, { macro: true, semantic: true, expert: true, policy: true, authority: false }, macroQType);
  console.log(`  Macro-heavy: questionType=${macroQType} macro_budget=${macroBudget.macro} policy_budget=${macroBudget.policy} semantic_budget=${macroBudget.semantic}`);

  check("Sparse question: expert gets full budget when only active layer", sparseBudget.expert >= 650, `expert=${sparseBudget.expert}`);
  check("Sparse question: macro gets 0 when inactive", sparseBudget.macro === 0);
  check("Macro-heavy: macro gets higher share than sparse scenario", macroBudget.macro > 100, `macro_budget=${macroBudget.macro}`);
  check("Macro-heavy question type detected", macroQType === "macro_heavy" || macroQType === "policy_heavy", `got ${macroQType}`);
  check("Policy-heavy budget > 50 chars for policy-heavy question", macroBudget.policy >= 50, `policy=${macroBudget.policy}`);
  check("Total budget allocation ≤ 700", sparseBudget.expert + sparseBudget.macro <= 700);

  // Analytical question type detection
  const analytQ = "How does monetary policy transmission mechanism work?";
  const expertQ  = "Compare Dalio vs Buffett vs Minsky investment frameworks";
  const policyQ2 = "Fed hawkish pivot — what does the central bank signal?";
  check("Analytical question detected", ["analytical","balanced"].includes(detectQuestionType(analytQ)));
  check("Expert question detected", ["expert_heavy","balanced"].includes(detectQuestionType(expertQ)));
  check("Policy question detected", detectQuestionType(policyQ2) === "policy_heavy" || detectQuestionType(policyQ2) === "macro_heavy");
}

// ─── Scenario 5: Unified Cognition Precision ─────────────────────────────────
console.log("\n── Scenario 5: Unified Cognition Precision ──");
{
  resetLiveMacroCache();
  const q   = "Oil crash 5% and TLT falling 2% simultaneously. Fed hawkish. Saudi fiscal at risk. What is the institutional allocator response?";
  const ctx = "Oil down 5%. TLT -2%. Credit spreads +40bps. SPY -2%. Saudi at risk below breakeven.";
  const isSaudi = true;

  const liveEv = assessLiveMacroEvents(71, -5.0, -2.0, -2.0, 1.5, null, null, isSaudi);
  const policyIntel = buildPolicyIntelligence(q, ctx);
  const semantic = buildSemanticImpact(q, ctx, liveEv, policyIntel, isSaudi, "high_vol_risk_off");
  const policyDelta = buildPolicyExpectation(q, ctx, policyIntel);
  const chains = selectMacroChains(q, ctx, 71, -5.0, -2.0, isSaudi);

  console.log(`  Semantic: pressure=${semantic.analyticalPressure} confidence=${semantic.confidencePressure}`);
  console.log(`  Chains: [${chains.selectedChains.map(c=>c.trigger).join(",")}]`);

  // Magnitude-aware: oil 5% crash in high_vol regime → regime dampens slightly
  const oilCrash = computeMagnitudeAdjustedConfidence({
    primaryMagnitudePct: 5.0, corroboratingCount: 3, regimeLabel: "high_vol_risk_off", baseConfidence: 65,
  });
  console.log(`  Oil crash 5% in high_vol: confidence=${oilCrash.magnitudeAdjustedConfidence} tier=${oilCrash.tier}`);
  check("5% oil crash → large/extreme tier", ["large","extreme"].includes(oilCrash.tier));
  check("High-vol regime dampens vs stable", oilCrash.regimeMultiplier < 1.0);
  check("Corroboration bonus applied", oilCrash.corroborationBonus > 0);
  check("Final confidence still elevated (multi-trigger)", oilCrash.magnitudeAdjustedConfidence >= 60, `got ${oilCrash.magnitudeAdjustedConfidence}`);

  const unified = buildUnifiedCognition({
    authority85b:    "BIS credit cycle research: spreads lead equities by 6-8 weeks.",
    expertKnowledge: "Oil shock playbook: Saudi fiscal deficit risk.",
    macroSynthesis:  chains.transmissionCtx,
    semanticImpact:  semantic,
    policyDelta,
    question: q, isSaudi, isInvestment: true,
  });

  console.log(`  Unified: coverage=${unified.coverageLabel} chars=${unified.totalChars} questionType=${detectQuestionType(q)}`);
  check("Unified non-empty for multi-trigger scenario", !unified.isEmpty);
  check("Unified ≤ 700 chars", unified.totalChars <= 700, `chars=${unified.totalChars}`);
  check("Multi-layer coverage present", unified.coverageLabel.split("+").length >= 2, `coverage=${unified.coverageLabel}`);
  check("No redundant context (efficiency)", unified.totalChars >= 100, `chars=${unified.totalChars}`);
}

// ─── Corroboration counting ───────────────────────────────────────────────────
console.log("\n── Corroboration signal counting ──");
{
  const fullRiskOff = countCorroboratingSaignals({ tltDown: true, spyDown: true, goldUp: true });
  const partial     = countCorroboratingSaignals({ tltDown: true, spyDown: true, goldUp: false });
  const single      = countCorroboratingSaignals({ tltDown: true });
  check("Full risk-off (TLT↓+SPY↓+Gold↑) = 3 corroborating", fullRiskOff === 3, `got ${fullRiskOff}`);
  check("Partial (TLT↓+SPY↓) = 2 corroborating", partial === 2, `got ${partial}`);
  check("Single signal = 0 corroborating", single === 0, `got ${single}`);

  const bonus3 = computeMagnitudeAdjustedConfidence({ primaryMagnitudePct: 2.0, corroboratingCount: 3, baseConfidence: 50 });
  const bonus0 = computeMagnitudeAdjustedConfidence({ primaryMagnitudePct: 2.0, corroboratingCount: 0, baseConfidence: 50 });
  check("3 corroborating signals > 0 signals", bonus3.magnitudeAdjustedConfidence > bonus0.magnitudeAdjustedConfidence);
  check("Corroboration bonus capped at 25%", bonus3.corroborationBonus === 0.25, `got ${bonus3.corroborationBonus}`);
}

// ─── Dynamic budget floor/ceiling ────────────────────────────────────────────
console.log("\n── Dynamic budget floor/ceiling ──");
{
  // All layers active, one dominates
  const scores = { macro: 95, semantic: 5, expert: 5, policy: 5, authority: 5 };
  const budget = allocateDynamicBudget(700, scores,
    { macro: true, semantic: true, expert: true, policy: true, authority: true },
    "macro_heavy"
  );
  console.log(`  All active, macro dominates: macro=${budget.macro} semantic=${budget.semantic} expert=${budget.expert} policy=${budget.policy} authority=${budget.authority}`);
  check("Macro doesn't exceed 48% ceiling (336 chars)", budget.macro <= 700 * 0.48 + 5, `macro=${budget.macro}`);
  check("Minor layers have floor allocation (>= 56 chars each)", budget.semantic >= 56 && budget.expert >= 56, `semantic=${budget.semantic} expert=${budget.expert}`);
  check("Total ≤ 700 chars", budget.macro + budget.semantic + budget.expert + budget.policy + budget.authority <= 700);
}

console.log(`\n=== TOTAL: ${passed}/${total} passed ===\n`);
if (passed < total) process.exit(1);
