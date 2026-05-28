/**
 * Multi-Agent Debate Intelligence — Phase 32
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Builds a structured internal debate scaffold from context signals:
 * bull case, bear case, macro objection, risk objection, portfolio objection.
 *
 * Design rules:
 * - Deterministic: derived from signal inputs only, no randomness
 * - No fake certainty: debate positions are conditional arguments, not facts
 * - No forced conclusion: contested balance is an honest allowed state
 * - Advisory only: debate affects AI framing, not execution semantics
 * - Confidence is reduced when disagreement is material (not inflated)
 * - No buy/sell language; no "must act now"; no dramatic wording
 * - Firewall governance is preserved and not bypassed
 * - Bounded: max 5 views, context string ≤160 chars
 */

import type { FirewallState } from "@/services/governance/decisionFirewall";
import type { PortfolioRiskLabel } from "@/services/portfolio/portfolioRiskEngine";
import type { RelevanceState, ResearchTopic } from "@/services/research/researchCoverageEngine";
import type { EventSignificance, MacroEventType } from "@/services/macro/macroEventEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DebatePosition =
  | "bull_case"
  | "bear_case"
  | "macro_objection"
  | "risk_objection"
  | "portfolio_objection";

export type DebateBalance =
  | "bull_dominant"   // bull score >= bear + 2, >= 2 bull views
  | "bear_dominant"   // bear score >= bull + 2, >= 2 bear views
  | "contested"       // |bull - bear| <= 1 and both sides have >= 1 view
  | "inconclusive";   // insufficient signals to build meaningful debate

export interface DebateView {
  position: DebatePosition;
  argument: string;    // 1-sentence conditional argument
  strength: "strong" | "moderate" | "weak";
  basis: string;       // which signal this derives from
}

export interface DebateInput {
  question: string;
  regime: string;
  strategicBias: string;          // from strategicSynthesis.bias
  firewallState: FirewallState;
  portfolioRiskLabel: PortfolioRiskLabel;
  hasActiveVulnerability: boolean;
  watchlistCategories: string[];
  coverageTopics: ResearchTopic[];
  macroEventSignificance: EventSignificance;
  macroEventType: MacroEventType | null;
  ar: boolean;
}

export interface DebateResult {
  bullScore: number;
  bearScore: number;
  views: DebateView[];
  strongestBullView: DebateView | null;
  strongestBearView: DebateView | null;
  debateBalance: DebateBalance;
  hasMaterialDisagreement: boolean;
  confidenceImpact: number;    // negative pts to apply to confidence anchor (0 or -5)
  narrative: string;
  contextString: string;       // compact ≤160 chars for AI injection
  hasActiveDebate: boolean;
}

// ─── Bull / Bear / Objection signal rules ────────────────────────────────────

type ViewStrength = "strong" | "moderate" | "weak";

interface ViewCandidate {
  position: DebatePosition;
  argument: (ar: boolean) => string;
  strength: ViewStrength;
  basis: string;
  condition: (input: DebateInput) => boolean;
}

const VIEW_CANDIDATES: ViewCandidate[] = [
  // ── Bull cases ─────────────────────────────────────────────────────────────
  {
    position: "bull_case",
    condition: (i) => ["bull_trending", "low_vol_accumulation", "risk_on"].includes(i.regime),
    strength: "strong",
    basis: "regime",
    argument: (ar) => ar
      ? "النظام الحالي يدعم التحيّز البنّاء — الأدلة تميل نحو الارتفاع مشروطاً بعدم تدهور الإشارات."
      : "Regime evidence supports constructive bias — upside case conditional on signal stability.",
  },
  {
    position: "bull_case",
    condition: (i) => ["constructive", "opportunistic"].includes(i.strategicBias),
    strength: "moderate",
    basis: "strategic bias",
    argument: (ar) => ar
      ? "التوجه الاستراتيجي المتعدد المسارات بنّاء/انتهازي — يدعم وجهة نظر صاعدة مشروطة."
      : "Multi-track evidence yields constructive/opportunistic bias — supports a conditional bull view.",
  },
  {
    position: "bull_case",
    condition: (i) =>
      i.macroEventSignificance === "meaningful" &&
      i.macroEventType !== null &&
      ["oil_price_move", "growth_pmi", "labor_employment"].includes(i.macroEventType ?? ""),
    strength: "moderate",
    basis: "macro event",
    argument: (ar) => ar
      ? "الحدث الكلي قد يعزز توقعات النمو — محفّز محتمل للأطروحة الصاعدة مشروط بتأكيد البيانات."
      : "Macro event may support growth expectations — potential bull catalyst conditional on data confirmation.",
  },
  {
    position: "bull_case",
    condition: (i) => /\b(bullish|recovery|opportunity|growth|rebound|rally|upside|صاعد|انتعاش|فرصة|نمو)\b/i.test(i.question),
    strength: "weak",
    basis: "question framing",
    argument: (ar) => ar
      ? "سياق السؤال يُشير إلى حالة صاعدة — الحجة تعتمد على صحة الافتراضات المستخدمة في الصياغة."
      : "Question context references a bull thesis — argument depends on the validity of the stated assumptions.",
  },
  // ── Bear cases ─────────────────────────────────────────────────────────────
  {
    position: "bear_case",
    condition: (i) => ["risk_off", "bear_ranging", "high_vol_risk-off"].includes(i.regime),
    strength: "strong",
    basis: "regime",
    argument: (ar) => ar
      ? "النظام الهابط/المتقلب يقيّد اليقين الاتجاهي — الحالة الهابطة أقوى مع غياب تحوّل واضح في الإشارات."
      : "Risk-off/bear regime constrains directional conviction — bear case is stronger absent a clear signal shift.",
  },
  {
    position: "bear_case",
    condition: (i) => ["defensive", "uncertain"].includes(i.strategicBias),
    strength: "moderate",
    basis: "strategic bias",
    argument: (ar) => ar
      ? "التوجه الاستراتيجي دفاعي/غير محدد — الأدلة تُضعف القناعة الصاعدة العالية."
      : "Defensive or uncertain strategic bias — evidence weakens the case for high bull conviction.",
  },
  {
    position: "bear_case",
    condition: (i) => i.firewallState === "blocked" || i.firewallState === "constrained",
    strength: "strong",
    basis: "firewall state",
    argument: (ar) => ar
      ? "جدار الحماية محظور/مقيَّد — جودة الإشارة مخفضة؛ الحالة الهابطة تستفيد من محدودية الثقة."
      : "Firewall blocked/constrained — signal quality is reduced; bear case benefits from limited conviction.",
  },
  {
    position: "bear_case",
    condition: (i) =>
      i.macroEventSignificance === "critical" &&
      i.macroEventType !== null &&
      ["cpi_inflation", "interest_rate_decision", "central_bank_meeting", "macro_stress", "liquidity_monetary"].includes(i.macroEventType ?? ""),
    strength: "strong",
    basis: "critical macro event",
    argument: (ar) => ar
      ? "حدث كلي حرج يُضيف شكوكاً جوهرية — الحالة الهابطة مدعومة بعدم اليقين في قناة الانتقال."
      : "Critical macro event adds material uncertainty — bear case supported by transmission channel risk.",
  },
  {
    position: "bear_case",
    condition: (i) => /\b(risk|decline|correction|crash|bear|sell.?off|concern|downside|bearish|هابط|مخاطر|تصحيح|انهيار)\b/i.test(i.question),
    strength: "weak",
    basis: "question framing",
    argument: (ar) => ar
      ? "سياق السؤال يُشير إلى مخاوف هبوطية — الحالة الهابطة قائمة على الافتراضات المذكورة."
      : "Question context raises downside concerns — bear case rests on the stated risk assumptions.",
  },
  // ── Macro objections ───────────────────────────────────────────────────────
  {
    position: "macro_objection",
    condition: (i) => i.regime === "macro_transition" || i.regime === "mixed",
    strength: "moderate",
    basis: "regime transition",
    argument: (ar) => ar
      ? "الاعتراض الكلي: الانتقال في النظام يُولّد غموضاً تحليلياً — يجب تقييد القناعة الاتجاهية."
      : "Macro objection: regime transition creates analytical ambiguity — directional conviction should be bounded.",
  },
  {
    position: "macro_objection",
    condition: (i) =>
      i.coverageTopics.includes("monetary_policy") ||
      i.coverageTopics.includes("inflation_cpi") ||
      i.coverageTopics.includes("interest_rates"),
    strength: "moderate",
    basis: "monetary/inflation coverage",
    argument: (ar) => ar
      ? "اعتراض كلي: حساسية السياسة النقدية/التضخم تُقيّد الوضوح الاتجاهي في النظام الحالي."
      : "Macro objection: monetary policy / inflation sensitivity limits directional clarity in current regime.",
  },
  {
    position: "macro_objection",
    condition: (i) =>
      i.watchlistCategories.includes("saudi_stock") &&
      (i.macroEventType === "oil_price_move" || i.coverageTopics.includes("oil_commodities")),
    strength: "strong",
    basis: "oil-Saudi fiscal channel",
    argument: (ar) => ar
      ? "اعتراض كلي: التعرض للأسهم السعودية يواجه قناة النفط→الإيرادات المالية — يُقيّد اليقين الاتجاهي."
      : "Macro objection: Saudi equity exposure faces the oil→fiscal transmission channel — constrains directional certainty.",
  },
  // ── Risk objections ────────────────────────────────────────────────────────
  {
    position: "risk_objection",
    condition: (i) => i.hasActiveVulnerability,
    strength: "strong",
    basis: "active portfolio vulnerability",
    argument: (ar) => ar
      ? "اعتراض المخاطر: المحفظة تحتوي على ثغرة نشطة — المخاطر قائمة؛ مراجعة التعرض مبررة."
      : "Risk objection: portfolio has an active vulnerability — risk case is live; exposure review is warranted.",
  },
  {
    position: "risk_objection",
    condition: (i) => i.portfolioRiskLabel === "concentrated" || i.portfolioRiskLabel === "macro_vulnerable",
    strength: "moderate",
    basis: "portfolio risk label",
    argument: (ar) => ar
      ? "اعتراض المخاطر: تركّز المحفظة أو تعرضها الكلي يُضخّم المخاطر الاتجاهية."
      : "Risk objection: concentrated or macro-vulnerable portfolio amplifies directional risk exposure.",
  },
  {
    position: "risk_objection",
    condition: (i) =>
      i.coverageTopics.includes("market_stress") ||
      i.coverageTopics.includes("liquidity_credit") ||
      i.macroEventType === "macro_stress",
    strength: "moderate",
    basis: "market stress signal",
    argument: (ar) => ar
      ? "اعتراض المخاطر: إشارات ضغط السوق/السيولة تُقيّد الاتجاه الصاعد في ظل ضيق التمويل."
      : "Risk objection: market stress / liquidity signals constrain upside thesis under tightening funding conditions.",
  },
  // ── Portfolio objections ───────────────────────────────────────────────────
  {
    position: "portfolio_objection",
    condition: (i) =>
      i.portfolioRiskLabel === "growth_sensitive" &&
      ["risk_off", "bear_ranging", "high_vol_risk-off"].includes(i.regime),
    strength: "strong",
    basis: "growth-heavy portfolio in risk-off",
    argument: (ar) => ar
      ? "اعتراض المحفظة: محفظة نمو مكثّفة تواجه عقبات في النظام الهابط — التوافق ضعيف مع الثيز الصاعد."
      : "Portfolio objection: growth-heavy holdings face headwinds in risk-off regime — weak alignment with bull thesis.",
  },
  {
    position: "portfolio_objection",
    condition: (i) =>
      i.watchlistCategories.includes("crypto") &&
      (i.regime === "risk_off" || i.firewallState === "constrained"),
    strength: "moderate",
    basis: "crypto in risk-off / constrained",
    argument: (ar) => ar
      ? "اعتراض المحفظة: مراكز الكريبتو تواجه عقبات وكيل السيولة في ظل انكماش شهية المخاطرة."
      : "Portfolio objection: crypto holdings face liquidity-proxy headwinds given compressed risk appetite.",
  },
  {
    position: "portfolio_objection",
    condition: (i) =>
      i.watchlistCategories.includes("saudi_stock") &&
      (i.macroEventSignificance === "critical" || i.coverageTopics.includes("oil_commodities")),
    strength: "moderate",
    basis: "Saudi holdings + oil signal",
    argument: (ar) => ar
      ? "اعتراض المحفظة: أسهم السعودية حساسة للنفط — التوجيه الاتجاهي للمحفظة يعتمد على قناة الإيرادات."
      : "Portfolio objection: Saudi holdings are oil-sensitive — portfolio direction depends on fiscal revenue channel.",
  },
];

// ─── Debate balance derivation ────────────────────────────────────────────────

const STRENGTH_SCORE: Record<ViewStrength, number> = { strong: 3, moderate: 2, weak: 1 };

function computeBalance(views: DebateView[]): DebateBalance {
  const bullViews = views.filter((v) => v.position === "bull_case");
  const bearViews = views.filter((v) => v.position === "bear_case");

  if (!bullViews.length && !bearViews.length) return "inconclusive";

  const bullScore = bullViews.reduce((s, v) => s + STRENGTH_SCORE[v.strength], 0);
  const bearScore = bearViews.reduce((s, v) => s + STRENGTH_SCORE[v.strength], 0);

  const diff = bullScore - bearScore;
  if (diff >= 3 && bullViews.length >= 2) return "bull_dominant";
  if (diff <= -3 && bearViews.length >= 2) return "bear_dominant";
  if (bullViews.length >= 1 && bearViews.length >= 1 && Math.abs(diff) <= 2) return "contested";
  return "inconclusive";
}

// ─── Context string builder ────────────────────────────────────────────────────

function buildContextString(
  bullScore: number,
  bearScore: number,
  balance: DebateBalance,
  views: DebateView[],
): string {
  if (balance === "inconclusive") return "";
  const topMacro = views.find((v) => v.position === "macro_objection");
  const macroNote = topMacro ? `; ${topMacro.basis}` : "";
  return `Debate: bull(${bullScore})/bear(${bearScore}) — ${balance.replace(/_/g, " ")}${macroNote}`.slice(0, 160);
}

// ─── Narrative builder ─────────────────────────────────────────────────────────

function buildNarrative(balance: DebateBalance, hasMaterial: boolean, ar: boolean): string {
  switch (balance) {
    case "bull_dominant":
      return ar
        ? "أدلة الحالة الصاعدة أقوى حالياً — القناعة مشروطة بعدم ظهور شروط الإلغاء."
        : "Bull case evidence is currently stronger — conviction is conditional on invalidation triggers remaining inactive.";
    case "bear_dominant":
      return ar
        ? "الحالة الهابطة مدعومة بأدلة أقوى — يجب تقييد اليقين الاتجاهي الصاعد."
        : "Bear case is better-supported by current evidence — upside conviction should be explicitly constrained.";
    case "contested":
      return ar
        ? hasMaterial
          ? "خلاف جوهري قائم بين الحالتين — القناعة مقيّدة؛ التوجه الاتجاهي غير محسوم."
          : "النقاش متوازن — كلا الجانبين مدعومان؛ الصياغة الشرطية مناسبة."
        : hasMaterial
          ? "Material disagreement active between bull and bear cases — conviction is constrained; directional view is unresolved."
          : "Debate is balanced — both cases have support; conditional framing is appropriate.";
    case "inconclusive":
    default:
      return ar
        ? "الإشارات غير كافية لبناء نقاش هادف — التحليل يعتمد على السياق المباشر."
        : "Insufficient signals to build a meaningful debate — analysis relies on immediate context.";
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeDebate(input: DebateInput): DebateResult {
  const { ar } = input;

  // Build all matching views
  const views: DebateView[] = [];
  for (const candidate of VIEW_CANDIDATES) {
    if (!candidate.condition(input)) continue;
    views.push({
      position: candidate.position,
      argument: candidate.argument(ar),
      strength: candidate.strength,
      basis: candidate.basis,
    });
  }

  // Cap at 5 total views (prioritise strong > moderate > weak; keep balance)
  const sorted = [...views].sort((a, b) => STRENGTH_SCORE[b.strength] - STRENGTH_SCORE[a.strength]);
  const capped = sorted.slice(0, 5);

  const bullViews = capped.filter((v) => v.position === "bull_case");
  const bearViews = capped.filter((v) => v.position === "bear_case");

  const bullScore = bullViews.reduce((s, v) => s + STRENGTH_SCORE[v.strength], 0);
  const bearScore = bearViews.reduce((s, v) => s + STRENGTH_SCORE[v.strength], 0);

  const debateBalance = computeBalance(capped);
  const hasMaterialDisagreement = debateBalance === "contested";

  const strongestBullView = bullViews.sort((a, b) => STRENGTH_SCORE[b.strength] - STRENGTH_SCORE[a.strength])[0] ?? null;
  const strongestBearView = bearViews.sort((a, b) => STRENGTH_SCORE[b.strength] - STRENGTH_SCORE[a.strength])[0] ?? null;

  // Confidence impact: contested debate → -5, bear_dominant → -3, inconclusive → 0
  const confidenceImpact =
    debateBalance === "contested" ? -5 :
    debateBalance === "bear_dominant" ? -3 : 0;

  const narrative = buildNarrative(debateBalance, hasMaterialDisagreement, ar);

  const contextString = buildContextString(bullScore, bearScore, debateBalance, capped);

  return {
    bullScore,
    bearScore,
    views: capped,
    strongestBullView,
    strongestBearView,
    debateBalance,
    hasMaterialDisagreement,
    confidenceImpact,
    narrative,
    contextString,
    hasActiveDebate: debateBalance !== "inconclusive",
  };
}
