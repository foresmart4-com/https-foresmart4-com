// Phase-87A: Dynamic Budget Governor
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Replaces the static 35/22/20/13/10 split in unifiedCognitionGovernor.ts
// with relevance-driven dynamic allocation.
//
// Problem: a question with no live macro events still allocates 35% of budget
// to the macro layer — wasting chars on an empty string.
//
// Solution: budget is proportional to (layer_relevance × active_flag × question_type_bonus).
//
// Layer relevance scores (0-100): passed from upstream modules.
//   macro:     from macroSynthesis string length + event count
//   semantic:  from semanticImpact.analyticalPressure
//   expert:    from expertKnowledge string length
//   policy:    from policyDelta.deltaScore
//   authority: from authority string length
//
// Question type bonus: detected from question text signals.
//   macro_heavy:   +30% to macro layer
//   policy_heavy:  +30% to policy layer
//   expert_heavy:  +20% to expert layer (thinker/school/framework questions)
//   analytical:    +20% to semantic layer (neutral how/what/why questions)
//   balanced:      no bonus — equal weighting
//
// Constraints:
//   Floor: each active layer gets at minimum 8% of total budget
//   Ceiling: no single layer exceeds 48% of total budget
//   Total: always sums to maxChars (no chars wasted)
//
// Returns: DynamicBudgetAllocation with per-layer char limits.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type QuestionType = "macro_heavy" | "policy_heavy" | "expert_heavy" | "analytical" | "balanced";

export interface LayerRelevanceScores {
  macro:     number;  // 0-100
  semantic:  number;  // 0-100
  expert:    number;  // 0-100
  policy:    number;  // 0-100
  authority: number;  // 0-100
}

export interface DynamicBudgetAllocation {
  macro:       number;
  semantic:    number;
  expert:      number;
  policy:      number;
  authority:   number;
  questionType: QuestionType;
}

// ─── Question type detection ─────────────────────────────────────────────────

// Note: `g` flag required — String.match() without `g` returns capture groups, not occurrence count
const MACRO_HEAVY  = /\b(oil|rate[s]?|inflation|macro|regime|credit|liquidity|gdp|tightening|easing|shock|نفط|أسعار|تضخم)\b/gi;
const POLICY_HEAVY = /\b(fed|ecb|sama|central bank|monetary policy|rate hike|rate cut|hawkish|dovish|pivot|فائدة|سياسة نقدية)\b/gi;
const EXPERT_HEAVY = /\b(framework|thinker|school|dalio|buffett|keynes|minsky|value invest|credit cycle|regime analysis|إطار|مدرسة)\b/gi;
const ANALYTICAL   = /\b(how does|what is|why|explain|compare|transmit|mechanism|transmission|describe|analyse|كيف|ما هو|لماذا)\b/gi;

export function detectQuestionType(question: string): QuestionType {
  // Reset lastIndex — all patterns use `g` flag so are stateful
  MACRO_HEAVY.lastIndex = 0; POLICY_HEAVY.lastIndex = 0;
  EXPERT_HEAVY.lastIndex = 0; ANALYTICAL.lastIndex = 0;

  const macroScore   = (question.match(MACRO_HEAVY)   ?? []).length;
  const policyScore  = (question.match(POLICY_HEAVY)  ?? []).length;
  const expertScore  = (question.match(EXPERT_HEAVY)  ?? []).length;
  const analytScore  = (question.match(ANALYTICAL)    ?? []).length;

  // Check analytical first — how/what/why questions dominate even if they mention policy
  if (analytScore >= 2 && analytScore >= Math.max(macroScore, policyScore, expertScore)) return "analytical";

  const max = Math.max(macroScore, policyScore, expertScore, analytScore);
  if (max === 0)              return "balanced";
  if (macroScore === max  && macroScore  >= 2) return "macro_heavy";
  if (policyScore === max && policyScore >= 2) return "policy_heavy";
  if (expertScore === max && expertScore >= 2) return "expert_heavy";
  if (analytScore >= 1)                        return "analytical";
  return "balanced";
}

// ─── Budget computation ───────────────────────────────────────────────────────

const LAYER_FLOOR   = 0.08;  // minimum share per active layer
const LAYER_CEILING = 0.48;  // maximum share per active layer

// Question type bonuses per layer
const TYPE_BONUS: Record<QuestionType, Partial<Record<keyof LayerRelevanceScores, number>>> = {
  macro_heavy:   { macro: 30 },
  policy_heavy:  { policy: 30 },
  expert_heavy:  { expert: 20 },
  analytical:    { semantic: 20 },
  balanced:      {},
};

export function allocateDynamicBudget(
  totalChars: number,
  scores: LayerRelevanceScores,
  available: Record<keyof LayerRelevanceScores, boolean>,
  questionType: QuestionType,
): DynamicBudgetAllocation {
  const layers = ["macro","semantic","expert","policy","authority"] as const;
  const bonus = TYPE_BONUS[questionType] ?? {};

  // Compute adjusted scores for active layers
  const adjusted: Record<string, number> = {};
  for (const layer of layers) {
    if (!available[layer]) { adjusted[layer] = 0; continue; }
    adjusted[layer] = Math.max(1, scores[layer] + (bonus[layer] ?? 0));
  }

  const totalAdjusted = layers.reduce((s, l) => s + adjusted[l], 0);
  const activeLayers  = layers.filter(l => available[l]);
  const n = activeLayers.length;

  if (n === 0 || totalAdjusted === 0) {
    return { macro: 0, semantic: 0, expert: 0, policy: 0, authority: 0, questionType };
  }

  // Raw proportional allocation
  const raw: Record<string, number> = {};
  for (const layer of layers) {
    raw[layer] = available[layer] ? (adjusted[layer] / totalAdjusted) : 0;
  }

  // Apply floor and ceiling, then re-normalise
  const floored: Record<string, number> = {};
  let floorTotal = 0;
  for (const layer of layers) {
    if (!available[layer]) { floored[layer] = 0; continue; }
    floored[layer] = Math.max(LAYER_FLOOR, Math.min(LAYER_CEILING, raw[layer]));
    floorTotal += floored[layer];
  }

  // Re-normalise to sum to 1.0 (proportional to floored shares)
  const charAlloc: Record<string, number> = {};
  let usedChars = 0;
  for (let i = 0; i < activeLayers.length; i++) {
    const layer = activeLayers[i];
    const share = floored[layer] / floorTotal;
    const chars = i === activeLayers.length - 1
      ? totalChars - usedChars   // last layer gets remainder to avoid rounding loss
      : Math.floor(share * totalChars);
    charAlloc[layer] = Math.max(0, chars);
    usedChars += charAlloc[layer];
  }

  // Fill inactive layers with 0
  for (const layer of layers) {
    if (!available[layer]) charAlloc[layer] = 0;
  }

  // Post-normalisation ceiling: only applies when multiple layers compete
  if (activeLayers.length > 1) {
    const absoluteCap = Math.floor(totalChars * LAYER_CEILING);
    for (const layer of activeLayers) {
      if ((charAlloc[layer] ?? 0) > absoluteCap) {
        const excess = charAlloc[layer] - absoluteCap;
        charAlloc[layer] = absoluteCap;
        const others = activeLayers.filter(l => l !== layer && available[l]);
        const bonus = others.length > 0 ? Math.floor(excess / others.length) : 0;
        for (const other of others) charAlloc[other] = (charAlloc[other] ?? 0) + bonus;
      }
    }
  }

  return {
    macro:       charAlloc.macro     ?? 0,
    semantic:    charAlloc.semantic  ?? 0,
    expert:      charAlloc.expert    ?? 0,
    policy:      charAlloc.policy    ?? 0,
    authority:   charAlloc.authority ?? 0,
    questionType,
  };
}

/** Convenience: derive relevance scores from context strings and semantic impact. */
export function deriveLayerScores(
  macroCtx:     string,
  semanticPressure: number,
  expertCtx:    string,
  policyDeltaScore: number,
  authorityCtx: string,
): LayerRelevanceScores {
  // String-length-based proxy for relevance (more content = more relevant)
  const lengthScore = (s: string, max = 400) => Math.min(100, Math.round((s.trim().length / max) * 100));
  return {
    macro:     Math.max(lengthScore(macroCtx), 30),     // floor 30 — macro is always relevant
    semantic:  semanticPressure,
    expert:    Math.max(lengthScore(expertCtx, 300), 20),
    policy:    Math.min(100, policyDeltaScore + 20),    // boost policy score slightly
    authority: lengthScore(authorityCtx, 300),
  };
}
