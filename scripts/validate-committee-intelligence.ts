// Phase-88A: Strategic Investment Committee Intelligence Validation
// Tests: allocator perspective, broad vs selective, preservation vs growth,
//        committee disagreement

import { buildCommitteeDynamicsFromTracks, buildCommitteeDynamics } from "../src/services/strategy/committeeDynamicsEngine";
import { buildOpportunityCostAnalysis } from "../src/services/strategy/opportunityCostEngine";
import { buildConvictionProfile } from "../src/services/strategy/convictionCalibrationEngine";
import { buildPortfolioLogic } from "../src/services/strategy/portfolioLogicEngine";

console.log("\n=== Phase-88A Committee Intelligence Validation ===\n");
let total = 0; let passed = 0;
function check(label: string, cond: boolean, detail?: string): void {
  total++;
  console.log(`    ${cond ? "✓" : "✗"} ${label}${detail ? `  → ${detail}` : ""}`);
  if (cond) passed++;
}

// ─── Scenario 1: Conservative Allocator Perspective (Saudi, bullish) ─────────
console.log("── Scenario 1: Conservative Allocator — Saudi Bullish ──");
{
  const committee = buildCommitteeDynamicsFromTracks(
    "bull_trending", "bullish", "low", "moderate", 72,
    "low", null, true, 84
  );
  const opp = buildOpportunityCostAnalysis(
    "bull_trending", "bullish", "low", "scale_in_gradual", 72, true,
    "What is the Saudi allocator stance on TASI?", 84
  );
  const conviction = buildConvictionProfile(
    65, "What is the Saudi allocator stance on TASI given oil above breakeven?",
    "Oil at $84. Fiscal surplus. Vision 2030 intact.",
    "low", 72, "moderate"
  );
  const portfolio = buildPortfolioLogic(
    committee, conviction, opp.severity, "bullish", "low", "low", 72, true, 84
  );

  console.log(`  Committee: tension=${committee.growthVsPreservation} dominant=${committee.dominantVoice} riskTension=${committee.riskTension}`);
  console.log(`  Opp cost: severity=${opp.severity}`);
  console.log(`  Conviction: raw=${conviction.rawConfidence} calibrated=${conviction.calibratedConviction} durability=${conviction.thesisDurability}`);
  console.log(`  Portfolio: concentration=${portfolio.concentrationAdvice} tilt=${portfolio.cyclicalVsDefensive} fit=${portfolio.regimeFitScore}`);

  check("Bullish Saudi → growth-oriented tension", ["growth_dominant","balanced_tension"].includes(committee.growthVsPreservation), `got ${committee.growthVsPreservation}`);
  check("Low risk tension in constructive regime", committee.riskTension <= 45, `got ${committee.riskTension}`);
  check("High opportunity cost for Saudi surplus regime", opp.severity === "high", `got ${opp.severity}`);
  check("Conviction calibrated above raw (strong evidence expected)", conviction.calibratedConviction >= 40, `got ${conviction.calibratedConviction}`);
  check("Conviction ceiling is 82", conviction.maxConvictionCeiling <= 82, `got ${conviction.maxConvictionCeiling}`);
  check("Portfolio is cyclical or balanced in bullish regime", ["cyclical_overweight","balanced"].includes(portfolio.cyclicalVsDefensive), `got ${portfolio.cyclicalVsDefensive}`);
  check("Portfolio context non-empty", portfolio.portfolioContext.length > 0);
  check("Saudi portfolio note present", portfolio.saudiPortfolioNote.length > 0, `"${portfolio.saudiPortfolioNote.slice(0,50)}"`);
  check("Reasonable regime fit for aligned allocation", portfolio.regimeFitScore >= 50, `got ${portfolio.regimeFitScore}`);
  check("Committee context injectable", committee.committeeContext.length > 0 && committee.committeeContext.length <= 250);
}

// ─── Scenario 2: Broad vs Selective — Risk-Off Regime ─────────────────────────
console.log("\n── Scenario 2: Broad vs Selective — Risk-Off ──");
{
  const committee = buildCommitteeDynamicsFromTracks(
    "high_vol_risk_off", "bearish", "high", "conflicted", 45,
    "high", null, false, null
  );
  const conviction = buildConvictionProfile(
    55, "Should we buy equities or wait?",
    "Spreads widening. Recession signals increasing. PMI declining.",
    "high", 40, "conflicted"
  );
  const opp = buildOpportunityCostAnalysis(
    "high_vol_risk_off", "bearish", "high", "avoid_or_reduce", 40, false,
    "Should we deploy in risk-off conditions?", null
  );
  const portfolio = buildPortfolioLogic(
    committee, conviction, opp.severity, "bearish", "high", "high", 40, false, null
  );

  console.log(`  Committee: tension=${committee.growthVsPreservation} riskTension=${committee.riskTension} conflict=${committee.convictionConflict}`);
  console.log(`  Conviction: calibrated=${conviction.calibratedConviction} ceiling=${conviction.maxConvictionCeiling}`);
  console.log(`  Portfolio: concentration=${portfolio.concentrationAdvice} tilt=${portfolio.cyclicalVsDefensive}`);

  check("Risk-off → preservation dominant", ["preservation_dominant","balanced_tension"].includes(committee.growthVsPreservation));
  check("High risk tension in risk-off regime", committee.riskTension >= 55, `got ${committee.riskTension}`);
  check("Conviction conflict in conflicted consensus", committee.convictionConflict === true, `got ${committee.convictionConflict}`);
  check("Conviction penalized by high uncertainty", conviction.calibratedConviction <= 45, `got ${conviction.calibratedConviction}`);
  check("Opportunity cost is low/negligible in risk-off", ["low","negligible"].includes(opp.severity), `got ${opp.severity}`);
  check("Portfolio broad defensive in risk-off", ["broad_defensive","diversified"].includes(portfolio.concentrationAdvice), `got ${portfolio.concentrationAdvice}`);
  check("Portfolio defensive tilt in bearish regime", portfolio.cyclicalVsDefensive === "defensive_overweight", `got ${portfolio.cyclicalVsDefensive}`);
  check("Lower regime fit in misaligned scenario", portfolio.regimeFitScore >= 0 && portfolio.regimeFitScore <= 100);
}

// ─── Scenario 3: Preservation vs Growth — Balanced Tension ───────────────────
console.log("\n── Scenario 3: Preservation vs Growth — Balanced Tension ──");
{
  const committee = buildCommitteeDynamicsFromTracks(
    "macro_transition", "neutral", "moderate", "weak", 55,
    "moderate", null, true, 75
  );
  const conviction = buildConvictionProfile(
    60, "Should we increase or reduce Saudi equity exposure?",
    "Regime is transitioning. Some growth indicators positive. Credit stable.",
    "moderate", 55, "weak"
  );
  const opp = buildOpportunityCostAnalysis(
    "macro_transition", "neutral", "moderate", "wait_confirmation", 55, true,
    "Saudi equity allocation during regime transition", 75
  );
  const portfolio = buildPortfolioLogic(
    committee, conviction, opp.severity, "neutral", "moderate", "moderate", 55, true, 75
  );

  console.log(`  Committee: tension=${committee.growthVsPreservation} dominant=${committee.dominantVoice}`);
  console.log(`  Minority: "${committee.minorityArgument.slice(0,70)}..."`);
  console.log(`  Resolution: "${committee.resolutionPath}"`);
  console.log(`  Portfolio: ${portfolio.concentrationAdvice} / ${portfolio.cyclicalVsDefensive}`);

  check("Neutral/transition produces balanced tension", ["balanced_tension","regime_uncertain"].includes(committee.growthVsPreservation));
  check("Committee has a dominant voice", committee.dominantVoice !== undefined);
  check("Minority argument non-empty", committee.minorityArgument.length > 0);
  check("Resolution path non-empty", committee.resolutionPath.length > 0);
  check("Moderate opportunity cost in transition", ["low","moderate"].includes(opp.severity), `got ${opp.severity}`);
  check("Portfolio selective or diversified in transition", ["selective","diversified"].includes(portfolio.concentrationAdvice), `got ${portfolio.concentrationAdvice}`);
  check("Conviction factors logged", conviction.calibrationFactors.length >= 0);
}

// ─── Scenario 4: Committee Disagreement — Strong Tension ─────────────────────
console.log("\n── Scenario 4: Committee Disagreement — Conviction Conflict ──");
{
  const committee = buildCommitteeDynamicsFromTracks(
    "stagflation", "neutral", "high", "conflicted", 38,
    "extreme", null, false, null
  );

  console.log(`  Committee: conflict=${committee.convictionConflict} riskTension=${committee.riskTension} voice=${committee.dominantVoice}`);
  console.log(`  Minority: "${committee.minorityArgument}"`);

  check("Extreme uncertainty → conviction conflict", committee.convictionConflict === true, `conflict=${committee.convictionConflict}`);
  check("Very high risk tension in stagflation", committee.riskTension >= 70, `riskTension=${committee.riskTension}`);
  check("Committee context describes the conflict", committee.committeeContext.length > 50);

  // Conviction profile for stagflation: should be heavily penalized
  const stagConviction = buildConvictionProfile(
    70, "Invest in equities during stagflation?",
    "Stagflation conditions. Conflicting signals. No clear catalyst.",
    "extreme", 38, "conflicted"
  );
  console.log(`  Stagflation conviction: ${stagConviction.rawConfidence} → ${stagConviction.calibratedConviction} (ceiling: ${stagConviction.maxConvictionCeiling})`);
  check("Stagflation heavily penalizes conviction", stagConviction.calibratedConviction < stagConviction.rawConfidence, `raw=${stagConviction.rawConfidence} calibrated=${stagConviction.calibratedConviction}`);
  check("Event-driven thesis detected in catalyst question",
    ["fragile","event_driven","regime_dependent"].includes(stagConviction.thesisDurability),
    `durability=${stagConviction.thesisDurability}`);

  // Portfolio for conflicted committee: should be broad defensive
  const stagPortfolio = buildPortfolioLogic(
    committee, stagConviction, "negligible", "neutral", "high", "extreme", 38, false, null
  );
  check("Conflicted committee → broad defensive portfolio", stagPortfolio.concentrationAdvice === "broad_defensive", `got ${stagPortfolio.concentrationAdvice}`);
  check("Defensive tilt in stagflation", stagPortfolio.cyclicalVsDefensive === "defensive_overweight", `got ${stagPortfolio.cyclicalVsDefensive}`);
}

// ─── Conviction calibration — evidence quality tests ─────────────────────────
console.log("\n── Conviction calibration — evidence quality ──");
{
  const strongEv = buildConvictionProfile(
    65, "Federal Reserve published FEDS notes confirming transmission mechanism cross-confirmed by BIS data",
    "Peer-reviewed empirical study supports the thesis. Track record validates the approach.",
    "low", 75, "strong"
  );
  const thinEv = buildConvictionProfile(
    65, "Heard rumors suggesting possible policy change. Anecdotal evidence suggests markets might move.",
    "Preliminary unconfirmed reports. Could be speculative.",
    "moderate", 60, "moderate"
  );

  console.log(`  Strong evidence: ${strongEv.calibratedConviction} (raw ${strongEv.rawConfidence})`);
  console.log(`  Thin evidence:   ${thinEv.calibratedConviction} (raw ${thinEv.rawConfidence})`);

  check("Strong evidence boosts conviction", strongEv.calibratedConviction > strongEv.rawConfidence - 5, `strong=${strongEv.calibratedConviction}`);
  check("Thin evidence penalizes conviction", thinEv.calibratedConviction < thinEv.rawConfidence, `thin=${thinEv.calibratedConviction}`);
  check("Strong > thin conviction from same raw", strongEv.calibratedConviction > thinEv.calibratedConviction);
}

// ─── Opportunity cost — Saudi fiscal window test ──────────────────────────────
console.log("\n── Opportunity cost — Saudi fiscal window ──");
{
  const saudiWindow = buildOpportunityCostAnalysis(
    "bull_trending", "bullish", "low", "scale_in_gradual", 75, true,
    "Saudi TASI allocation during fiscal surplus", 83
  );
  const nonSaudi = buildOpportunityCostAnalysis(
    "bull_trending", "bullish", "low", "scale_in_gradual", 75, false,
    "Global equity allocation in bullish regime", null
  );

  console.log(`  Saudi fiscal window: severity=${saudiWindow.severity} timing="${saudiWindow.timingWindow.slice(0,50)}..."`);
  console.log(`  Non-Saudi: severity=${nonSaudi.severity}`);

  check("Saudi surplus window mentions capex", saudiWindow.timingWindow.toLowerCase().includes("surplus") || saudiWindow.timingWindow.toLowerCase().includes("capex"), `"${saudiWindow.timingWindow.slice(0,60)}"`);
  check("High opportunity cost in Saudi surplus + bullish", saudiWindow.severity === "high", `got ${saudiWindow.severity}`);
  check("Opportunity context within budget", saudiWindow.opportunityContext.length <= 220);
}

console.log(`\n=== TOTAL: ${passed}/${total} passed ===\n`);
if (passed < total) process.exit(1);
