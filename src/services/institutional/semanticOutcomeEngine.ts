// Phase-84B: Semantic Outcome Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Distinct from Phase-84A outcomeLearningEngine:
//   outcomeLearningEngine (84A)  — vocabulary overlap (raw word matching)
//   semanticOutcomeEngine (84B)  — structured semantic slot comparison:
//                                   direction, conviction tier, policy stance,
//                                   Saudi oil signal, sector preference order,
//                                   allocation stance, and claim-level comparison.
//
// "Semantic" here means comparing the MEANING of investment stances by extracting
// structured representations first, then comparing those structures — not raw text.
//
// Educational/advisory only. No autonomous trading. No broker execution.

import type { GenesisReply } from "@/lib/genesis.functions";
import type { PersistentMemoryEntry } from "./persistentMemoryStore";

// ─── Semantic profile types ───────────────────────────────────────────────────

export type DirectionSemantic = "bullish" | "bearish" | "neutral" | "conflicted" | "unknown";
export type ConvictionTier    = "high" | "moderate" | "low" | "insufficient";
export type PolicySemantic    = "easing_expected" | "holding" | "tightening_expected" | "pivot_expected" | "unknown";
export type OilSemantic       = "above_breakeven" | "near_breakeven" | "below_breakeven" | "unknown";
export type AllocationSemantic = "scale_in" | "selective" | "wait" | "defensive" | "avoid" | "unknown";

export interface SemanticProfile {
  direction: DirectionSemantic;
  convictionTier: ConvictionTier;
  confidence: number;          // raw 0-100
  policyStance: PolicySemantic;
  oilSignal: OilSemantic;
  allocationStance: AllocationSemantic;
  sectorLeader: string;        // primary sector favoured (empty if none)
  invalidationActive: boolean; // prior invalidation condition appears active
  hasCausalChain: boolean;     // has → chains
  hasSecondOrder: boolean;     // has second-order risks
}

// ─── Direction extraction ─────────────────────────────────────────────────────

function extractDirection(reply: GenesisReply): DirectionSemantic {
  const allText = [
    reply.thesis, reply.baseCase, reply.committeeSynthesis?.finalStance,
    reply.committeeStance,
  ].filter(Boolean).join(" ");

  const hasBull = /صاعد|bullish|constructive|scale.in|scale_in|conditional_opportunity/i.test(allText);
  const hasBear = /هابط|bearish|defensive|avoid|reduce|wait_for_confirmation/i.test(allText);
  const hasConflict = reply.consensusStrength === "conflicted" ||
    (hasBull && hasBear && /versus|vs\.|تعارض|conflict/i.test(allText));

  if (hasConflict) return "conflicted";
  if (hasBull && !hasBear) return "bullish";
  if (hasBear && !hasBull) return "bearish";
  if (!hasBull && !hasBear) return "unknown";
  return "neutral";
}

// ─── Conviction tier ──────────────────────────────────────────────────────────

function extractConvictionTier(reply: GenesisReply): ConvictionTier {
  const conf = reply.confidence ?? 50;
  if (conf >= 68) return "high";
  if (conf >= 50) return "moderate";
  if (conf >= 35) return "low";
  return "insufficient";
}

// ─── Policy stance extraction ─────────────────────────────────────────────────

function extractPolicyStance(reply: GenesisReply): PolicySemantic {
  const text = (reply.voiceReasoning?.policy ?? "") + " " + (reply.macroChain ?? "");
  if (/pivot|تحوّل|rate\s+cut|خفض.*أسعار/i.test(text)) return "pivot_expected";
  if (/eas|easing|cut|تخفيف|تيسير/i.test(text)) return "easing_expected";
  if (/tight|hike|restrictive|تشديد|رفع.*أسعار/i.test(text)) return "tightening_expected";
  if (/hold|stable|ثبات|لم\s+يتغير/i.test(text)) return "holding";
  return "unknown";
}

// ─── Oil signal extraction ────────────────────────────────────────────────────

function extractOilSignal(reply: GenesisReply): OilSemantic {
  const text = [reply.macroChain, reply.bullCase, reply.sectorLens, reply.voiceReasoning?.macro]
    .filter(Boolean).join(" ");
  if (/above.*breakeven|فوق.*نقطة.*التعادل|surplus|فائض/i.test(text)) return "above_breakeven";
  if (/below.*breakeven|دون.*نقطة.*التعادل|deficit|عجز/i.test(text)) return "below_breakeven";
  if (/near.*breakeven|near.*75|near.*80|قرب.*نقطة/i.test(text)) return "near_breakeven";
  return "unknown";
}

// ─── Allocation stance extraction ────────────────────────────────────────────

function extractAllocationStance(reply: GenesisReply): AllocationSemantic {
  const text = [
    reply.committeeStance?.toString(),
    reply.committeeSynthesis?.finalStance,
    reply.voiceReasoning?.allocator,
  ].filter(Boolean).join(" ");

  if (/scale.in.gradual|conditional_opportunity/i.test(text)) return "scale_in";
  if (/selective_over_broad|selective.*quality/i.test(text)) return "selective";
  if (/wait.for.confirmation|wait_for_confirmation|انتظار.*تأكيد/i.test(text)) return "wait";
  if (/defensive|حفظ.*رأس.*المال/i.test(text)) return "defensive";
  if (/avoid.*or.*reduce|insufficient_edge/i.test(text)) return "avoid";
  return "unknown";
}

// ─── Sector leader extraction ─────────────────────────────────────────────────

function extractSectorLeader(reply: GenesisReply): string {
  const text = (reply.sectorLens ?? "") + " " + (reply.committeeSynthesis?.finalStance ?? "");
  if (/aramco.*primary|aramco.*first|أرامكو.*أول|aramco.*anchor/i.test(text)) return "aramco";
  if (/bank.*lead|مصرفي.*يقود/i.test(text)) return "banks";
  if (/sabic.*lead|سابك.*يقود/i.test(text)) return "sabic";
  if (/defensive.*lead|دفاعيات.*تقود/i.test(text)) return "defensives";
  if (/tech.*lead|technology.*lead/i.test(text)) return "technology";
  return "";
}

// ─── Invalidation active check ────────────────────────────────────────────────

function checkInvalidationActive(reply: GenesisReply, priorInvalidation?: string): boolean {
  if (!priorInvalidation) return false;
  // Check if the prior invalidation trigger appears in current reply's macro chain or bear case
  const currentText = [reply.macroChain, reply.bearCase, reply.secondOrderRisks].filter(Boolean).join(" ");
  const triggerWords = priorInvalidation.toLowerCase().split(/\W+/).filter(w => w.length > 5);
  const hits = triggerWords.filter(w => currentText.toLowerCase().includes(w)).length;
  return hits >= 2; // at least 2 content words from invalidation appear active
}

// ─── Main extraction ─────────────────────────────────────────────────────────

/**
 * Extracts a structured semantic profile from a GenesisReply.
 */
export function extractSemanticProfile(
  reply: GenesisReply,
  priorInvalidation?: string,
): SemanticProfile {
  return {
    direction: extractDirection(reply),
    convictionTier: extractConvictionTier(reply),
    confidence: reply.confidence ?? 50,
    policyStance: extractPolicyStance(reply),
    oilSignal: extractOilSignal(reply),
    allocationStance: extractAllocationStance(reply),
    sectorLeader: extractSectorLeader(reply),
    invalidationActive: checkInvalidationActive(reply, priorInvalidation),
    hasCausalChain: (reply.macroChain ?? "").includes("→"),
    hasSecondOrder: !!reply.secondOrderRisks,
  };
}

// ─── Semantic comparison ──────────────────────────────────────────────────────

export type SemanticChangeType =
  | "direction_confirmed"        // same direction as prior
  | "direction_reversed"         // opposite direction
  | "conviction_upgraded"        // higher conviction now
  | "conviction_downgraded"      // lower conviction now
  | "policy_stance_changed"      // policy assessment shifted
  | "oil_signal_changed"         // oil-above/below/near changed
  | "allocation_stance_changed"  // deployment decision changed
  | "invalidation_triggered"     // prior invalidation condition now active
  | "sector_rotation"            // different sector leader
  | "stable";                    // no meaningful change

export interface SemanticComparison {
  changes: SemanticChangeType[];
  dominantChange: SemanticChangeType | null;
  overallSignal: "confirmed" | "evolved" | "reversed" | "invalidated";
  confidenceAdjustment: number;   // -10 to +10
  semanticLesson: string;
  outcomeContext: string;         // injectable "Recent thesis outcomes:" block
}

function compareDirection(prior: DirectionSemantic, current: DirectionSemantic): SemanticChangeType | null {
  if (prior === "unknown" || current === "unknown") return null;
  if (prior === current) return "direction_confirmed";
  if ((prior === "bullish" && current === "bearish") || (prior === "bearish" && current === "bullish")) {
    return "direction_reversed";
  }
  return null;
}

function compareConviction(prior: ConvictionTier, current: ConvictionTier): SemanticChangeType | null {
  const tierOrder: Record<ConvictionTier, number> = { high: 3, moderate: 2, low: 1, insufficient: 0 };
  const diff = tierOrder[current] - tierOrder[prior];
  if (diff >= 1) return "conviction_upgraded";
  if (diff <= -1) return "conviction_downgraded";
  return null;
}

/**
 * Compares two semantic profiles and produces a structured change analysis.
 */
export function compareSemanticProfiles(
  prior: SemanticProfile,
  current: SemanticProfile,
  lang: "ar" | "en",
): SemanticComparison {
  const ar = lang === "ar";
  const changes: SemanticChangeType[] = [];

  // Direction comparison
  const dirChange = compareDirection(prior.direction, current.direction);
  if (dirChange) changes.push(dirChange);

  // Conviction comparison
  const convChange = compareConviction(prior.convictionTier, current.convictionTier);
  if (convChange) changes.push(convChange);

  // Policy stance change
  if (prior.policyStance !== "unknown" && current.policyStance !== "unknown" &&
      prior.policyStance !== current.policyStance) {
    changes.push("policy_stance_changed");
  }

  // Oil signal change (Saudi-specific)
  if (prior.oilSignal !== "unknown" && current.oilSignal !== "unknown" &&
      prior.oilSignal !== current.oilSignal) {
    changes.push("oil_signal_changed");
  }

  // Allocation stance change
  if (prior.allocationStance !== "unknown" && current.allocationStance !== "unknown" &&
      prior.allocationStance !== current.allocationStance) {
    changes.push("allocation_stance_changed");
  }

  // Invalidation triggered
  if (current.invalidationActive) changes.push("invalidation_triggered");

  // Sector rotation
  if (prior.sectorLeader && current.sectorLeader && prior.sectorLeader !== current.sectorLeader) {
    changes.push("sector_rotation");
  }

  if (changes.length === 0) changes.push("stable");

  // Determine dominant change (priority order)
  const changePriority: SemanticChangeType[] = [
    "invalidation_triggered", "direction_reversed", "direction_confirmed",
    "conviction_upgraded", "conviction_downgraded", "policy_stance_changed",
    "oil_signal_changed", "allocation_stance_changed", "sector_rotation", "stable",
  ];
  const dominantChange = changePriority.find(c => changes.includes(c)) ?? null;

  // Overall signal
  const overallSignal: SemanticComparison["overallSignal"] =
    changes.includes("invalidation_triggered") ? "invalidated" :
    changes.includes("direction_reversed") ? "reversed" :
    changes.includes("direction_confirmed") || changes.includes("stable") ? "confirmed" :
    "evolved";

  // Confidence adjustment
  const confidenceAdjustment =
    overallSignal === "confirmed" ? 5 :
    overallSignal === "invalidated" ? -10 :
    overallSignal === "reversed" ? -7 :
    changes.includes("conviction_upgraded") ? 4 :
    changes.includes("conviction_downgraded") ? -4 : 0;

  // Semantic lesson
  const lessonMap: Partial<Record<SemanticChangeType, string>> = {
    direction_confirmed:      ar ? "الاتجاه الدلالي مؤكد — نفس التوجه مع إشارات محدثة." : "Semantic direction confirmed — same orientation with updated signals.",
    direction_reversed:       ar ? "الاتجاه الدلالي انقلب — مراجعة صريحة مطلوبة." : "Semantic direction reversed — explicit revision required.",
    invalidation_triggered:   ar ? "شرط الإلغاء السابق يبدو نشطاً — الأطروحة تحتاج إعادة تقييم." : "Prior invalidation condition appears active — thesis requires re-evaluation.",
    conviction_upgraded:      ar ? "القناعة ارتفعت — الأدلة أقوى من قبل." : "Conviction upgraded — evidence is stronger than before.",
    conviction_downgraded:    ar ? "القناعة تراجعت — حذر أكبر مبرر." : "Conviction downgraded — increased caution is warranted.",
    policy_stance_changed:    ar ? "موقف السياسة تغيّر — أثره على التقييم يحتاج تناولاً صريحاً." : "Policy stance changed — valuation impact needs explicit treatment.",
    oil_signal_changed:       ar ? "إشارة النفط تغيّرت (فوق/قرب/دون نقطة التعادل) — الأطروحة المالية السعودية تتأثر." : "Oil signal changed (above/near/below breakeven) — Saudi fiscal thesis is impacted.",
    stable:                   ar ? "لا تغيير دلالي جوهري — استمر بإشارات محدثة." : "No material semantic change — continue with updated signals.",
  };
  const semanticLesson = lessonMap[dominantChange ?? "stable"] ?? (ar ? "تطور تحليلي محايد." : "Neutral analytical evolution.");

  // Outcome context (injectable)
  const outcomeContext = ar
    ? `نتائج الأطروحات السابقة (دلالي): ${overallSignal === "confirmed" ? "مؤكد" : overallSignal === "reversed" ? "معكوس" : overallSignal === "invalidated" ? "مُلغى" : "متطور"} (+${confidenceAdjustment} نقطة قناعة). ${semanticLesson}`
    : `Recent thesis outcomes (semantic): ${overallSignal} (${confidenceAdjustment >= 0 ? "+" : ""}${confidenceAdjustment} confidence pts). ${semanticLesson}`;

  return { changes, dominantChange, overallSignal, confidenceAdjustment, semanticLesson, outcomeContext };
}

/**
 * Extracts a SemanticProfile from a PersistentMemoryEntry.
 * Used for comparing stored memory entries with current replies.
 */
export function profileFromMemoryEntry(entry: PersistentMemoryEntry): SemanticProfile {
  return {
    direction: (entry.direction ?? "unknown") as DirectionSemantic,
    convictionTier: entry.conviction !== undefined
      ? (entry.conviction >= 68 ? "high" : entry.conviction >= 50 ? "moderate" : entry.conviction >= 35 ? "low" : "insufficient")
      : "unknown",
    confidence: entry.conviction ?? 50,
    policyStance: (entry.policyStance ?? "unknown") as PolicySemantic,
    oilSignal: (entry.oilSignal ?? "unknown") as OilSemantic,
    allocationStance: "unknown",
    sectorLeader: "",
    invalidationActive: false,
    hasCausalChain: entry.content.includes("→"),
    hasSecondOrder: /second.order|ثانوي|downstream/i.test(entry.content),
  };
}
