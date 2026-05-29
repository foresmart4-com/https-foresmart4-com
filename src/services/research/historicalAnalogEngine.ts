// Phase-83A/83B: Historical Analog Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Distinct from historicalLearning.ts (Phase 74):
//   historicalLearning.ts   — single best-match analog via keyword scoring (10 episodes)
//   historicalAnalogEngine  — multi-cycle comparison, regime-aware matching,
//                             structured "what's the same / what's different" output,
//                             Saudi-specific cycle overlay, and richer context block.
//                             Phase-83B addition: 6 supplementary episodes + false-analog
//                             risk assessment (prevents inappropriate analog application).
//
// Supplementary episodes added (83B):
//   dot_com_2000         — valuation-driven bear, not credit-driven
//   oil_collapse_2014_16 — Saudi-specific oil collapse with fiscal numbers
//   china_slowdown_2015  — China PMI collapse + commodity bear market
//   gcc_liquidity_2015   — GCC bank deposit outflows + credit tightening
//   2013_taper_tantrum   — EM rate shock from Fed guidance change
//   2011_eu_debt         — regional credit crisis + austerity cycle
//
// False-analog risk: each analog comparison now includes a falseAnalogRisk score
// (0-3: low/medium/high) indicating how likely the analog is to mislead.
//
// Never a prediction tool. Context and base rates only.

import { HISTORICAL_EPISODES, type HistoricalEpisode } from "@/services/research/historicalLearning";

// ─── Supplementary episode registry ──────────────────────────────────────────
// New episodes not in historicalLearning.ts (Phase 74).

const SUPPLEMENTARY_EPISODES: HistoricalEpisode[] = [
  {
    id: "dot_com_2000",
    name: "Dot-Com Valuation Unwind",
    period: "2000-2002",
    domain: "fed_cycle",
    characteristics: ["extreme valuation stretch (P/E 60-80x)", "technology concentration", "earnings growth narrative without actual earnings", "multiple compression cycle", "sector rotation to value"],
    macroTransmission: "Narrative-driven PE expansion → Fed tightening → earnings disappointment → multiple collapse → capital rotation from growth to value and defensives",
    assetClassBehavior: "NASDAQ fell 78%; S&P 500 -50%; value/financials relatively resilient; gold began secular bull; bonds held well.",
    howItEnded: "18-month earnings recovery cycle + Fed easing; tech never returned to prior multiples for a decade.",
    saudiDimension: "Saudi market largely insulated; oil was low in 2001 but recovering. TASI had limited foreign investor exposure.",
    keyLesson: "Valuation-expansion-driven returns are the most fragile — when the narrative breaks, multiple compression is fast and severe with no earnings support.",
    analogKeywords: ["dot-com", "valuation unwind", "2000", "nasdaq", "tech bubble", "multiple compression", "growth narrative", "pe expansion", "توسع المضاعفات", "انهيار التقييم"],
  },
  {
    id: "oil_collapse_2014_16",
    name: "Saudi Oil Revenue Collapse 2014-2016",
    period: "2014-2016",
    domain: "oil_shock",
    characteristics: ["oil from $115 to $27", "Saudi fiscal deficit 15% of GDP", "SAMA reserves drawn down $250B", "bank lending tightened", "Vision 2030 conceived as response"],
    macroTransmission: "OPEC supply decision → oil oversupply → price collapse → Saudi fiscal deficit ($98B in 2015) → government spending cuts → bank deposits outflow → credit tightening → TASI fell 50% peak-to-trough",
    assetClassBehavior: "TASI fell from ~10,000 to ~5,000 (-50%); bank sector most exposed; petrochemicals (SABIC) severely impacted; Aramco pre-IPO so no listed vehicle then.",
    howItEnded: "OPEC production cuts (Vienna Agreement 2016) + Vision 2030 announcement created new investment narrative; TASI recovered over 2-3 years.",
    saudiDimension: "This is the defining Saudi fiscal stress episode: $75-80/bbl breakeven was not yet established as policy framework until after this crisis; SAMA reserves fell from $730B to $530B.",
    keyLesson: "Saudi fiscal stress at scale: a -65% oil price decline creates feedback loop through government deposits → bank credit → non-oil GDP → TASI; recovery requires both oil stabilisation AND a new structural narrative.",
    analogKeywords: ["2014 oil", "2016 oil", "saudi 2014", "saudi 2015", "opec 2016", "oil collapse", "tasi 2015", "sama reserves", "saudi fiscal deficit", "انهيار النفط", "تاسي 2015"],
  },
  {
    id: "china_slowdown_2015",
    name: "China Slowdown & Commodity Bear 2015",
    period: "2015-2016",
    domain: "macro_cycle",
    characteristics: ["China PMI fell below 50", "RMB devaluation surprise", "commodity supercycle reversal", "EM capital outflows", "petrochemical margin collapse"],
    macroTransmission: "China industrial slowdown → commodity demand collapse → oil/metals price decline → EM fiscal stress → capital outflows → DXY strength → SABIC/petrochemical margin compression",
    assetClassBehavior: "EM equities fell 25-35%; commodities fell broadly; SABIC margins compressed severely; TASI caught in both oil and China demand headwinds simultaneously.",
    howItEnded: "China stimulus in 2016 + commodity supply cuts; partial recovery over 18 months.",
    saudiDimension: "China is the marginal demand driver for Saudi petrochemicals (SABIC). China slowdown creates a simultaneous oil price and petrochemical margin headwind for TASI — the worst combination for Saudi equities.",
    keyLesson: "Saudi petrochemical exposure (SABIC) is a China demand proxy, not a Saudi domestic story; China slowdown + oil decline simultaneously creates a dual headwind that is not captured by pure oil-fiscal analysis.",
    analogKeywords: ["china slowdown", "china 2015", "china pmi", "rmb devaluation", "commodity bear", "sabic margin", "petrochem margins", "تراجع الصين", "سابك"],
  },
  {
    id: "gcc_liquidity_2015",
    name: "GCC Bank Liquidity Cycle 2015-2016",
    period: "2015-2016",
    domain: "saudi_oil_history",
    characteristics: ["government deposit withdrawal from banks", "SAIBOR spiked 100bps", "bank credit growth fell to 2%", "bank valuations fell 20-30%", "real estate pressure"],
    macroTransmission: "Oil revenue decline → Saudi government withdraws deposits from banks → interbank rates spike (SAIBOR) → bank lending costs rise → credit growth falls from 12% to 2% YoY → real estate volumes fall → bank NPL risk rises",
    assetClassBehavior: "Saudi banking sector fell 25-30%; dividend yields rose to 5-7%; real estate transaction volumes fell 30%; cement sector severely impacted.",
    howItEnded: "ARAMCO IPO preparation + Vision 2030 spending resumption + OPEC deal restored fiscal receipts; bank deposit base recovered.",
    saudiDimension: "GCC liquidity cycle is directly driven by oil revenue; government deposits constitute ~30-40% of Saudi bank funding — this structural dependency creates leverage to oil price that many external investors underestimate.",
    keyLesson: "Saudi bank sector NIM and credit growth are secondary exposures to oil via the government deposit channel — not directly to oil prices; the lag between oil decline and bank credit stress is 6-12 months.",
    analogKeywords: ["gcc liquidity", "saibor", "saudi bank 2015", "credit growth 2015", "government deposits", "saudi interbank", "سيولة خليجية", "البنوك السعودية 2015"],
  },
  {
    id: "taper_tantrum_2013",
    name: "2013 Fed Taper Tantrum",
    period: "2013",
    domain: "fed_cycle",
    characteristics: ["unexpected Fed guidance shift", "bond yields spiked 100bps in 3 months", "EM capital outflows", "currencies depreciated 10-20%", "DXY strengthened"],
    macroTransmission: "Fed guidance on QE tapering → bond yield spike → EM capital outflows → EM currency depreciation → tighter financial conditions → equity PE compression in EM",
    assetClassBehavior: "EM fell 15-20%; US bonds worst quarter in 3 years; DXY strengthened 5%; Saudi market relatively insulated due to SAR peg (no currency risk).",
    howItEnded: "Fed clarified guidance; EM stabilised; actual tapering was slower than feared.",
    saudiDimension: "SAR peg provides Saudi investors a buffer from currency risk but not from capital flow effects; foreign outflows from EM can reduce TASI liquidity even without currency exposure.",
    keyLesson: "Forward guidance changes can matter as much as actual policy actions; EM with dollar debt and current account deficits are most vulnerable; GCC with pegged currencies and fiscal surpluses are relatively insulated.",
    analogKeywords: ["taper tantrum", "2013 fed", "qe taper", "em outflow", "bond spike 2013", "dxy 2013", "صدمة التخفيف"],
  },
  {
    id: "eu_debt_crisis_2011",
    name: "European Debt Crisis 2011",
    period: "2011-2012",
    domain: "liquidity_crisis",
    characteristics: ["sovereign spread widening", "austerity cycle", "European bank stress", "ECB crisis response", "regional contagion within EM"],
    macroTransmission: "Sovereign debt spreads → bank funding stress → credit contraction → austerity policies → growth collapse in periphery → ECB OMT program broke feedback loop",
    assetClassBehavior: "European equities fell 25%; global credit spreads widened; gold rallied; USD strengthened; EM fell 20-25%.",
    howItEnded: "ECB 'whatever it takes' (July 2012) + OMT program backstop eliminated the tail risk; market recovered sharply.",
    saudiDimension: "Oil remained elevated ($100+) during European crisis; Saudi TASI outperformed global equities in 2011-2012 due to fiscal strength and Vision 2030 precursor spending.",
    keyLesson: "Regional credit crises can be contained by credible central bank backstop; but the 'whatever it takes' moment is not always predictable; position before the backstop is painful.",
    analogKeywords: ["eu debt", "european debt", "2011 crisis", "ecb", "austerity", "sovereign spread", "draghi", "أزمة الديون الأوروبية"],
  },
];

// ─── False-analog risk assessment ────────────────────────────────────────────
// Assesses whether applying a given analog to the current question is misleading.
// Returns a risk level (0=low, 1=medium, 2=high, 3=very_high) and explanation.

function assessFalseAnalogRisk(
  episode: HistoricalEpisode,
  question: string,
  ctx: string,
): { risk: number; explanation: string } {
  const text = `${question} ${ctx}`.toLowerCase();

  // High false-analog risk cases
  if (episode.id === "dot_com_2000" && /saudi|tasi|oil|aramco/i.test(text)) {
    return { risk: 3, explanation: "dot-com was a US tech valuation episode; Saudi/TASI dynamics are oil-driven, not tech-narrative-driven — applying this analog to Saudi is misleading." };
  }
  if (episode.id === "great_depression" && !/deflation|bank\s+failure|gold\s+standard/i.test(text)) {
    return { risk: 2, explanation: "Great Depression required specific gold standard + deflation conditions; absent those, the analog overstates tail risk." };
  }
  if (episode.id === "asian_crisis_1997" && !/em\s+crisis|currency\s+peg|sar\s+peg|devaluation/i.test(text)) {
    return { risk: 2, explanation: "Asian crisis was a currency peg collapse; SAR peg is backed by reserves and political commitment — structural difference limits the analog." };
  }

  // Low false-analog risk for well-matched episodes
  if (/saudi|tasi|aramco/i.test(text) && (episode.id === "oil_collapse_2014_16" || episode.id === "gcc_liquidity_2015" || episode.id === "saudi_oil_1986_2014")) {
    return { risk: 0, explanation: "directly applicable Saudi cycle — structural similarities high." };
  }

  return { risk: 1, explanation: "moderate applicability — use with standard 'what is different' caveat." };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CycleCategory =
  | "oil_shock_downward"   // oil falling, fiscal stress, Saudi pressure
  | "oil_shock_upward"     // oil rising, fiscal windfall, Saudi boom
  | "rate_tightening"      // CB raising, real rates rising, PE compression
  | "rate_easing"          // CB cutting, real rates falling, PE expansion
  | "credit_stress"        // spreads widening, funding stress
  | "risk_on_regime"       // spreads tight, EM flows positive, risk appetite high
  | "stagflation"          // inflation high + growth weak simultaneously
  | "demand_shock"         // exogenous demand collapse (pandemic, war)
  | "recovery_phase"       // post-crisis normalisation
  | "unknown";

export interface RegimeAnalog {
  episode: HistoricalEpisode;
  matchScore: number;       // 0-10
  matchingFeatures: string[];
  differingFeatures: string[];
  saudiRelevance: string;   // how this analog applies to Saudi/TASI specifically
  allocatorLesson: string;  // what a conservative allocator did/should have done
}

export interface HistoricalAnalogEngineResult {
  category: CycleCategory;
  primaryAnalog: RegimeAnalog | null;
  secondaryAnalog: RegimeAnalog | null;   // second-closest match for comparison
  conflictingAnalog: RegimeAnalog | null; // analog that argues the OTHER direction
  contextBlock: string;                  // injectable prompt context
  saudiCycleContext: string;             // Saudi-specific historical overlay
  governanceNote: string;                // how to use this responsibly
}

// ─── Regime category detection ────────────────────────────────────────────────

const CATEGORY_PATTERNS: Record<CycleCategory, RegExp> = {
  oil_shock_downward:  /oil\s*(fall|drop|decline|crash|below|collapse)|نفط\s*(ينخفض|ينهار|تراجع|دون)/i,
  oil_shock_upward:    /oil\s*(rise|surge|rally|above|spike)|نفط\s*(يرتفع|فوق|صعود)/i,
  rate_tightening:     /rate\s*(hike|rise|tight|increas)|fed\s*(hik|tight|rais)|الفيدرالي\s*(يرفع|تشديد)/i,
  rate_easing:         /rate\s*(cut|lower|ease|pivot)|fed\s*(cut|pivo|ease)|الفيدرالي\s*(يخفض|تيسير|تحول)/i,
  credit_stress:       /credit\s*(spread|stress|tighten)|spread\s*widen|ائتمان\s*(ضغط|فوارق|تشديد)/i,
  risk_on_regime:      /risk.on|risk\s+appetite|EM\s+(rally|flow)|شهية\s+المخاطرة/i,
  stagflation:         /stagflat|inflation.{0,20}(weak|slow)|(تضخم|ارتفاع).{0,30}(ضعف|تباطؤ)/i,
  demand_shock:        /pandemic|covid|lockdown|war|exogenous\s+shock|جائحة|حرب|صدمة\s+خارجية/i,
  recovery_phase:      /recovery|rebound|normaliz|post.crisis|انتعاش|تعافٍ/i,
  unknown:             /.*/,
};

function detectCycleCategory(question: string, ctx: string): CycleCategory {
  const text = `${question} ${ctx}`.toLowerCase();
  for (const [cat, pattern] of Object.entries(CATEGORY_PATTERNS) as [CycleCategory, RegExp][]) {
    if (cat !== "unknown" && pattern.test(text)) return cat;
  }
  return "unknown";
}

// ─── Enhanced scoring ─────────────────────────────────────────────────────────
// Uses both keyword matching AND category alignment for richer scoring.

const CATEGORY_TO_DOMAIN_AFFINITY: Partial<Record<CycleCategory, string[]>> = {
  oil_shock_downward: ["oil_shock", "saudi_oil_history"],
  oil_shock_upward:   ["oil_shock", "saudi_oil_history", "macro_cycle"],
  rate_tightening:    ["fed_cycle", "inflation_regime"],
  rate_easing:        ["fed_cycle", "macro_cycle"],
  credit_stress:      ["gfc_2008", "liquidity_crisis"],
  stagflation:        ["inflation_regime"],
  demand_shock:       ["covid", "great_depression"],
  recovery_phase:     ["covid", "gfc_2008", "macro_cycle"],
};

function scoreEpisode(
  episode: HistoricalEpisode,
  question: string,
  ctx: string,
  category: CycleCategory,
): number {
  const text = `${question} ${ctx}`.toLowerCase();
  let score = episode.analogKeywords.filter(k => text.includes(k)).length;

  // Bonus for category-domain affinity
  const affinityDomains = CATEGORY_TO_DOMAIN_AFFINITY[category] ?? [];
  if (affinityDomains.includes(episode.domain)) score += 2;

  return score;
}

// ─── Feature matching ─────────────────────────────────────────────────────────

function findMatchingFeatures(episode: HistoricalEpisode, question: string, ctx: string): string[] {
  const text = `${question} ${ctx}`.toLowerCase();
  return episode.characteristics.filter(c => {
    const words = c.toLowerCase().split(/\s+/);
    return words.some(w => w.length > 4 && text.includes(w));
  }).slice(0, 3);
}

function findDifferingFeatures(episode: HistoricalEpisode, question: string, ctx: string): string[] {
  const text = `${question} ${ctx}`.toLowerCase();
  return episode.characteristics.filter(c => {
    const words = c.toLowerCase().split(/\s+/);
    return !words.some(w => w.length > 4 && text.includes(w));
  }).slice(0, 2).map(c => `Not currently present: "${c}"`);
}

// ─── Saudi cycle overlay ──────────────────────────────────────────────────────

function buildSaudiCycleContext(
  category: CycleCategory,
  primaryAnalog: RegimeAnalog | null,
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";

  const coreNote = ar
    ? "السياق التاريخي السعودي (ليس تنبؤاً — معدلات أساسية وأنماط فقط):"
    : "Saudi historical context (not prediction — base rates and patterns only):";

  let cycleNote: string;

  switch (category) {
    case "oil_shock_downward":
      cycleNote = ar
        ? "النمط 1986/2014-16: نفط دون نقطة التعادل → تاسي -40-50% خلال 6-18 شهراً → استرداد في 2-3 سنوات. الفارق المهم هذه المرة: رؤية 2030 توفر إنفاقاً غير نفطي غير موجود في 1986. معدل أساسي: البنوك وأسماء رؤية 2030 تتراجع أسرع من أرامكو."
        : "1986/2014-16 pattern: oil below breakeven → TASI -40-50% over 6-18 months → 2-3 year recovery. Key difference this time: Vision 2030 provides non-oil spending anchor absent in 1986. Base rate: banks and V2030 names decline faster than Aramco.";
      break;

    case "oil_shock_upward":
      cycleNote = ar
        ? "نمط 2003-08/2021-22: نفط فوق نقطة التعادل بفارق كبير → فائض مالي → فورة تاسي. تاسي 2022 بلغ 13,000+. الفارق: التقييمات والمضاعفات في بداية الفورة مهمة — الصعود المدفوع بتوسع P/E يعكس مساره عند استقرار النفط."
        : "2003-08/2021-22 pattern: oil well above breakeven → fiscal surplus → TASI boom. TASI hit 13,000+ in 2022. Difference: starting valuations matter — P/E-expansion-driven gains reverse when oil stabilises.";
      break;

    case "rate_tightening":
      cycleNote = ar
        ? "1994/2022: دورات التشديد السريع تضغط مضاعفات PE عالمياً. البيئة السعودية في 2022: نفط مرتفع + رفع الأسعار = أداء تاسي فوق المتوسط العالمي. الشرط: النفط فوق نقطة التعادل يُعوّض ضغط المضاعفات."
        : "1994/2022: rapid tightening cycles compress PE multiples globally. Saudi experience in 2022: high oil + rate hikes = TASI outperformed global equities. Condition: oil above breakeven offsets multiple compression.";
      break;

    case "rate_easing":
      cycleNote = ar
        ? "دورات التيسير (2019-20): تخفيف تلقائي عبر SAMA + ربط SAR يدعم التقييمات والائتمان. الاستفادة الأكبر: البنوك (توسع الائتمان) والقطاعات ذات التقييم المنخفض. الشرط: النفط يحتاج أن يكون مستقراً حتى تتحقق إعادة التسعير."
        : "Easing cycles (2019-20): automatic easing via SAMA SAR peg supports valuations and credit. Biggest beneficiaries: banks (credit expansion) and low-valuation sectors. Condition: oil needs to be stable for re-pricing to materialise.";
      break;

    default:
      cycleNote = ar
        ? "لا يوجد أنالوغ سعودي محدد لهذا النظام — تطبيق المبادئ العامة: إذا كان النفط فوق نقطة التعادل، فالمعدل الأساسي إيجابي لتاسي؛ إذا كان دون ذلك، فالمعدل الأساسي تحذيري."
        : "No specific Saudi analog for this regime — apply general principle: if oil is above breakeven, base rate is constructive for TASI; if below, base rate is cautionary.";
  }

  const analogNote = primaryAnalog
    ? (ar
        ? `الأنالوغ الأقرب: ${primaryAnalog.episode.name} (${primaryAnalog.episode.period}). الدرس: ${primaryAnalog.allocatorLesson}`
        : `Closest analog: ${primaryAnalog.episode.name} (${primaryAnalog.episode.period}). Lesson: ${primaryAnalog.allocatorLesson}`)
    : "";

  const governance = ar
    ? "⚠ الأنالوغ التاريخي سياق وتقدير — ليس تنبؤاً ولا إشارة دخول. الظروف الهيكلية تختلف دائماً."
    : "⚠ Historical analog is context and calibration — not prediction and not an entry signal. Structural conditions always differ.";

  return [coreNote, cycleNote, analogNote, governance].filter(Boolean).join("\n");
}

// ─── Allocator lesson derivation ──────────────────────────────────────────────

function deriveAllocatorLesson(episode: HistoricalEpisode, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  const baseLesson = episode.keyLesson;

  // Derive allocator-specific implication from the episode lesson
  const allocatorFraming = ar
    ? `الدرس للمخصص: ${baseLesson} — المخصص المحافظ في هذا السياق: ${episode.saudiDimension ?? "الانتقائية والصبر أثمرا بعد مرحلة الضغط."}`
    : `Allocator lesson: ${baseLesson} — conservative allocator in this context: ${episode.saudiDimension ?? "selectivity and patience rewarded after the stress phase."}`;

  return allocatorFraming;
}

// ─── Governance note ─────────────────────────────────────────────────────────

function buildGovernanceNote(lang: "ar" | "en"): string {
  return lang === "ar"
    ? "حوكمة استخدام الأنالوغ التاريخي: (1) سمّ الأنالوغ وذكر خصائصه المطابقة؛ (2) أدرج صراحةً ما يختلف هذه المرة؛ (3) لا تستخدمه كإشارة دخول/خروج محددة؛ (4) اربطه بالبيانات الحالية المتاحة، لا الماضي وحده."
    : "Historical analog governance: (1) name the analog and state matching characteristics; (2) explicitly state what is different this time; (3) never use as a specific entry/exit signal; (4) ground in current available data, not past alone.";
}

// ─── Main public API ──────────────────────────────────────────────────────────

/**
 * Multi-cycle historical analog comparison for a given question/context.
 * Returns primary + secondary + conflicting analogs with structured context.
 * Distinct from findHistoricalAnalog() in historicalLearning.ts which returns
 * only the single best keyword match.
 */
export function findMultiCycleAnalogs(
  question: string,
  ctx: string,
  lang: "ar" | "en",
): HistoricalAnalogEngineResult {
  const category = detectCycleCategory(question, ctx);

  // Merge base + supplementary episodes, score all
  const ALL_EPISODES = [...HISTORICAL_EPISODES, ...SUPPLEMENTARY_EPISODES];
  const scored = ALL_EPISODES.map(ep => {
    const baseScore = scoreEpisode(ep, question, ctx, category);
    // Penalise high false-analog-risk episodes
    const falseRisk = assessFalseAnalogRisk(ep, question, ctx);
    const adjustedScore = Math.max(0, baseScore - falseRisk.risk);
    return {
      ep,
      score: adjustedScore,
      matchingFeatures: findMatchingFeatures(ep, question, ctx),
      differingFeatures: [
        ...findDifferingFeatures(ep, question, ctx),
        ...(falseRisk.risk >= 2 ? [`⚠ False analog risk: ${falseRisk.explanation}`] : []),
      ],
    };
  }).sort((a, b) => b.score - a.score);

  const withScore = scored.filter(s => s.score > 0);

  const buildRegimeAnalog = (item: typeof scored[0]): RegimeAnalog => ({
    episode: item.ep,
    matchScore: item.score,
    matchingFeatures: item.matchingFeatures,
    differingFeatures: item.differingFeatures,
    saudiRelevance: item.ep.saudiDimension ?? (lang === "ar" ? "لا تأثير سعودي محدد في هذا الأنالوغ." : "No specific Saudi dimension in this analog."),
    allocatorLesson: deriveAllocatorLesson(item.ep, lang),
  });

  const primaryAnalog = withScore.length > 0 ? buildRegimeAnalog(withScore[0]) : null;
  const secondaryAnalog = withScore.length > 1 ? buildRegimeAnalog(withScore[1]) : null;

  // Find the conflicting analog — one that supports the OPPOSITE of the primary direction
  const conflicting = withScore.find(s =>
    s.ep !== withScore[0]?.ep &&
    s.ep !== withScore[1]?.ep &&
    s.score > 0,
  );
  const conflictingAnalog = conflicting ? buildRegimeAnalog(conflicting) : null;

  const saudiCycleContext = buildSaudiCycleContext(category, primaryAnalog, lang);
  const governanceNote = buildGovernanceNote(lang);

  // Build compact context block for injection
  const parts: string[] = [];
  if (primaryAnalog) {
    parts.push(lang === "ar"
      ? `[أنالوغ تاريخي رئيسي: ${primaryAnalog.episode.name} (${primaryAnalog.episode.period})] ${primaryAnalog.episode.keyLesson}`
      : `[Primary analog: ${primaryAnalog.episode.name} (${primaryAnalog.episode.period})] ${primaryAnalog.episode.keyLesson}`);
    if (primaryAnalog.matchingFeatures.length > 0) {
      parts.push(lang === "ar"
        ? `المطابق الآن: ${primaryAnalog.matchingFeatures.join("; ")}`
        : `Matching now: ${primaryAnalog.matchingFeatures.join("; ")}`);
    }
    if (primaryAnalog.differingFeatures.length > 0) {
      parts.push(lang === "ar"
        ? `يختلف هذه المرة: ${primaryAnalog.differingFeatures.join("; ")}`
        : `Different this time: ${primaryAnalog.differingFeatures.join("; ")}`);
    }
  }
  if (secondaryAnalog) {
    parts.push(lang === "ar"
      ? `[أنالوغ ثانوي: ${secondaryAnalog.episode.name}] ${secondaryAnalog.episode.keyLesson}`
      : `[Secondary analog: ${secondaryAnalog.episode.name}] ${secondaryAnalog.episode.keyLesson}`);
  }
  parts.push(governanceNote);

  return {
    category,
    primaryAnalog,
    secondaryAnalog,
    conflictingAnalog,
    contextBlock: parts.join("\n"),
    saudiCycleContext,
    governanceNote,
  };
}

/**
 * Builds a compact Saudi-specific historical cycle context for investment questions.
 * Includes breakeven cycle history and base rate returns by regime.
 */
export function buildSaudiHistoricalCycleContext(
  category: CycleCategory,
  lang: "ar" | "en",
): string {
  return buildSaudiCycleContext(category, null, lang);
}
