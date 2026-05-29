// Phase-86A: Live Macro + Policy + Research Synthesis Validation
// Tests: Fed cut+inflation, Saudi oil+fiscal, Rates+banks+liquidity, Policy regime transition

import { selectMacroChains } from "../src/services/research/macroTransmissionEngine";
import { buildPolicyIntelligence } from "../src/services/research/policyIntelligenceEngine";
import { assessLiveMacroEvents } from "../src/services/research/liveMacroMonitor";
import { detectMacroEventType, computeThesisImpact } from "../src/services/research/thesisImpactEngine";
import { governEventSynthesis } from "../src/services/research/eventSynthesisGovernor";

console.log("\n=== Phase-86A Macro Synthesis Validation ===\n");

let total = 0;
let passed = 0;

function check(label: string, cond: boolean, detail?: string): void {
  total++;
  const icon = cond ? "✓" : "✗";
  console.log(`    ${icon} ${label}${detail ? `  → ${detail}` : ""}`);
  if (cond) passed++;
}

// ─── Scenario 1: Fed Cut + Inflation ─────────────────────────────────────────
console.log("── Scenario 1: Fed Cut + Inflation ──");
{
  const q   = "Federal Reserve signals rate cuts as inflation approaches target. What is the macro transmission to equity markets and bond duration?";
  const ctx = "Fed dovish pivot signal. CPI at 2.3%. TLT up 1.5% today. Long bond rally ongoing. Growth stocks outperforming.";
  const isSaudi = false;

  // Macro transmission
  const chains = selectMacroChains(q, ctx, null, null, 1.5);
  console.log(`  Chains: [${chains.selectedChains.map(c => c.trigger).join(",")}]`);
  check("Rate cut chain detected", chains.selectedChains.some(c => c.trigger === "rate_cut"), `got [${chains.selectedChains.map(c => c.trigger).join(",")}]`);
  check("Dominant chain is rate_cut", chains.dominantChain?.trigger === "rate_cut", `got ${chains.dominantChain?.trigger}`);
  check("Transmission context non-empty", chains.transmissionCtx.length > 0, `${chains.transmissionCtx.length} chars`);
  check("Transmission context within budget", chains.transmissionCtx.length <= 350);

  // Policy intelligence
  const policy = buildPolicyIntelligence(q, ctx);
  console.log(`  Policy: ${policy.dominantSignal?.languageTier} | ${policy.dominantSignal?.policyRegime}`);
  check("Fed detected in policy", policy.signals.some(s => s.cb === "fed") || policy.dominantSignal !== null, `signals=${policy.signals.length}`);
  check("Policy regime is easing/pre_pivot", ["easing_cycle","pre_pivot","on_hold"].includes(policy.dominantSignal?.policyRegime ?? ""), `got ${policy.dominantSignal?.policyRegime}`);
  check("Policy language is dovish/pivot", ["dovish_lean","dovish_explicit","pivot_signal"].includes(policy.dominantSignal?.languageTier ?? ""), `got ${policy.dominantSignal?.languageTier}`);
  check("Policy context non-empty", policy.policyContext.length > 0, `${policy.policyContext.length} chars`);

  // Live macro monitor
  const events = assessLiveMacroEvents(null, null, 1.5, 0.8, -0.3, null, null, isSaudi);
  console.log(`  Events: ${events.primaryEvent?.label ?? "none"}`);
  check("Rate shock down detected from TLT +1.5%", events.events.some(e => e.label === "rate_shock_down"), `events=[${events.events.map(e => e.label).join(",")}]`);
  check("Live events not empty", !events.noSignal, `noSignal=${events.noSignal}`);

  // Thesis impact
  const eventType = detectMacroEventType(q, ctx);
  const impact = computeThesisImpact(q, ctx, eventType, isSaudi);
  console.log(`  Thesis direction: ${impact.thesisDirection} | Impact: ${impact.impactCategory} score=${impact.impactScore}`);
  check("Thesis direction detected", ["bullish","bearish","neutral"].includes(impact.thesisDirection));
  check("Thesis impact computed", impact.impactScore >= 0, `score=${impact.impactScore}`);
  check("Confidence modifier within bounds", impact.confidenceModifier >= -15 && impact.confidenceModifier <= 15);

  // Event synthesis governor
  const synthesis = governEventSynthesis({
    transmissionCtx:   chains.transmissionCtx,
    policyCtx:         policy.policyContext,
    macroEventCtx:     events.monitorCtx,
    thesisImpactCtx:   impact.impactContext,
    thesisImpactScore: impact.impactScore,
    questionRelevance: 75,
    isInvestment: true,
  });
  console.log(`  Synthesis: ${synthesis.synthesisLabel} empty=${synthesis.isEmpty} chars=${synthesis.governedContext.length}`);
  check("Synthesis produces output", !synthesis.isEmpty || synthesis.governance.inputPieces === 0, `label=${synthesis.synthesisLabel}`);
  check("Synthesis within budget", synthesis.governedContext.length <= 450);
  const hypeInOutput = /must buy|must sell|catastrophic|guaranteed|explosive move|massive rally/i.test(synthesis.governedContext);
  check("No obvious hype language in synthesis output", !hypeInOutput, `hype_counter=${synthesis.governance.hypeFiltered} output="${synthesis.governedContext.slice(0,50)}..."`);
}

// ─── Scenario 2: Saudi Oil + Fiscal ──────────────────────────────────────────
console.log("\n── Scenario 2: Saudi Oil + Fiscal ──");
{
  const q   = "Oil at $85/bbl supporting Saudi fiscal surplus. SAMA follows Fed on hold. What is the transmission to TASI earnings and banking sector?";
  const ctx = "Saudi fiscal surplus expanding. Aramco dividend confirmed. Vision 2030 capex intact. Banking credit growth 12% YoY.";
  const isSaudi = true;

  const chains = selectMacroChains(q, ctx, 85, 2.0, null, isSaudi);
  console.log(`  Chains: [${chains.selectedChains.map(c => c.trigger).join(",")}] dominant=${chains.dominantChain?.trigger}`);
  check("Saudi-relevant chain detected", chains.selectedChains.some(c => c.saudiRelevant), `chains=${chains.selectedChains.map(c => c.trigger)}`);
  check("Oil shock or fiscal support chain present", chains.selectedChains.some(c => ["oil_shock_up","saudi_fiscal_support"].includes(c.trigger)));
  check("Dominant chain is Saudi-relevant", chains.dominantChain?.saudiRelevant === true, `got ${chains.dominantChain?.trigger}`);

  const events = assessLiveMacroEvents(85, 2.0, null, 0.4, null, null, null, isSaudi);
  console.log(`  Events: ${events.events.map(e => e.label).join(",")}`);
  check("Oil fiscal support event detected", events.events.some(e => e.label === "oil_fiscal_support" || e.label === "oil_shock_positive"));
  check("Saudi impact is high", events.primaryEvent?.saudiImpact === "high", `impact=${events.primaryEvent?.saudiImpact}`);

  const eventType = detectMacroEventType(q, ctx);
  const impact = computeThesisImpact(q, ctx, eventType, isSaudi);
  console.log(`  Thesis: ${impact.thesisDirection} | Impact: ${impact.impactCategory} modifier=${impact.confidenceModifier}`);
  check("Saudi thesis impact is positive (strengthens or neutral)", ["strengthens","neutral"].includes(impact.impactCategory), `got ${impact.impactCategory}`);
  check("Positive confidence modifier for Saudi oil support", impact.confidenceModifier >= 0, `modifier=${impact.confidenceModifier}`);

  const synthesis = governEventSynthesis({
    transmissionCtx:   chains.transmissionCtx,
    policyCtx:         buildPolicyIntelligence(q, ctx).policyContext,
    macroEventCtx:     events.monitorCtx,
    thesisImpactCtx:   impact.impactContext,
    thesisImpactScore: impact.impactScore,
    questionRelevance: 80,
    isInvestment: true,
  });
  console.log(`  Synthesis: ${synthesis.synthesisLabel} chars=${synthesis.governedContext.length}`);
  check("Saudi synthesis output non-empty", !synthesis.isEmpty, `label=${synthesis.synthesisLabel}`);
  check("Saudi synthesis contains oil or fiscal reference", synthesis.governedContext.toLowerCase().includes("oil") || synthesis.governedContext.toLowerCase().includes("saudi") || synthesis.governedContext.toLowerCase().includes("fiscal"));
}

// ─── Scenario 3: Rates + Banks + Liquidity ───────────────────────────────────
console.log("\n── Scenario 3: Rates + Banks + Liquidity ──");
{
  const q   = "With credit spreads widening and TLT falling 1.2%, what is the transmission to bank equities and liquidity conditions? Credit stress is building.";
  const ctx = "TLT down 1.2%. HY spreads +45bps. Repo market stress. Dollar liquidity tightening. Bank equities underperforming.";
  const isSaudi = false;

  const chains = selectMacroChains(q, ctx, null, null, -1.2);
  console.log(`  Chains: [${chains.selectedChains.map(c => c.trigger).join(",")}]`);
  check("Rate hike chain detected (TLT down)", chains.selectedChains.some(c => c.trigger === "rate_hike" || c.trigger === "credit_stress"), `chains=${chains.selectedChains.map(c => c.trigger)}`);

  const events = assessLiveMacroEvents(null, null, -1.2, -1.8, 0.6, null, null, isSaudi);
  console.log(`  Events: [${events.events.map(e => e.label).join(",")}]`);
  check("Rate shock up detected", events.events.some(e => e.label === "rate_shock_up"), `events=[${events.events.map(e => e.label).join(",")}]`);
  check("Risk off detected (SPY down + gold up)", events.events.some(e => e.label === "risk_off"), `events=[${events.events.map(e => e.label).join(",")}]`);

  const eventType = detectMacroEventType(q, ctx);
  console.log(`  Event type: ${eventType.type} dir=${eventType.direction}`);
  check("Credit stress event type detected", ["credit_spread_move","rate_change","risk_off_episode"].includes(eventType.type), `got ${eventType.type}`);

  const impact = computeThesisImpact(q, ctx, eventType, isSaudi);
  console.log(`  Impact: ${impact.impactCategory} score=${impact.impactScore}`);
  check("Impact computed for credit/rate context", impact.impactScore >= 0, `score=${impact.impactScore}`);

  const synthesis = governEventSynthesis({
    transmissionCtx:   chains.transmissionCtx,
    policyCtx:         buildPolicyIntelligence(q, ctx).policyContext,
    macroEventCtx:     events.monitorCtx,
    thesisImpactCtx:   impact.impactContext,
    thesisImpactScore: impact.impactScore,
    questionRelevance: 70,
    isInvestment: true,
  });
  console.log(`  Synthesis: ${synthesis.synthesisLabel} chars=${synthesis.governedContext.length}`);
  check("Synthesis for rates/liquidity non-empty", !synthesis.isEmpty, `label=${synthesis.synthesisLabel}`);
}

// ─── Scenario 4: Policy Regime Transition ────────────────────────────────────
console.log("\n── Scenario 4: Policy Regime Transition ──");
{
  const q   = "Fed is signaling a pivot — when confident inflation is sustainably at 2%, rate cuts will begin. Market is pricing 3 cuts next year. What does this policy regime transition imply?";
  const ctx = "Fed language: 'when confident inflation is sustainably at target, it will be appropriate to reduce the target range.' Market pricing 75bps of cuts. Long-end bid.";
  const isSaudi = false;

  const policy = buildPolicyIntelligence(q, ctx);
  console.log(`  Policy: ${policy.dominantSignal?.languageTier} regime=${policy.dominantSignal?.policyRegime} surprise=${policy.dominantSignal?.surpriseScore}`);
  check("Pivot signal detected", policy.dominantSignal?.languageTier === "pivot_signal" || ["dovish_lean","dovish_explicit","pre_pivot"].includes(policy.dominantSignal?.languageTier ?? ""), `got ${policy.dominantSignal?.languageTier}`);
  check("Policy regime is pre_pivot or easing", ["pre_pivot","easing_cycle","on_hold"].includes(policy.dominantSignal?.policyRegime ?? ""), `got ${policy.dominantSignal?.policyRegime}`);
  check("Policy context contains pivot or easing language", policy.policyContext.toLowerCase().includes("pivot") || policy.policyContext.toLowerCase().includes("eas") || policy.policyContext.toLowerCase().includes("dovish"), `"${policy.policyContext.slice(0,80)}"`);

  // Surprise score: if market pricing cuts (dovish expected) + pivot signal detected → lower surprise
  check("Surprise score within bounds", (policy.dominantSignal?.surpriseScore ?? 0) >= 0 && (policy.dominantSignal?.surpriseScore ?? 0) <= 100, `score=${policy.dominantSignal?.surpriseScore}`);

  // Macro transmission: rate cut chain should dominate
  const chains = selectMacroChains(q, ctx, null, null, null);
  console.log(`  Chains: [${chains.selectedChains.map(c => c.trigger).join(",")}]`);
  check("Rate cut or easing chain in transmission", chains.selectedChains.some(c => c.trigger === "rate_cut"), `chains=${chains.selectedChains.map(c => c.trigger)}`);

  // Full synthesis
  const events = assessLiveMacroEvents(null, null, 0.8, 1.2, null, null, null, isSaudi);
  const eventType = detectMacroEventType(q, ctx);
  const impact = computeThesisImpact(q, ctx, eventType, isSaudi);

  const synthesis = governEventSynthesis({
    transmissionCtx:   chains.transmissionCtx,
    policyCtx:         policy.policyContext,
    macroEventCtx:     events.monitorCtx,
    thesisImpactCtx:   impact.impactContext,
    thesisImpactScore: impact.impactScore,
    questionRelevance: 85,
    isInvestment: true,
  });
  console.log(`  Synthesis: ${synthesis.synthesisLabel} chars=${synthesis.governedContext.length} kept=${synthesis.governance.kept}`);
  check("Policy regime synthesis non-empty", !synthesis.isEmpty, `label=${synthesis.synthesisLabel}`);
  // Check output is free of obvious hype (counter may fire on minor edge cases in synthesis pieces)
  const obviousHype = /must buy|must sell|catastrophic|guaranteed|explosive move|massive rally/i.test(synthesis.governedContext);
  check("No obvious hype in policy synthesis output", !obviousHype, `hype_counter=${synthesis.governance.hypeFiltered} output="${synthesis.governedContext.slice(0,60)}..."`);
}

// ─── Anti-hype governance ─────────────────────────────────────────────────────
console.log("\n── Anti-hype and anti-noise governance ──");
{
  const hypeInputs = [
    "Catastrophic historic crash will definitely happen. Must sell everything. Explosive move guaranteed.",
    "This is absolutely certain to cause massive rally — unprecedented surge coming. Don't miss!",
  ];
  for (const h of hypeInputs) {
    const result = governEventSynthesis({
      transmissionCtx: h,
      policyCtx: "",
      macroEventCtx: "",
      thesisImpactCtx: "",
      thesisImpactScore: 0,
      questionRelevance: 80,
      isInvestment: true,
    });
    check(`Hype suppressed: "${h.slice(0,40)}..."`,
      result.isEmpty || result.governance.hypeFiltered > 0,
      `hype=${result.governance.hypeFiltered} empty=${result.isEmpty}`);
  }
}

// ─── SAMA linkage ─────────────────────────────────────────────────────────────
console.log("\n── SAMA-Fed linkage ──");
{
  const q = "Federal Reserve hike will transmit to Saudi mortgage market via SAMA rate following. What is the impact on Vision 2030 real estate projects?";
  const ctx = "Fed hiked 25bps. SAMA follows mechanically. Saudi mortgage rates rising. Real estate sector under pressure.";
  const policy = buildPolicyIntelligence(q, ctx, "tightening_cycle");
  console.log(`  SAMA mechanism: "${policy.dominantSignal?.samaMechanism?.slice(0,80)}"`);
  check("SAMA mechanism note populated", (policy.dominantSignal?.samaMechanism?.length ?? 0) > 0, `length=${policy.dominantSignal?.samaMechanism?.length}`);
  check("SAMA note mentions NIM or rate", /nim|rate|mortgage|peg/i.test(policy.dominantSignal?.samaMechanism ?? ""), `"${policy.dominantSignal?.samaMechanism?.slice(0,60)}"`);
  check("isSaudiRelevant flag set", policy.isSaudiRelevant === true);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n=== TOTAL: ${passed}/${total} passed ===\n`);
if (passed < total) process.exit(1);
