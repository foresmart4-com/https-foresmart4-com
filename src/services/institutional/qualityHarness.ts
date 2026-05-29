// Phase-69: Investment Quality Evaluation Harness
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Distinct from existing quality modules:
//   qualityGate.ts (P0)          — binary field-presence checks; triggers enrichment
//   reasoningCalibration.ts (66) — causal language density scoring in prose
//   qualityHarness.ts (69)       — comprehensive multi-dimension scoring harness
//                                  with fixed canonical test prompts, per-dimension
//                                  subscores, quality tier derivation, and actionable
//                                  improvement feedback. Designed as a measurement
//                                  tool, not a live enrichment trigger.
//
// Six scoring dimensions:
//   1. depth               — reasoning depth, evidence strength, causal structure
//   2. macroLinkage        — transmission mechanism density, cross-asset confirmation
//   3. sectorLogic         — sector-specific reasoning quality and causal linkage
//   4. committeeReasoning  — selection framework, debate structure, stance discipline
//   5. uncertaintyDiscipline — confidence calibration, caveats, missing evidence
//   6. answerUsefulness    — specificity, completeness, non-generic framing
//
// Quality tiers:
//   institutional — total ≥ 80
//   strong        — total ≥ 65
//   acceptable    — total ≥ 45
//   weak          — total < 45

import type { GenesisReply } from "@/lib/genesis.functions";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type QualityTier =
  | "institutional"  // total ≥ 80; all six dimensions solid
  | "strong"         // total ≥ 65; most dimensions adequate
  | "acceptable"     // total ≥ 45; usable but thin in places
  | "weak";          // total < 45; major gaps; enrichment needed

export type PromptCategory =
  | "saudi_outlook"    // TASI 6-month outlook + investment question
  | "us_market"        // US equity market state and direction
  | "oil"              // oil price view + global market impact
  | "sectors"          // sector positioning in current macro environment
  | "companies"        // company selection / which stocks to invest in
  | "allocation"       // portfolio allocation given current conditions
  | "generic";         // unclassified investment question

export interface DimensionScore {
  name: string;
  score: number;        // 0-100
  weight: number;       // contribution weight (sums to 1.0 across dimensions)
  signals: string[];    // which positive signals were detected
  gaps: string[];       // which signals were absent / what lowered the score
}

export interface HarnessResult {
  promptCategory: PromptCategory;
  totalScore: number;           // 0-100 weighted average
  qualityTier: QualityTier;
  dimensions: {
    depth: DimensionScore;
    macroLinkage: DimensionScore;
    sectorLogic: DimensionScore;
    committeeReasoning: DimensionScore;
    uncertaintyDiscipline: DimensionScore;
    answerUsefulness: DimensionScore;
  };
  improvements: string[];       // actionable, specific improvement suggestions
  summary: string;              // 1-sentence overall assessment
}

// ─── Fixed canonical test prompts ─────────────────────────────────────────────
// These prompts are the reference set for harness evaluation. They are not sent
// to the AI — they define what category of question a reply is evaluated against.

export const TEST_PROMPTS: Record<PromptCategory, string> = {
  saudi_outlook:
    "What is your 6-month outlook for the Saudi market (TASI)? Should I invest, and which sectors or companies are best positioned?",
  us_market:
    "What is the current state of the US stock market and where is it headed over the next few months?",
  oil:
    "What is your view on oil prices and how does this affect global markets and Saudi equities?",
  sectors:
    "Which sectors are best positioned in the current macro environment and why?",
  companies:
    "Which companies should I invest in right now given the current market conditions?",
  allocation:
    "How should I allocate my portfolio given the current market conditions and macro environment?",
  generic:
    "What is your investment outlook for the current market?",
};

// ─── Prompt category detection ────────────────────────────────────────────────

const SAUDI_Q    = /tasi|saudi|أرامكو|تاسي|سعود|aramco|sabic|gulf|خليج/i;
const US_Q       = /\b(us|s&p|sp500|nasdaq|dow|nyse|american|united states)\b/i;
const OIL_Q      = /\boil\b|النفط|brent|wti|opec|crude/i;
const SECTOR_Q   = /\bsector\b|قطاع|which sector|rotation|دوران/i;
const COMPANY_Q  = /which.{0,10}(compan|stock)|أي.{0,10}شركات|best stock|top stock|أفضل.{0,10}(أسهم|شركات)/i;
const ALLOC_Q    = /allocat|portfolio|تخصيص|محفظة|how.{0,10}invest|كيف.{0,10}أستثمر/i;

export function detectPromptCategory(question: string): PromptCategory {
  if (SAUDI_Q.test(question))   return "saudi_outlook";
  if (OIL_Q.test(question))     return "oil";
  if (SECTOR_Q.test(question))  return "sectors";
  if (COMPANY_Q.test(question)) return "companies";
  if (ALLOC_Q.test(question))   return "allocation";
  if (US_Q.test(question))      return "us_market";
  return "generic";
}

// ─── Causal language density (shared with reasoningCalibration) ───────────────

const CAUSAL_PATTERNS = [/→/g, /leads? to/gi, /transmit/gi, /\bchannel\b/gi,
  /mechanism/gi, /resulting in/gi, /because.{1,40}(the|of|it)/gi,
  /if.{1,40}then/gi, /fiscal.{0,15}(space|drag|channel)/gi,
  /liquidity.{0,15}(tighten|drain|expan)/gi];

function causalScore(text: string): number {
  let hits = 0;
  for (const p of CAUSAL_PATTERNS) hits += (text.match(p) ?? []).length;
  return Math.min(hits, 10); // cap at 10
}

const GENERIC_FILLER = [/monitor the market/gi, /significant uncertainty/gi,
  /exciting opportunity/gi, /important to note/gi, /investors should watch/gi,
  /generally (bullish|bearish)/gi, /market conditions remain/gi];

function fillerPenalty(text: string): number {
  let hits = 0;
  for (const p of GENERIC_FILLER) if (p.test(text)) hits++;
  return hits;
}

// ─── Dimension 1: Depth ───────────────────────────────────────────────────────

function scoreDepth(reply: GenesisReply): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  // ReasoningDepth field (40 pts)
  const depthMap: Record<string, number> = {
    institutional: 40, moderate: 26, shallow: 10, insufficient: 0,
  };
  const depthPts = depthMap[reply.reasoningDepth ?? ""] ?? 0;
  score += depthPts;
  if (reply.reasoningDepth === "institutional") signals.push("reasoningDepth=institutional");
  else if (reply.reasoningDepth === "moderate")  signals.push("reasoningDepth=moderate");
  else gaps.push("reasoningDepth is shallow/insufficient — causal chains absent");

  // Evidence strength field (35 pts scaled)
  const es = reply.evidenceStrength ?? 0;
  const esPts = Math.round((es / 100) * 35);
  score += esPts;
  if (es >= 60) signals.push(`evidenceStrength=${es}/100`);
  else gaps.push(`evidenceStrength=${es}/100 — below threshold for institutional depth`);

  // Macro chain present (25 pts)
  if (reply.macroChain) {
    const causal = causalScore(reply.macroChain);
    const macPts = causal >= 3 ? 25 : causal >= 1 ? 15 : 8;
    score += macPts;
    signals.push(causal >= 3 ? "macroChain with strong causal density" : "macroChain present");
  } else {
    gaps.push("macroChain absent — macro chain narrative missing");
  }

  return {
    name: "depth", score: Math.min(100, score), weight: 0.22,
    signals, gaps,
  };
}

// ─── Dimension 2: Macro Linkage ───────────────────────────────────────────────

function scoreMacroLinkage(reply: GenesisReply, category: PromptCategory): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  // Track A macro view present (20 pts)
  if (reply.trackViewMacro) { score += 20; signals.push("trackViewMacro present"); }
  else gaps.push("trackViewMacro absent");

  // Cross-asset confirmation (20 pts)
  if (reply.crossAssetConfirmation) { score += 20; signals.push("crossAssetConfirmation present"); }
  else gaps.push("crossAssetConfirmation absent");

  // Causal chain quality in outlook + macroChain (30 pts)
  const richText = [reply.outlook, reply.macroChain, reply.reasoning].filter(Boolean).join(" ");
  const causal = causalScore(richText);
  const causalPts = Math.min(30, causal * 3);
  score += causalPts;
  if (causal >= 5) signals.push(`strong causal density (${causal} causal hits in outlook/macroChain)`);
  else if (causal >= 2) signals.push(`moderate causal density (${causal} causal hits)`);
  else gaps.push("weak causal language in outlook — regime labels without transmission mechanisms");

  // Saudi-specific: oil channel linkage (15 pts for Saudi questions)
  if (category === "saudi_outlook" || category === "oil") {
    const oilLinked = /oil.{0,30}(fiscal|breakeven|aramco|tasi|government)/i.test(richText)
      || /النفط.{0,30}(مالي|تاسي|أرامكو)/i.test(richText);
    if (oilLinked) { score += 15; signals.push("oil→fiscal channel linkage present"); }
    else gaps.push("oil→fiscal channel not explicitly linked for Saudi/oil question");
  } else {
    // Generic macro linkage bonus (15 pts)
    const hasRegimeLink = !!reply.regime && !!reply.thesis;
    if (hasRegimeLink) { score += 15; signals.push("regime+thesis linkage present"); }
    else gaps.push("regime and thesis not connected");
  }

  // Filler penalty
  const filler = fillerPenalty(richText);
  score -= filler * 8;
  if (filler > 0) gaps.push(`${filler} generic filler phrase(s) detected — reduces macro linkage quality`);

  return {
    name: "macroLinkage", score: Math.max(0, Math.min(100, score)), weight: 0.20,
    signals, gaps,
  };
}

// ─── Dimension 3: Sector Logic ────────────────────────────────────────────────

function scoreSectorLogic(reply: GenesisReply, category: PromptCategory): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  // sectorLens present (40 pts)
  if (reply.sectorLens) {
    score += 40;
    signals.push("sectorLens present");

    // Causal density in sectorLens (20 pts)
    const causal = causalScore(reply.sectorLens);
    if (causal >= 3) { score += 20; signals.push("sectorLens has strong causal reasoning"); }
    else if (causal >= 1) { score += 10; signals.push("sectorLens has partial causal reasoning"); }
    else gaps.push("sectorLens lacks causal transmission (→, 'because', 'leads to')");

    // Sector-specific content (20 pts)
    const sectorKeywords = /bank|energy|tech|petrochem|telecom|healthcare|consumer|reit|utility|industri|بنك|طاقة|بتروكيماوي|اتصال|صحة|مستهلك|عقار|مرافق|صناعي/i;
    if (sectorKeywords.test(reply.sectorLens)) {
      score += 20; signals.push("sector-specific content detected in sectorLens");
    } else {
      gaps.push("sectorLens lacks named sector references");
    }
  } else {
    gaps.push("sectorLens absent — sector rotation reasoning missing");
  }

  // Saudi sector enforcement (20 pts)
  if (category === "saudi_outlook" || category === "sectors") {
    const saudiSectors = /sama|banks|aramco|sabic|vision 2030|أرامكو|سابك|رؤية/i;
    const allText = [reply.sectorLens, reply.outlook, reply.baseCase].filter(Boolean).join(" ");
    if (saudiSectors.test(allText)) {
      score += 20; signals.push("Saudi sector channels referenced (SAMA/Aramco/SABIC/Vision 2030)");
    } else if (category === "saudi_outlook") {
      gaps.push("Saudi sector channels (SAMA, Aramco, SABIC, Vision 2030) not addressed");
    }
  } else {
    // Generic: global sector rotation logic bonus
    const hasRotation = /rotation|winner|loser|outperform|underperform|دوران|متفوق|أداء/i
      .test([reply.sectorLens, reply.outlook].filter(Boolean).join(" "));
    if (hasRotation) { score += 20; signals.push("sector rotation logic present"); }
    else gaps.push("no sector rotation/winner-loser reasoning detected");
  }

  return {
    name: "sectorLogic", score: Math.max(0, Math.min(100, score)), weight: 0.16,
    signals, gaps,
  };
}

// ─── Dimension 4: Committee Reasoning ────────────────────────────────────────

function scoreCommitteeReasoning(reply: GenesisReply, category: PromptCategory): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  const isCompanyOrAlloc = category === "companies" || category === "allocation" || category === "sectors";

  // Selection framework (30 pts)
  if (reply.selectionFramework) {
    score += 30; signals.push("selectionFramework present");
  } else if (isCompanyOrAlloc) {
    gaps.push("selectionFramework absent — required for company/allocation questions");
  } else {
    score += 10; // partial credit: not strictly required for non-company questions
  }

  // Committee bull + bear cases (20 pts each)
  if (reply.committeeBullCase) { score += 20; signals.push("committeeBullCase present"); }
  else if (isCompanyOrAlloc) gaps.push("committeeBullCase absent");

  if (reply.committeeBearCase) { score += 20; signals.push("committeeBearCase present"); }
  else if (isCompanyOrAlloc) gaps.push("committeeBearCase absent");

  // Committee stance (15 pts)
  if (reply.committeeStance) { score += 15; signals.push(`committeeStance=${reply.committeeStance}`); }
  else if (isCompanyOrAlloc) gaps.push("committeeStance absent");

  // Opposing case present (15 pts — all question types)
  if (reply.opposingCase) { score += 15; signals.push("opposingCase present"); }
  else gaps.push("opposingCase absent — no devil's advocate framing");

  // No company name as recommendation check (bonus: not penalising, just noting)
  // Can't check this deterministically from field names alone — skip

  return {
    name: "committeeReasoning", score: Math.max(0, Math.min(100, score)), weight: 0.16,
    signals, gaps,
  };
}

// ─── Dimension 5: Uncertainty Discipline ─────────────────────────────────────

function scoreUncertaintyDiscipline(reply: GenesisReply): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  // Confidence vs evidence alignment (25 pts)
  const es = reply.evidenceStrength ?? 50;
  const conf = reply.confidence;
  const gap = conf - es;
  if (gap <= 10) {
    score += 25; signals.push(`confidence (${conf}%) aligned with evidenceStrength (${es}/100)`);
  } else if (gap <= 25) {
    score += 15; signals.push(`confidence (${conf}%) slightly above evidenceStrength (${es}/100)`);
    gaps.push("confidence modestly exceeds evidence strength");
  } else {
    gaps.push(`confidence (${conf}%) significantly exceeds evidenceStrength (${es}/100) — possible assertion`);
  }

  // Caveats present (20 pts)
  if (reply.caveats?.length) {
    score += 20; signals.push(`${reply.caveats.length} caveat(s) present`);
  } else gaps.push("no caveats — reasoning may be overconfident");

  // Missing evidence named (20 pts)
  if (reply.missingEvidence) {
    score += 20; signals.push("missingEvidence field present");
  } else gaps.push("missingEvidence absent — what would change the view is unclear");

  // Uncertainty warning when low confidence (15 pts)
  if (conf < 50 && reply.uncertaintyWarning) {
    score += 15; signals.push("uncertaintyWarning present at low confidence");
  } else if (conf < 50 && !reply.uncertaintyWarning) {
    gaps.push("confidence < 50% but no uncertaintyWarning");
  } else {
    score += 10; // no penalty for high confidence without warning
  }

  // Evidence conflict acknowledged (20 pts)
  if (reply.evidenceConflict) {
    score += 20; signals.push("evidenceConflict acknowledged");
  } else if (reply.disagreementNote) {
    score += 12; signals.push("disagreementNote present (partial conflict acknowledgement)");
  } else {
    gaps.push("no evidence conflict or disagreement acknowledged");
  }

  return {
    name: "uncertaintyDiscipline", score: Math.max(0, Math.min(100, score)), weight: 0.14,
    signals, gaps,
  };
}

// ─── Dimension 6: Answer Usefulness ──────────────────────────────────────────

function scoreAnswerUsefulness(reply: GenesisReply, category: PromptCategory): DimensionScore {
  const signals: string[] = [];
  const gaps: string[] = [];
  let score = 0;

  // Specific headline (not generic) — 15 pts
  const genericHeadline = /market is|outlook is|conditions remain|general|overall/i;
  if (!genericHeadline.test(reply.headline) && reply.headline.length > 30) {
    score += 15; signals.push("headline is specific and substantive");
  } else {
    gaps.push("headline is generic or too short");
  }

  // Scenarios: exactly 3 with conditional labels — 15 pts
  if (reply.scenarios?.length === 3) {
    const conditional = reply.scenarios.some(s => /if|when|إذا|عند/.test(s.label));
    score += conditional ? 15 : 8;
    if (conditional) signals.push("3 scenarios with conditional labels");
    else signals.push("3 scenarios present (non-conditional labels)");
  } else {
    gaps.push(`scenarios: ${reply.scenarios?.length ?? 0} (expected 3 conditional scenarios)`);
  }

  // Risks: 2+ specific items — 10 pts
  if ((reply.risks?.length ?? 0) >= 2) {
    score += 10; signals.push(`${reply.risks.length} risk items`);
  } else gaps.push("fewer than 2 risk items");

  // baseCase present — 15 pts
  if (reply.baseCase) { score += 15; signals.push("baseCase present"); }
  else gaps.push("baseCase absent");

  // thesisChanger present — 10 pts
  if (reply.thesisChanger) { score += 10; signals.push("thesisChanger present"); }
  else gaps.push("thesisChanger absent — what changes the view not stated");

  // Thesis + invalidation (directional and falsifiable) — 15 pts
  if (reply.thesis && reply.invalidation) {
    score += 15; signals.push("thesis + invalidation (falsifiable view)");
  } else if (reply.thesis) {
    score += 8; gaps.push("thesis present but no invalidation condition");
  } else {
    gaps.push("no directional thesis");
  }

  // Category-specific usefulness
  if (category === "saudi_outlook") {
    // Must address investment stance explicitly
    const hasStance = /invest|توصية|stance|outlook|تنصح/.test([reply.headline, reply.outlook, reply.baseCase].filter(Boolean).join(" "));
    if (hasStance) { score += 10; signals.push("investment stance addressed for Saudi question"); }
    else gaps.push("Saudi question: investment stance not explicitly addressed");
  } else if (category === "allocation") {
    if (reply.selectionFramework) { score += 10; signals.push("selectionFramework present for allocation question"); }
    else gaps.push("selectionFramework absent for allocation question");
  }

  // Filler penalty on headline + outlook
  const quickCheck = (reply.headline ?? "") + " " + (reply.outlook ?? "").slice(0, 200);
  const filler = fillerPenalty(quickCheck);
  score -= filler * 5;
  if (filler > 0) gaps.push(`${filler} generic filler phrase(s) reduce answer usefulness`);

  return {
    name: "answerUsefulness", score: Math.max(0, Math.min(100, score)), weight: 0.12,
    signals, gaps,
  };
}

// ─── Quality tier derivation ──────────────────────────────────────────────────

function deriveQualityTier(total: number): QualityTier {
  if (total >= 80) return "institutional";
  if (total >= 65) return "strong";
  if (total >= 45) return "acceptable";
  return "weak";
}

// ─── Improvement suggestions ──────────────────────────────────────────────────

function buildImprovements(
  dims: HarnessResult["dimensions"],
  tier: QualityTier,
): string[] {
  const suggestions: string[] = [];

  // Ordered by impact: depth → macroLinkage → sectorLogic → committeeReasoning
  if (dims.depth.score < 60)
    suggestions.push(`Depth (${dims.depth.score}/100): ${dims.depth.gaps[0] ?? "improve causal chain density"}`);
  if (dims.macroLinkage.score < 55)
    suggestions.push(`Macro linkage (${dims.macroLinkage.score}/100): ${dims.macroLinkage.gaps[0] ?? "add transmission mechanisms"}`);
  if (dims.sectorLogic.score < 50)
    suggestions.push(`Sector logic (${dims.sectorLogic.score}/100): ${dims.sectorLogic.gaps[0] ?? "add named sector reasoning"}`);
  if (dims.committeeReasoning.score < 50)
    suggestions.push(`Committee (${dims.committeeReasoning.score}/100): ${dims.committeeReasoning.gaps[0] ?? "add selectionFramework and debate cases"}`);
  if (dims.uncertaintyDiscipline.score < 55)
    suggestions.push(`Uncertainty (${dims.uncertaintyDiscipline.score}/100): ${dims.uncertaintyDiscipline.gaps[0] ?? "add caveats and missingEvidence"}`);
  if (dims.answerUsefulness.score < 50)
    suggestions.push(`Usefulness (${dims.answerUsefulness.score}/100): ${dims.answerUsefulness.gaps[0] ?? "add baseCase and thesisChanger"}`);

  if (tier === "weak" && suggestions.length < 3)
    suggestions.push("Consider triggering enrichReplyFromTracks() to populate missing institutional fields");

  return suggestions.slice(0, 5);
}

// ─── Summary builder ──────────────────────────────────────────────────────────

function buildSummary(tier: QualityTier, total: number, category: PromptCategory): string {
  const catLabel = category.replace(/_/g, " ");
  switch (tier) {
    case "institutional":
      return `Institutional-grade ${catLabel} answer (${total}/100) — causal chains, sector logic, and uncertainty discipline all meet the bar.`;
    case "strong":
      return `Strong ${catLabel} answer (${total}/100) — directional reasoning is present with minor gaps in one or two dimensions.`;
    case "acceptable":
      return `Acceptable ${catLabel} answer (${total}/100) — usable but thin in macro linkage, sector logic, or committee reasoning.`;
    case "weak":
      return `Weak ${catLabel} answer (${total}/100) — major institutional fields missing; enrichment or retry recommended.`;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluates a GenesisReply against six quality dimensions.
 * @param reply     The Genesis reply to evaluate.
 * @param question  The original user question (used for category detection).
 * @returns         A fully scored HarnessResult with tier, subscores, and improvements.
 */
export function evaluateAnswerQuality(
  reply: GenesisReply,
  question: string = "",
): HarnessResult {
  const category = detectPromptCategory(question);

  const depth               = scoreDepth(reply);
  const macroLinkage        = scoreMacroLinkage(reply, category);
  const sectorLogic         = scoreSectorLogic(reply, category);
  const committeeReasoning  = scoreCommitteeReasoning(reply, category);
  const uncertaintyDiscipline = scoreUncertaintyDiscipline(reply);
  const answerUsefulness    = scoreAnswerUsefulness(reply, category);

  const dims = { depth, macroLinkage, sectorLogic, committeeReasoning, uncertaintyDiscipline, answerUsefulness };

  const totalScore = Math.round(
    depth.score              * depth.weight +
    macroLinkage.score       * macroLinkage.weight +
    sectorLogic.score        * sectorLogic.weight +
    committeeReasoning.score * committeeReasoning.weight +
    uncertaintyDiscipline.score * uncertaintyDiscipline.weight +
    answerUsefulness.score   * answerUsefulness.weight,
  );

  const qualityTier  = deriveQualityTier(totalScore);
  const improvements = buildImprovements(dims, qualityTier);
  const summary      = buildSummary(qualityTier, totalScore, category);

  return {
    promptCategory: category,
    totalScore,
    qualityTier,
    dimensions: dims,
    improvements,
    summary,
  };
}

/**
 * Runs the harness against all six canonical test prompts using a mock reply.
 * Returns per-prompt expected minimum scores for regression monitoring.
 * The reply is evaluated as if it were the response to each prompt category.
 * Useful for batch evaluation without requiring live AI calls.
 */
export function runCanonicalBatch(
  replies: Partial<Record<PromptCategory, GenesisReply>>,
): Partial<Record<PromptCategory, HarnessResult>> {
  const results: Partial<Record<PromptCategory, HarnessResult>> = {};
  for (const [category, reply] of Object.entries(replies) as [PromptCategory, GenesisReply][]) {
    results[category] = evaluateAnswerQuality(reply, TEST_PROMPTS[category]);
  }
  return results;
}

/**
 * Returns the minimum expected score per dimension for a quality tier.
 * Used to identify which dimensions are dragging the tier down.
 */
export function tierThresholds(tier: QualityTier): Record<keyof HarnessResult["dimensions"], number> {
  const floors: Record<QualityTier, number> = {
    institutional: 72, strong: 58, acceptable: 38, weak: 0,
  };
  const floor = floors[tier];
  return {
    depth: floor, macroLinkage: floor, sectorLogic: floor,
    committeeReasoning: floor, uncertaintyDiscipline: floor, answerUsefulness: floor,
  };
}
