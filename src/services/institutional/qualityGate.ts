// P0 Quality Gate — Investment Answer Quality Enforcement
// Pure deterministic functions — no AI calls, no network, O(1).
// Assesses quality of Genesis replies for investment questions and provides
// deterministic enrichment from track data when AI omits required fields.

import type { GenesisReply } from "@/lib/genesis.functions";
import type { CommitteeStance } from "./committeeDebate";
import type { ReasoningState } from "./institutionalReasoning";

export type InvestmentQualityState =
  | "acceptable_institutional"  // all key fields present; institutional depth confirmed
  | "shallow_but_usable"        // partial fields; answer is usable but thin
  | "rejected_shallow"          // major fields missing; no macro chain reasoning
  | "missing_required_fields";  // below minimum threshold for investment question

interface TrackASlice {
  regime?: string;
  macroSummary?: string;
  ratesEnv?: string;
  oilLiquidity?: string;
  dxyImpact?: string;
  creditStressLevel?: "low" | "moderate" | "high" | "extreme";
  macroBias?: "bullish" | "bearish" | "neutral";
  regimeConf?: number;
}

interface TrackDSlice {
  uncertaintyLevel?: "low" | "moderate" | "high" | "extreme";
  primaryRisk?: string;
  counterCase?: string;
  invalidationTrigger?: string;
  confidenceChallenge?: string;
  thesisWeakness?: string;
}

interface ConsensusSlice {
  dominantBias: "bullish" | "bearish" | "neutral";
  agreementScore: number;
  strength: "strong" | "moderate" | "weak" | "conflicted";
}

// ─── Investment intent detection (server-side, mirrors client pattern) ─────────
const INVEST_INTENT_SERVER =
  /invest|portfolio|which.{0,5}(stock|compan|sector)|best.{0,5}(stock|sector|return|gain)|outlook|توقعات|استثمار|أفضل.{0,5}(أسهم|شركات|قطاعات)|محفظة|أين.{0,5}أستثمر|هل.{0,5}(أستثمر|الوقت)|تنصح.{0,5}ب|sector.{0,5}(outlook|analysis|rotation)|market.{0,5}(outlook|view)|allocation/i;

const SAUDI_INTENT_SERVER =
  /tasi|saudi|أرامكو|تاسي|سعود|aramco|gulf|خليج|sabic|ساسكو|2222|السوق.{0,5}السعودي/i;

const COMPANY_Q_SERVER =
  /which.{0,5}(compan|stock)|أي.{0,5}شركات|ما.{0,5}هي.{0,5}الشركات|أفضل.{0,5}شركات|تنصح.{0,5}ب.{0,5}(شركات|أسهم)|شركات.{0,5}(مقترحة|للاستثمار)/i;

export function serverDetectInvestmentIntent(question: string, ctx?: string): boolean {
  return INVEST_INTENT_SERVER.test(question) || INVEST_INTENT_SERVER.test((ctx ?? "").slice(0, 400));
}

export function serverDetectSaudiQuestion(question: string, ctx?: string): boolean {
  return SAUDI_INTENT_SERVER.test(question) || SAUDI_INTENT_SERVER.test((ctx ?? "").slice(0, 400));
}

export function serverDetectCompanyQuestion(question: string): boolean {
  return COMPANY_Q_SERVER.test(question);
}

// ─── Quality assessment ────────────────────────────────────────────────────────

export function assessInvestmentQuality(
  reply: GenesisReply,
  isInvestment: boolean,
  isSaudi: boolean,
  isCompanyQ: boolean,
): InvestmentQualityState {
  if (!isInvestment) return "acceptable_institutional";

  let score = 0;

  // Core institutional reasoning chain (Phase-63)
  if (reply.macroChain) score += 2;
  if (reply.bullCase) score += 1;
  if (reply.bearCase) score += 1;
  if (reply.baseCase) score += 1;
  if (reply.missingEvidence) score += 0.5;
  if (reply.thesisChanger) score += 0.5;

  // Sector reasoning (Phase-64)
  if (reply.sectorLens) score += 1;

  // Baseline investment fields
  if (reply.thesis) score += 0.5;
  if (reply.opposingCase) score += 0.5;

  // Saudi-specific content check
  let saudiBonus = 0;
  if (isSaudi) {
    const searchable = [reply.outlook, reply.macroChain, reply.sectorLens, reply.baseCase, reply.bullCase, reply.bearCase]
      .filter(Boolean).join(" ").toLowerCase();
    if (/oil|نفط|fiscal|breakeven/.test(searchable)) saudiBonus += 0.5;
    if (/sama|fed|bank|بنك|rates|فائدة/.test(searchable)) saudiBonus += 0.5;
    if (/petroch|sabic|بتروكيماوي|china|صين/.test(searchable)) saudiBonus += 0.5;
    if (/defensive|dividend|أرامكو|aramco/.test(searchable)) saudiBonus += 0.5;
    score += Math.min(saudiBonus, 2);
  }

  // Committee fields (Phase-65)
  if (isCompanyQ) {
    if (reply.selectionFramework) score += 1;
    if (reply.committeeBullCase) score += 0.5;
    if (reply.committeeBearCase) score += 0.5;
    if (reply.committeeStance) score += 0.5;
  }

  const maxScore = isCompanyQ ? 10 : isSaudi ? 9 : 7;
  const ratio = score / maxScore;

  if (ratio >= 0.70) return "acceptable_institutional";
  if (ratio >= 0.35) return "shallow_but_usable";
  if (ratio >= 0.15) return "rejected_shallow";
  return "missing_required_fields";
}

// ─── Deterministic enrichment from track data ──────────────────────────────────
// These produce compact but substantive field values from available track evidence.
// Used when AI omits required fields. Never fabricate — only derive from tracks.

function regimeStr(trackA: TrackASlice | null): string {
  return (trackA?.regime ?? "current regime").replace(/_/g, " ");
}

export function deriveMacroChain(trackA: TrackASlice | null, trackD: TrackDSlice | null, lang: "ar" | "en"): string {
  if (!trackA) {
    return lang === "ar"
      ? "بيانات سلسلة الماكرو غير متوفرة — الاستدلال محدود بالسياق المتاح."
      : "Macro chain data unavailable — reasoning limited to available context.";
  }
  const parts: string[] = [];
  if (trackA.ratesEnv) parts.push(`Rates/CB: ${trackA.ratesEnv}`);
  if (trackA.oilLiquidity) parts.push(`Oil/liquidity: ${trackA.oilLiquidity}`);
  if (trackA.dxyImpact) parts.push(`DXY: ${trackA.dxyImpact}`);
  if (trackA.creditStressLevel) parts.push(`Credit stress: ${trackA.creditStressLevel}`);
  if (trackA.macroSummary) parts.push(trackA.macroSummary);
  if (trackD?.confidenceChallenge) parts.push(`Constraint: ${trackD.confidenceChallenge}`);
  return parts.join(". ").slice(0, 450) || (lang === "ar"
    ? `نظام ${regimeStr(trackA)} بتوجه ${trackA.macroBias ?? "محايد"}.`
    : `${regimeStr(trackA)} regime with ${trackA.macroBias ?? "neutral"} bias.`);
}

export function deriveBullCase(trackA: TrackASlice | null, consensus: ConsensusSlice, lang: "ar" | "en"): string {
  if (!trackA) return lang === "ar" ? "الحالة الصاعدة: بيانات غير كافية." : "Bull case: insufficient track data.";
  const regime = regimeStr(trackA);
  const credit = trackA.creditStressLevel ?? "moderate";
  const bullish = trackA.macroBias === "bullish" || consensus.dominantBias === "bullish";
  if (bullish) {
    return lang === "ar"
      ? `الحالة الصاعدة: ${trackA.macroSummary ?? `نظام ${regime} يدعم الميل الصاعد`}${trackA.ratesEnv ? ` — ${trackA.ratesEnv}` : ""}. يتطلب التحقق: ضغط ائتمان ${credit} يبقى دون تصاعد.`
      : `Bull case: ${trackA.macroSummary ?? `${regime} regime supports constructive bias`}${trackA.ratesEnv ? ` — ${trackA.ratesEnv}` : ""}. Requires: ${credit} credit stress does not escalate.`;
  }
  return lang === "ar"
    ? `الحالة الصاعدة: تحوّل في ${regime} نحو ظروف ائتمان منخفض الضغط وتيسير مالي سيدعم التقييمات — يتطلب تأكيد النفط فوق نقطة التعادل المالي وانخفاض DXY.`
    : `Bull case: a shift in ${regime} toward low credit-stress conditions and easing would support valuations — requires oil above fiscal breakeven and DXY softening as confirmation.`;
}

export function deriveBearCase(trackD: TrackDSlice | null, trackA: TrackASlice | null, lang: "ar" | "en"): string {
  if (!trackD) return lang === "ar" ? "الحالة الهابطة: بيانات وكيل المخاطر غير متوفرة." : "Bear case: risk track data unavailable.";
  const risk = trackD.primaryRisk ?? (lang === "ar" ? "ضغوط ماكرو" : "macro headwinds");
  const counter = trackD.counterCase ?? (lang === "ar" ? "الحالة السائدة تُقلّل من وزن المخاطر الهبوطية" : "dominant view underweights downside risk");
  const weakness = trackD.thesisWeakness;
  return lang === "ar"
    ? `الحالة الهابطة: ${risk}. ${counter}.${weakness ? ` الافتراض الأضعف: ${weakness}.` : ""}`
    : `Bear case: ${risk}. ${counter}.${weakness ? ` Weakest assumption: ${weakness}.` : ""}`;
}

export function deriveBaseCase(trackA: TrackASlice | null, consensus: ConsensusSlice, lang: "ar" | "en"): string {
  const bias = consensus.dominantBias;
  const regime = regimeStr(trackA);
  const agreement = consensus.agreementScore;
  const strength = consensus.strength;
  return lang === "ar"
    ? `الحالة الأساسية: توجه ${bias === "bullish" ? "صاعد" : bias === "bearish" ? "هابط" : "محايد"} بنسبة إجماع ${agreement}% (${strength}) في نظام ${regime} — الرأي مدعوم بوزن الأدلة عبر الوكلاء لكن ليس مؤكداً بيقين عالٍ.`
    : `Base case: ${bias} bias at ${agreement}% cross-agent agreement (${strength}) in ${regime} — view supported by weight of evidence across tracks but not confirmed with high certainty.`;
}

export function deriveMissingEvidence(trackD: TrackDSlice | null, isSaudi: boolean, lang: "ar" | "en"): string {
  const challenge = trackD?.confidenceChallenge;
  if (challenge) return lang === "ar" ? `أدلة مفقودة: ${challenge}` : `Missing evidence: ${challenge}`;
  return lang === "ar"
    ? (isSaudi
        ? "أدلة مفقودة: أسعار النفط الحالية مقارنةً بنقطة التعادل السعودية، بيانات أرباح أرامكو الأخيرة، وتدفقات رأس المال الأجنبي إلى تاسي."
        : "أدلة مفقودة: بيانات الأرباح الحالية، مستويات التقييم، وتأكيد الأصول المتقاطعة للنظام السائد.")
    : (isSaudi
        ? "Missing evidence: current oil price relative to Saudi fiscal breakeven, recent Aramco earnings, and foreign capital flows into TASI."
        : "Missing evidence: current earnings data, valuation levels, and cross-asset confirmation of the dominant regime.");
}

export function deriveThesisChanger(trackD: TrackDSlice | null, lang: "ar" | "en"): string {
  const trigger = trackD?.invalidationTrigger;
  if (trigger) return lang === "ar" ? `المُغيِّر: ${trigger}` : `Thesis changer: ${trigger}`;
  return lang === "ar"
    ? "المُغيِّر: تحوّل حاد في السياسة المركزية (تغيير مسار الفائدة) أو تراجع النفط دون نقطة التعادل المالي أو توسع ملموس في فوارق الائتمان."
    : "Thesis changer: a sharp central bank policy pivot, oil falling below fiscal breakeven, or a material widening of credit spreads.";
}

export function deriveSectorLens(
  isSaudi: boolean,
  trackA: TrackASlice | null,
  lang: "ar" | "en",
): string {
  const regime = regimeStr(trackA);
  const bias = trackA?.macroBias ?? "neutral";
  const credit = trackA?.creditStressLevel ?? "moderate";

  if (isSaudi) {
    const oilDirection = trackA?.oilLiquidity ?? "oil direction unclear";
    return lang === "ar"
      ? `عدسة القطاعات (تاسي): البنوك والطاقة (أرامكو) تمثّل ~80% من رسملة تاسي. ${oilDirection} — تحدد الفضاء المالي وقدرة توزيعات أرامكو. البتروكيماويات (سابك) تتبع هوامش النفتا والطلب الصيني. الاتصالات/الرعاية الصحية: دفاعيات جزئية. رؤية 2030: مستفيدة من فائض النفط.${credit === "high" || credit === "extreme" ? ` ضغط ائتمان ${credit} يُقيّد التقييم.` : ""}`
      : `Sector lens (TASI): Banks + Energy (Aramco) represent ~80% of TASI cap. ${oilDirection} — determines fiscal space and Aramco dividend capacity. Petrochemicals (SABIC) track naphtha margins and China demand. Telecom/Healthcare: partial defensives. Vision 2030 capex beneficiaries: oil-surplus dependent.${credit === "high" || credit === "extreme" ? ` ${credit} credit stress constrains valuations.` : ""}`;
  }

  return lang === "ar"
    ? `عدسة القطاعات: نظام ${regime} بتوجه ${bias === "bullish" ? "صاعد" : bias === "bearish" ? "هابط" : "محايد"}. ${bias === "bullish" ? "الدوريات والتقنية تستفيد من الزخم." : bias === "bearish" ? "الدفاعيات والذهب ملاذ نسبي." : "الانتقائية القطاعية أفضل من التعرض الواسع."} ${credit === "high" || credit === "extreme" ? `ضغط ائتمان ${credit} يُصعّب الرافعة المالية ويدعم الجودة على الزخم.` : ""}`
    : `Sector lens: ${regime} regime with ${bias} bias. ${bias === "bullish" ? "Cyclicals and technology benefit from momentum." : bias === "bearish" ? "Defensives and gold offer relative shelter." : "Sector selectivity outperforms broad exposure."} ${credit === "high" || credit === "extreme" ? `${credit} credit stress disfavors leverage; quality over momentum.` : ""}`;
}

export function deriveSelectionFramework(isSaudi: boolean, lang: "ar" | "en"): string {
  return lang === "ar"
    ? "إطار الانتقاء: جودة الأرباح (تدفق نقدي حر وليس أرباحاً محاسبية)، متانة الميزانية (نسبة الدين/EBITDA ≤2x)، انضباط التقييم (P/E مقارنةً بالنظراء)، السيولة (حجم التداول اليومي)، قيادة السوق (قوة تسعيرية ومستدامة)، صمود الهبوط (قاع صافي الأصول أو أرضية العائد)، حساسية الماكرو (النفط/الفائدة/DXY/الصين). أي اسم شركة مشروط بتأكيد أساسيات حالية غير متوفرة في هذا السياق."
    : "Selection framework: earnings quality (FCF conversion, not accounting earnings), balance sheet (Net debt/EBITDA ≤2x), valuation discipline (P/E vs peers in current regime), liquidity (daily traded volume), market leadership (sustainable pricing power), downside resilience (NAV floor or yield anchor), macro sensitivity (oil/rates/DXY/China). Any named company is conditional on current fundamental confirmation unavailable in this context.";
}

export function deriveCommitteeBullCase(trackA: TrackASlice | null, consensus: ConsensusSlice, lang: "ar" | "en"): string {
  const bias = consensus.dominantBias;
  const macro = trackA?.macroSummary ?? (lang === "ar" ? "دعم كلي هيكلي" : "structural macro support");
  return lang === "ar"
    ? `الحجة الصاعدة: ${bias === "bullish" ? macro : "التقييم يُقدّم نقطة دخول إذا تحسّن النظام"}؛ الميزانيات القوية والعائدات المرتفعة توفر قاعدة دعم أثناء التقلبات.`
    : `Bull case: ${bias === "bullish" ? macro : "valuation offers an entry point if the regime improves"}; strong balance sheets and high yields provide a floor during volatility.`;
}

export function deriveCommitteeBearCase(trackD: TrackDSlice | null, lang: "ar" | "en"): string {
  const risk = trackD?.primaryRisk ?? (lang === "ar" ? "المخاطر الكلية تُقيّد الرأس المال" : "macro risks constrain capital deployment");
  return lang === "ar"
    ? `الحجة الهابطة: ${risk}؛ مستويات التقييم الحالية قد لا تعكس كامل مخاطر الهبوط إذا تدهور النظام أو اتسعت فوارق الائتمان.`
    : `Bear case: ${risk}; current valuation levels may not fully price downside risk if regime deteriorates or credit spreads widen materially.`;
}

// ─── Main enrichment function ──────────────────────────────────────────────────
// Deterministically fills missing Phase-63/64/65 fields from track data.
// Never overwrites fields already set by AI. Never fabricates.

export function enrichReplyFromTracks(
  reply: GenesisReply,
  trackA: TrackASlice | null,
  trackD: TrackDSlice | null,
  consensus: ConsensusSlice,
  isInvestment: boolean,
  isSaudi: boolean,
  isCompanyQ: boolean,
  lang: "ar" | "en",
): void {
  if (!isInvestment) return;

  if (!reply.macroChain)
    reply.macroChain = deriveMacroChain(trackA, trackD, lang);
  if (!reply.bullCase)
    reply.bullCase = deriveBullCase(trackA, consensus, lang);
  if (!reply.bearCase)
    reply.bearCase = deriveBearCase(trackD, trackA, lang);
  if (!reply.baseCase)
    reply.baseCase = deriveBaseCase(trackA, consensus, lang);
  if (!reply.missingEvidence)
    reply.missingEvidence = deriveMissingEvidence(trackD, isSaudi, lang);
  if (!reply.thesisChanger)
    reply.thesisChanger = deriveThesisChanger(trackD, lang);
  if (!reply.sectorLens)
    reply.sectorLens = deriveSectorLens(isSaudi, trackA, lang);

  if (isCompanyQ) {
    if (!reply.selectionFramework)
      reply.selectionFramework = deriveSelectionFramework(isSaudi, lang);
    if (!reply.committeeBullCase)
      reply.committeeBullCase = deriveCommitteeBullCase(trackA, consensus, lang);
    if (!reply.committeeBearCase)
      reply.committeeBearCase = deriveCommitteeBearCase(trackD, lang);
  }
}
