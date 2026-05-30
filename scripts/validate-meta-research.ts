// Phase-88C: Meta-Research + Thesis Competition Intelligence Validation
// Validates: thesis competition, red-team reasoning, bias detection,
//            research stress test, meta-research governor

import { buildThesisCompetition }  from "../src/services/meta/thesisCompetitionEngine";
import { buildRedTeamReasoning }    from "../src/services/meta/redTeamReasoningEngine";
import { detectBias }               from "../src/services/meta/biasDetectionGovernor";
import { stressTestResearch }       from "../src/services/meta/researchStressTestEngine";
import { governMetaResearch }       from "../src/services/meta/metaResearchGovernor";

console.log("\n=== Phase-88C Meta-Research + Thesis Competition Validation ===\n");

let total = 0; let passed = 0;
function check(label: string, cond: boolean, detail?: string): void {
  total++;
  console.log(`    ${cond ? "✓" : "✗"} ${label}${detail ? `  → ${detail}` : ""}`);
  if (cond) passed++;
}

// ─── Scenario 1: Bull vs Bear Competition (bullish bias, bull_trending) ───────
console.log("── Scenario 1: Bull vs Bear Competition (bull_trending, bullish) ──");
{
  const comp = buildThesisCompetition({
    regime: "bull_trending", macroBias: "bullish",
    creditStressLevel: "low", consensusStrength: "strong", isSaudi: false,
  });
  console.log(`  BULL(w=${comp.bull.weight}) BASE(w=${comp.base.weight}) BEAR(w=${comp.bear.weight}) dominant=${comp.dominant} contest=${comp.contestLevel}`);
  check("Bull dominant in bull_trending+bullish",     comp.dominant === "bull",     `dominant=${comp.dominant}`);
  check("Bull weight > bear weight by ≥20",           comp.bull.weight - comp.bear.weight >= 20, `spread=${comp.bull.weight - comp.bear.weight}`);
  check("Competition context ≤200 chars",             comp.competitionCtx.length <= 200, `len=${comp.competitionCtx.length}`);
  check("Dominant label in context",                  comp.competitionCtx.includes("bull"), `ctx="${comp.competitionCtx.slice(0,60)}"`);
  check("All three theses have coreAssertion",        [comp.bull, comp.base, comp.bear].every(t => t.coreAssertion.length > 5));
  check("All three theses have keyAssumption",        [comp.bull, comp.base, comp.bear].every(t => t.keyAssumption.length > 5));
  check("All three theses have weakPoint",            [comp.bull, comp.base, comp.bear].every(t => t.weakPoint.length > 5));

  // Bearish + bear_ranging → bear dominant
  const bearComp = buildThesisCompetition({
    regime: "bear_ranging", macroBias: "bearish",
    creditStressLevel: "high", consensusStrength: "moderate", isSaudi: false,
  });
  console.log(`  Bear scenario: dominant=${bearComp.dominant} BEAR(w=${bearComp.bear.weight})`);
  check("Bear dominant in bear_ranging+bearish+high credit", bearComp.dominant === "bear", `dominant=${bearComp.dominant}`);
  check("High credit stress suppresses bull weight", bearComp.bull.weight <= 30, `bull=${bearComp.bull.weight}`);

  // Conflicted consensus → compressed weights (heavily contested)
  const conflictComp = buildThesisCompetition({
    regime: "macro_transition", macroBias: "neutral",
    creditStressLevel: "moderate", consensusStrength: "conflicted", isSaudi: false,
  });
  check("Conflicted consensus → heavily or moderately contested", ["heavily_contested","moderately_contested"].includes(conflictComp.contestLevel), `contest=${conflictComp.contestLevel}`);
}

// ─── Scenario 2: Conflicting Evidence (Saudi, oil below breakeven) ────────────
console.log("\n── Scenario 2: Conflicting Evidence (Saudi, oil=$68, bear) ──");
{
  const saudiComp = buildThesisCompetition({
    regime: "bear_ranging", macroBias: "bearish",
    creditStressLevel: "moderate", consensusStrength: "moderate",
    isSaudi: true, oilPrice: 68,
  });
  console.log(`  Saudi BULL(w=${saudiComp.bull.weight}) BASE(w=${saudiComp.base.weight}) BEAR(w=${saudiComp.bear.weight})`);
  check("Saudi bear weight elevated at oil=$68",     saudiComp.bear.weight >= 50, `bear=${saudiComp.bear.weight}`);
  check("Saudi bull thesis mentions fiscal/oil",      /fiscal|oil|tasi/i.test(saudiComp.bull.coreAssertion + saudiComp.bull.evidenceBasis));

  const saudiRed = buildRedTeamReasoning({
    dominantThesis:    saudiComp.dominant,
    contestLevel:      saudiComp.contestLevel,
    creditStressLevel: "moderate",
    consensusStrength: "moderate",
    isSaudi:           true,
  });
  console.log(`  Saudi red-team: vector=${saudiRed.primaryAttack.vector} severity=${saudiRed.primaryAttack.severity}`);
  check("Saudi red-team attack present",              saudiRed.primaryAttack !== undefined);
  check("Saudi red-team context ≤200 chars",          saudiRed.redTeamCtx.length <= 200);
  check("Saudi red-team mentions oil/fiscal/pif",     /oil|fiscal|pif|sama|breakeven/i.test(saudiRed.primaryAttack.counterArg + saudiRed.primaryAttack.target));
  check("How-to-defend is non-empty",                 saudiRed.primaryAttack.howToDefend.length > 5);
}

// ─── Scenario 3: Weak Thesis Invalidation (fragile + critical stress) ────────
console.log("\n── Scenario 3: Weak Thesis + Critical Stress Test ──");
{
  const q   = "I heard oil prices might drop. There could be a recession. It's possibly going to get worse.";
  const ctx = "Rumours of Fed emergency cut. Speculation about Chinese demand. Unclear signals everywhere.";

  const stress = stressTestResearch({ question: q, ctx, creditStressLevel: "extreme" });
  console.log(`  Stress: evidence=${stress.evidenceResilience.score} assumption=${stress.assumptionFragility.score} proximity=${stress.invalidationProximity.score} composite=${stress.compositeFragility} level=${stress.fragilityLevel}`);
  check("Thin evidence detected (speculation/rumour keywords)", stress.evidenceResilience.score >= 60, `score=${stress.evidenceResilience.score}`);
  check("Composite fragility elevated for thin evidence",       stress.compositeFragility >= 45, `composite=${stress.compositeFragility}`);
  check("FragilityLevel is fragile or critical",                ["fragile","critical"].includes(stress.fragilityLevel), `level=${stress.fragilityLevel}`);
  check("Repair directive non-null for fragile/critical",       stress.repairDirective !== null, `repair="${stress.repairDirective?.slice(0,40)}"`);
  check("Stress context ≤180 chars",                            stress.stressTestCtx.length <= 180);

  // Strong evidence → robust
  const qStrong = "CPI confirmed at 2.8%. Fed statement: preparing to cut 25bps. Unemployment at 4.5%, quarterly data confirmed.";
  const stressStrong = stressTestResearch({ question: qStrong, ctx: "Confirmed by BLS. Fed minutes published.", creditStressLevel: "low" });
  check("Strong evidence → low fragility score",  stressStrong.evidenceResilience.score <= 40, `score=${stressStrong.evidenceResilience.score}`);
}

// ─── Scenario 4: Bias Detection ───────────────────────────────────────────────
console.log("\n── Scenario 4: Bias Detection ──");
{
  // Confirmation bias
  const confQ = "This confirms my view that rates will rise. As I expected, the market is moving exactly as I predicted.";
  const confResult = detectBias({ question: confQ, ctx: "" });
  console.log(`  Confirmation bias: flags=[${confResult.flags.map(f=>f.bias).join(",")}] score=${confResult.totalBiasScore}`);
  check("Confirmation bias detected",        confResult.flags.some(f => f.bias === "confirmation_bias"), `flags=[${confResult.flags.map(f=>f.bias)}]`);
  check("Bias score > 0",                    confResult.totalBiasScore > 0, `score=${confResult.totalBiasScore}`);
  check("Bias is not clean",                 !confResult.isClean, `clean=${confResult.isClean}`);
  check("Bias context ≤160 chars",           confResult.biasCtx.length <= 160);
  check("Correction directive is non-empty", confResult.flags[0]?.correction.length ?? 0 > 5);

  // Overconfidence
  const overcQ = "The market will definitely rally. There is no doubt this is a bull market.";
  const overcResult = detectBias({ question: overcQ, ctx: "" });
  check("Overconfidence detected",           overcResult.flags.some(f => f.bias === "overconfidence"), `flags=[${overcResult.flags.map(f=>f.bias)}]`);
  check("Overconfidence is strong severity", overcResult.flags.find(f => f.bias === "overconfidence")?.severity === "strong");

  // Clean text
  const cleanQ = "How does the Fed rate decision affect TASI through the SAMA peg?";
  const cleanResult = detectBias({ question: cleanQ, ctx: "" });
  check("Clean question passes bias check",  cleanResult.isClean, `flags=[${cleanResult.flags.map(f=>f.bias).join(",")||"none"}]`);
  check("Clean score is low",                cleanResult.totalBiasScore < 25, `score=${cleanResult.totalBiasScore}`);
}

// ─── Scenario 5: Institutional Disagreement + Full Governor ──────────────────
console.log("\n── Scenario 5: Institutional Disagreement + Meta-Research Governor ──");
{
  const comp = buildThesisCompetition({
    regime: "macro_transition", macroBias: "neutral",
    creditStressLevel: "high", consensusStrength: "conflicted", isSaudi: false,
  });
  const redTeam = buildRedTeamReasoning({
    dominantThesis:    comp.dominant,
    contestLevel:      comp.contestLevel,
    creditStressLevel: "high",
    consensusStrength: "conflicted",
    isSaudi:           false,
  });
  const bias = detectBias({
    question: "Given that credit spreads are widening and the recession is clearly starting...",
    ctx:      "Credit stress is obvious. The bear thesis is certain to play out.",
  });
  const stress = stressTestResearch({
    question: "Given credit stress is obvious, what happens next?",
    ctx:      "Spreads are widening. If recession, if credit crunch, assuming defaults rise.",
    creditStressLevel: "high",
  });

  console.log(`  Governor inputs: competition=${comp.contestLevel} redTeam.vuln=${redTeam.vulnerabilityScore} bias.score=${bias.totalBiasScore} stress.level=${stress.fragilityLevel}`);
  const gov = governMetaResearch({ competition: comp, redTeam, bias, stress, lang: "en" });
  console.log(`  Governor: approved=${gov.approved} quality=${gov.qualityScore} repairs=[${gov.repairs.join(",")||"none"}]`);

  check("Governor quality score ≥ 40",                gov.qualityScore >= 40, `quality=${gov.qualityScore}`);
  check("Governed meta context ≤480 chars",           gov.governedMetaCtx.length <= 480, `len=${gov.governedMetaCtx.length}`);
  check("Context includes thesis competition",         gov.governedMetaCtx.includes("DOMINANT") || gov.governedMetaCtx.includes("bull") || gov.governedMetaCtx.includes("bear") || gov.governedMetaCtx.includes("base"));
  check("Context includes red-team signal",            gov.governedMetaCtx.toLowerCase().includes("red-team") || gov.governedMetaCtx.toLowerCase().includes("counter") || gov.governedMetaCtx.toLowerCase().includes("attack"));
  check("Bias flagged in context when strong bias",    !bias.isClean ? gov.governedMetaCtx.toLowerCase().includes("bias") : true);
  check("Stress finding in context",                   gov.governedMetaCtx.toLowerCase().includes("stress"));
  check("Meta disclaimer present",                     gov.metaDisclaimer.length > 10, `disclaimer="${gov.metaDisclaimer.slice(0,45)}"`);
  check("Governance log present",                      gov.governanceLog.length > 5);

  // Arabic disclaimer check
  const govAr = governMetaResearch({ competition: comp, redTeam, bias, stress, lang: "ar" });
  check("Arabic meta disclaimer is Arabic",            /[؀-ۿ]/.test(govAr.metaDisclaimer));
}

console.log(`\n=== TOTAL: ${passed}/${total} passed ===\n`);
if (passed < total) process.exit(1);
