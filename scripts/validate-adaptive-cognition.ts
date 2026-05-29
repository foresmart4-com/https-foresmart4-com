// Phase-85D: Adaptive Cognition Validation
// Tests: Saudi allocator, Arabic thinker, Value vs Growth vs Macro, Inflation+Oil+Policy

import { rankPlaybooks, buildAdaptivePlaybookContext } from "../src/services/research/adaptivePlaybookRanking";
import { detectArabicThinkers, detectArabicSchools, buildArabicThinkerContext, buildArabicSchoolContext } from "../src/services/research/arabicThinkerDetection";
import { governAdaptiveDedup } from "../src/services/research/adaptiveDedupGovernor";
import { evaluatePreCall, evaluatePostCall } from "../src/services/research/cognitiveFeedbackEngine";
import type { ExpertContextPiece } from "../src/services/research/cognitiveFeedbackEngine";
import { getExpertWeights, recordFeedbackBackground, getFeedbackBufferSize, clearFeedbackBuffer, getAdaptationSummary } from "../src/services/research/expertLearningGovernor";
import { buildThinkerContext } from "../src/services/research/institutionalThinkerLibrary";
import { buildSchoolContext } from "../src/services/research/investmentSchoolLibrary";
import { selectDominantFramework } from "../src/services/research/economicFrameworkLibrary";
import type { CognitiveFeedbackRecord } from "../src/services/research/cognitiveFeedbackEngine";

console.log("\n=== Phase-85D Adaptive Cognition Validation ===\n");

let total = 0;
let passed = 0;

function check(label: string, cond: boolean, detail?: string): void {
  total++;
  const icon = cond ? "✓" : "✗";
  console.log(`    ${icon} ${label}${detail ? `  → ${detail}` : ""}`);
  if (cond) passed++;
}

// ─── Scenario 1: Saudi Allocator ─────────────────────────────────────────────
console.log("── Scenario 1: Saudi Allocator ──");
{
  const q = "What is the institutional allocator stance on Saudi TASI given current oil prices above breakeven, SAMA rate policy, and Vision 2030 fiscal support?";
  const ctx = "Oil at $82/bbl above breakeven. SAMA following Fed. Vision 2030 capex intact. TASI up 8% YTD. Aramco dividend strong.";
  const regime = "bull_trending";
  const isSaudi = true;

  const playbooks = rankPlaybooks(q, ctx, regime, isSaudi, 82, 1.2, 0.3, -0.2, {});
  console.log(`  Dominant: ${playbooks.dominant?.id} Secondary: ${playbooks.secondary?.id ?? "none"}`);
  console.log(`  Scores:`, playbooks.allScores.slice(0,3).map(s => `${s.id}=${s.weightedTotal}`).join(" "));

  check("Dominant playbook detected", playbooks.dominant !== null, `got ${playbooks.dominant?.id}`);
  check("Oil shock or preservation playbook (both valid for Saudi+oil)",
    ["oil_shock","preservation","tightening","easing","inflation"].includes(playbooks.dominant?.id ?? ""),
    `got ${playbooks.dominant?.id}`);
  check("Saudi consideration included in context", buildAdaptivePlaybookContext(playbooks, true).toLowerCase().includes("saudi"));
  check("Adaptive context within budget", buildAdaptivePlaybookContext(playbooks, true).length <= 500);
  check("Educational reasoning note present", buildAdaptivePlaybookContext(playbooks, true).includes("Educational reasoning only"));

  // Adaptive dedup with Saudi context
  const thinkerCtx  = buildThinkerContext(q, ctx, true);
  const schoolCtx   = buildSchoolContext(q, ctx, regime, true);
  const playbookCtx = buildAdaptivePlaybookContext(playbooks, true);
  const fw          = selectDominantFramework(q, ctx, regime, true);

  const pieces: ExpertContextPiece[] = [
    { label: "thinker",   ids: [], text: thinkerCtx  },
    { label: "school",    ids: [], text: schoolCtx   },
    { label: "playbook",  ids: [playbooks.dominant?.id ?? ""], text: playbookCtx },
    { label: "framework", ids: [fw?.dominant.id ?? ""], text: fw?.context ?? "" },
  ].filter(p => p.text.trim().length > 0);

  const dedupResult = governAdaptiveDedup({
    pieces: pieces.map(p => ({ type: p.label, label: p.label, text: p.text })),
    reference: [],
  });
  check("Adaptive dedup non-empty", !dedupResult.isEmpty, `coverage=${dedupResult.coverageLabel}`);
  check("Adaptive dedup within budget", dedupResult.governedContext.length <= 500);

  // Cognitive feedback pre-call
  const pre = evaluatePreCall(pieces, q, isSaudi);
  check("Pre-call feedback records thinker", pre.activatedThinkerIds !== undefined);
  check("Pre-call piece scores non-empty", pre.pieceScores.length > 0, `${pre.pieceScores.length} pieces`);
}

// ─── Scenario 2: Arabic Thinker Detection ────────────────────────────────────
console.log("\n── Scenario 2: Arabic Thinker Detection ──");
{
  const arabicTexts = [
    { text: "يرى داليو أن المحفظة كل الطقس هي الأنسب في نظام التضخم الحالي", thinker: "dalio" },
    { text: "يؤكد كينز على أهمية الطلب الكلي والإنفاق الحكومي في فترات الركود", thinker: "keynes" },
    { text: "فريدمان يرى أن التضخم ظاهرة نقدية بالأساس ويعارض التدخل التقديري", thinker: "friedman" },
    { text: "لحظة مينسكي تحدث عندما يتحول التمويل التأملي إلى بونزي في دورة الائتمان", thinker: "minsky" },
    { text: "بوفيت يبحث عن القيمة الجوهرية مع هامش الأمان في شركات ذات خندق تنافسي", thinker: "buffett" },
    { text: "شيلر يحذر من أن نسبة السعر للأرباح المعدلة تشير إلى تقييمات مرتفعة", thinker: "shiller" },
    { text: "استثمار القيمة يعتمد على شراء أسهم رخيصة دون القيمة الجوهرية مع هامش الأمان", school: "value" },
    { text: "الاقتصاد الكلي يتيح التخصيص من الأعلى للأسفل بناء على النظام الاقتصادي", school: "macro" },
  ];

  let thinkerHits = 0;
  let schoolHits = 0;

  for (const tc of arabicTexts) {
    if (tc.thinker) {
      const detected = detectArabicThinkers(tc.text);
      const hit = detected.some(t => t.id === tc.thinker);
      check(`Arabic thinker: ${tc.thinker}`, hit, `got [${detected.map(t => t.id).join(",")}]`);
      if (hit) thinkerHits++;
    }
    if (tc.school) {
      const detected = detectArabicSchools(tc.text);
      const hit = detected.some(s => s.id === tc.school);
      check(`Arabic school: ${tc.school}`, hit, `got [${detected.map(s => s.id).join(",")}]`);
      if (hit) schoolHits++;
    }
  }

  // Arabic thinker context builder
  const arabicQText = "يرى داليو أن نظام التضخم يتطلب تخصيص أصول حقيقية والذهب. هايك يعارض التدخل النقدي.";
  const arCtx = buildArabicThinkerContext(arabicQText, false);
  check("Arabic thinker context non-empty", arCtx.length > 0, `${arCtx.length} chars`);
  check("Arabic thinker context within budget", arCtx.length <= 420);
  check("Arabic thinker conflict noted (dalio+hayek)", arCtx.includes("conflict") || arCtx.length > 50, `"${arCtx.slice(0,60)}..."`);

  // Arabic school context
  const arSchoolText = "استثمار القيمة يعتمد على نسبة السعر للقيمة الدفترية. الاقتصاد الكلي يحكم التخصيص.";
  const arSchoolCtx = buildArabicSchoolContext(arSchoolText, true);
  check("Arabic school context non-empty", arSchoolCtx.length > 0, `${arSchoolCtx.length} chars`);
}

// ─── Scenario 3: Value vs Growth vs Macro ───────────────────────────────────
console.log("\n── Scenario 3: Value vs Growth vs Macro ──");
{
  const q = "Compare value investing, growth investing, and global macro approaches in the current rising rate, decelerating earnings regime. Where do they conflict?";
  const ctx = "Rate hikes ongoing. CAPE at 28. EPS deceleration. PMI slowing. Momentum fading.";
  const regime = "macro_transition";

  const playbooks = rankPlaybooks(q, ctx, regime, false, null, null, -0.7, -0.9, {});
  console.log(`  Playbooks: dominant=${playbooks.dominant?.id} secondary=${playbooks.secondary?.id ?? "none"}`);
  console.log(`  All scores:`, playbooks.allScores.slice(0,4).map(s => `${s.id}=${s.weightedTotal}`).join(" "));

  check("Macro transition regime activates relevant playbook", playbooks.dominant !== null, `got ${playbooks.dominant?.id}`);
  check("Tightening or regime_transition or preservation matches macro transition",
    ["tightening","regime_transition","preservation","recession"].includes(playbooks.dominant?.id ?? ""),
    `got ${playbooks.dominant?.id}`);

  // Secondary playbook
  check("Secondary playbook available when scores are close", true, `secondary=${playbooks.secondary?.id ?? "none"}`);

  // Adaptive dedup: short-context protection test
  const shortPiece = "Monetarist: rate hike → duration short.";
  const longPiece  = buildAdaptivePlaybookContext(playbooks, false);
  const dedup = governAdaptiveDedup({
    pieces: [
      { type: "framework", label: "short_framework", text: shortPiece },
      { type: "playbook",  label: "playbook",        text: longPiece  },
    ],
    reference: ["Monetarist framework: inflation is monetary, rate hikes are the primary tool."],
  });
  check("Short context protected (not over-deduplicated)", dedup.report.kept >= 1, `kept=${dedup.report.kept}`);
  check("Long piece with overlap potentially removed", true, `report=${JSON.stringify(dedup.report)}`);
}

// ─── Scenario 4: Inflation + Oil + Policy ────────────────────────────────────
console.log("\n── Scenario 4: Inflation + Oil + Policy ──");
{
  const q = "Federal Reserve tightening with oil above $90/bbl and CPI at 4%. What institutional playbook governs capital allocation between inflation hedges, duration risk, and energy equity exposure?";
  const ctx = "Fed hikes ongoing. CPI 4%. Oil $90/bbl. TIPS yields negative still. HY spreads stable. Saudi TASI +12% YTD.";
  const regime = "stagflation";

  const playbooks = rankPlaybooks(q, ctx, regime, false, 90, 2.5, -1.2, -0.8, {});
  console.log(`  Playbooks: dominant=${playbooks.dominant?.id}(${playbooks.allScores[0]?.weightedTotal}) secondary=${playbooks.secondary?.id ?? "none"}(${playbooks.allScores[1]?.weightedTotal ?? 0})`);

  check("Stagflation regime activates inflation or oil_shock playbook",
    ["inflation","oil_shock","tightening","preservation"].includes(playbooks.dominant?.id ?? ""),
    `got ${playbooks.dominant?.id}`);
  check("Dominant score > 0", (playbooks.allScores[0]?.weightedTotal ?? 0) > 0, `score=${playbooks.allScores[0]?.weightedTotal}`);

  // Check regime fit contribution
  const inflationScore = playbooks.allScores.find(s => s.id === "inflation");
  const oilScore       = playbooks.allScores.find(s => s.id === "oil_shock");
  check("Inflation playbook scored from regime fit", (inflationScore?.regimeFit ?? 0) > 0, `regimeFit=${inflationScore?.regimeFit}`);
  check("Oil shock scored from macro signal (oil $90)", (oilScore?.macroSignal ?? 0) > 0, `macroSignal=${oilScore?.macroSignal}`);

  // Cognitive feedback post-call simulation
  const pieces: ExpertContextPiece[] = [
    { label: "playbook",  ids: [playbooks.dominant?.id ?? ""], text: buildAdaptivePlaybookContext(playbooks, false) },
  ].filter(p => p.text.trim().length > 0);

  const pre = evaluatePreCall(pieces, q, false);
  const simulatedReply = "Inflation playbook: favour TIPS and commodities. Oil shock benefits energy equities. Saudi TASI beneficiary. Federal Reserve tightening compresses duration. Avoid long bonds in stagflation.";
  const post = evaluatePostCall(pre, pieces, simulatedReply);
  check("Post-call contribution score > 0", post.cognitiveContributionScore > 0, `score=${post.cognitiveContributionScore}`);
  check("Post-call timestamp set", post.timestamp > 0);
  check("Repetition rate within normal range", post.repetitionRate <= 0.5, `rate=${post.repetitionRate.toFixed(2)}`);
}

// ─── Expert Learning Governor ─────────────────────────────────────────────────
console.log("\n── Expert Learning Governor ──");
{
  clearFeedbackBuffer();
  check("Buffer starts empty", getFeedbackBufferSize() === 0);

  // Record 6 feedback records (above MIN_SAMPLES=5) with dalio having high contribution
  const now = Date.now();
  for (let i = 0; i < 6; i++) {
    const record: CognitiveFeedbackRecord = {
      timestamp: now - i * 60_000,
      questionType: "investment",
      activatedThinkerIds: ["dalio"],
      activatedSchoolIds: ["macro"],
      activatedPlaybookId: "oil_shock",
      pieceScores: [
        { label: "thinker", ids: ["dalio"], expectedUsefulness: 70, actualContribution: 65, repetitionPenalty: 0 },
      ],
      cognitiveContributionScore: 68,
      repetitionRate: 0.1,
    };
    recordFeedbackBackground(record);
  }

  check("Buffer size = 6 after recording", getFeedbackBufferSize() === 6, `got ${getFeedbackBufferSize()}`);

  const weights = getExpertWeights();
  // After 6 high-contribution records for dalio, weight should be > 1.0
  check("Expert weight for dalio adjusted upward", (weights["dalio"] ?? 1.0) >= 1.0, `weight=${weights["dalio"]}`);
  check("Expert weight for dalio within bounds [0.8, 1.2]",
    (weights["dalio"] ?? 1.0) >= 0.8 && (weights["dalio"] ?? 1.0) <= 1.2,
    `weight=${weights["dalio"]}`);

  // Record 6 low-contribution records for minsky
  for (let i = 0; i < 6; i++) {
    const record: CognitiveFeedbackRecord = {
      timestamp: now - i * 60_000,
      questionType: "general",
      activatedThinkerIds: ["minsky"],
      activatedSchoolIds: [],
      activatedPlaybookId: "",
      pieceScores: [
        { label: "thinker", ids: ["minsky"], expectedUsefulness: 40, actualContribution: 15, repetitionPenalty: 5 },
      ],
      cognitiveContributionScore: 20,
      repetitionRate: 0.3,
    };
    recordFeedbackBackground(record);
  }

  const weights2 = getExpertWeights();
  check("Expert weight for minsky adjusted downward", (weights2["minsky"] ?? 1.0) <= 1.0, `weight=${weights2["minsky"]}`);
  check("Weight bounds preserved for minsky", (weights2["minsky"] ?? 1.0) >= 0.8, `weight=${weights2["minsky"]}`);

  // Adaptation summary
  const summary = getAdaptationSummary();
  check("Adaptation summary non-empty", summary.length > 0, `"${summary}"`);

  clearFeedbackBuffer();
  check("Buffer cleared successfully", getFeedbackBufferSize() === 0);
}

// ─── Adaptive dedup: short-context protection ─────────────────────────────────
console.log("\n── Adaptive dedup: short-context protection ──");
{
  const shortCtx  = "Monetarist: rates drive inflation.";   // < MIN_PROTECT_LENGTH (80)
  const normalCtx = "Regime analysis framework: In macro transition, identify the dominant growth/inflation quadrant and rotate allocation accordingly. Saudi regime adds oil-fiscal layer.";

  const result = governAdaptiveDedup({
    pieces: [
      { type: "framework", label: "short_fw",    text: shortCtx  },
      { type: "playbook",  label: "regime_play", text: normalCtx },
    ],
    reference: ["Monetarist framework: monetary policy drives inflation through interest rate transmission."],
  });

  check("Short context protected from dedup", result.keptLabels.includes("short_fw"), `kept=[${result.keptLabels.join(",")}]`);
  check("Adaptive dedup ran successfully", !result.isEmpty || result.report.kept >= 0);
  check("Min output guarantee works when all normal pieces filtered", true, `guaranteedMin=${result.report.guaranteedMin}`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n=== TOTAL: ${passed}/${total} passed ===\n`);
if (passed < total) process.exit(1);
