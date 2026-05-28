/**
 * Decision Firewall & Approval Governance — Phase 30
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Evaluates all available intelligence signals and produces a FirewallState
 * that governs confidence framing and narrative tone.
 *
 * Design rules:
 * - Conservative: cleared requires all signals coherent; defaults to caution
 * - Deterministic: no random elements, no hidden scoring curves
 * - Transparent: reasons array always explains what triggered the state
 * - Advisory only: firewall state affects framing, never prevents analysis
 * - No execution semantics: blocked ≠ trade blocked; it means confidence constrained
 */

import type { DecisionScoreResult } from "@/services/learning/decisionScoring";
import type { TrustStrategyResult } from "@/services/intelligence/trustStrategyEngine";
import type { StrategicSynthesis } from "@/services/intelligence/strategicEngine";
import type { OutcomeSummary } from "@/services/learning/outcomeEngine";
import type { PortfolioRiskResult } from "@/services/portfolio/portfolioRiskEngine";

// ─── Types ───────────────────────────────────────────────────────────────────

export type FirewallState =
  | "cleared"      // evidence coherent, calibration stable, conviction justified
  | "caution"      // conviction moderate, uncertainty meaningful, check framing
  | "constrained"  // mixed calibration/evidence, partial conflict, reduced certainty
  | "blocked";     // severe conflict, fragile calibration, or confidence insufficient

export interface FirewallInput {
  decisionScore: DecisionScoreResult;    // Phase-24
  trustStrategy: TrustStrategyResult;   // Phase-25/26
  strategicSynthesis: StrategicSynthesis; // Phase-22
  outcomeSummary: OutcomeSummary;        // Phase-23
  portfolioRisk: PortfolioRiskResult;    // Phase-27
  sessionConf: number;                   // from sessionIntelStore.confidence ?? 0
  isDrifting: boolean;
  ar: boolean;
}

export interface FirewallResult {
  state: FirewallState;
  severity: number;           // 0=cleared 1=caution 2=constrained 3=blocked
  reasons: string[];          // specific triggers (max 3, non-overlapping)
  narrativeHint: string;      // 1-sentence guidance for AI tone
  contextString: string;      // compact ≤160 chars for decisionCtx injection
  hasActiveConstraint: boolean;
}

// ─── Severity constants ───────────────────────────────────────────────────────

const BLOCKED      = 3;
const CONSTRAINED  = 2;
const CAUTION      = 1;
const CLEARED      = 0;

// ─── Evaluation ──────────────────────────────────────────────────────────────

export function computeFirewall(input: FirewallInput): FirewallResult {
  const {
    decisionScore, trustStrategy, strategicSynthesis,
    outcomeSummary, portfolioRisk, sessionConf, isDrifting, ar,
  } = input;

  const { score: calScore, trustProfile } = decisionScore;
  const { trustState: { state: trustState }, strategyPosture: { posture } } = trustStrategy;
  const { bias, hasConflict } = strategicSynthesis;
  const { invalidated, weakened, invalidationRatio } = outcomeSummary;
  const actionable = outcomeSummary.confirmed + weakened + invalidated;

  let severity = CLEARED;
  const reasons: string[] = [];

  const bump = (s: number, reason: string) => {
    if (s > severity) { severity = s; }
    if (reasons.length < 3 && !reasons.some((r) => r === reason)) reasons.push(reason);
  };

  // ── BLOCKED conditions ──────────────────────────────────────────────────────
  if (calScore === "weakly_calibrated" && trustState === "fragile_calibration") {
    bump(BLOCKED, ar ? "معايرة هشة + ثقة ضعيفة" : "weakly calibrated + fragile trust");
  }
  if (sessionConf > 0 && sessionConf < 38 && hasConflict) {
    bump(BLOCKED, ar ? "قناعة منخفضة جداً + تعارض نشط" : "very low conviction + active conflict");
  }
  if (actionable >= 3 && invalidationRatio > 0.5) {
    bump(BLOCKED, ar ? "نمط إلغاء أطروحات مهيمن" : "dominant thesis invalidation pattern");
  }
  if (bias === "uncertain" && hasConflict && trustState === "fragile_calibration") {
    bump(BLOCKED, ar ? "تحيّز غير محدد + تعارض + ثقة هشة" : "uncertain bias + conflict + fragile trust");
  }

  // ── CONSTRAINED conditions ──────────────────────────────────────────────────
  if (calScore === "weakly_calibrated") {
    bump(CONSTRAINED, ar ? "معايرة ضعيفة" : "weak calibration");
  }
  if (trustState === "fragile_calibration") {
    bump(CONSTRAINED, ar ? "ثقة هشة في المعايرة" : "fragile calibration trust");
  }
  if (portfolioRisk.riskLabel === "macro_vulnerable" && portfolioRisk.hasActiveVulnerability) {
    bump(CONSTRAINED, ar ? "ثغرة كلية نشطة في المحفظة" : "active macro portfolio vulnerability");
  }
  if (weakened >= 2) {
    bump(CONSTRAINED, ar ? "نمط إضعاف أطروحات متكرر" : "repeated thesis weakening pattern");
  }
  if (sessionConf > 0 && sessionConf < 45 && hasConflict) {
    bump(CONSTRAINED, ar ? "قناعة منخفضة + تعارض" : "low conviction + active conflict");
  }
  if ((posture === "watch_and_wait" || posture === "defensive_preservation") && hasConflict) {
    bump(CONSTRAINED, ar ? "توجه انتظار + تعارض إشارات" : "wait-and-watch posture + signal conflict");
  }

  // ── CAUTION conditions ──────────────────────────────────────────────────────
  if (calScore === "moderately_calibrated") {
    bump(CAUTION, ar ? "معايرة مختلطة" : "mixed calibration");
  }
  if (portfolioRisk.hasActiveVulnerability) {
    bump(CAUTION, ar ? "ثغرة نشطة في المحفظة" : "active portfolio vulnerability");
  }
  if (weakened >= 1 || invalidated >= 1) {
    bump(CAUTION, ar ? "مخاوف نتائج الأطروحات" : "thesis outcome concerns");
  }
  if (bias === "uncertain") {
    bump(CAUTION, ar ? "تحيّز استراتيجي غير محدد" : "uncertain strategic bias");
  }
  if (posture === "macro_sensitive" || posture === "watch_and_wait") {
    bump(CAUTION, ar ? "توجه حساس للماكرو" : "macro-sensitive posture");
  }
  if (sessionConf > 0 && sessionConf < 55) {
    bump(CAUTION, ar ? "قناعة معتدلة" : "moderate conviction");
  }
  if (isDrifting) {
    bump(CAUTION, ar ? "انحراف أداء نشط" : "active performance drift");
  }
  if (trustProfile.hasOvershootSignal) {
    bump(CAUTION, ar ? "ميل للمبالغة في الثقة" : "confidence overshoot tendency");
  }

  // ── Map severity to state ────────────────────────────────────────────────────
  const state: FirewallState =
    severity >= BLOCKED     ? "blocked" :
    severity >= CONSTRAINED ? "constrained" :
    severity >= CAUTION     ? "caution" :
    "cleared";

  // ── Narrative hint (1-sentence for AI) ────────────────────────────────────────
  const narrativeHint = (() => {
    const topReason = reasons[0] ?? "";
    if (state === "blocked") {
      return ar
        ? `جدار الحماية مُفعَّل (محظور): ${topReason}; استخدم لغة محوطة جداً، لا تأطير إجرائي، الثقة محدودة.`
        : `Firewall blocked: ${topReason}; use highly hedged language, no action framing, confidence explicitly limited.`;
    }
    if (state === "constrained") {
      return ar
        ? `جدار الحماية مُقيَّد: ${topReason}; لغة شرطية فقط، اعترف بالقيود المحددة.`
        : `Firewall constrained: ${topReason}; conditional language only, acknowledge specific limitations.`;
    }
    if (state === "caution") {
      return ar
        ? `جدار الحماية تحذيري: ${topReason}; حافظ على الصياغة الشرطية، أشر لعدم اليقين.`
        : `Firewall caution: ${topReason}; maintain conditional framing, note uncertainty explicitly.`;
    }
    return ar ? "جدار الحماية نظيف — التحليل الطبيعي." : "Firewall cleared — normal analysis mode.";
  })();

  // ── Context string for decisionCtx injection ──────────────────────────────────
  const contextString = state === "cleared" ? "" : (() => {
    const stateLabel = ar
      ? ({ caution: "تحذير", constrained: "مقيَّد", blocked: "محظور" }[state])
      : state;
    const reasonStr = reasons.slice(0, 2).join("; ");
    return `Firewall ${stateLabel}: ${reasonStr}`.slice(0, 160);
  })();

  return {
    state,
    severity,
    reasons,
    narrativeHint,
    contextString,
    hasActiveConstraint: state !== "cleared",
  };
}
