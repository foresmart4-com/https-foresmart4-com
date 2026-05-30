// Phase-88B: Economic Foresight + Scenario Intelligence Validation
// Validates: scenario competition, second-order chains, regime transition,
//            path dependency, governor quality gate

import { buildScenarioCompetition } from "../src/services/foresight/scenarioCompetitionEngine";
import { buildSecondOrderEffects }   from "../src/services/foresight/secondOrderEffectEngine";
import { buildTransitionForesight }  from "../src/services/foresight/regimeTransitionForesight";
import { buildPathDependency }       from "../src/services/foresight/pathDependencyEngine";
import { governScenarios }           from "../src/services/foresight/scenarioGovernor";

console.log("\n=== Phase-88B Economic Foresight + Scenario Intelligence Validation ===\n");

let total = 0; let passed = 0;
function check(label: string, cond: boolean, detail?: string): void {
  total++;
  console.log(`    ${cond ? "✓" : "✗"} ${label}${detail ? `  → ${detail}` : ""}`);
  if (cond) passed++;
}

// ─── Scenario 1: Inflation Shock ─────────────────────────────────────────────
console.log("── Scenario 1: Inflation Shock (rate_shock_up + inflation_surprise_up) ──");
{
  const q   = "CPI came in at 4.8%, well above expectations. The Fed is likely to hike aggressively. How does this transmission work?";
  const ctx = "Inflation surprise upside. Fed hawkish surprise. Rate shock up. Credit spreads beginning to widen.";

  const scenComp = buildScenarioCompetition({
    regime:            "high_vol_risk_off",
    macroBias:         "bearish",
    creditStressLevel: "high",
    isSaudi:           false,
  });
  console.log(`  Scenarios: BULL=${scenComp.bull.probability}% BASE=${scenComp.base.probability}% BEAR=${scenComp.bear.probability}% sum=${scenComp.probabilitySum}`);
  check("Probability sum ~100",             Math.abs(scenComp.probabilitySum - 100) <= 3, `sum=${scenComp.probabilitySum}`);
  check("Bear scenario dominant in risk-off+bearish", scenComp.dominantScenario === "bear", `dominant=${scenComp.dominantScenario}`);
  check("Bear probability > bull probability",  scenComp.bear.probability > scenComp.bull.probability);
  check("Foresight context includes BASE/BULL/BEAR", /BASE\(.*\).*BULL\(.*\).*BEAR\(.*\)/.test(scenComp.foresightContext), `ctx="${scenComp.foresightContext.slice(0,60)}"`);
  check("Foresight context ≤220 chars",     scenComp.foresightContext.length <= 220, `len=${scenComp.foresightContext.length}`);

  const soChain = buildSecondOrderEffects({
    question: q, ctx, primaryRegime: "high_vol_risk_off", macroBias: "bearish",
    creditStressLevel: "high", isSaudi: false,
  });
  console.log(`  2nd-order trigger=${soChain.trigger} amplifying=${soChain.amplificationRisk}`);
  check("Rate shock up or inflation detected as trigger", ["rate_shock_up","inflation_surprise_up"].includes(soChain.trigger), `trigger=${soChain.trigger}`);
  check("Amplification risk true for rate/inflation shock", soChain.amplificationRisk);
  check("Chain context contains arrow notation",          /→/.test(soChain.chainContext), `ctx="${soChain.chainContext.slice(0,60)}"`);
  check("Chain context ≤220 chars",                       soChain.chainContext.length <= 220);
  check("Second-order goes beyond direct (spread/capex/earnings)", /spread|capex|earn|fund|credit/.test(soChain.chainContext.toLowerCase()));
}

// ─── Scenario 2: Oil Regime Shift ────────────────────────────────────────────
console.log("\n── Scenario 2: Oil Regime Shift (Saudi fiscal channel) ──");
{
  const q   = "Oil has fallen below $68 for the past 2 months. How does this affect Saudi Arabia and TASI?";
  const ctx = "Brent below $70 for 6 weeks. Saudi budget breakeven ~$75. SAMA rate unchanged.";

  const scenSaudi = buildScenarioCompetition({
    regime:            "bear_ranging",
    macroBias:         "bearish",
    creditStressLevel: "moderate",
    isSaudi:           true,
    oilPrice:          68,
  });
  console.log(`  Saudi scenarios: BULL=${scenSaudi.bull.probability}% BASE=${scenSaudi.base.probability}% BEAR=${scenSaudi.bear.probability}%`);
  check("Saudi oil below $75 → bear scenario elevated", scenSaudi.bear.probability >= 40, `bear=${scenSaudi.bear.probability}`);
  check("Saudi bull scenario suppressed (oil < $75)",  scenSaudi.bull.probability <= 25, `bull=${scenSaudi.bull.probability}`);
  check("Probability sum valid",                        Math.abs(scenSaudi.probabilitySum - 100) <= 3);

  const soSaudi = buildSecondOrderEffects({
    question: q, ctx, primaryRegime: "bear_ranging", macroBias: "bearish",
    creditStressLevel: "moderate", isSaudi: true,
  });
  console.log(`  Saudi 2nd-order: trigger=${soSaudi.trigger} saudiSpecific="${soSaudi.saudiSpecific?.slice(0,50)}"`);
  check("Oil shock negative detected",         soSaudi.trigger === "oil_shock_negative", `trigger=${soSaudi.trigger}`);
  check("Saudi-specific supplement present",   soSaudi.saudiSpecific !== null && (soSaudi.saudiSpecific?.length ?? 0) > 10, `saudiNote="${soSaudi.saudiSpecific?.slice(0,40)}"`);
  check("Saudi chain mentions bank/fiscal/real estate", /bank|fiscal|real.estate|nim|credit|aramco/i.test(soSaudi.chainContext));

  const path = buildPathDependency({
    question: q, ctx: "oil below breakeven for months, fiscal pressure entrenched",
    creditStressLevel: "moderate", isSaudi: true,
  });
  console.log(`  Path: dominant=${path.dominantPath?.id} persistence=${path.dominantPath?.persistence} nonLinear=${path.dominantPath?.nonLinearRisk}`);
  check("Oil_below_breakeven path detected for Saudi", path.activeConditions.some(c => c.id === "oil_below_breakeven"), `conditions=[${path.activeConditions.map(c=>c.id).join(",")}]`);
  check("Fiduciary warning set for non-linear risk",  path.fiduciaryWarning !== null);
}

// ─── Scenario 3: Policy Pivot ─────────────────────────────────────────────────
console.log("\n── Scenario 3: Policy Pivot (macro_transition → easing) ──");
{
  const q   = "Inflation has fallen to 2.8% and unemployment is rising. Is the Fed about to pivot?";
  const ctx = "CPI at 2.8%. NFP missed. Fed meeting this week. Market pricing 2 cuts by year end.";

  const transition = buildTransitionForesight({
    primaryRegime:     "macro_transition",
    creditStressLevel: "moderate",
    regimeConf:        45,
    isSaudi:           false,
  });
  console.log(`  Transition: most→${transition.mostLikelyTransition?.to} risk=${transition.transitionRisk} p=${transition.mostLikelyTransition?.probability}%`);
  check("Most likely transition detected",             transition.mostLikelyTransition !== null);
  check("Transition context non-empty",                transition.transitionContext.length > 20, `len=${transition.transitionContext.length}`);
  check("Transition context ≤200 chars",               transition.transitionContext.length <= 200);
  check("Institutional watch non-empty",               transition.institutionalWatch.length > 5);
  check("Policy pivot path to easing_cycle present",  transition.mostLikelyTransition?.to === "easing_cycle" || transition.mostLikelyTransition !== null);

  const soPolicy = buildSecondOrderEffects({
    question: q, ctx: "Fed cuts rate. Rate shock down. Dovish pivot. Rate reduction.",
    primaryRegime: "macro_transition", macroBias: "bullish",
    creditStressLevel: "low", isSaudi: false,
  });
  check("Rate cut/pivot detected as trigger",   soPolicy.trigger === "rate_shock_down", `trigger=${soPolicy.trigger}`);
  check("Pivot chain is non-amplifying (easing stabilises)", !soPolicy.amplificationRisk, `amplifying=${soPolicy.amplificationRisk}`);
}

// ─── Scenario 4: Growth Slowdown ──────────────────────────────────────────────
console.log("\n── Scenario 4: Growth Slowdown (bear_ranging + path dependency) ──");
{
  const q   = "GDP has missed for 2 consecutive quarters and earnings revisions are negative. How entrenched is the slowdown?";
  const ctx = "GDP -0.3% Q1, -0.5% Q2. Earnings revisions -8%. Credit spreads widening for weeks. Growth disappointing.";

  const path = buildPathDependency({
    question: q, ctx, creditStressLevel: "moderate", isSaudi: false,
  });
  console.log(`  Path conditions: [${path.activeConditions.map(c=>c.id).join(",")}]`);
  console.log(`  Dominant: ${path.dominantPath?.id} persistence=${path.dominantPath?.persistence} reversal=${path.reversalSensitivity}`);
  check("Growth slowdown condition detected",     path.activeConditions.some(c => c.id === "growth_slowdown"), `conditions=[${path.activeConditions.map(c=>c.id)}]`);
  check("Credit spread widening detected",        path.activeConditions.some(c => c.id === "credit_spread_widening"), `conditions=[${path.activeConditions.map(c=>c.id)}]`);
  check("Reversal sensitivity elevated",          ["high","moderate"].includes(path.reversalSensitivity), `sensitivity=${path.reversalSensitivity}`);
  check("Path context ≤200 chars",               path.pathContext.length <= 200);
  check("Fiduciary warning for non-linear spread risk", path.fiduciaryWarning !== null || path.activeConditions.every(c => !c.nonLinearRisk));

  const transSlowdown = buildTransitionForesight({
    primaryRegime:     "bear_ranging",
    creditStressLevel: "moderate",
    regimeConf:        50,
    isSaudi:           false,
  });
  check("Recovery transition path available",    transSlowdown.mostLikelyTransition !== null);
  check("Recession path also available",         transSlowdown.alternativeTransition !== null);
  check("Both paths have observable triggers",   (transSlowdown.mostLikelyTransition?.triggerCondition.length ?? 0) > 15);
}

// ─── Scenario 5: Competing Scenarios + Governor ───────────────────────────────
console.log("\n── Scenario 5: Competing Scenarios + Governance Quality Gate ──");
{
  // Macro transition with balanced competition
  const scenBalance = buildScenarioCompetition({
    regime:            "macro_transition",
    macroBias:         "neutral",
    creditStressLevel: "moderate",
    isSaudi:           false,
    isTransition:      true,
  });
  console.log(`  Competition: intensity=${scenBalance.competitionIntensity} BULL=${scenBalance.bull.probability}% BASE=${scenBalance.base.probability}% BEAR=${scenBalance.bear.probability}%`);
  check("Alternative scenario present in transition",  scenBalance.alternative !== undefined, `alt=${JSON.stringify(scenBalance.alternative?.label)}`);
  check("Competition intensity is moderate/high in transition", ["high","moderate"].includes(scenBalance.competitionIntensity), `intensity=${scenBalance.competitionIntensity}`);
  check("No single scenario >72%",                     Math.max(scenBalance.bull.probability, scenBalance.base.probability, scenBalance.bear.probability) <= 72);
  check("Bull trigger contains 'If'",                  /if /i.test(scenBalance.bull.trigger));
  check("Bear trigger contains 'If'",                  /if /i.test(scenBalance.bear.trigger));

  // Governor integration
  const so = buildSecondOrderEffects({ question: "What happens?", ctx: "Credit stress. Rate shock.",
    primaryRegime: "macro_transition", macroBias: "neutral", creditStressLevel: "moderate", isSaudi: false });
  const tr = buildTransitionForesight({ primaryRegime: "macro_transition", creditStressLevel: "moderate", regimeConf: 48, isSaudi: false });
  const pd = buildPathDependency({ question: "Tightening for months.", ctx: "Rates have been rising for months. Spread widening.", creditStressLevel: "moderate", isSaudi: false });

  const gov = governScenarios({ scenario: scenBalance, secondOrder: so, transition: tr, path: pd, lang: "en" });
  console.log(`  Governor: approved=${gov.approved} quality=${gov.qualityScore} repairs=[${gov.repairs.join(",")||"none"}]`);
  check("Governor qualityScore ≥ 55",                  gov.qualityScore >= 55, `score=${gov.qualityScore}`);
  check("Governed context ≤500 chars",                  gov.governedForesightContext.length <= 500, `len=${gov.governedForesightContext.length}`);
  check("Governed context includes scenario competition",  /BASE\(|Scenario/.test(gov.governedForesightContext));
  check("Governed context includes 2nd-order arrow chain", /→/.test(gov.governedForesightContext));
  check("Governed context includes transition path",    /Transition/.test(gov.governedForesightContext));
  check("Fiduciary disclaimer present",                 gov.fiduciaryDisclaimer.length > 10, `disclaimer="${gov.fiduciaryDisclaimer.slice(0,50)}"`);
  check("No certainty language in governed context",    !/will definitely|guaranteed|certain to|inevitable/i.test(gov.governedForesightContext));

  // Arabic lang disclaimer
  const govAr = governScenarios({ scenario: scenBalance, secondOrder: so, transition: tr, path: pd, lang: "ar" });
  check("Arabic fiduciary disclaimer is Arabic",        /[؀-ۿ]/.test(govAr.fiduciaryDisclaimer));
}

console.log(`\n=== TOTAL: ${passed}/${total} passed ===\n`);
if (passed < total) process.exit(1);
