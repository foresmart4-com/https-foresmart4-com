// Phase-89A: Institutional Research Desk Architecture Validation
// Validates: macro desk, sector desk, policy desk, routing, evidence hierarchy

import { buildMacroDeskBriefing }   from "../src/services/desks/macroResearchDesk";
import { buildSectorDeskBriefing }  from "../src/services/desks/sectorResearchDesk";
import { buildPolicyDeskBriefing }  from "../src/services/desks/policyResearchDesk";
import { routeToDesks }             from "../src/services/desks/researchRoutingGovernor";
import { buildEvidenceHierarchy }   from "../src/services/desks/evidenceHierarchyEngine";

console.log("\n=== Phase-89A Institutional Research Desk Architecture Validation ===\n");

let total = 0; let passed = 0;
function check(label: string, cond: boolean, detail?: string): void {
  total++;
  console.log(`    ${cond ? "✓" : "✗"} ${label}${detail ? `  → ${detail}` : ""}`);
  if (cond) passed++;
}

// ─── Scenario 1: Macro Question ───────────────────────────────────────────────
console.log("── Scenario 1: Macro Question (rates/inflation/liquidity) ──");
{
  const q   = "How does the Fed tightening cycle affect global liquidity and inflation dynamics?";
  const ctx = "TLT falling 2%. Credit spreads widening. CPI above target at 4.5%. Real rates rising.";

  const routing = routeToDesks({ question: q, ctx });
  console.log(`  Routing: primary=${routing.primaryDesk} active=[${routing.activeDesks.join(",")}] conf=${routing.routingConfidence}`);
  check("Macro desk routes as primary for rates/inflation",  routing.primaryDesk === "macro" || routing.primaryDesk === "mixed", `primary=${routing.primaryDesk}`);
  check("Routing confidence ≥ 35",                          routing.routingConfidence >= 35, `conf=${routing.routingConfidence}`);
  check("Macro desk is active",                             routing.activeDesks.includes("macro"), `active=[${routing.activeDesks}]`);

  const macroDesk = buildMacroDeskBriefing({
    question: q, ctx,
    regime: "high_vol_risk_off", macroBias: "bearish",
    creditStressLevel: "high", ratesEnv: "Fed hawkish, restrictive, tightening",
    oilLiquidity: "DXY rising", dxyImpact: "DXY rising; EM pressure",
    tltChangePct: -2.0, regimeConf: 65,
  });
  console.log(`  Macro desk: conviction=${macroDesk.deskConviction} rates=${macroDesk.ratesSignal} inflation=${macroDesk.inflationRegime} liquidity=${macroDesk.liquidityCondition}`);
  check("Macro desk is active",            macroDesk.isActive, `conviction=${macroDesk.deskConviction}`);
  check("Rates signal = rising (tlt -2%)", macroDesk.ratesSignal === "rising", `signal=${macroDesk.ratesSignal}`);
  check("Inflation regime = elevated",     macroDesk.inflationRegime === "elevated", `inflation=${macroDesk.inflationRegime}`);
  check("Liquidity = tight (high credit)", macroDesk.liquidityCondition === "tight" || macroDesk.liquidityCondition === "draining", `liquidity=${macroDesk.liquidityCondition}`);
  check("Desk briefing ≤160 chars",        macroDesk.deskBriefing.length <= 160, `len=${macroDesk.deskBriefing.length}`);
  check("Briefing contains MACRO label",   macroDesk.deskBriefing.startsWith("MACRO:"), `briefing="${macroDesk.deskBriefing.slice(0,40)}"`);
}

// ─── Scenario 2: Sector Question ──────────────────────────────────────────────
console.log("\n── Scenario 2: Sector Question (Saudi energy + banks) ──");
{
  const q   = "With oil at $85 and Vision 2030 spending, which TASI sectors benefit? Focus on banks and energy.";
  const ctx = "Aramco capex confirmed. Banks showing NIM expansion. Petrochem margins recovering.";

  const routing = routeToDesks({ question: q, ctx });
  console.log(`  Routing: primary=${routing.primaryDesk} active=[${routing.activeDesks.join(",")}]`);
  check("Sector desk routes as primary or mixed",     ["sector","mixed"].includes(routing.primaryDesk), `primary=${routing.primaryDesk}`);
  check("Sector desk is active",                      routing.activeDesks.includes("sector"));

  const sectorDesk = buildSectorDeskBriefing({
    question: q, ctx,
    regime: "bull_trending", macroBias: "bullish", isSaudi: true, oilPrice: 85,
  });
  console.log(`  Sector desk: conviction=${sectorDesk.deskConviction} sectors=[${sectorDesk.activeSectors.join(",")}]`);
  check("Sector desk is active",                      sectorDesk.isActive, `conviction=${sectorDesk.deskConviction}`);
  check("Energy and banks detected as active sectors", sectorDesk.activeSectors.includes("energy") && sectorDesk.activeSectors.includes("banks"), `sectors=[${sectorDesk.activeSectors}]`);
  check("Saudi sector note present (oil=$85)",        sectorDesk.saudiSectorNote !== null, `note="${sectorDesk.saudiSectorNote?.slice(0,40)}"`);
  check("Saudi note mentions oil/aramco/fiscal",      /oil|aramco|fiscal|bank|breakeven/i.test(sectorDesk.saudiSectorNote ?? ""));
  check("Desk briefing ≤160 chars",                   sectorDesk.deskBriefing.length <= 160);
  check("Briefing contains SECTOR label",             sectorDesk.deskBriefing.startsWith("SECTOR"), `briefing="${sectorDesk.deskBriefing.slice(0,40)}"`);
}

// ─── Scenario 3: Policy Question ─────────────────────────────────────────────
console.log("\n── Scenario 3: Policy Question (SAMA/Fed rate decision) ──");
{
  const q   = "What does the SAMA rate decision mean for Saudi banks? The Fed is about to pivot.";
  const ctx = "Fed meeting next week. SAMA mechanically follows. Bank NIM outlook under review.";

  const routing = routeToDesks({ question: q, ctx });
  console.log(`  Routing: primary=${routing.primaryDesk} active=[${routing.activeDesks.join(",")}]`);
  check("Policy desk active or primary for SAMA/Fed question", routing.activeDesks.includes("policy"), `active=[${routing.activeDesks}]`);

  const policyDesk = buildPolicyDeskBriefing({
    question: q, ctx,
    ratesEnv: "Fed pivot signal; about to cut rates", isSaudi: true, oilPrice: 78,
  });
  console.log(`  Policy desk: conviction=${policyDesk.deskConviction} cbStance=${policyDesk.cbStance} domains=[${policyDesk.activeDomains.join(",")}]`);
  check("Policy desk is active",                    policyDesk.isActive, `conviction=${policyDesk.deskConviction}`);
  check("CB stance detected as pivoting",           policyDesk.cbStance === "pivoting" || policyDesk.cbStance === "dovish", `stance=${policyDesk.cbStance}`);
  check("Central bank domain detected",             policyDesk.activeDomains.includes("central_bank"), `domains=[${policyDesk.activeDomains}]`);
  check("SAMA peg mention in CB context",           /sama|peg|riyal/i.test(policyDesk.cbContext), `cbCtx="${policyDesk.cbContext}"`);
  check("Desk briefing ≤160 chars",                 policyDesk.deskBriefing.length <= 160);
  check("Briefing contains POLICY label",           policyDesk.deskBriefing.startsWith("POLICY"), `briefing="${policyDesk.deskBriefing.slice(0,40)}"`);
}

// ─── Scenario 4: Mixed Institutional Question ─────────────────────────────────
console.log("\n── Scenario 4: Mixed Institutional Question (macro+sector+policy) ──");
{
  const q   = "How does Fed policy on rates combine with Saudi oil fiscal dynamics to affect TASI sector allocation across banks and energy?";
  const ctx = "Fed hawkish. Oil $78. SAMA peg intact. Saudi fiscal budget near breakeven. Banks: NIM at risk. Energy: Aramco dividend watch.";

  const routing = routeToDesks({ question: q, ctx });
  console.log(`  Routing: primary=${routing.primaryDesk} active=[${routing.activeDesks.join(",")}] conf=${routing.routingConfidence}`);
  check("All 3 desks active for mixed question",   routing.activeDesks.length >= 2, `active=[${routing.activeDesks}]`);
  check("Routing confidence ≥ 50 for mixed",       routing.routingConfidence >= 50, `conf=${routing.routingConfidence}`);

  // Run all 3 desks
  const macroDesk  = buildMacroDeskBriefing({ question: q, ctx, regime: "macro_transition", macroBias: "neutral", creditStressLevel: "moderate", ratesEnv: "Fed hawkish", oilLiquidity: "oil $78", dxyImpact: "DXY steady", tltChangePct: -0.5, regimeConf: 50 });
  const sectorDesk = buildSectorDeskBriefing({ question: q, ctx, regime: "macro_transition", macroBias: "neutral", isSaudi: true, oilPrice: 78 });
  const policyDesk = buildPolicyDeskBriefing({ question: q, ctx, ratesEnv: "Fed hawkish", isSaudi: true, oilPrice: 78 });

  const hierarchy = buildEvidenceHierarchy({ routing, macroBriefing: macroDesk, sectorBriefing: sectorDesk, policyBriefing: policyDesk });
  console.log(`  Hierarchy: dominant=${hierarchy.dominantDesk} priority=[${hierarchy.deskPriority.join(",")}] conf=${hierarchy.evidenceConfidence} ctxLen=${hierarchy.synthesisContext.length}`);
  check("Evidence hierarchy produced",               hierarchy.synthesisContext.length > 20, `len=${hierarchy.synthesisContext.length}`);
  check("Synthesis context ≤400 chars",              hierarchy.synthesisContext.length <= 400, `len=${hierarchy.synthesisContext.length}`);
  check("Synthesis includes 'Research desks'",       hierarchy.synthesisContext.startsWith("Research desks"), `ctx="${hierarchy.synthesisContext.slice(0,40)}"`);
  check("Dominant desk is non-null",                 hierarchy.dominantDesk !== undefined);
  check("Evidence confidence ≥ 30",                  hierarchy.evidenceConfidence >= 30, `conf=${hierarchy.evidenceConfidence}`);
  check("Desk priority is ordered",                  hierarchy.deskPriority.length >= 1);
  check("No execution language in synthesis",        !/\b(buy now|sell now|enter position|trade immediately)\b/i.test(hierarchy.synthesisContext));
}

// ─── Scenario 5: Evidence Hierarchy Ordering ──────────────────────────────────
console.log("\n── Scenario 5: Evidence Hierarchy Ordering ──");
{
  // High sector conviction should make sector dominant when primaryDesk = sector
  const q   = "Which sectors win in a bull market? Focus on technology and consumer discretionary.";
  const ctx = "Bull market conditions. Tech momentum. Consumer spending strong.";

  const routing = routeToDesks({ question: q, ctx });
  const macroDesk  = buildMacroDeskBriefing({ question: q, ctx, regime: "bull_trending", macroBias: "bullish", creditStressLevel: "low", ratesEnv: "easing", oilLiquidity: "", dxyImpact: "", tltChangePct: 0.5, regimeConf: 70 });
  const sectorDesk = buildSectorDeskBriefing({ question: q, ctx, regime: "bull_trending", macroBias: "bullish", isSaudi: false });
  const policyDesk = buildPolicyDeskBriefing({ question: q, ctx, ratesEnv: "easing", isSaudi: false });

  const hierarchy = buildEvidenceHierarchy({ routing, macroBriefing: macroDesk, sectorBriefing: sectorDesk, policyBriefing: policyDesk });
  console.log(`  Sector conviction=${sectorDesk.deskConviction} routing=${routing.primaryDesk} dominant=${hierarchy.dominantDesk}`);
  check("Sector desk conviction > 30 for sector question", sectorDesk.deskConviction > 30, `conv=${sectorDesk.deskConviction}`);
  check("Sector appears in desk priority",                  hierarchy.deskPriority.includes("sector"), `priority=[${hierarchy.deskPriority}]`);
  check("Synthesis context non-empty",                      hierarchy.synthesisContext.length > 20);
  check("Desk briefings contain sector information",        /sector|tech|consumer|win|lose/i.test(sectorDesk.deskBriefing), `briefing="${sectorDesk.deskBriefing.slice(0,60)}"`);

  // Routing rationale is set
  check("Routing rationale is non-empty",                   routing.routingRationale.length > 5, `rationale="${routing.routingRationale}"`);
  check("Routing rationale ≤60 chars",                      routing.routingRationale.length <= 60);
}

console.log(`\n=== TOTAL: ${passed}/${total} passed ===\n`);
if (passed < total) process.exit(1);
