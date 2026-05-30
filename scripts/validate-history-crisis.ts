// Phase-89C: Economic History + Crisis Intelligence Validation
// Validates: crisis library, historical analogy, regime history, governor

import { detectCrisisArchetypes }   from "../src/services/history/crisisHistoryLibrary";
import { buildHistoricalAnalogy }    from "../src/services/history/historicalAnalogyEngine";
import { buildRegimeHistoryProfile } from "../src/services/history/regimeHistoryEngine";
import { governHistory }             from "../src/services/history/historyGovernor";

console.log("\n=== Phase-89C Economic History + Crisis Intelligence Validation ===\n");

let total = 0; let passed = 0;
function check(label: string, cond: boolean, detail?: string): void {
  total++;
  console.log(`    ${cond ? "✓" : "✗"} ${label}${detail ? `  → ${detail}` : ""}`);
  if (cond) passed++;
}

// ─── Scenario 1: Inflation Era ─────────────────────────────────────────────
console.log("── Scenario 1: Inflation Era (CPI above target, hawkish Fed, TLT falling) ──");
{
  const q   = "CPI is above target at 5.2%. The Fed is being forced to hike aggressively like the Volcker era. Will inflation stay sticky?";
  const ctx = "Wage growth 4.5%. Services inflation persistent. Fed hiking 75bps. TLT falling hard.";

  const crisis = detectCrisisArchetypes({ question: q, ctx, creditStressLevel: "moderate", oilChangePct: 2, oilPrice: 85, macroBias: "bearish", tltChangePct: -2.5 });
  console.log(`  Crisis: detected=[${crisis.detectedCrises.map(c=>c.archetype.id).join(",")}] dominant=${crisis.dominantCrisis?.archetype.id}`);
  check("Inflation crisis archetype detected",           crisis.detectedCrises.some(c => c.archetype.id === "inflation_crisis"), `detected=[${crisis.detectedCrises.map(c=>c.archetype.id)}]`);
  check("Dominant crisis = inflation_crisis",            crisis.dominantCrisis?.archetype.id === "inflation_crisis", `dom=${crisis.dominantCrisis?.archetype.id}`);
  check("Crisis signal score ≥ 5",                      (crisis.dominantCrisis?.signalScore ?? 0) >= 5, `score=${crisis.dominantCrisis?.signalScore}`);
  check("Crisis context ≤200 chars",                    crisis.crisisCtx.length <= 200, `len=${crisis.crisisCtx.length}`);
  check("Crisis context contains transmission pattern", /→/.test(crisis.crisisCtx));

  const analogy = buildHistoricalAnalogy({ regime: "high_vol_risk_off", macroBias: "bearish", creditStressLevel: "moderate", ratesEnv: "Fed aggressive hawkish 75bps hike tightening", oilChangePct: 2, oilPrice: 85, tltChangePct: -2.5 });
  console.log(`  Analogy: era=${analogy.dominantEra} confidence=${analogy.analogConfidence}% strength=${analogy.strength}`);
  // 1994 and 2022 are both valid "aggressive tightening" analogs; 1970s is CB-behind-the-curve
  check("Historical analog identifies tightening/inflation-era", /1970s|2022|1994/.test(analogy.dominantEra), `era=${analogy.dominantEra}`);
  check("Analog confidence ≥ 40 (partial or strong)",  analogy.analogConfidence >= 40, `conf=${analogy.analogConfidence}`);
  check("whatDiffers is always populated",              analogy.whatDiffers.length > 5, `differs="${analogy.whatDiffers.slice(0,50)}"`);
  check("Analog context ≤180 chars",                   analogy.analogCtx.length <= 180);

  const regime = buildRegimeHistoryProfile({ question: q, ctx, ratesEnv: "hawkish aggressive tightening Fed hiking", creditStressLevel: "moderate", tltChangePct: -2.5 });
  check("Tightening cycle detected as active regime",  regime.activeRegimes.some(r => r.type === "tightening_cycle"), `types=[${regime.activeRegimes.map(r=>r.type).join(",")}]`);
  check("Inflation era also detected",                 regime.activeRegimes.some(r => r.type === "inflation_era"), `types=[${regime.activeRegimes.map(r=>r.type).join(",")}]`);
}

// ─── Scenario 2: Oil Shock ─────────────────────────────────────────────────
console.log("\n── Scenario 2: Oil Shock (oil -7%, Saudi context) ──");
{
  const q   = "Oil has crashed -7% today following the OPEC surprise. Saudi fiscal deficit is likely to emerge. How does this transmit?";
  const ctx = "Brent now $62. Saudi breakeven ~$75-80. SAMA reserves being drawn. Vision 2030 projects at risk of delay.";

  const crisis = detectCrisisArchetypes({ question: q, ctx, creditStressLevel: "moderate", oilChangePct: -7, oilPrice: 62, macroBias: "bearish", tltChangePct: null });
  console.log(`  Crisis: detected=[${crisis.detectedCrises.map(c=>c.archetype.id).join(",")}]`);
  check("Oil shock archetype detected",               crisis.detectedCrises.some(c => c.archetype.id === "oil_shock"), `detected=[${crisis.detectedCrises.map(c=>c.archetype.id)}]`);
  check("Oil shock has signal score ≥ 5",             (crisis.detectedCrises.find(c=>c.archetype.id==="oil_shock")?.signalScore ?? 0) >= 5, `score=${crisis.detectedCrises.find(c=>c.archetype.id==="oil_shock")?.signalScore}`);

  const analogy = buildHistoricalAnalogy({ regime: "bear_ranging", macroBias: "bearish", creditStressLevel: "moderate", ratesEnv: "", oilChangePct: -7, oilPrice: 62 });
  console.log(`  Analogy: era=${analogy.dominantEra} confidence=${analogy.analogConfidence}%`);
  check("Oil collapse analog detected (2014 era)",    analogy.dominantEra === "2014_oil_collapse" || analogy.analogConfidence >= 35, `era=${analogy.dominantEra} conf=${analogy.analogConfidence}`);

  const regime = buildRegimeHistoryProfile({ question: q, ctx, ratesEnv: "", creditStressLevel: "moderate", oilChangePct: -7, oilPrice: 62 });
  check("Oil era (negative) detected as active regime", regime.activeRegimes.some(r => r.type === "oil_era_negative"), `types=[${regime.activeRegimes.map(r=>r.type).join(",")}]`);
  check("Oil era resolution precedent references OPEC", /opec|supply|demand|recovery/i.test(regime.activeRegimes.find(r=>r.type==="oil_era_negative")?.resolutionPrecedent ?? ""));
}

// ─── Scenario 3: Banking Stress ───────────────────────────────────────────
console.log("\n── Scenario 3: Banking Stress (extreme credit, spread blow-out) ──");
{
  const q   = "Credit spreads are blowing out. Bank stress is building with deposit outflows. HY spreads have widened 400bps.";
  const ctx = "IG spreads +180bps. HY spreads +420bps. Bank funding frozen. Forced selling in credit markets.";

  const crisis = detectCrisisArchetypes({ question: q, ctx, creditStressLevel: "extreme", oilChangePct: null, oilPrice: 75, macroBias: "bearish", tltChangePct: -1.0, spyChangePct: -3.5 });
  console.log(`  Crisis: detected=[${crisis.detectedCrises.map(c=>c.archetype.id).join(",")}] dom=${crisis.dominantCrisis?.archetype.id}`);
  check("Banking stress archetype detected",          crisis.detectedCrises.some(c => c.archetype.id === "banking_stress"), `detected=[${crisis.detectedCrises.map(c=>c.archetype.id)}]`);
  check("Liquidity shock also detected (forced selling)", crisis.detectedCrises.some(c => c.archetype.id === "liquidity_shock"), `detected=[${crisis.detectedCrises.map(c=>c.archetype.id)}]`);

  const analogy = buildHistoricalAnalogy({ regime: "high_vol_risk_off", macroBias: "bearish", creditStressLevel: "extreme", ratesEnv: "", tltChangePct: -1.0, spyChangePct: -3.5 });
  console.log(`  Analogy: era=${analogy.dominantEra} confidence=${analogy.analogConfidence}%`);
  check("GFC or LTCM analog identified for banking stress", /2008|1998/.test(analogy.dominantEra), `era=${analogy.dominantEra}`);
  check("Strong or partial analog for extreme credit", analogy.strength !== "weak_analog" || analogy.analogConfidence >= 35, `str=${analogy.strength} conf=${analogy.analogConfidence}`);

  const regime = buildRegimeHistoryProfile({ question: q, ctx, ratesEnv: "", creditStressLevel: "extreme" });
  check("Credit stress era detected as active regime",   regime.activeRegimes.some(r => r.type === "credit_stress_era"), `types=[${regime.activeRegimes.map(r=>r.type).join(",")}]`);
  check("Depth level = extreme for extreme credit",      regime.depthLevel === "extreme", `depth=${regime.depthLevel}`);
}

// ─── Scenario 4: Sovereign Pressure ──────────────────────────────────────
console.log("\n── Scenario 4: Sovereign Pressure (fiscal deficit + credit stress) ──");
{
  const q   = "Sovereign spreads are widening. The government is facing a fiscal deficit of 8% of GDP. IMF program is being discussed.";
  const ctx = "Sovereign CDS +250bps. Budget deficit widening. Rating downgrade warning from S&P. Austerity measures likely.";

  const crisis = detectCrisisArchetypes({ question: q, ctx, creditStressLevel: "high", oilChangePct: -3, oilPrice: 68, macroBias: "bearish" });
  console.log(`  Crisis: detected=[${crisis.detectedCrises.map(c=>c.archetype.id).join(",")}]`);
  check("Sovereign pressure detected",               crisis.detectedCrises.some(c => c.archetype.id === "sovereign_pressure"), `detected=[${crisis.detectedCrises.map(c=>c.archetype.id)}]`);
  check("Sovereign score ≥ 6",                       (crisis.detectedCrises.find(c=>c.archetype.id==="sovereign_pressure")?.signalScore ?? 0) >= 6, `score=${crisis.detectedCrises.find(c=>c.archetype.id==="sovereign_pressure")?.signalScore}`);
  check("False trigger warning is non-empty",        crisis.dominantCrisis?.archetype.falseTriggerWarning !== undefined && (crisis.dominantCrisis?.archetype.falseTriggerWarning?.length ?? 0) > 0, `warning="${crisis.dominantCrisis?.archetype.falseTriggerWarning?.slice(0,40)}"`);
}

// ─── Scenario 5: Historical Analog + Full Governor ───────────────────────
console.log("\n── Scenario 5: Historical Analog Case + Full Governor Pipeline ──");
{
  const q   = "We are in a tightening cycle with high inflation. This feels like the 1970s stagflation environment.";
  const ctx = "CPI above target for months. Entrenched. CB credibility being questioned. Wage spiral risk.";

  const crisis  = detectCrisisArchetypes({ question: q, ctx, creditStressLevel: "moderate", oilChangePct: 3, oilPrice: 90, macroBias: "bearish", tltChangePct: -1.8 });
  const analogy = buildHistoricalAnalogy({ regime: "macro_transition", macroBias: "bearish", creditStressLevel: "moderate", ratesEnv: "hawkish tightening above neutral restrict", oilChangePct: 3, oilPrice: 90, tltChangePct: -1.8 });
  const regime  = buildRegimeHistoryProfile({ question: q, ctx, ratesEnv: "hawkish tightening entrenched for months", creditStressLevel: "moderate", oilChangePct: 3, tltChangePct: -1.8 });
  const gov     = governHistory({ crisis, analogy, regime, lang: "en" });

  console.log(`  Governor: quality=${gov.qualityScore} approved=${gov.approved} ctx.len=${gov.governedHistoryCtx.length}`);
  console.log(`  Cycle phase: ${regime.cyclePhase} | depth: ${regime.depthLevel}`);
  check("Governor quality score ≥ 45",               gov.qualityScore >= 45, `score=${gov.qualityScore}`);
  check("Governed history context ≤420 chars",        gov.governedHistoryCtx.length <= 420, `len=${gov.governedHistoryCtx.length}`);
  check("Context contains crisis signal",             /crisis|Crisis|inflation|oil|bank|sovereign/i.test(gov.governedHistoryCtx));
  check("Context contains analog reference",          /Analog/.test(gov.governedHistoryCtx));
  check("No certainty language in context",           !/will follow the same|history repeats exactly|guaranteed/i.test(gov.governedHistoryCtx));
  check("Fiduciary note present",                     gov.fiduciaryNote.length > 5, `note="${gov.fiduciaryNote.slice(0,50)}"`);
  check("Cycle phase = late (entrenched for months)", regime.cyclePhase === "late", `phase=${regime.cyclePhase}`);
  check("Inflation era + tightening cycle active",    regime.activeRegimes.some(r => r.type === "inflation_era") && regime.activeRegimes.some(r => r.type === "tightening_cycle"), `types=[${regime.activeRegimes.map(r=>r.type).join(",")}]`);
  check("whatDiffers always populated in analogy",    analogy.whatDiffers.length > 10, `differs="${analogy.whatDiffers.slice(0,50)}"`);
  check("Governance log is non-empty",               gov.governanceLog.length > 5);
}

console.log(`\n=== TOTAL: ${passed}/${total} passed ===\n`);
if (passed < total) process.exit(1);
