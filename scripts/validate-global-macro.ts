// Phase-89B: Global Macro + Cross-Asset Intelligence Validation
// Validates: cross-asset transmission, global liquidity, capital flows, governor

import { buildCrossAssetTransmission } from "../src/services/global/crossAssetTransmissionEngine";
import { buildGlobalLiquidityState }   from "../src/services/global/globalLiquidityEngine";
import { buildCapitalFlowProfile }     from "../src/services/global/capitalFlowEngine";
import { governCrossAsset }            from "../src/services/global/crossAssetGovernor";

console.log("\n=== Phase-89B Global Macro + Cross-Asset Intelligence Validation ===\n");

let total = 0; let passed = 0;
function check(label: string, cond: boolean, detail?: string): void {
  total++;
  console.log(`    ${cond ? "✓" : "✗"} ${label}${detail ? `  → ${detail}` : ""}`);
  if (cond) passed++;
}

// ─── Scenario 1: DXY Shock (strong dollar, EUR/USD < 1.03) ───────────────────
console.log("── Scenario 1: DXY Shock (EUR/USD 1.01, strong dollar) ──");
{
  const transmission = buildCrossAssetTransmission({
    tltChangePct: null, oilChangePct: -2.0, oilPrice: 74,
    eurUsd: 1.01, spyChangePct: -1.5, creditStressLevel: "moderate",
    macroBias: "bearish", isSaudi: true,
  });
  console.log(`  Transmission links=${transmission.activeLinks.length} amplification=${transmission.amplificationRisk}`);
  console.log(`  Dominant: ${transmission.dominantLink?.pair ?? "none"}`);
  check("DXY→commodities link active (EUR/USD 1.01)",     transmission.activeLinks.some(l => l.pair === "dxy_to_commodities"), `pairs=[${transmission.activeLinks.map(l=>l.pair).join(",")}]`);
  check("DXY→commodities is amplifying (USD strong)",     transmission.activeLinks.find(l => l.pair === "dxy_to_commodities")?.direction === "amplifying");
  check("FX→risk_appetite link active",                   transmission.activeLinks.some(l => l.pair === "fx_to_risk_appetite"));
  check("Oil→liquidity active (oil -2%)",                 transmission.activeLinks.some(l => l.pair === "oil_to_liquidity"), `pairs=[${transmission.activeLinks.map(l=>l.pair).join(",")}]`);
  check("Transmission context ≤240 chars",                transmission.transmissionCtx.length <= 240, `len=${transmission.transmissionCtx.length}`);
  check("Context contains arrow notation",                /→/.test(transmission.transmissionCtx));

  const flows = buildCapitalFlowProfile({
    regime: "bear_ranging", macroBias: "bearish", creditStressLevel: "moderate",
    oilPrice: 74, oilChangePct: -2, eurUsd: 1.01, spyChangePct: -1.5, isSaudi: true,
  });
  check("Risk mode = risk_off for DXY shock",             flows.riskMode === "risk_off", `mode=${flows.riskMode}`);
  check("EM/DM = dm_positive (DXY strong)",               flows.emDmBias === "dm_positive", `bias=${flows.emDmBias}`);
  check("GCC = headwind (risk_off + oil < $80)",          flows.gccAllocation === "headwind", `gcc=${flows.gccAllocation}`);
  check("GCC note present for Saudi",                     flows.gccNote !== null);
}

// ─── Scenario 2: Yield Spike (TLT -2.5%, credit stress high) ─────────────────
console.log("\n── Scenario 2: Yield Spike (TLT -2.5%, high credit stress) ──");
{
  const transmission = buildCrossAssetTransmission({
    tltChangePct: -2.5, oilChangePct: -1.0, oilPrice: 78,
    eurUsd: 1.07, spyChangePct: -2.0, creditStressLevel: "high",
    macroBias: "bearish", isSaudi: false,
  });
  console.log(`  Transmission: bonds_eq=${transmission.activeLinks.find(l=>l.pair==="bonds_to_equities")?.magnitude} yields_growth=${transmission.activeLinks.find(l=>l.pair==="yields_to_growth")?.magnitude}`);
  check("bonds→equities link active (TLT -2.5%)",         transmission.activeLinks.some(l => l.pair === "bonds_to_equities"), `pairs=[${transmission.activeLinks.map(l=>l.pair)}]`);
  check("bonds→equities = strong magnitude",               transmission.activeLinks.find(l => l.pair === "bonds_to_equities")?.magnitude === "strong", `mag=${transmission.activeLinks.find(l=>l.pair==="bonds_to_equities")?.magnitude}`);
  check("yields→growth active (TLT -2.5% + high credit)", transmission.activeLinks.some(l => l.pair === "yields_to_growth"), `pairs=[${transmission.activeLinks.map(l=>l.pair)}]`);
  check("Amplification risk detected (2+ amplifying links)", transmission.amplificationRisk, `amplifying=${transmission.activeLinks.filter(l=>l.direction==="amplifying").length}`);

  const liquidity = buildGlobalLiquidityState({
    tltChangePct: -2.5, oilPrice: 78, oilChangePct: -1.0,
    eurUsd: 1.07, creditStressLevel: "high",
    ratesEnv: "Fed restrictive, tightening", macroBias: "bearish",
  });
  console.log(`  Liquidity: state=${liquidity.liquidityState} dollar=${liquidity.dollarLiquidity} funding=${liquidity.fundingConditions} stress=${liquidity.stressSignal}`);
  check("Liquidity state = tightening or stressed",        ["tightening","stressed"].includes(liquidity.liquidityState), `state=${liquidity.liquidityState}`);
  check("Funding conditions = tight (high credit stress)", liquidity.fundingConditions === "tight", `funding=${liquidity.fundingConditions}`);
  check("Stress signal = true (multiple stress indicators)", liquidity.stressSignal, `stress=${liquidity.stressSignal}`);
  check("Liquidity context ≤180 chars",                    liquidity.liquidityCtx.length <= 180);
}

// ─── Scenario 3: Oil Collapse (oil -6%, Saudi context) ───────────────────────
console.log("\n── Scenario 3: Oil Collapse (-6%, oil=$65, Saudi) ──");
{
  const transmission = buildCrossAssetTransmission({
    tltChangePct: -0.5, oilChangePct: -6.0, oilPrice: 65,
    eurUsd: 1.08, spyChangePct: -1.5, creditStressLevel: "moderate",
    macroBias: "bearish", isSaudi: true,
  });
  console.log(`  Oil→liquidity: ${transmission.activeLinks.find(l=>l.pair==="oil_to_liquidity")?.magnitude} dir=${transmission.activeLinks.find(l=>l.pair==="oil_to_liquidity")?.direction}`);
  check("Oil→liquidity active (oil -6%)",   transmission.activeLinks.some(l => l.pair === "oil_to_liquidity"), `pairs=[${transmission.activeLinks.map(l=>l.pair)}]`);
  check("Oil→liquidity = strong magnitude", transmission.activeLinks.find(l => l.pair === "oil_to_liquidity")?.magnitude === "strong", `mag=${transmission.activeLinks.find(l=>l.pair==="oil_to_liquidity")?.magnitude}`);
  check("Oil→liquidity = amplifying",       transmission.activeLinks.find(l => l.pair === "oil_to_liquidity")?.direction === "amplifying");
  check("Transmission narrative mentions petrodollar", /petrodollar/i.test(transmission.activeLinks.find(l=>l.pair==="oil_to_liquidity")?.narrative ?? ""));
  check("Saudi note in narrative",           /saudi/i.test(transmission.activeLinks.find(l=>l.pair==="oil_to_liquidity")?.narrative ?? ""));

  const liquidity = buildGlobalLiquidityState({
    tltChangePct: -0.5, oilPrice: 65, oilChangePct: -6.0,
    eurUsd: 1.08, creditStressLevel: "moderate",
    ratesEnv: "", macroBias: "bearish",
  });
  check("Petrodollar flow = draining (oil $65, -6%)", liquidity.petrodollarFlow === "draining", `petro=${liquidity.petrodollarFlow}`);
}

// ─── Scenario 4: Risk-Off Transition ──────────────────────────────────────────
console.log("\n── Scenario 4: Risk-Off Transition ──");
{
  const flows = buildCapitalFlowProfile({
    regime: "high_vol_risk_off", macroBias: "bearish",
    creditStressLevel: "extreme", oilPrice: 72, oilChangePct: -4,
    eurUsd: 1.03, spyChangePct: -3.0, isSaudi: false,
  });
  console.log(`  Flows: mode=${flows.riskMode} emDm=${flows.emDmBias} haven=${flows.safeHavenDemand} gcc=${flows.gccAllocation}`);
  check("Risk mode = risk_off",              flows.riskMode === "risk_off", `mode=${flows.riskMode}`);
  check("Safe haven = active (extreme credit + equity -3%)", flows.safeHavenDemand === "active", `haven=${flows.safeHavenDemand}`);
  check("EM/DM = dm_positive (EUR/USD 1.03)", flows.emDmBias === "dm_positive", `bias=${flows.emDmBias}`);
  check("Capital flow context ≤180 chars",   flows.flowCtx.length <= 180);
  check("Flow context contains risk_off",    /risk.off/i.test(flows.flowCtx));

  const transmission = buildCrossAssetTransmission({
    tltChangePct: -1.5, oilChangePct: -4.0, oilPrice: 72,
    eurUsd: 1.03, spyChangePct: -3.0, creditStressLevel: "extreme",
    macroBias: "bearish", isSaudi: false,
  });
  const gov = governCrossAsset({ transmission, liquidity: buildGlobalLiquidityState({ tltChangePct: -1.5, oilPrice: 72, oilChangePct: -4, eurUsd: 1.03, creditStressLevel: "extreme", ratesEnv: "tightening", macroBias: "bearish" }), capitalFlows: flows, isSaudi: false, lang: "en" });
  console.log(`  Governor: quality=${gov.qualityScore} repairs=[${gov.repairs.join(",")||"none"}]`);
  check("Governor stress_escalation repair for extreme credit + risk_off", gov.repairs.includes("stress_escalation_active"), `repairs=[${gov.repairs}]`);
  check("Governor approved",                gov.approved, `approved=${gov.approved}`);
  check("Governed context ≤480 chars",      gov.governedCrossAssetCtx.length <= 480, `len=${gov.governedCrossAssetCtx.length}`);
}

// ─── Scenario 5: Liquidity Tightening + Full Pipeline ─────────────────────────
console.log("\n── Scenario 5: Liquidity Tightening + Full Governor ──");
{
  const transmission = buildCrossAssetTransmission({
    tltChangePct: -1.8, oilChangePct: -3.0, oilPrice: 76,
    eurUsd: 1.05, spyChangePct: -1.0, creditStressLevel: "high",
    macroBias: "bearish", isSaudi: true,
  });
  const liquidity = buildGlobalLiquidityState({
    tltChangePct: -1.8, oilPrice: 76, oilChangePct: -3.0,
    eurUsd: 1.05, creditStressLevel: "high",
    ratesEnv: "Fed tightening, restrictive, QT active", macroBias: "bearish",
  });
  const flows = buildCapitalFlowProfile({
    regime: "bear_ranging", macroBias: "bearish", creditStressLevel: "high",
    oilPrice: 76, oilChangePct: -3, eurUsd: 1.05, spyChangePct: -1.0, isSaudi: true,
  });

  const gov = governCrossAsset({ transmission, liquidity, capitalFlows: flows, isSaudi: true, lang: "en" });
  console.log(`  Governor: quality=${gov.qualityScore} links=${transmission.activeLinks.length} ctx.len=${gov.governedCrossAssetCtx.length}`);
  check("Quality score ≥ 45",                 gov.qualityScore >= 45, `score=${gov.qualityScore}`);
  check("Governed context ≤480 chars",         gov.governedCrossAssetCtx.length <= 480, `len=${gov.governedCrossAssetCtx.length}`);
  check("Context contains liquidity signal",   gov.governedCrossAssetCtx.toLowerCase().includes("liquidity"));
  check("Context contains flow signal",        gov.governedCrossAssetCtx.toLowerCase().includes("risk"));
  check("No certainty language in context",    !/will definitely|guaranteed|certain to/i.test(gov.governedCrossAssetCtx));
  check("Fiduciary note present",              gov.fiduciaryNote.length > 5, `note="${gov.fiduciaryNote.slice(0,50)}"`);
  check("Governance log present",              gov.governanceLog.length > 5);
  check("GCC note present for Saudi",          flows.gccNote !== null, `note="${flows.gccNote?.slice(0,40)}"`);

  // Easing scenario: TLT +2%, EUR/USD 1.15
  const easingLiquidity = buildGlobalLiquidityState({
    tltChangePct: 2.0, oilPrice: 88, oilChangePct: 2.0,
    eurUsd: 1.15, creditStressLevel: "low",
    ratesEnv: "easing cycle, Fed cutting", macroBias: "bullish",
  });
  check("Easing: liquidity state = easing/ample",    ["easing","ample"].includes(easingLiquidity.liquidityState), `state=${easingLiquidity.liquidityState}`);
  check("Easing: dollar = abundant (EUR 1.15 + low credit)", easingLiquidity.dollarLiquidity === "abundant", `dollar=${easingLiquidity.dollarLiquidity}`);
  check("Easing: petrodollar = recycling (oil $88+)",         easingLiquidity.petrodollarFlow === "recycling", `petro=${easingLiquidity.petrodollarFlow}`);
}

console.log(`\n=== TOTAL: ${passed}/${total} passed ===\n`);
if (passed < total) process.exit(1);
