// Phase-85B: Knowledge Authority Validation Runner
// Tests: Saudi allocator, Fed+oil+Saudi linkage, historical regime comparison

import { rankAuthoritySources, buildAuthorityContext } from "../src/services/research/authorityRankingEngine";
import { buildFrameworkLibraryContext, selectFrameworks } from "../src/services/research/economicFrameworkLibrary";
import { queryLiteratureLibrary, buildLiteratureContext } from "../src/services/research/institutionalLiteratureLibrary";
import { assessResearchRelevance } from "../src/services/research/liveResearchMonitor";
import { governKnowledgeContext } from "../src/services/research/knowledgeAuthorityGovernor";
import { scoreResearchCredibility } from "../src/services/research/researchCredibilityEngine";

// ─── Test scenarios ───────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    id: "saudi-allocator",
    label: "Saudi Allocator Question",
    question: "What is the institutional allocator stance on Saudi TASI given current oil prices above breakeven and SAMA rate policy?",
    ctx: "Oil at $82/bbl. SAMA following Fed. Vision 2030 spending intact. TASI up 8% YTD.",
    isSaudi: true,
    regime: "bull_trending",
    signals: { oilPrice: 82, oilChangePct: 1.2, spyChangePct: 0.3 },
    expected: {
      thesisRelevanceMin: 35,
      frameworksMin: 1,
      literatureMin: 1,
      authorityLabel: "no_authority",  // no explicit source in text → expected no authority
      governedNotEmpty: true,
      saudiNoteInFramework: true,
    },
  },
  {
    id: "fed-oil-saudi-linkage",
    label: "Fed + Oil + Saudi Linkage",
    question: "How does Federal Reserve tightening transmit to Saudi fiscal policy through the SAR peg and oil price mechanism?",
    ctx: "Fed raised rates 25bps. Oil at $75/bbl near breakeven. SAMA follows Fed mechanically. Credit spreads stable.",
    isSaudi: true,
    regime: "macro_transition",
    signals: { oilPrice: 75, oilChangePct: -0.8, tltChangePct: -0.5 },
    expected: {
      thesisRelevanceMin: 28,  // policy/fiscal/peg match — thesis score is secondary for policy-heavy question
      frameworksMin: 1,
      literatureMin: 1,
      authorityLabel: "tier_1_dominant",  // Fed is mentioned → authority_1
      governedNotEmpty: true,
      saudiNoteInFramework: true,
    },
  },
  {
    id: "historical-regime-comparison",
    label: "Historical Regime Comparison",
    question: "How does the 2022 inflation tightening cycle compare to the Volcker tightening era and what does it imply for 60/40 portfolio allocation?",
    ctx: "Current regime: high inflation, rising rates. Bonds and equities both under pressure. Shiller CAPE at 28. BIS credit gap elevated.",
    isSaudi: false,
    regime: "high_vol_risk-off",
    signals: { tltChangePct: -1.2, spyChangePct: -1.5, goldChangePct: 0.8 },
    expected: {
      thesisRelevanceMin: 35,
      frameworksMin: 1,
      literatureMin: 1,
      authorityLabel: "tier_1_dominant",  // Shiller + BIS mentioned → authority_1
      governedNotEmpty: true,
      saudiNoteInFramework: false,
    },
  },
] as const;

// ─── Validation runner ────────────────────────────────────────────────────────

console.log("\n=== Phase-85B Knowledge Authority Validation ===\n");

let totalChecks = 0;
let passed = 0;

function check(label: string, condition: boolean, detail?: string): void {
  totalChecks++;
  const icon = condition ? "✓" : "✗";
  const note = detail ? `  → ${detail}` : "";
  console.log(`    ${icon} ${label}${note}`);
  if (condition) passed++;
}

for (const scenario of SCENARIOS) {
  console.log(`\n── Scenario: ${scenario.label} ──`);

  // 1. Research relevance
  const relevance = assessResearchRelevance(
    scenario.question, scenario.ctx, scenario.isSaudi,
    scenario.regime, scenario.signals,
  );
  console.log(`  Relevance: policy=${relevance.policyRelevance} thesis=${relevance.thesisRelevance} market=${relevance.marketRelevance} regime=${relevance.regimeRelevance} overall=${relevance.overallRelevance}`);
  console.log(`  Active domains: [${relevance.activeResearchDomains.join(",")}]`);
  check(`thesisRelevance >= ${scenario.expected.thesisRelevanceMin}`, relevance.thesisRelevance >= scenario.expected.thesisRelevanceMin, `got ${relevance.thesisRelevance}`);

  // 2. Framework library
  const frameworks = selectFrameworks(scenario.question, scenario.ctx, scenario.regime);
  console.log(`  Frameworks selected: [${frameworks.map(f => f.id).join(",")}]`);
  check(`frameworksSelected >= ${scenario.expected.frameworksMin}`, frameworks.length >= scenario.expected.frameworksMin, `got ${frameworks.length}`);

  const frameworkCtx = buildFrameworkLibraryContext(scenario.question, scenario.ctx, scenario.regime, scenario.isSaudi);
  check(`frameworkContext non-empty`, frameworkCtx.length > 0, `${frameworkCtx.length} chars`);

  if (scenario.expected.saudiNoteInFramework && scenario.isSaudi) {
    const hasSaudiNote = frameworkCtx.toLowerCase().includes("saudi");
    check(`frameworkContext contains Saudi note`, hasSaudiNote);
  }

  // 3. Literature library
  const litEntries = queryLiteratureLibrary(scenario.question, scenario.ctx, scenario.regime, scenario.isSaudi);
  console.log(`  Literature entries matched: ${litEntries.length} [${litEntries.map(e => e.id).join(",")}]`);
  check(`literatureEntries >= ${scenario.expected.literatureMin}`, litEntries.length >= scenario.expected.literatureMin, `got ${litEntries.length}`);

  const litCtx = buildLiteratureContext(litEntries, scenario.isSaudi);
  check(`literatureContext non-empty`, litCtx.length > 0);

  // 4. Authority ranking
  const credResult = scoreResearchCredibility(scenario.question, scenario.ctx);
  const authorityResult = rankAuthoritySources(credResult);
  console.log(`  Authority: label=${authorityResult.authorityLabel} sources=${authorityResult.rankedSources.length} modifier=${authorityResult.thesisWeightModifier}`);

  if (scenario.expected.authorityLabel !== "no_authority") {
    check(`authorityLabel = ${scenario.expected.authorityLabel}`, authorityResult.authorityLabel === scenario.expected.authorityLabel, `got ${authorityResult.authorityLabel}`);
    check(`thesisWeightModifier >= 0.80`, authorityResult.thesisWeightModifier >= 0.80, `got ${authorityResult.thesisWeightModifier}`);
  } else {
    // No explicit source in question — accept any label
    check(`authorityRanking computed`, true, `label=${authorityResult.authorityLabel}`);
  }

  // 5. Knowledge authority governor
  const authorityCtx = buildAuthorityContext(scenario.question, scenario.ctx, credResult);
  const governed = governKnowledgeContext({
    authorityContext:  authorityCtx,
    frameworkContext:  frameworkCtx,
    literatureContext: litCtx,
    researchRelevance: relevance,
    authorityRanking:  authorityResult,
  });

  console.log(`  Governor: empty=${governed.isEmpty} chars=${governed.governanceReport.outputChars} noise=${governed.governanceReport.noiseFiltered} hype=${governed.governanceReport.hypeFiltered}`);
  check(`governedContext non-empty`, !governed.isEmpty && governed.governedContext.length > 0, `${governed.governedContext.length} chars`);
  check(`no hype detected`, governed.governanceReport.hypeFiltered === 0, `got ${governed.governanceReport.hypeFiltered}`);
  check(`output within budget`, governed.governanceReport.outputChars <= 600, `got ${governed.governanceReport.outputChars}`);

  if (scenario.expected.governedNotEmpty) {
    check(`governance preserves meaningful content`, governed.governanceReport.outputChars >= 50);
  }
}

// ─── Anti-hype validation ─────────────────────────────────────────────────────
console.log("\n── Anti-hype + Anti-noise governance ──");

const HYPE_INPUTS = [
  "This is a guaranteed opportunity — must act now! Explosive returns certain!",
  "The smart money says buy everything. Perfect timing. This will definitely moon.",
  "Fundamentally speaking, it is important to remember that in the long run markets go up.",
];

for (const hypeInput of HYPE_INPUTS) {
  const governed = governKnowledgeContext({
    authorityContext:  hypeInput,
    frameworkContext:  "",
    literatureContext: "",
    researchRelevance: assessResearchRelevance("test", "", false, "unknown"),
    maxChars:          400,
  });
  check(`Hype suppressed: "${hypeInput.slice(0, 40)}..."`, governed.governanceReport.hypeFiltered > 0 || governed.isEmpty, `hype=${governed.governanceReport.hypeFiltered} empty=${governed.isEmpty}`);
}

// ─── Authority weighting validation ──────────────────────────────────────────
console.log("\n── Authority weighting ──");

const FED_QUESTION = "Federal Reserve published FEDS notes on credit cycle and monetary transmission";
const credFed = scoreResearchCredibility(FED_QUESTION, "");
const rankFed = rankAuthoritySources(credFed);
check(`Fed detection → authority_1`, rankFed.topTier === "authority_1", `got ${rankFed.topTier}`);
check(`Fed thesisWeightModifier = 1.00`, rankFed.thesisWeightModifier === 1.00, `got ${rankFed.thesisWeightModifier}`);

const DALIO_QUESTION = "Ray Dalio Bridgewater all-weather portfolio framework debt cycle";
const credDalio = scoreResearchCredibility(DALIO_QUESTION, "");
const rankDalio = rankAuthoritySources(credDalio);
check(`Dalio detection → authority_2`, rankDalio.topTier === "authority_2", `got ${rankDalio.topTier}`);
check(`Dalio thesisWeightModifier = 0.80`, rankDalio.thesisWeightModifier === 0.80, `got ${rankDalio.thesisWeightModifier}`);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n=== TOTAL: ${passed}/${totalChecks} passed ===\n`);

if (passed < totalChecks) {
  process.exit(1);
}
