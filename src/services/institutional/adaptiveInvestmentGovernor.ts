// Phase-84A: Adaptive Investment Governor
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Final governor before user response on serious investment questions.
// Combines all quality scores into a composite assessment and decides
// whether the answer is ready to return, needs repair, or is insufficient.
//
// Decision hierarchy:
//   allow                — composite score ≥ 80; all critical signals present
//   repair_required      — composite 65-79; one or more weak dimensions
//   insufficient_evidence — composite < 65; serious gaps; label answer accordingly
//   stale_memory_warning  — answer passes but uses stale prior context
//
// The governor does NOT modify the reply. It only returns a decision and
// actionable repair hints that the pipeline can apply.

import type { GenesisReply } from "@/lib/genesis.functions";
import type { OutcomeSignal } from "./outcomeLearningEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GovernorDecision =
  | "allow"
  | "repair_required"
  | "insufficient_evidence"
  | "stale_memory_warning";

export interface GovernorInput {
  knowledgeUseScore: number;       // 0-100 from knowledgeUseEnforcement
  depthRulesScore: number;         // 0-100 from investmentDepthRules
  judgmentScore: number;           // 0-100 from investmentJudgmentEngine
  validationHarnessScore: number;  // 0-100 from genesisQualityValidationHarness
  hasMemoryContext: boolean;       // true if prior thesis was injected
  memoryIsStale: boolean;          // true if memory context was marked stale
  outcomeLearningSignal: OutcomeSignal | null;
  isInvestment: boolean;
}

export interface GovernorOutput {
  decision: GovernorDecision;
  compositeScore: number;  // 0-100 weighted
  explanation: string;     // log-safe explanation of the decision
  repairPriority: string[]; // ordered repair hints (highest impact first)
  insufficientLabel: string; // label to attach if insufficient_evidence
}

// ─── Score weights ────────────────────────────────────────────────────────────
// Validation harness and judgment engine are highest weight (output quality).
// Depth rules and knowledge use are medium (input quality enforcement).

const WEIGHTS = {
  validationHarness: 0.30,
  judgmentScore:     0.28,
  depthRulesScore:   0.25,
  knowledgeUseScore: 0.17,
};

// ─── Composite scoring ────────────────────────────────────────────────────────

function computeCompositeScore(input: GovernorInput): number {
  let score =
    (input.validationHarnessScore * WEIGHTS.validationHarness) +
    (input.judgmentScore * WEIGHTS.judgmentScore) +
    (input.depthRulesScore * WEIGHTS.depthRulesScore) +
    (input.knowledgeUseScore * WEIGHTS.knowledgeUseScore);

  // Outcome learning adjustments (small signal, ±5 pts max)
  if (input.outcomeLearningSignal === "confirmed") score = Math.min(100, score + 3);
  if (input.outcomeLearningSignal === "contradicted") score = Math.max(0, score - 3);

  return Math.round(score);
}

// ─── Decision derivation ──────────────────────────────────────────────────────

const ALLOW_THRESHOLD = 80;
const REPAIR_THRESHOLD = 65;

function deriveDecision(compositeScore: number, input: GovernorInput): GovernorDecision {
  if (compositeScore >= ALLOW_THRESHOLD) {
    // Allow — but flag stale memory if relevant
    if (input.hasMemoryContext && input.memoryIsStale) return "stale_memory_warning";
    return "allow";
  }
  if (compositeScore >= REPAIR_THRESHOLD) return "repair_required";
  return "insufficient_evidence";
}

// ─── Repair priority ──────────────────────────────────────────────────────────

function buildRepairPriority(input: GovernorInput, lang: "ar" | "en"): string[] {
  const ar = lang === "ar";
  const hints: Array<{ priority: number; hint: string }> = [];

  if (input.validationHarnessScore < 65) {
    hints.push({ priority: 10, hint: ar
      ? "درجة التحقق من الجودة منخفضة — تحقق من وجود أطروحة اتجاهية وسلسلة ماكرو وموقف مخصص."
      : "Validation score low — ensure directional thesis, macro chain, and allocator stance are present." });
  }
  if (input.judgmentScore < 65) {
    hints.push({ priority: 9, hint: ar
      ? "درجة حكم الاستثمار منخفضة — أضف معالجة التعارضات وقناعة النشر وتوازن الأدلة."
      : "Judgment score low — add conflict handling, deployment conviction, and balanced evidence." });
  }
  if (input.depthRulesScore < 70) {
    hints.push({ priority: 8, hint: ar
      ? "درجة قواعد العمق منخفضة — أضف سلسلة انتقال سببية واستفد من المخاطر الثانوية والتمييز بين التقييم والأرباح."
      : "Depth rules score low — add causal transmission chain, second-order risks, valuation-vs-earnings distinction." });
  }
  if (input.knowledgeUseScore < 70) {
    hints.push({ priority: 7, hint: ar
      ? "درجة استخدام المعرفة منخفضة — أشر إلى أرامكو، نقطة التعادل، SAMA بشكل صريح."
      : "Knowledge use score low — explicitly reference Aramco, fiscal breakeven, SAMA constraint." });
  }

  return hints.sort((a, b) => b.priority - a.priority).map(h => h.hint);
}

// ─── Insufficient evidence label ──────────────────────────────────────────────

function buildInsufficientLabel(input: GovernorInput, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  const lowestDim = [
    { name: ar ? "التحقق من الجودة" : "validation", score: input.validationHarnessScore },
    { name: ar ? "حكم الاستثمار" : "judgment", score: input.judgmentScore },
    { name: ar ? "قواعد العمق" : "depth rules", score: input.depthRulesScore },
  ].sort((a, b) => a.score - b.score)[0];

  return ar
    ? `أدلة غير كافية: درجة ${lowestDim.name} ${lowestDim.score}/100 — الإجابة تحتاج مراجعة قبل العرض. التحليل للأغراض التعليمية فقط.`
    : `Insufficient evidence: ${lowestDim.name} score ${lowestDim.score}/100 — answer requires review before display. Analysis is educational only.`;
}

// ─── Explanation builder ─────────────────────────────────────────────────────

function buildExplanation(decision: GovernorDecision, compositeScore: number, input: GovernorInput): string {
  const dims = `validation=${input.validationHarnessScore} judgment=${input.judgmentScore} depth=${input.depthRulesScore} knowledge=${input.knowledgeUseScore}`;
  const mem = input.hasMemoryContext ? ` memory=${input.memoryIsStale ? "stale" : "fresh"}` : "";
  const outcome = input.outcomeLearningSignal ? ` outcome=${input.outcomeLearningSignal}` : "";
  return `decision=${decision} composite=${compositeScore} [${dims}${mem}${outcome}]`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Final governance evaluation before response delivery.
 * Returns a decision and actionable repair hints.
 * Pure O(1) — no AI calls, no network.
 */
export function evaluateGovernor(
  input: GovernorInput,
  lang: "ar" | "en" = "en",
): GovernorOutput {
  if (!input.isInvestment) {
    return {
      decision: "allow", compositeScore: 100,
      explanation: "non-investment question — governor pass-through",
      repairPriority: [], insufficientLabel: "",
    };
  }

  const compositeScore = computeCompositeScore(input);
  const decision = deriveDecision(compositeScore, input);
  const explanation = buildExplanation(decision, compositeScore, input);
  const repairPriority = (decision === "repair_required" || decision === "insufficient_evidence")
    ? buildRepairPriority(input, lang)
    : [];
  const insufficientLabel = decision === "insufficient_evidence"
    ? buildInsufficientLabel(input, lang)
    : "";

  return { decision, compositeScore, explanation, repairPriority, insufficientLabel };
}

/**
 * Applies the governor decision to the reply.
 * - allow: no change
 * - repair_required: returns repair hints (caller applies repair)
 * - insufficient_evidence: marks reply disclaimer
 * - stale_memory_warning: no change but warning noted in log
 */
export function applyGovernorDecision(
  reply: GenesisReply,
  output: GovernorOutput,
  lang: "ar" | "en",
): void {
  if (output.decision === "insufficient_evidence" && output.insufficientLabel) {
    // Append to disclaimer to surface the insufficiency
    const suffix = lang === "ar"
      ? ` | ${output.insufficientLabel}`
      : ` | ${output.insufficientLabel}`;
    if (!reply.disclaimer.includes("insufficient") && !reply.disclaimer.includes("غير كافية")) {
      reply.disclaimer = reply.disclaimer + suffix;
    }
  }
  // repair_required: repair hints returned to caller; no direct mutation here
  // allow/stale_memory_warning: no mutation needed
}
