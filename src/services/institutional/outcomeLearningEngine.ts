// Phase-84A: Outcome Learning Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Purpose: Compare prior thesis assumptions with current reply evidence to
// identify what confirmed, what contradicted, and what changed. Produces
// a lesson learned and a confidence adjustment signal.
//
// Educational/advisory only. No autonomous trading. No broker execution.
// No personal financial advice storage. Governed context only.
//
// Distinct from thesisMemoryStore (saves/retrieves snapshots):
//   outcomeLearningEngine — takes prior + current, returns comparison analysis
//                           that can be injected as "Recent thesis outcomes:" context
//   thesisMemoryStore     — persistence layer for thesis snapshots

import type { ThesisSnapshot } from "./thesisMemoryStore";
import type { GenesisReply } from "@/lib/genesis.functions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OutcomeSignal =
  | "confirmed"        // prior thesis elements confirmed by current analysis
  | "contradicted"     // prior thesis contradicted by current analysis
  | "revised"          // thesis direction changed (not confirmed, not contradicted)
  | "insufficient"     // not enough overlap to determine outcome
  | "stale_context";   // prior snapshot is too old to compare meaningfully

export interface OutcomeComparison {
  signal: OutcomeSignal;
  confirmedElements: string[];    // thesis fields that align
  contradictedElements: string[]; // thesis fields that conflict
  changedElements: string[];      // stance/direction changed
  lesson: string;                 // 1-2 sentence lesson from comparison
  confidenceAdjustment: number;   // -10 to +10; applied to current confidence anchor
  outcomeContext: string;         // compact injectable "Recent thesis outcomes:" block
}

// ─── Field comparison helpers ─────────────────────────────────────────────────

function textOverlap(a: string, b: string): number {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 4));
  const wordsB = b.toLowerCase().split(/\W+/).filter(w => w.length > 4);
  const hits = wordsB.filter(w => wordsA.has(w)).length;
  return wordsA.size > 0 ? hits / wordsA.size : 0;
}

function directionFromText(text: string): "bullish" | "bearish" | "neutral" | "unknown" {
  if (!text) return "unknown";
  const t = text.toLowerCase();
  if (/صاعد|bullish|constructive|upside\s+dominant|long\s+bias/i.test(t)) return "bullish";
  if (/هابط|bearish|defensive|downside\s+dominant|reduce|avoid/i.test(t)) return "bearish";
  if (/neutral|محايد|انتظار|wait|balanced/i.test(t)) return "neutral";
  return "unknown";
}

// ─── Comparison logic ─────────────────────────────────────────────────────────

function compareThesisContent(
  prior: ThesisSnapshot,
  current: GenesisReply,
): { confirmed: string[]; contradicted: string[]; changed: string[] } {
  const confirmed: string[] = [];
  const contradicted: string[] = [];
  const changed: string[] = [];

  // Direction comparison: was thesis bullish/bearish? Is current the same?
  const priorDir = directionFromText(prior.thesis ?? prior.baseCase ?? "");
  const currentDir = directionFromText(current.thesis ?? current.baseCase ?? "");
  if (priorDir !== "unknown" && currentDir !== "unknown") {
    if (priorDir === currentDir) {
      confirmed.push(`Direction confirmed: both ${priorDir}`);
    } else if (priorDir !== "neutral" && currentDir !== "neutral") {
      contradicted.push(`Direction reversed: prior ${priorDir} → current ${currentDir}`);
    } else {
      changed.push(`Direction shifted: prior ${priorDir} → current ${currentDir}`);
    }
  }

  // MacroChain overlap
  if (prior.macroChain && current.macroChain) {
    const overlap = textOverlap(prior.macroChain, current.macroChain);
    if (overlap > 0.5) confirmed.push("Macro chain narrative consistent with prior");
    else if (overlap < 0.2) changed.push("Macro chain narrative significantly different");
  }

  // Sector lens comparison
  if (prior.sectorLens && current.sectorLens) {
    const overlap = textOverlap(prior.sectorLens, current.sectorLens);
    if (overlap > 0.4) confirmed.push("Sector thesis broadly consistent");
    else changed.push("Sector thesis has evolved");
  }

  // Thesis changer: was prior invalidation condition triggered?
  if (prior.thesisChanger && current.macroChain) {
    const isActive = textOverlap(prior.thesisChanger, current.macroChain) > 0.3;
    if (isActive) contradicted.push(`Prior thesis changer appears active: "${prior.thesisChanger.slice(0, 60)}"`);
  }

  // Committee stance change
  if (prior.committeeStance && current.committeeStance && prior.committeeStance !== current.committeeStance) {
    changed.push(`Committee stance changed: ${prior.committeeStance} → ${current.committeeStance}`);
  }

  return { confirmed, contradicted, changed };
}

function deriveSignal(confirmed: string[], contradicted: string[], changed: string[]): OutcomeSignal {
  if (confirmed.length === 0 && contradicted.length === 0 && changed.length === 0) return "insufficient";
  if (contradicted.length > confirmed.length) return "contradicted";
  if (changed.length > 0 && contradicted.length > 0) return "revised";
  if (confirmed.length > 0 && contradicted.length === 0) return "confirmed";
  return "revised";
}

function deriveConfidenceAdjustment(signal: OutcomeSignal, confirmed: number, contradicted: number): number {
  switch (signal) {
    case "confirmed":    return Math.min(8, confirmed * 3);   // +3 per confirmed element, max +8
    case "contradicted": return Math.max(-8, -contradicted * 3); // -3 per contradiction, max -8
    case "revised":      return -3;   // slight discount for changed direction
    case "insufficient": return 0;
    default:             return 0;
  }
}

function buildLesson(signal: OutcomeSignal, confirmed: string[], contradicted: string[], changed: string[], lang: "ar" | "en"): string {
  const ar = lang === "ar";
  switch (signal) {
    case "confirmed":
      return ar
        ? `الأطروحة السابقة تُؤكَّد: ${confirmed[0] ?? "عناصر متعددة متسقة"}. استمر باستخدام الأطروحة الجارية مع الإشارة إلى الأدلة الجديدة الداعمة.`
        : `Prior thesis confirmed: ${confirmed[0] ?? "multiple consistent elements"}. Continue current thesis noting specific new supporting evidence.`;
    case "contradicted":
      return ar
        ? `الأطروحة السابقة مُتعارضة: ${contradicted[0] ?? "تغيّر في الاتجاه"}. يلزم مراجعة صريحة بذكر العامل الدقيق الذي يُبرر التحوّل.`
        : `Prior thesis contradicted: ${contradicted[0] ?? "direction change"}. Explicit revision required naming the precise factor warranting the change.`;
    case "revised":
      return ar
        ? `الأطروحة السابقة تطوّرت: ${changed[0] ?? "الموقف تغيّر"}. أدرج viewChange بحدث أو إشارة محددة تُبرر المراجعة.`
        : `Prior thesis revised: ${changed[0] ?? "stance shifted"}. Include viewChange with specific event/signal justifying the revision.`;
    default:
      return ar
        ? "لا يكفي التداخل لتقييم نتيجة الأطروحة السابقة — تابع الأطروحة الجارية بصرف النظر."
        : "Insufficient overlap to assess prior thesis outcome — continue with current thesis independently.";
  }
}

function buildOutcomeContext(comparison: OutcomeComparison, lang: "ar" | "en"): string {
  if (comparison.signal === "insufficient") return "";
  const ar = lang === "ar";

  const header = ar ? "نتائج الأطروحات السابقة:" : "Recent thesis outcomes:";
  const signal = ar
    ? { confirmed: "مؤكدة", contradicted: "متعارضة", revised: "مُعدَّلة", stale_context: "قديمة", insufficient: "" }[comparison.signal]
    : comparison.signal;

  const adj = comparison.confidenceAdjustment > 0
    ? (ar ? `+${comparison.confidenceAdjustment} نقطة قناعة` : `+${comparison.confidenceAdjustment} confidence pts`)
    : comparison.confidenceAdjustment < 0
      ? (ar ? `${comparison.confidenceAdjustment} نقطة قناعة` : `${comparison.confidenceAdjustment} confidence pts`)
      : "";

  const lines = [`${header} ${signal}${adj ? ` (${adj})` : ""}`, comparison.lesson];
  if (comparison.confirmedElements.length > 0) {
    lines.push(ar ? `مؤكَّد: ${comparison.confirmedElements[0]}` : `Confirmed: ${comparison.confirmedElements[0]}`);
  }
  if (comparison.contradictedElements.length > 0) {
    lines.push(ar ? `متعارض: ${comparison.contradictedElements[0]}` : `Contradicted: ${comparison.contradictedElements[0]}`);
  }

  return lines.join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compares a prior thesis snapshot with the current Genesis reply.
 * Returns a structured outcome comparison with lesson and confidence adjustment.
 * Pure O(1) — no AI calls, no network.
 */
export function compareThesisOutcome(
  prior: ThesisSnapshot,
  current: GenesisReply,
  lang: "ar" | "en",
): OutcomeComparison {
  // Check if snapshot is too old for meaningful comparison (>2h)
  const age = Date.now() - prior.timestamp;
  if (age > 2 * 60 * 60 * 1000) {
    return {
      signal: "stale_context",
      confirmedElements: [], contradictedElements: [], changedElements: [],
      lesson: lang === "ar"
        ? "السياق السابق قديم جداً للمقارنة المعنوية — تابع الأطروحة الجارية بصرف النظر."
        : "Prior context is too old for meaningful comparison — proceed with current thesis independently.",
      confidenceAdjustment: 0,
      outcomeContext: "",
    };
  }

  const { confirmed, contradicted, changed } = compareThesisContent(prior, current);
  const signal = deriveSignal(confirmed, contradicted, changed);
  const confidenceAdjustment = deriveConfidenceAdjustment(signal, confirmed.length, contradicted.length);
  const lesson = buildLesson(signal, confirmed, contradicted, changed, lang);

  const comparison: OutcomeComparison = {
    signal,
    confirmedElements: confirmed,
    contradictedElements: contradicted,
    changedElements: changed,
    lesson,
    confidenceAdjustment,
    outcomeContext: "",
  };
  comparison.outcomeContext = buildOutcomeContext(comparison, lang);
  return comparison;
}
