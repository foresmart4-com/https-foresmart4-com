// Phase-83B: Regime Conflict Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Distinct from existing modules:
//   institutionalReasoning.ts — produces a single reasoningState label (macro_conflict etc.)
//   qualityHarness.ts — checks field presence
//   regimeConflictEngine (83B) — explicitly detects NAMED conflict pairs (macro vs policy,
//                                oil vs liquidity, etc.) with severity, resolution logic,
//                                and a "fake consensus risk" assessment.
//
// Core problem: when Genesis produces "moderate outlook" or "mixed signals" it is often
// papering over real conflicts that institutional investors must surface and resolve.
// A conservative allocator does not produce fake consensus — they name the conflict and
// explain which side wins on the weight of available evidence.

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConflictType =
  | "macro_vs_policy"          // supportive macro regime BUT restrictive CB policy
  | "oil_vs_liquidity"         // strong oil BUT tight global liquidity (DXY/credit)
  | "earnings_vs_valuation"    // strong earnings BUT stretched valuations
  | "sentiment_vs_fundamentals"// positive sentiment BUT weak fundamentals
  | "technical_vs_macro"       // bullish technicals BUT adverse macro regime
  | "saudi_fiscal_vs_rates"    // Saudi fiscal surplus BUT SAMA rate constraint
  | "vision_growth_vs_earnings"; // Vision 2030 growth narrative BUT no current earnings

export type ConflictSeverity = "critical" | "significant" | "minor";
export type ConflictWinner = "A" | "B" | "unresolved";

export interface ConflictPair {
  type: ConflictType;
  sideA: string;         // description of the supportive side
  sideB: string;         // description of the conflicting side
  severity: ConflictSeverity;
  resolutionLogic: string; // which side typically wins over 12-24M horizon and why
  winner: ConflictWinner;
  allocatorImplication: string; // what this conflict means for an allocator decision
}

export interface ConflictAnalysis {
  conflicts: ConflictPair[];
  dominantConflict: ConflictPair | null;
  fakeConsensusRisk: boolean;        // true if reply might create fake consensus
  conflictCount: number;
  conflictContext: string;           // compact injectable directive
  resolutionSummary: string;         // 1-2 sentence synthesis
}

// ─── Input slices ──────────────────────────────────────────────────────────────

interface TrackASlice {
  regime?: string;
  macroBias?: "bullish" | "bearish" | "neutral";
  creditStressLevel?: "low" | "moderate" | "high" | "extreme";
  ratesEnv?: string;
  oilLiquidity?: string;
  dxyImpact?: string;
  regimeConf?: number;
}

interface TrackDSlice {
  counterCase?: string;
  primaryRisk?: string;
  thesisWeakness?: string;
  uncertaintyLevel?: "low" | "moderate" | "high" | "extreme";
}

interface ConsensusSlice {
  dominantBias: "bullish" | "bearish" | "neutral";
  strength: "strong" | "moderate" | "weak" | "conflicted";
  agreementScore: number;
}

// ─── Conflict detectors ───────────────────────────────────────────────────────

function detectMacroVsPolicy(
  trackA: TrackASlice,
  lang: "ar" | "en",
): ConflictPair | null {
  const ar = lang === "ar";
  const ratesText = (trackA.ratesEnv ?? "").toLowerCase();
  const isMacroConstructive = trackA.macroBias === "bullish" || trackA.regimeConf && trackA.regimeConf >= 60;
  const isPolicyRestrictive = /tight|restrictive|hold|above\s+neutral|hike|مرتفع|تشديد|تقييد/.test(ratesText);

  if (!isMacroConstructive || !isPolicyRestrictive) return null;

  return {
    type: "macro_vs_policy",
    sideA: ar
      ? `الماكرو بنّاء: النظام ${trackA.regime?.replace(/_/g, " ") ?? "الحالي"} يدعم أسعار المخاطرة.`
      : `Constructive macro: ${trackA.regime?.replace(/_/g, " ") ?? "current"} regime supports risk assets.`,
    sideB: ar
      ? `السياسة مُقيِّدة: ${ratesText.slice(0, 80)} — ضغط على المضاعفات.`
      : `Restrictive policy: ${ratesText.slice(0, 80)} — multiple compression pressure.`,
    severity: "significant",
    resolutionLogic: ar
      ? "السياسة النقدية تتحكم في التقييم على أفق 12-24 شهراً؛ الماكرو الصاعد يُترجَم إلى أرباح في النهاية لكن المضاعفات ستظل مضغوطة حتى يتحول الفيدرالي."
      : "Monetary policy controls valuations over the 12-24M horizon; constructive macro eventually translates to earnings but multiples remain compressed until Fed pivots.",
    winner: "B",
    allocatorImplication: ar
      ? "في نظام متعارض بين الماكرو والسياسة: الانتقائية القطاعية (جودة+تدفق نقدي حر+عائد) تتفوق على التعرض الواسع."
      : "In macro-vs-policy conflict: sector selectivity (quality+FCF+yield) outperforms broad exposure.",
  };
}

function detectOilVsLiquidity(
  trackA: TrackASlice,
  lang: "ar" | "en",
): ConflictPair | null {
  const ar = lang === "ar";
  const oilText = (trackA.oilLiquidity ?? "").toLowerCase();
  const dxyText = (trackA.dxyImpact ?? "").toLowerCase();
  const isOilStrong = /above|strong|high|surplus|فوق|قوي|مرتفع|فائض/.test(oilText);
  const isLiquidityTight = trackA.creditStressLevel === "high" || trackA.creditStressLevel === "extreme" ||
    /strong|rising|dxy\s+up|دولار\s+قوي|DXY\s+يرتفع/.test(dxyText);

  if (!isOilStrong || !isLiquidityTight) return null;

  return {
    type: "oil_vs_liquidity",
    sideA: ar
      ? `النفط قوي: ${oilText.slice(0, 60)} — دعم مالي ومعنوي للأسواق الناشئة.`
      : `Strong oil: ${oilText.slice(0, 60)} — fiscal and sentiment support for EM.`,
    sideB: ar
      ? `السيولة ضيقة: ضغط ائتماني ${trackA.creditStressLevel ?? "مرتفع"} ${dxyText.slice(0, 40)} — عائق تدفقات رأس المال.`
      : `Tight liquidity: ${trackA.creditStressLevel ?? "elevated"} credit stress ${dxyText.slice(0, 40)} — capital flow headwind.`,
    severity: trackA.creditStressLevel === "extreme" ? "critical" : "significant",
    resolutionLogic: ar
      ? "النفط يدعم الأساسيات لكن ضيق السيولة العالمية يُحجب إعادة التسعير في الأسواق الناشئة؛ السيولة العالمية تهيمن على التدفقات قصيرة المدى."
      : "Oil supports fundamentals but tight global liquidity suppresses EM re-pricing; global liquidity dominates near-term flows.",
    winner: "B",
    allocatorImplication: ar
      ? "انتظار تيسير السيولة العالمية (تخفيف DXY/فيدرالي) قبل المراهنة على إعادة تسعير الأصول الناشئة النفطية."
      : "Wait for global liquidity easing (DXY/Fed pivot) before betting on oil-EM re-pricing.",
  };
}

function detectEarningsVsValuation(
  trackA: TrackASlice,
  lang: "ar" | "en",
): ConflictPair | null {
  const ar = lang === "ar";
  // Check if regime indicates earnings growth but credit/rates suggest valuation stretch
  const isEarningsPositive = trackA.macroBias === "bullish" && trackA.regimeConf && trackA.regimeConf >= 55;
  const isValuationStretched = (trackA.creditStressLevel === "moderate" || trackA.creditStressLevel === "high") &&
    /high|stretch|exten|مرتفع|ممتد|متوسع/.test((trackA.ratesEnv ?? "").toLowerCase());

  if (!isEarningsPositive || !isValuationStretched) return null;

  return {
    type: "earnings_vs_valuation",
    sideA: ar
      ? "الأرباح قوية: النظام الصاعد يدعم نمو EPS في البيئة الحالية."
      : "Strong earnings: bullish regime supports EPS growth in current environment.",
    sideB: ar
      ? "التقييم ممتد: ظروف الأسعار/الائتمان تُقلّص العلاوة المدفوعة مقابل النمو."
      : "Valuation stretched: rates/credit conditions reduce the premium warranted for growth.",
    severity: "significant",
    resolutionLogic: ar
      ? "توسع مضاعفات PE مبني على التوقعات — عرضة للانعكاس الفوري. نمو EPS قائم على الأرباح الفعلية — أكثر استدامة. الأطروحة المبنية على نمو EPS أقل تأثراً بالتحول السياسي."
      : "PE multiple expansion is expectations-driven — immediately reversible. EPS growth is earnings-driven — more durable. EPS-growth thesis is less vulnerable to policy shift.",
    winner: "unresolved",
    allocatorImplication: ar
      ? "التمييز ضروري: إذا كان الصعود مدفوعاً بتوسع PE → أحجم وتأكد؛ إذا كان مدفوعاً بنمو EPS → قناعة أعلى."
      : "Distinction is mandatory: if upside is PE-expansion driven → reduce size and confirm; if EPS-growth driven → higher conviction warranted.",
  };
}

function detectSentimentVsFundamentals(
  trackA: TrackASlice,
  consensus: ConsensusSlice,
  lang: "ar" | "en",
): ConflictPair | null {
  const ar = lang === "ar";
  const isSentimentPositive = consensus.dominantBias === "bullish" && consensus.agreementScore >= 65;
  const isFundamentalsWeak = trackA.creditStressLevel === "high" || trackA.macroBias === "bearish" || trackA.creditStressLevel === "extreme";

  if (!isSentimentPositive || !isFundamentalsWeak) return null;

  return {
    type: "sentiment_vs_fundamentals",
    sideA: ar
      ? `الإجماع إيجابي: ${consensus.agreementScore}% اتفاق صاعد عبر الوكلاء.`
      : `Positive consensus: ${consensus.agreementScore}% bullish agreement across agents.`,
    sideB: ar
      ? `الأساسيات ضعيفة: ضغط ائتماني ${trackA.creditStressLevel ?? "مرتفع"} / نظام كلي ${trackA.macroBias ?? "ضعيف"}.`
      : `Weak fundamentals: ${trackA.creditStressLevel ?? "elevated"} credit stress / ${trackA.macroBias ?? "bearish"} macro regime.`,
    severity: "significant",
    resolutionLogic: ar
      ? "الأساسيات تتحكم في المآلات على أفق 12-24 شهراً؛ توافق الإجماع المدفوع بالتحسينات الهامشية يُلغى عند ظهور بيانات هيكلية معاكسة."
      : "Fundamentals govern outcomes over 12-24M; consensus alignment driven by marginal improvements reverses on structural negative data.",
    winner: "B",
    allocatorImplication: ar
      ? "التوافق المرتفع مع أساسيات ضعيفة = تحذير تراجع (خطر الازدحام). المحافظ يُقلّص التعرض الواسع؛ يتمسك فقط بالجودة المدعومة بأساسيات."
      : "High consensus with weak fundamentals = drawdown warning (crowding risk). Conservative allocator reduces broad exposure; holds only fundamental-backed quality.",
  };
}

function detectSaudiFiscalVsRates(
  trackA: TrackASlice,
  lang: "ar" | "en",
): ConflictPair | null {
  if (!trackA.oilLiquidity) return null;
  const ar = lang === "ar";
  const oilText = trackA.oilLiquidity.toLowerCase();
  const isFiscalPositive = /above|surplus|فوق|فائض/.test(oilText);
  const isRatesRestrictive = /restrictive|tight|hike|hold|تشديد|تثبيت|رفع/.test((trackA.ratesEnv ?? "").toLowerCase());

  if (!isFiscalPositive || !isRatesRestrictive) return null;

  return {
    type: "saudi_fiscal_vs_rates",
    sideA: ar
      ? `الفضاء المالي إيجابي: النفط فوق نقطة التعادل → فائض الميزانية يدعم الإنفاق الحكومي.`
      : `Positive fiscal space: oil above breakeven → budget surplus supports government spending.`,
    sideB: ar
      ? `قيد الأسعار: SAMA مُقيَّدة بربط SAR-USD — تكاليف الاقتراض لا تستطيع أن تنخفض مستقلةً.`
      : `Rate constraint: SAMA constrained by SAR-USD peg — borrowing costs cannot independently decline.`,
    severity: "significant",
    resolutionLogic: ar
      ? "الفضاء المالي يدعم الإنفاق (إيجابي لرؤية 2030)؛ لكن ارتفاع تكاليف الاقتراض يُقيّد نمو الائتمان المصرفي وتقييمات القطاعات ذات الرافعة."
      : "Fiscal space supports spending (positive for Vision 2030); but high borrowing costs constrain bank credit growth and leveraged sector valuations.",
    winner: "unresolved",
    allocatorImplication: ar
      ? "انتقائية القطاعات: أرامكو (مستفيدة من الفضاء المالي) تتفوق على أسماء رؤية 2030 ذات الرافعة العالية (تتأثر بتكاليف الاقتراض)."
      : "Sector selectivity: Aramco (benefits from fiscal space) outperforms high-leverage Vision 2030 names (hurt by borrowing costs).",
  };
}

function detectVisionGrowthVsEarnings(
  trackA: TrackASlice,
  question: string,
  lang: "ar" | "en",
): ConflictPair | null {
  if (!/vision|رؤية|neom|نيوم|2030/.test(question.toLowerCase())) return null;
  const ar = lang === "ar";

  return {
    type: "vision_growth_vs_earnings",
    sideA: ar
      ? "رواية نمو رؤية 2030: مشاريع كبرى تُنشئ إمكانيات جديدة ومضاعفات تقييم متوسعة."
      : "Vision 2030 growth narrative: mega-projects create new opportunities and expanding valuation multiples.",
    sideB: ar
      ? "الأرباح الفعلية: معظم مشاريع رؤية 2030 في مرحلة استهلاك رأس المال؛ لا أرباح تُذكر في المدى القريب."
      : "Actual earnings: most Vision 2030 projects are in capital-consuming phase; negligible near-term earnings.",
    severity: "significant",
    resolutionLogic: ar
      ? "أسماء رؤية 2030 تتداول على أرباح مستقبلية متوقعة، لا حالية؛ المضاعفات عرضة للانكماش إذا تباطأ الإنفاق أو تأخر الجدول الزمني."
      : "Vision 2030 names trade on expected future earnings, not current; multiples are vulnerable to compression if spending slows or timeline slips.",
    winner: "B",
    allocatorImplication: ar
      ? "المحافظ يتجنب أسماء رؤية 2030 عالية المضاعفات حتى تظهر أرباح ملموسة؛ الأفضلية للقطاعات ذات التدفق النقدي الحر الفعلي."
      : "Conservative allocator avoids high-multiple Vision 2030 names until material earnings appear; preference for sectors with actual FCF.",
  };
}

// ─── Fake consensus risk ──────────────────────────────────────────────────────

function assessFakeConsensusRisk(
  conflicts: ConflictPair[],
  consensus: ConsensusSlice,
): boolean {
  // Risk is high when there are significant conflicts but consensus appears strong
  const hasSignificantConflicts = conflicts.some(c => c.severity === "critical" || c.severity === "significant");
  const appearsHighConsensus = consensus.strength === "strong" || consensus.agreementScore >= 70;
  return hasSignificantConflicts && appearsHighConsensus;
}

// ─── Context builder ──────────────────────────────────────────────────────────

function buildConflictContext(analysis: ConflictAnalysis, lang: "ar" | "en"): string {
  const ar = lang === "ar";

  if (analysis.conflicts.length === 0) {
    return ar
      ? "تحليل التعارض: لا تعارض جوهري مكتشف — الإشارات تتسق بما يكفي للموقف الاتجاهي."
      : "Conflict analysis: no material conflicts detected — signals sufficiently consistent for directional stance.";
  }

  const header = ar
    ? `تعارضات الإشارات المكتشفة (${analysis.conflictCount}) — يجب أن يُعالجها الرد:`
    : `Detected signal conflicts (${analysis.conflictCount}) — reply MUST address:`;

  const conflictLines = analysis.conflicts.slice(0, 3).map((c, i) => {
    const winnerLabel = c.winner === "A" ? (ar ? "الجانب أ يفوز" : "Side A wins") :
                        c.winner === "B" ? (ar ? "الجانب ب يفوز" : "Side B wins") :
                        (ar ? "غير محسوم" : "unresolved");
    return `${i + 1}. ${c.sideA} ↔ ${c.sideB} → ${winnerLabel}: ${c.resolutionLogic.slice(0, 100)}`;
  });

  const rule = ar
    ? (analysis.fakeConsensusRisk
        ? "⚠ خطر إجماع زائف: التعارضات الموجودة يجب أن تُسمَّى صراحةً — الموقف المتفائل بلا تناقضات = تحليل ناقص."
        : "قاعدة: سمّ التعارض الجوهري واذكر أيهما يفوز على وزن الأدلة.")
    : (analysis.fakeConsensusRisk
        ? "⚠ Fake consensus risk: present conflicts MUST be named explicitly — bullish stance without contradiction = incomplete analysis."
        : "Rule: name the material conflict and state which side wins on weight of evidence.");

  return [header, ...conflictLines, rule].filter(Boolean).join("\n");
}

function buildResolutionSummary(analysis: ConflictAnalysis, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  if (analysis.conflicts.length === 0) {
    return ar ? "لا تعارضات كبرى — الإشارات تتسق." : "No major conflicts — signals are aligned.";
  }
  const dominant = analysis.dominantConflict;
  if (!dominant) return ar ? "تعارضات متعددة بدون تسوية واضحة." : "Multiple conflicts without clear resolution.";

  const winnerText = dominant.winner === "A"
    ? (ar ? dominant.sideA.slice(0, 50) : dominant.sideA.slice(0, 50))
    : dominant.winner === "B"
      ? (ar ? dominant.sideB.slice(0, 50) : dominant.sideB.slice(0, 50))
      : (ar ? "غير محسوم" : "unresolved");

  return ar
    ? `التعارض الرئيسي: ${dominant.type.replace(/_/g, " ")}. الحكم: ${winnerText}. ${dominant.allocatorImplication.slice(0, 100)}`
    : `Dominant conflict: ${dominant.type.replace(/_/g, " ")}. Resolution: ${winnerText}. ${dominant.allocatorImplication.slice(0, 100)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detects named conflict pairs from track data and question context.
 * Returns analysis with fake consensus risk assessment and injectable context.
 * Pure O(1) — no AI calls, no network.
 */
export function analyzeRegimeConflicts(
  trackA: TrackASlice | null,
  trackD: TrackDSlice | null,
  consensus: ConsensusSlice,
  question: string,
  isSaudi: boolean,
  lang: "ar" | "en",
): ConflictAnalysis {
  if (!trackA) {
    return {
      conflicts: [],
      dominantConflict: null,
      fakeConsensusRisk: false,
      conflictCount: 0,
      conflictContext: "",
      resolutionSummary: lang === "ar" ? "بيانات مسار غير كافية للكشف عن التعارضات." : "Insufficient track data to detect conflicts.",
    };
  }

  const candidates: Array<ConflictPair | null> = [
    detectMacroVsPolicy(trackA, lang),
    detectOilVsLiquidity(trackA, lang),
    detectEarningsVsValuation(trackA, lang),
    detectSentimentVsFundamentals(trackA, consensus, lang),
    isSaudi ? detectSaudiFiscalVsRates(trackA, lang) : null,
    isSaudi ? detectVisionGrowthVsEarnings(trackA, question, lang) : null,
  ];

  const conflicts = candidates.filter((c): c is ConflictPair => c !== null);

  // Sort by severity (critical first)
  const severityOrder: Record<ConflictSeverity, number> = { critical: 0, significant: 1, minor: 2 };
  conflicts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const dominantConflict = conflicts[0] ?? null;
  const fakeConsensusRisk = assessFakeConsensusRisk(conflicts, consensus);

  const analysis: ConflictAnalysis = {
    conflicts,
    dominantConflict,
    fakeConsensusRisk,
    conflictCount: conflicts.length,
    conflictContext: "",
    resolutionSummary: "",
  };

  analysis.conflictContext = buildConflictContext(analysis, lang);
  analysis.resolutionSummary = buildResolutionSummary(analysis, lang);
  return analysis;
}
