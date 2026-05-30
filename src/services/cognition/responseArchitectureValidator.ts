// Response Architecture Validator
// Audits the complete Genesis response for architectural quality across 5 dimensions:
//
//   1. questionCompliance  (0-25) — did response contain what the user explicitly asked?
//   2. institutionalDepth  (0-25) — depth of reasoning (populated fields + chain quality)
//   3. memoQuality         (0-25) — structured memo vs generic summary (from InstitutionalMemoResult)
//   4. reasoningDominance  (0-25) — conditional/causal language vs template labels
//
// Architecture failure: overallScore < 60
//
// No AI calls. No network. Pure deterministic. O(1).

import type { QuestionBindingResult } from "./questionBindingGovernor";
import type { InstitutionalMemoResult } from "./institutionalMemoComposer";

export interface ArchitectureValidationResult {
  questionCompliance: number;    // 0-25
  institutionalDepth: number;    // 0-25
  memoQuality: number;           // 0-25
  reasoningDominance: number;    // 0-25
  overallScore: number;          // 0-100
  architectureFailure: boolean;  // overallScore < 60
  failureReasons: string[];
  validatorLog: string;
}

// Generic surface language patterns — indicate template dominance
const TEMPLATE_PATTERNS = [
  /\bit is important to (note|mention)\b/i,
  /\bsignificant(ly)?\s+uncertain\b/i,
  /\bexciting opportunity\b/i,
  /\binvestors? should (closely )?watch\b/i,
  /\bmomentum suggests? (upside|downside|growth)\b/i,
  /\boverall (bullish|bearish|positive|negative)\b/i,
  /\bcould potentially (rise|fall|improve)\b/i,
  /\bmarket conditions remain uncertain\b/i,
  /\bkeep an eye (on|out for)\b/i,
  /\bas we know\b/i,
];

type ReplyLike = {
  thesis?: string;
  bullCase?: string;
  bearCase?: string;
  baseCase?: string;
  macroChain?: string;
  secondOrderRisks?: string;
  thesisChanger?: string;
  invalidation?: string;
  outlook?: string;
  committeeSynthesis?: { finalStance?: string };
  voiceReasoning?: { allocator?: string; macro?: string; historical?: string };
};

function scoreQuestionCompliance(
  reply: ReplyLike,
  binding: QuestionBindingResult,
): number {
  if (!binding.hasMandatoryOutput || binding.boundSections.length === 0) return 20;
  const allText = JSON.stringify(reply).toLowerCase();
  let score = 0;
  const perSection = 25 / binding.boundSections.length;
  for (const bs of binding.boundSections) {
    // Try to resolve nested field path (e.g. "voiceReasoning.historical")
    const fieldValue = bs.fieldRequired.split(".").reduce<unknown>(
      (obj, key) =>
        obj && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined,
      reply,
    );
    if (typeof fieldValue === "string" && fieldValue.trim().length > 20) {
      score += perSection;
    } else if (allText.includes(bs.humanLabel.toLowerCase().replace(/ /g, ""))) {
      score += perSection * 0.4;
    }
  }
  return Math.min(25, Math.round(score));
}

function scoreInstitutionalDepth(reply: ReplyLike): number {
  let score = 0;
  if (reply.thesis && reply.thesis.length > 30) score += 4;
  if (reply.bullCase && reply.bullCase.length > 40) score += 3;
  if (reply.bearCase && reply.bearCase.length > 40) score += 3;
  if (reply.baseCase && reply.baseCase.length > 30) score += 3;
  if (reply.macroChain && /→/.test(reply.macroChain) && reply.macroChain.length > 50) score += 4;
  if (reply.secondOrderRisks && reply.secondOrderRisks.length > 40) score += 3;
  if (reply.voiceReasoning?.allocator && reply.voiceReasoning.allocator.length > 50) score += 3;
  if (reply.committeeSynthesis?.finalStance && reply.committeeSynthesis.finalStance.length > 30) score += 2;
  return Math.min(25, score);
}

function scoreMemoQuality(memo: InstitutionalMemoResult): number {
  return Math.round(memo.memoScore * 0.25);
}

function scoreReasoningDominance(reply: ReplyLike): number {
  const allText = [
    reply.thesis ?? "",
    reply.outlook ?? "",
    reply.voiceReasoning?.allocator ?? "",
    reply.voiceReasoning?.macro ?? "",
    reply.macroChain ?? "",
  ].join(" ");

  const genericHits = TEMPLATE_PATTERNS.filter(re => re.test(allText)).length;
  const arrowCount = (allText.match(/→/g) ?? []).length;
  const conditionalCount = (allText.match(/\bif\b.*?\b(then|→)\b|\bIF [A-Z]/g) ?? []).length;
  const numericCount = (allText.match(/\b\d{1,3}(\.\d+)?%|\$\d+|\d+[xX]\b/g) ?? []).length;

  let score = 0;
  if (arrowCount >= 5) score += 9;
  else if (arrowCount >= 3) score += 7;
  else if (arrowCount >= 1) score += 3;

  if (conditionalCount >= 3) score += 9;
  else if (conditionalCount >= 1) score += 4;

  if (numericCount >= 4) score += 7;
  else if (numericCount >= 2) score += 4;

  score -= genericHits * 2;
  return Math.max(0, Math.min(25, score));
}

export function validateResponseArchitecture(
  reply: ReplyLike,
  binding: QuestionBindingResult,
  memo: InstitutionalMemoResult,
): ArchitectureValidationResult {
  const questionCompliance  = scoreQuestionCompliance(reply, binding);
  const institutionalDepth  = scoreInstitutionalDepth(reply);
  const memoQuality         = scoreMemoQuality(memo);
  const reasoningDominance  = scoreReasoningDominance(reply);

  const overallScore = questionCompliance + institutionalDepth + memoQuality + reasoningDominance;
  const architectureFailure = overallScore < 60;

  const failureReasons: string[] = [];
  if (questionCompliance < 15) {
    failureReasons.push(`question_compliance=${questionCompliance}/25 — required sections missing`);
  }
  if (institutionalDepth < 12) {
    failureReasons.push(`institutional_depth=${institutionalDepth}/25 — thesis/macroChain/allocator weak`);
  }
  if (memoQuality < 12) {
    failureReasons.push(`memo_quality=${memoQuality}/25 — fewer than 4 memo sections assembled`);
  }
  if (reasoningDominance < 10) {
    failureReasons.push(`reasoning_dominance=${reasoningDominance}/25 — template language dominant`);
  }

  const validatorLog = [
    `arch_score=${overallScore}`,
    `compliance=${questionCompliance}/25`,
    `depth=${institutionalDepth}/25`,
    `memo=${memoQuality}/25`,
    `reasoning=${reasoningDominance}/25`,
    `failure=${architectureFailure}`,
    `memo_grade=${memo.memoGrade}`,
    `memo_sections=[${memo.sectionsIncluded.join(",")}]`,
  ].join(" ");

  return {
    questionCompliance,
    institutionalDepth,
    memoQuality,
    reasoningDominance,
    overallScore,
    architectureFailure,
    failureReasons,
    validatorLog,
  };
}
