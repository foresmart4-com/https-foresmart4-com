// P0 Genesis Intelligence Rescue — Shallow Answer Rejection Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Responsibilities:
//   1. Score a Genesis reply against 8 institutional depth dimensions (0-100).
//   2. Detect specific shallow patterns in Arabic and English.
//   3. Reject and trigger deterministic repair when total score < 80.
//   4. Provide targeted repair directives for each failing dimension.
//
// Rejection threshold: total weighted score < 80.
// Repair strategy: deterministic enrichment from available track data.
// Retry directive: returned as a context string to be injected on retry.
//
// Distinct from existing modules:
//   qualityGate.ts (P0)     — binary field-presence checks; triggers enrichment
//   qualityHarness.ts (69)  — comprehensive scoring for measurement
//   shallowAnswerRejection  — BLOCKING enforcement based on content patterns + score

import type { GenesisReply } from "@/lib/genesis.functions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RejectionReason =
  | "shallow_phrase_without_mechanism"   // banned phrase detected without causal follow-up
  | "no_causal_chain"                    // no → / because / leads to patterns
  | "no_allocator_logic"                 // no institutional allocator reasoning
  | "no_second_order_effects"            // no contagion beyond direct effects
  | "no_sector_differentiation"          // no named sector with causal linkage
  | "no_disagreement"                    // no bull/bear debate or opposing case
  | "no_actionable_framework"            // no selection framework or criteria
  | "no_missing_evidence"                // no acknowledgement of what's unknown
  | "score_below_threshold";             // composite score < 80

export interface ShallowPattern {
  pattern: RegExp;
  reason: RejectionReason;
  label: string;
}

export interface DimensionScore {
  dimension: string;
  score: number;   // 0-100
  weight: number;
  signals: string[];
  gaps: string[];
}

export interface RejectionResult {
  rejected: boolean;
  totalScore: number;
  reasons: RejectionReason[];
  dimensionScores: DimensionScore[];
  patternsDetected: string[];
  repairDirective: string;
  repairNeeded: boolean;
}

// ─── Shallow pattern detection ───────────────────────────────────────────────
// Patterns that indicate shallow commentary.
// Each pattern triggers rejection if the following ~120 chars lack a causal mechanism.

const SHALLOW_PATTERNS_AR: ShallowPattern[] = [
  {
    pattern: /السوق\s+(متذبذب|يتذبذب|غير\s+مستقر)/gi,
    reason: "shallow_phrase_without_mechanism",
    label: "السوق متذبذب (بلا آلية)",
  },
  {
    pattern: /النفط\s+يؤثر(?!\s+على\s+\S{3,40}\s+من\s+خلال)/gi,
    reason: "shallow_phrase_without_mechanism",
    label: "النفط يؤثر (بلا قناة)",
  },
  {
    pattern: /السيولة\s+محايدة(?!\s+لأن|\s+بمعنى)/gi,
    reason: "shallow_phrase_without_mechanism",
    label: "السيولة محايدة (بلا تفسير)",
  },
  {
    pattern: /الضغط\s+الائتماني\s+معتدل(?!\s+بمعنى|\s+مما\s+يعني)/gi,
    reason: "shallow_phrase_without_mechanism",
    label: "الضغط الائتماني معتدل (بلا تفصيل)",
  },
  {
    pattern: /لا\s+يوجد\s+اتجاه\s+واضح(?!\s+لأن|\s+بسبب)/gi,
    reason: "shallow_phrase_without_mechanism",
    label: "لا يوجد اتجاه واضح (بلا تحليل)",
  },
  {
    pattern: /السوق\s+(جيد|ممتاز|قوي|ضعيف|متراجع)\s+(?!لأن|بسبب|من\s+خلال|إذ)/gi,
    reason: "shallow_phrase_without_mechanism",
    label: "وصف حالة السوق بلا سبب",
  },
];

const SHALLOW_PATTERNS_EN: ShallowPattern[] = [
  {
    pattern: /market\s+is\s+(volatile|uncertain|mixed|unstable)(?!\s+because|\s+due|\s+as)/gi,
    reason: "shallow_phrase_without_mechanism",
    label: "market is volatile/uncertain (no mechanism)",
  },
  {
    pattern: /oil\s+(affects|impacts|influences)\s+(?!the\s+\w{3,30}\s+through|\w+\s+through)/gi,
    reason: "shallow_phrase_without_mechanism",
    label: "oil affects [X] (no channel specified)",
  },
  {
    pattern: /liquidity\s+is\s+(neutral|balanced|adequate)(?!\s+because|\s+as|\s+since)/gi,
    reason: "shallow_phrase_without_mechanism",
    label: "liquidity is neutral (no explanation)",
  },
  {
    pattern: /credit\s+(pressure|stress)\s+is\s+(moderate|manageable)(?!\s+meaning|\s+which)/gi,
    reason: "shallow_phrase_without_mechanism",
    label: "credit stress is moderate (no detail)",
  },
  {
    pattern: /no\s+clear\s+(direction|trend|view)(?!\s+because|\s+as|\s+since|\s+due)/gi,
    reason: "shallow_phrase_without_mechanism",
    label: "no clear direction (no analysis)",
  },
  {
    pattern: /investors\s+should\s+(monitor|watch|consider)\s+(?!the\s+specific|whether)/gi,
    reason: "shallow_phrase_without_mechanism",
    label: "investors should monitor X (no actionable specificity)",
  },
  {
    pattern: /significant\s+uncertainty\s+(?!regarding\s+the\s+specific|because|due\s+to)/gi,
    reason: "shallow_phrase_without_mechanism",
    label: "significant uncertainty (generic, no specifics)",
  },
];

// ─── Causal language detection ────────────────────────────────────────────────

const CAUSAL_AR = [
  /→/g,
  /يؤدي\s+إلى/gi,
  /مما\s+يعني/gi,
  /من\s+خلال\s+قناة/gi,
  /بسبب\s+\S{3,}/gi,
  /لأن\s+\S{3,}/gi,
  /ينتقل\s+عبر/gi,
  /يُفضي\s+إلى/gi,
  /الانتقال\s+من/gi,
  /السلسلة\s+السببية/gi,
];

const CAUSAL_EN = [
  /→/g,
  /leads?\s+to/gi,
  /transmit/gi,
  /channel/gi,
  /mechanism/gi,
  /resulting\s+in/gi,
  /because\s+\S{3,}/gi,
  /if\s+.{5,40}then/gi,
  /fiscal\s+(space|drag|channel)/gi,
  /liquidity\s+(tighten|drain|expan)/gi,
  /therefore/gi,
  /consequently/gi,
];

function countCausal(text: string, lang: "ar" | "en"): number {
  let hits = 0;
  const patterns = lang === "ar" ? CAUSAL_AR : CAUSAL_EN;
  for (const p of patterns) hits += (text.match(p) ?? []).length;
  return Math.min(hits, 20);
}

// ─── Dimension scorers ────────────────────────────────────────────────────────

function scoreCausalDepth(reply: GenesisReply, lang: "ar" | "en"): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  const text = [reply.macroChain, reply.outlook, reply.bullCase, reply.bearCase, reply.baseCase]
    .filter(Boolean).join(" ");
  const causal = countCausal(text, lang);
  let score = Math.min(100, causal * 7);
  if (reply.macroChain) { score = Math.max(score, 30); signals.push("macroChain present"); }
  if (causal >= 6) signals.push(`strong causal density (${causal} hits)`);
  else if (causal >= 3) signals.push(`moderate causal density (${causal} hits)`);
  else gaps.push(`weak causal language (${causal} hits) — missing → chains and mechanism words`);
  return { dimension: "causalDepth", score: Math.max(0, Math.min(100, score)), weight: 0.15, signals, gaps };
}

function scoreInvestmentUsefulness(reply: GenesisReply, isCompanyQ: boolean): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;
  if (reply.committeeStance) { score += 25; signals.push(`committeeStance=${reply.committeeStance}`); }
  else gaps.push("no committeeStance — no allocator deployment decision");
  if (reply.thesis) { score += 20; signals.push("thesis present"); }
  else gaps.push("thesis absent — no directional view");
  if (reply.baseCase) { score += 20; signals.push("baseCase present"); }
  else gaps.push("baseCase absent");
  if (reply.selectionFramework && isCompanyQ) { score += 20; signals.push("selectionFramework present"); }
  else if (isCompanyQ) gaps.push("selectionFramework absent for company question");
  else score += 15;
  if (reply.invalidation) { score += 15; signals.push("invalidation present"); }
  else gaps.push("invalidation absent — view not falsifiable");
  return { dimension: "investmentUsefulness", score: Math.max(0, Math.min(100, score)), weight: 0.15, signals, gaps };
}

function scoreSectorSpecificity(reply: GenesisReply, isSaudi: boolean): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;
  const allText = [reply.sectorLens, reply.outlook, reply.baseCase].filter(Boolean).join(" ");

  if (reply.sectorLens) {
    score += 30; signals.push("sectorLens present");
    // Must name specific sectors AND provide causal linkage
    const hasNamedSectors = /bank|energy|tech|petrochem|telecom|health|consumer|reit|utility|industri|بنك|طاقة|بتروكيماوي|اتصال|صحة|مستهلك|عقار|مرافق|صناعي/i.test(reply.sectorLens);
    if (hasNamedSectors) { score += 30; signals.push("named sectors present"); }
    else gaps.push("sectorLens lacks named sectors");
    const hasCausal = /→|leads? to|يؤدي|transmit|channel|قناة|بسبب|because/.test(reply.sectorLens);
    if (hasCausal) { score += 25; signals.push("causal sector linkage"); }
    else gaps.push("sectorLens lacks causal linkage — sector labels without mechanism");
  } else {
    gaps.push("sectorLens absent");
  }

  if (isSaudi) {
    const hasSaudiSectors = /aramco|أرامكو|sabic|سابك|sama|sama|بنوك|banks|vision 2030|رؤية/i.test(allText);
    if (hasSaudiSectors) { score += 15; signals.push("Saudi sector channels referenced"); }
    else gaps.push("Saudi sector channels (Aramco/SABIC/banks/Vision 2030) not addressed");
  } else {
    score += 15;
  }

  return { dimension: "sectorSpecificity", score: Math.max(0, Math.min(100, score)), weight: 0.10, signals, gaps };
}

function scorePolicyLinkage(reply: GenesisReply, isSaudi: boolean): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;
  const allText = [reply.macroChain, reply.outlook, reply.bullCase, reply.bearCase, reply.voiceReasoning?.policy]
    .filter(Boolean).join(" ");

  const hasCBMention = /fed|federal\s+reserve|central\s+bank|sama|الفيدرالي|المركزي|sama|الفائدة|rates?|monetary\s+policy|rate\s+policy/i.test(allText);
  if (hasCBMention) { score += 30; signals.push("central bank/policy mentioned"); }
  else gaps.push("no central bank or rates context");

  const hasPolicyMechanism = /→|if.{0,30}(fed|rates?|cb)|reaction\s+function|دالة\s+رد\s+الفعل|shadow|SAMA\s+follow|peg\s+constraint|sar\s+peg/i.test(allText);
  if (hasPolicyMechanism) { score += 35; signals.push("policy mechanism/reaction function present"); }
  else gaps.push("no policy reaction function — CB mentioned but mechanism absent");

  if (isSaudi) {
    const hasSamaPeg = /sar\s+peg|peg|ربط|SAMA|same\s+as\s+fed|shadows\s+fed/i.test(allText);
    if (hasSamaPeg) { score += 20; signals.push("SAR peg constraint addressed"); }
    else gaps.push("SAR-USD peg constraint not addressed for Saudi question");
    const hasFiscal = /fiscal\s+(breakeven|space|surplus|deficit)|نقطة\s+التعادل|فائض|عجز\s+الميزانية/i.test(allText);
    if (hasFiscal) { score += 15; signals.push("fiscal channel addressed"); }
    else gaps.push("fiscal channel not addressed for Saudi question");
  } else {
    score += 35;
  }

  return { dimension: "policyLinkage", score: Math.max(0, Math.min(100, score)), weight: 0.10, signals, gaps };
}

function scoreAllocatorRealism(reply: GenesisReply): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;
  const allText = [
    reply.committeeStance, reply.selectionFramework, reply.outlook,
    reply.voiceReasoning?.allocator, reply.committeeSynthesis?.finalStance,
  ].filter(Boolean).join(" ");

  const hasAllocatorPerspective = /allocat|مخصص|مستثمر\s+محافظ|conservative\s+investor|institutional\s+(investor|allocator)|drawdown|mandate|deployment\s+(capital|timing)|أفق\s+(استثماري|زمني)/i.test(allText);
  if (hasAllocatorPerspective) { score += 35; signals.push("allocator perspective present"); }
  else gaps.push("no institutional allocator perspective — missing deployment/mandate framing");

  const hasStance = reply.committeeStance !== undefined;
  if (hasStance) { score += 25; signals.push(`committeeStance=${reply.committeeStance}`); }
  else gaps.push("no committee stance — no allocator decision");

  const hasVoiceAllocator = !!reply.voiceReasoning?.allocator;
  if (hasVoiceAllocator) { score += 25; signals.push("allocator voice reasoning present"); }
  else gaps.push("allocator voice reasoning absent");

  const hasSelectivity = /selective\s+over\s+broad|انتقائية\s+قطاعية|selective\s+exposure|broad\s+exposure/i.test(allText);
  if (hasSelectivity) { score += 15; signals.push("broad vs selective exposure addressed"); }
  else gaps.push("broad vs selective exposure not addressed");

  return { dimension: "allocatorRealism", score: Math.max(0, Math.min(100, score)), weight: 0.15, signals, gaps };
}

function scoreSecondOrderReasoning(reply: GenesisReply): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;
  const allText = [reply.secondOrderRisks, reply.macroChain, reply.bearCase, reply.baseCase, reply.outlook]
    .filter(Boolean).join(" ");

  if (reply.secondOrderRisks) { score += 50; signals.push("secondOrderRisks field present"); }
  else gaps.push("secondOrderRisks absent — no second-order contagion analysis");

  const hasSecondOrderLanguage = /second.order|second\s+order|contagion|التأثير\s+الثانوي|تداعيات\s+غير\s+مباشرة|يولّد\s+بدوره|في\s+المرحلة\s+التالية|downstream|ripple\s+effect|cascad/i.test(allText);
  if (hasSecondOrderLanguage) { score += 35; signals.push("second-order language detected"); }
  else gaps.push("no second-order contagion language in any field");

  const hasCreditSpread = /credit\s+spread|spread\s+widen|فوارق\s+الائتمان|نقل\s+العدوى/i.test(allText);
  if (hasCreditSpread) { score += 15; signals.push("credit contagion channel mentioned"); }

  return { dimension: "secondOrderReasoning", score: Math.max(0, Math.min(100, score)), weight: 0.10, signals, gaps };
}

function scoreEvidenceDiscipline(reply: GenesisReply): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  if (reply.missingEvidence) { score += 30; signals.push("missingEvidence present"); }
  else gaps.push("missingEvidence absent — reply claims completeness without acknowledging gaps");

  if (reply.caveats && reply.caveats.length > 0) { score += 25; signals.push(`${reply.caveats.length} caveat(s)`); }
  else gaps.push("no caveats — reasoning may be overconfident");

  const conf = reply.confidence ?? 50;
  const es = reply.evidenceStrength ?? 50;
  if (Math.abs(conf - es) <= 15) { score += 25; signals.push(`confidence (${conf}%) aligned with evidenceStrength (${es})`); }
  else gaps.push(`confidence-evidence gap too large (${conf}% vs ${es}) — confidence not earned`);

  if (reply.thesisChanger) { score += 20; signals.push("thesisChanger present"); }
  else gaps.push("thesisChanger absent — no falsifiable view");

  return { dimension: "evidenceDiscipline", score: Math.max(0, Math.min(100, score)), weight: 0.15, signals, gaps };
}

function scoreNonRepetition(reply: GenesisReply): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 100;

  const GENERIC_FILLER = [
    /monitor\s+the\s+market/gi, /significant\s+uncertainty/gi,
    /exciting\s+opportunity/gi, /important\s+to\s+note/gi,
    /investors\s+should\s+watch/gi, /conditions\s+remain\s+(positive|negative|stable)/gi,
    /market\s+conditions\s+are/gi, /generally\s+(bullish|bearish)/gi,
    /السوق\s+يشهد\s+تحسناً/gi, /ينصح\s+بالمتابعة/gi,
    /يبقى\s+على\s+حذر/gi, /يُنصح\s+بالانتظار\b/gi,
  ];

  const allText = [reply.outlook, reply.headline, reply.macroChain].filter(Boolean).join(" ");
  let fillerCount = 0;
  for (const p of GENERIC_FILLER) {
    if (p.test(allText)) { fillerCount++; score -= 12; }
  }
  if (fillerCount === 0) signals.push("no generic filler phrases detected");
  else gaps.push(`${fillerCount} generic filler phrase(s) detected`);

  // Check for repeated sentence fragments (crude deduplication)
  const sentences = allText.split(/[.!?؟]/g).map(s => s.trim().toLowerCase()).filter(s => s.length > 20);
  const seen = new Set<string>();
  let dupeCount = 0;
  for (const s of sentences) {
    const key = s.slice(0, 30);
    if (seen.has(key)) { dupeCount++; score -= 10; }
    seen.add(key);
  }
  if (dupeCount > 0) gaps.push(`${dupeCount} repeated sentence fragment(s) detected`);

  return { dimension: "nonRepetition", score: Math.max(0, Math.min(100, score)), weight: 0.10, signals, gaps };
}

// ─── Shallow pattern detection in full reply text ─────────────────────────────

function detectShallowPhrases(reply: GenesisReply, lang: "ar" | "en"): string[] {
  const allText = [reply.headline, reply.outlook, reply.macroChain, reply.sectorLens, reply.baseCase]
    .filter(Boolean).join(" ");

  const patterns = lang === "ar" ? SHALLOW_PATTERNS_AR : SHALLOW_PATTERNS_EN;
  const detected: string[] = [];

  for (const { pattern, label } of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(allText);
    if (match) {
      // Check if followed by a causal mechanism (→ or "because" / "لأن" within 120 chars)
      const afterMatch = allText.slice(match.index + match[0].length, match.index + match[0].length + 120);
      const hasMechanism = /→|يؤدي|من\s+خلال\s+قناة|بسبب|لأن|leads?\s+to|because|through\s+the|channel/i.test(afterMatch);
      if (!hasMechanism) detected.push(label);
    }
  }
  return detected;
}

// ─── Repair directive builder ─────────────────────────────────────────────────
// Returns a context string to inject on a deterministic repair pass.

function buildRepairDirective(
  dimensionScores: DimensionScore[],
  patternsDetected: string[],
  lang: "ar" | "en",
): string {
  const ar = lang === "ar";
  const failingDimensions = dimensionScores.filter(d => d.score < 70).map(d => `${d.dimension}(${d.score}/100): ${d.gaps[0] ?? "improve"}`);

  if (ar) {
    const parts = [
      "توجيه الإصلاح الحتمي — يجب تطبيق التالي:",
      failingDimensions.length > 0
        ? `الأبعاد الفاشلة: ${failingDimensions.join("; ")}`
        : "",
      patternsDetected.length > 0
        ? `الأنماط السطحية المكتشفة (يجب تجاوزها): ${patternsDetected.join(", ")}`
        : "",
      'أضف حقل "secondOrderRisks": التأثيرات الثانوية المتسلسلة من السيناريو الأساسي — بعيداً عن الأثر المباشر.',
      "أضف آلية سببية صريحة (→) لكل ادعاء رئيسي.",
      "أضف موقف المخصص المؤسسي: الدخول التدريجي أو الانتظار أو التجنب — مع السبب.",
      "أضف اشتراطات: ماذا سيحدث إذا تغيّر السعر/السياسة/الأرباح — بحدود قابلة للقياس.",
    ].filter(Boolean);
    return parts.join("\n");
  }

  const parts = [
    "DETERMINISTIC REPAIR DIRECTIVE — apply the following:",
    failingDimensions.length > 0
      ? `Failing dimensions: ${failingDimensions.join("; ")}`
      : "",
    patternsDetected.length > 0
      ? `Shallow patterns detected (must supersede): ${patternsDetected.join(", ")}`
      : "",
    'Add "secondOrderRisks" field: cascading second-order effects from the primary scenario — beyond the direct impact.',
    "Add explicit causal mechanism (→) for every primary claim.",
    "Add institutional allocator stance: scale-in, wait, or avoid — with specific reason.",
    "Add measurable conditions: what happens if price/policy/earnings changes — with observable thresholds.",
  ].filter(Boolean);
  return parts.join("\n");
}

// ─── Deterministic repair function ───────────────────────────────────────────
// Fills missing depth fields in the reply from available track evidence.
// Called when total score < 80. Never overwrites non-empty fields.

interface RepairTrackSlice {
  regime?: string;
  macroSummary?: string;
  ratesEnv?: string;
  oilLiquidity?: string;
  creditStressLevel?: "low" | "moderate" | "high" | "extreme";
  macroBias?: "bullish" | "bearish" | "neutral";
}

interface RepairConsensusSlice {
  dominantBias: "bullish" | "bearish" | "neutral";
  agreementScore: number;
  strength: "strong" | "moderate" | "weak" | "conflicted";
}

export function repairShallowAnswer(
  reply: GenesisReply,
  trackA: RepairTrackSlice | null,
  consensus: RepairConsensusSlice,
  isSaudi: boolean,
  lang: "ar" | "en",
): void {
  const ar = lang === "ar";
  const bias = consensus.dominantBias;
  const credit = trackA?.creditStressLevel ?? "moderate";
  const regime = (trackA?.regime ?? "current regime").replace(/_/g, " ");

  // Fill secondOrderRisks if absent
  if (!reply.secondOrderRisks) {
    if (isSaudi) {
      reply.secondOrderRisks = ar
        ? `إذا انخفض النفط دون نقطة التعادل → تقلّص الإنفاق الحكومي يُفضي إلى تباطؤ الإقراض المصرفي → تراجع تقييمات العقارات → انضغاط ثروة الأسرة → تراجع الطلب الاستهلاكي — أبعد من الأثر المباشر على قطاع الطاقة. إذا واصل الفيدرالي تثبيت الأسعار → تكاليف الاقتراض السعودية مرتفعة تُعيق نمو الائتمان → القطاعات ذات الرافعة المالية تتراجع بأسرع من الدفاعيات.`
        : `If oil falls below fiscal breakeven → government spending contraction drives bank lending deceleration → real estate valuation compression → household wealth effect dampening consumer demand — well beyond the direct energy sector impact. If Fed maintains rates → Saudi borrowing costs stay elevated, credit growth impaired → leveraged sectors decline faster than defensives.`;
    } else {
      reply.secondOrderRisks = ar
        ? `في نظام ${regime} بتوجه ${bias === "bullish" ? "صاعد" : bias === "bearish" ? "هابط" : "محايد"}: ${credit === "high" || credit === "extreme" ? `اتساع فوارق الائتمان يرفع تكاليف إعادة التمويل → انكماش سيولة الأصول ذات الرافعة → ضغط على صناديق التحوط المُعتمدة على الرافعة → مخاطر تصفية مُعدية تمتد لما وراء القطاعات المتعثرة.` : `تحرك الأسعار في نظام ${regime} يُعيد توزيع تدفقات رأس المال → القطاعات المستفيدة تستقطب رأس المال من القطاعات الخاسرة → المراكز الحشدية في المنتصر ترفع مخاطر الانعكاس.`}`
        : `In ${regime} regime with ${bias} bias: ${credit === "high" || credit === "extreme" ? `credit spread widening raises refinancing costs → leveraged asset liquidity contracts → hedge fund deleveraging pressures → contagion liquidation risk extends beyond directly stressed sectors.` : `rate movement in ${regime} regime redistributes capital flows → winning sectors attract capital from losing sectors → crowded positioning in the winner increases mean-reversion risk.`}`;
    }
  }

  // Strengthen macroChain with causal arrows if it's flat
  if (reply.macroChain && !/→/.test(reply.macroChain)) {
    const prefix = ar
      ? `سلسلة الانتقال السببي: `
      : `Transmission chain: `;
    const chain = trackA?.ratesEnv
      ? (ar
          ? `${trackA.ratesEnv} → تكلفة رأس المال → التقييم → قرار التخصيص.`
          : `${trackA.ratesEnv} → cost of capital → valuation multiples → allocation decision.`)
      : (ar
          ? `نظام الماكرو الحالي → ضغط الائتمان → توجه مضاعفات التقييم → قرار تخصيص رأس المال.`
          : `Current macro regime → credit pressure → valuation multiple direction → capital allocation decision.`);
    reply.macroChain = `${prefix}${chain} ${reply.macroChain}`;
  }

  // Add allocator framing to committeeSynthesis.finalStance if absent
  if (reply.committeeSynthesis && !reply.committeeSynthesis.finalStance) {
    const stance = bias === "bullish" && credit === "low"
      ? (ar ? "دخول تدريجي — النظام والائتمان يدعمان التوجه الصاعد." : "Scale in gradually — regime and credit support constructive bias.")
      : bias === "bearish" || credit === "high" || credit === "extreme"
        ? (ar ? "تعرض محافظ أو تحوط — النظام يستوجب الحذر." : "Conservative exposure or hedge — regime warrants caution.")
        : (ar ? "انتقائية قطاعية — التعرض الواسع لا يُبرر في النظام الحالي." : "Sector selectivity — broad exposure not warranted in current regime.");
    reply.committeeSynthesis.finalStance = stance;
  }

  // Ensure missingEvidence is present
  if (!reply.missingEvidence) {
    reply.missingEvidence = isSaudi
      ? (ar
          ? "أدلة مفقودة: مستوى النفط الحالي بالنسبة لنقطة التعادل السعودية، بيانات أرباح أرامكو الأخيرة، تدفقات رأس المال الأجنبي إلى تاسي، توقعات نمو الائتمان البنكي."
          : "Missing evidence: current oil vs Saudi fiscal breakeven, recent Aramco earnings data, foreign capital flows into TASI, bank credit growth forecasts.")
      : (ar
          ? "أدلة مفقودة: بيانات الأرباح الحالية مقابل التوقعات، مستويات التقييم مقارنةً بالنظراء التاريخيين، تأكيد إشارات الأصول المتقاطعة."
          : "Missing evidence: current earnings vs consensus estimates, valuation levels vs historical peer range, cross-asset signal confirmation.");
  }

  // Ensure thesisChanger is present
  if (!reply.thesisChanger) {
    reply.thesisChanger = isSaudi
      ? (ar
          ? "المُغيِّر: تحوّل الفيدرالي نحو التخفيف يدعم تاسي، أو النفط ينخفض دون 70$/ب مما يُعيد تسعير الفرضية المالية السعودية."
          : "Thesis changer: Fed pivot toward easing supports TASI, or oil declining below $70/bbl reprices the Saudi fiscal thesis.")
      : (ar
          ? "المُغيِّر: تحوّل مفاجئ في السياسة المركزية أو توسع ملموس في فوارق الائتمان أو خيبة أمل في أرباح القطاع."
          : "Thesis changer: surprise central bank policy pivot, material credit spread widening, or sector earnings disappointment.");
  }
}

// ─── Main public API ──────────────────────────────────────────────────────────

/**
 * Evaluates a Genesis reply for shallow content and returns a RejectionResult.
 * Score < 80 → rejected = true + repairDirective provided.
 * Pure O(1) — no AI calls, no network.
 */
export function shouldRejectAnswer(
  reply: GenesisReply,
  question: string,
  isInvestment: boolean,
  isSaudi: boolean,
  isCompanyQ: boolean,
  lang: "ar" | "en",
): RejectionResult {
  if (!isInvestment) {
    return {
      rejected: false, totalScore: 100, reasons: [], dimensionScores: [], patternsDetected: [],
      repairDirective: "", repairNeeded: false,
    };
  }

  const dimensionScores: DimensionScore[] = [
    scoreCausalDepth(reply, lang),
    scoreInvestmentUsefulness(reply, isCompanyQ),
    scoreSectorSpecificity(reply, isSaudi),
    scorePolicyLinkage(reply, isSaudi),
    scoreAllocatorRealism(reply),
    scoreSecondOrderReasoning(reply),
    scoreEvidenceDiscipline(reply),
    scoreNonRepetition(reply),
  ];

  const totalScore = Math.round(
    dimensionScores.reduce((sum, d) => sum + d.score * d.weight, 0),
  );

  const patternsDetected = detectShallowPhrases(reply, lang);

  const reasons: RejectionReason[] = [];
  for (const d of dimensionScores) {
    if (d.score < 40) {
      const reasonMap: Record<string, RejectionReason> = {
        causalDepth: "no_causal_chain",
        investmentUsefulness: "no_actionable_framework",
        sectorSpecificity: "no_sector_differentiation",
        policyLinkage: "no_causal_chain",
        allocatorRealism: "no_allocator_logic",
        secondOrderReasoning: "no_second_order_effects",
        evidenceDiscipline: "no_missing_evidence",
        nonRepetition: "shallow_phrase_without_mechanism",
      };
      const reason = reasonMap[d.dimension];
      if (reason) reasons.push(reason);
    }
  }
  if (patternsDetected.length > 0) reasons.push("shallow_phrase_without_mechanism");
  if (totalScore < 80 && !reasons.includes("score_below_threshold")) reasons.push("score_below_threshold");

  const rejected = totalScore < 80 || patternsDetected.length > 2;
  const repairNeeded = rejected;

  const repairDirective = repairNeeded ? buildRepairDirective(dimensionScores, patternsDetected, lang) : "";

  return { rejected, totalScore, reasons, dimensionScores, patternsDetected, repairDirective, repairNeeded };
}
