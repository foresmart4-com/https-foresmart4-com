/**
 * Strategic Intelligence Engine — Phase 22
 * Pure function — no network calls, no AI calls, no side effects.
 * Synthesises macro regime, cross-asset intelligence, thesis history,
 * proactive signals, and portfolio alignment into a controlled strategic view.
 *
 * Design rules:
 * - Bias labels are evidence-linked and computed deterministically
 * - No fake certainty: bias is omitted when insufficient data
 * - Advisory only: all decision language uses allowed framing
 * - Forbidden: "buy now", "sell now", "guaranteed", "certain outcome"
 */

import type { ThesisEntry } from "@/services/learning/thesisMemory";
import type { IntelligenceEvent } from "@/services/learning/sessionIntelStore";
import type { ResearchCandidate } from "@/services/research/proactiveEngine";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StrategicBias =
  | "constructive"    // macro + cross-asset + technical all favor base case; manageable risk
  | "opportunistic"   // asymmetric setup: one side better-compensated given risk profile
  | "neutral"         // mixed signals; no strong directional conviction
  | "defensive"       // elevated risk environment; capital preservation focus
  | "uncertain";      // regime unclear; conflicting evidence; confidence too low

export interface StrategicSynthesis {
  bias: StrategicBias;
  biasReason: string;            // 1 evidence-linked sentence — never "conditions are mixed"
  opportunityDrivers: string[];  // 1-3 specific factors supporting the constructive side
  riskDrivers: string[];         // 1-3 specific factors threatening or limiting the thesis
  conflictNote: string | null;   // specific tension when thesis/macro/cross-asset disagree
  hasConflict: boolean;
  decisionContext: string;       // compact string injected into AI context (~200 chars)
}

export interface StrategicInput {
  sessionBus: IntelligenceEvent | null;
  theses: ThesisEntry[];
  proactiveCandidates: ResearchCandidate[];
  portfolioAligned: boolean;
  portfolioNote: string;
  portfolioHasContext: boolean;
  marketRegime: string;  // from marketIntel
  ar: boolean;
}

// ─── Bias computation ─────────────────────────────────────────────────────────

function deriveBias(
  sessionBias: "bullish" | "bearish" | "neutral" | null,
  sessionConf: number,
  proactiveCandidates: ResearchCandidate[],
  hasThesisConflict: boolean,
  portfolioAligned: boolean,
): StrategicBias {
  if (!sessionBias) return "neutral";

  const highSev = proactiveCandidates.filter((c) => c.severity === "high").length;
  const hasFiscal = proactiveCandidates.some((c) => c.trigger === "oil-fiscal-stress");
  const hasGoldConflict = proactiveCandidates.some((c) => c.trigger === "gold-haven-conflict");
  const hasBtcWeakness = proactiveCandidates.some((c) => c.trigger === "btc-liquidity-weakness");
  const moveCount = proactiveCandidates.filter((c) => c.trigger === "significant-move").length;

  // Uncertain: thesis contradicts regime, or confidence very low, or too many conflicts
  if (hasThesisConflict || sessionConf < 38) return "uncertain";

  // Defensive: multiple compounding risk signals
  if (highSev >= 2 || (hasFiscal && (hasBtcWeakness || hasGoldConflict))) return "defensive";
  if (sessionBias === "bearish" && sessionConf >= 55 && highSev === 0) return "defensive";

  // Constructive: bullish regime, good confidence, limited risk signals
  if (sessionBias === "bullish" && sessionConf >= 55 && highSev === 0 && !hasFiscal && portfolioAligned) return "constructive";

  // Opportunistic: bullish backdrop but some risks or portfolio misalignment (asymmetric)
  if (sessionBias === "bullish" && sessionConf >= 45 && (highSev <= 1 || !portfolioAligned)) return "opportunistic";

  // Opportunistic: bearish regime but low signal count → potential counter-trend opportunity
  if (sessionBias === "bearish" && sessionConf >= 45 && highSev === 0 && moveCount > 0) return "opportunistic";

  // Defensive: bearish or multiple move signals with moderate confidence
  if (sessionBias === "bearish" && sessionConf >= 42) return "defensive";

  return "neutral";
}

// ─── Driver extraction ────────────────────────────────────────────────────────

function extractDrivers(
  input: StrategicInput,
  bias: StrategicBias,
): { opportunityDrivers: string[]; riskDrivers: string[] } {
  const { sessionBus, proactiveCandidates, portfolioAligned, portfolioNote, ar } = input;
  const oppDrivers: string[] = [];
  const riskDrivers: string[] = [];

  // Opportunity drivers
  if (sessionBus?.dominantBias === "bullish" && (sessionBus?.confidence ?? 0) >= 50) {
    oppDrivers.push(ar ? "تحيّز كلي صاعد بثقة معتدلة" : "Macro regime bias constructive with moderate conviction");
  }
  if (portfolioAligned && input.portfolioHasContext) {
    oppDrivers.push(ar ? "توافق المحفظة مع النظام الكلي السائد" : "Portfolio positioning aligned with dominant macro thesis");
  }
  if (!proactiveCandidates.some((c) => c.trigger === "gold-haven-conflict") &&
      !proactiveCandidates.some((c) => c.trigger === "btc-liquidity-weakness")) {
    if (sessionBus?.dominantBias === "bullish") {
      oppDrivers.push(ar ? "لا تباين بين الأصول المتقاطعة ضد الاتجاه الصاعد" : "No cross-asset divergence contradicting the constructive bias");
    }
  }
  const thesisCount = input.theses.filter(
    (t) => t.direction === "bullish" && Date.now() - t.ts < 7 * 86400000,
  ).length;
  if (thesisCount >= 2 && sessionBus?.dominantBias === "bullish") {
    oppDrivers.push(ar ? `${thesisCount} أطروحات صاعدة حديثة تدعم الاتجاه` : `${thesisCount} recent bullish theses support the directional view`);
  }

  // Risk drivers
  const hasFiscal = proactiveCandidates.some((c) => c.trigger === "oil-fiscal-stress");
  if (hasFiscal) {
    riskDrivers.push(ar ? "ضغط قناة النفط→المالية السعودية نشط" : "Oil→Saudi fiscal channel stress signal active");
  }
  const hasGoldConflict = proactiveCandidates.some((c) => c.trigger === "gold-haven-conflict");
  if (hasGoldConflict) {
    riskDrivers.push(ar ? "نمط الذهب الملاذ آمن يتعارض مع تحيّز risk-on" : "Gold safe-haven mode conflicts with risk-on session bias");
  }
  const hasBtc = proactiveCandidates.some((c) => c.trigger === "btc-liquidity-weakness");
  if (hasBtc) {
    riskDrivers.push(ar ? "إشارة وكيل سيولة BTC تُلمح لتشديد شهية المخاطرة" : "BTC liquidity-proxy signal implies tightening risk appetite");
  }
  if (!portfolioAligned && input.portfolioHasContext) {
    riskDrivers.push(ar
      ? (portfolioNote || "المحفظة غير متوافقة مع النظام الكلي الحالي")
      : (portfolioNote || "Portfolio not aligned with current macro regime"));
  }
  if ((sessionBus?.confidence ?? 0) < 50 && sessionBus?.confidence !== undefined) {
    riskDrivers.push(ar ? `ثقة الجلسة منخفضة (${sessionBus.confidence}%) — سياق البيانات ضعيف` : `Session confidence low (${sessionBus.confidence}%) — thin data context`);
  }

  return {
    opportunityDrivers: oppDrivers.slice(0, 3),
    riskDrivers: riskDrivers.slice(0, 3),
  };
}

// ─── Conflict note ────────────────────────────────────────────────────────────

function buildConflictNote(
  proactiveCandidates: ResearchCandidate[],
  theses: ThesisEntry[],
  sessionBus: IntelligenceEvent | null,
  ar: boolean,
): string | null {
  const conflicts: string[] = [];

  const thesisConflict = proactiveCandidates.find((c) => c.trigger === "thesis-regime-conflict");
  if (thesisConflict) {
    conflicts.push(ar
      ? `الأطروحة السابقة على ${thesisConflict.asset} قد تتعارض مع التحيّز الكلي الحالي`
      : `Prior ${thesisConflict.asset} thesis may conflict with current macro bias`);
  }

  const goldConflict = proactiveCandidates.find((c) => c.trigger === "gold-haven-conflict");
  const btcWeakness = proactiveCandidates.find((c) => c.trigger === "btc-liquidity-weakness");
  if (goldConflict && sessionBus?.dominantBias === "bullish") {
    conflicts.push(ar
      ? "تباين الذهب/risk-on يشير لنظام انتقالي محتمل"
      : "Gold/risk-on divergence signals possible regime transition");
  }
  if (btcWeakness && sessionBus?.dominantBias === "bullish") {
    conflicts.push(ar
      ? "ضعف BTC يتعارض مع التحيّز الصاعد الكلي"
      : "BTC weakness contradicts bullish macro bias");
  }

  if (!conflicts.length) return null;
  return conflicts.slice(0, 2).join("; ");
}

// ─── Bias reason ─────────────────────────────────────────────────────────────

function buildBiasReason(
  bias: StrategicBias,
  sessionBus: IntelligenceEvent | null,
  hasConflict: boolean,
  ar: boolean,
): string {
  const conf = sessionBus?.confidence ?? 0;
  const regime = sessionBus?.regime?.replace(/_/g, " ") ?? "";

  if (bias === "constructive") {
    return ar
      ? `النظام الكلي (${regime}) ثقة ${conf}% مع توافق قنوات الأدلة — مخاطر قابلة للإدارة`
      : `Macro regime (${regime}) at ${conf}% conviction with evidence channels aligned — manageable risk profile`;
  }
  if (bias === "opportunistic") {
    return ar
      ? `توضّع غير متماثل محتمل — التحيّز الصاعد قائم لكن عوامل المخاطرة تستحق المراقبة قبل اتخاذ موقف أعلى ثقة`
      : `Potential asymmetric setup — constructive bias present but risk factors warrant monitoring before higher-conviction positioning`;
  }
  if (bias === "defensive") {
    return ar
      ? `إشارات مخاطر متعددة نشطة — حالة حفاظ على رأس المال مع ضرورة مراجعة التعرض`
      : `Multiple risk signals active — capital preservation posture with elevated-risk exposure review warranted`;
  }
  if (bias === "uncertain") {
    return ar
      ? `إشارات الاتجاه متعارضة أو ثقة منخفضة (${conf}%) — غير كافٍ لموقف استراتيجي عالي الثقة`
      : `Directional signals conflicting or low conviction (${conf}%) — insufficient basis for high-confidence strategic positioning`;
  }
  // neutral
  return ar
    ? `إشارات مختلطة؛ لا قناعة اتجاهية قوية كافية لتصنيف استراتيجي${hasConflict ? " — تعارضات نشطة" : ""}`
    : `Mixed signals; insufficient directional conviction for strategic classification${hasConflict ? " — active conflicts present" : ""}`;
}

// ─── Decision context string ──────────────────────────────────────────────────

function buildDecisionContext(
  bias: StrategicBias,
  biasReason: string,
  opportunityDrivers: string[],
  riskDrivers: string[],
  conflictNote: string | null,
  ar: boolean,
): string {
  const biasLabel = ar
    ? ({ constructive: "بنّاء", opportunistic: "انتهازي", neutral: "محايد", defensive: "دفاعي", uncertain: "غير محدد" }[bias])
    : bias;

  const parts: string[] = [
    `Strategic bias: ${biasLabel} — ${biasReason}`,
  ];
  if (opportunityDrivers.length > 0) {
    parts.push(`Opportunity: ${opportunityDrivers[0]}`);
  }
  if (riskDrivers.length > 0) {
    parts.push(`Risk: ${riskDrivers[0]}`);
  }
  if (conflictNote) {
    parts.push(`Conflict: ${conflictNote}`);
  }
  parts.push(
    ar
      ? "قواعد اللغة الاستشارية: مراقبة | مراجعة | فرصة محتملة | تعزيز/إضعاف الأطروحة. ممنوع: اشترِ الآن | بِع الآن | مضمون."
      : "Decision language: monitor | review | potential opportunity | thesis strengthening/weakening. Forbidden: buy now | sell now | guaranteed.",
  );

  return parts.join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds a controlled strategic synthesis from existing session data.
 * Pure function — deterministic, no I/O, no AI calls.
 */
export function computeStrategicSynthesis(input: StrategicInput): StrategicSynthesis {
  const { sessionBus, theses, proactiveCandidates, portfolioAligned, ar } = input;

  const sessionBiasRaw = sessionBus?.dominantBias ?? null;
  const sessionConf = sessionBus?.confidence ?? 0;

  const hasThesisConflict = proactiveCandidates.some((c) => c.trigger === "thesis-regime-conflict");
  const conflictNote = buildConflictNote(proactiveCandidates, theses, sessionBus, ar);
  const hasConflict = Boolean(conflictNote) || hasThesisConflict;

  const bias = deriveBias(sessionBiasRaw, sessionConf, proactiveCandidates, hasThesisConflict, portfolioAligned);
  const biasReason = buildBiasReason(bias, sessionBus, hasConflict, ar);
  const { opportunityDrivers, riskDrivers } = extractDrivers(input, bias);

  const decisionContext = buildDecisionContext(bias, biasReason, opportunityDrivers, riskDrivers, conflictNote, ar);

  return { bias, biasReason, opportunityDrivers, riskDrivers, conflictNote, hasConflict, decisionContext };
}
