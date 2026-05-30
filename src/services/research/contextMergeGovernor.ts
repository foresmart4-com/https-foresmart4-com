// Phase-87B: Context Merge Governor
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Problem: Phase-87A's Arabic merge in unifiedCognitionGovernor.ts is length-only:
//   arabicCtx.length > expertKnowledge.length ? arabicCtx : `${arabicCtx.slice(0,180)} | ${expertKnowledge}`
//
// This fails when:
//   1. Long but low-quality Arabic context displaces shorter but richer English
//   2. Both contexts cover the same thinkers — wasting budget on duplication
//   3. Question is English but Arabic holds unique Saudi-specific institutional content
//
// Solution: score each context independently on quality axes, compute semantic
// overlap to detect redundancy, then select a merge strategy that maximises
// advisory continuity within the char budget.
//
// Quality axes (scored 0-100):
//   institutional_density: thinker/framework/allocator keyword density
//   specificity:           named entities, numbers, mechanisms
//   advisory_coherence:    complete analytical sentence structure
//   length_contribution:   log-scaled length bonus (diminishing returns)
//
// Merge strategies:
//   arabic_dominant  — Arabic quality leads; English supplements up to 32%
//   english_dominant — English quality leads; Arabic supplements up to 32%
//   balanced         — both quality scores within 20pts; interleave best portions
//   arabic_only      — English context absent or below quality floor
//   english_only     — Arabic context absent or below quality floor
//
// No PII. No secrets. No broker data. Educational/advisory only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type MergeBias =
  | "arabic_dominant"
  | "english_dominant"
  | "balanced"
  | "arabic_only"
  | "english_only";

export interface MergeGovernanceResult {
  mergedContext:        string;  // governed merged output (respects maxChars)
  mergeBias:            MergeBias;
  semanticOverlapScore: number;  // 0-100: domain-term overlap between contexts
  arQuality:            number;  // 0-100: quality of Arabic context
  enQuality:            number;  // 0-100: quality of English context
  mergeQuality:         number;  // 0-100: estimated quality of final merged output
  advisoryContinuity:   string;  // 1-sentence institutional framing note
}

const QUALITY_FLOOR = 5;  // minimum score for a context to be considered usable

// ─── Quality scoring ──────────────────────────────────────────────────────────

// Note: g flag required — used with .match() for counts
const INST_EN = /\b(keynes|friedman|minsky|hayek|fama|shiller|buffett|dalio|marks|soros|druckenmiller|macro|value.invest|credit.cycle|regime|framework|allocator|thinker|school|institutional|fiduciary)\b/gi;
const INST_AR = /\b(كينز|فريدمان|مينسكي|هايك|فاما|شيلر|بافيت|داليو|ماركس|سوروس|دراكنميلر|الكلي|قيمة|دورة ائتمان|نظام|إطار|مخصص|مفكر|مدرسة|مؤسسي)\b/gi;
const SPEC_EN = /\b(\d+%|\$\d+|bps|basis.points?|yield|spread|gdp|cpi|nim|roe|p\/e|fiscal|transmission|credit.spread|rate.hike|rate.cut)\b/gi;
const SPEC_AR = /\b(\d+%|\d+\s*نقطة|عائد|فارق|ناتج|تضخم|هامش|مرونة|انتقال|مالي|رفع.الفائدة|خفض.الفائدة)\b/gi;
// Complete sentences: capital + body + terminal punctuation
const SENT_EN = /[A-Z][^.!?]{10,}[.!?]/g;
const SENT_AR = /[؀-ۿ][^.!?،؟]{6,}[.!?،؟]/g;

function scoreContextQuality(text: string, lang: "en" | "ar"): number {
  if (!text || text.trim().length < QUALITY_FLOOR) return 0;
  let score = 0;

  if (lang === "en") {
    INST_EN.lastIndex = 0; SPEC_EN.lastIndex = 0; SENT_EN.lastIndex = 0;
    const inst  = (text.match(INST_EN) ?? []).length;
    const spec  = (text.match(SPEC_EN) ?? []).length;
    const sents = (text.match(SENT_EN) ?? []).length;
    score = (inst * 9) + (spec * 6) + (sents * 4);
  } else {
    INST_AR.lastIndex = 0; SPEC_AR.lastIndex = 0; SENT_AR.lastIndex = 0;
    const inst  = (text.match(INST_AR) ?? []).length;
    const spec  = (text.match(SPEC_AR) ?? []).length;
    const sents = (text.match(SENT_AR) ?? []).length;
    score = (inst * 9) + (spec * 6) + (sents * 4);
  }

  // Log-scaled length contribution (max +20)
  score += Math.min(20, Math.round(Math.log2(Math.max(1, text.trim().length / 10))));
  return Math.min(100, Math.max(0, score));
}

// ─── Language dominance detection ────────────────────────────────────────────

function detectQuestionLanguage(question: string): "ar" | "en" | "mixed" {
  const arabic = (question.match(/[؀-ۿ]/g) ?? []).length;
  const latin  = (question.match(/[a-zA-Z]/g)        ?? []).length;
  const total  = arabic + latin;
  if (total === 0) return "en";
  const ratio = arabic / total;
  if (ratio > 0.55) return "ar";
  if (ratio < 0.20) return "en";
  return "mixed";
}

// ─── Semantic overlap (cross-language domain anchors) ─────────────────────────

const DOMAIN_ANCHORS = /\b(dalio|buffett|keynes|minsky|hayek|shiller|macro|credit|regime|fiscal|rates?|yield|oil|inflation|liquidity|saudi|tasi|sama|fed|ecb|tightening|easing|bearish|bullish|allocat|framework|transmission)\b/gi;

function extractAnchors(text: string): Set<string> {
  DOMAIN_ANCHORS.lastIndex = 0;
  const anchors = new Set<string>();
  const matches = text.toLowerCase().match(DOMAIN_ANCHORS) ?? [];
  for (const m of matches) anchors.add(m);
  return anchors;
}

function computeSemanticOverlap(a: string, b: string): number {
  const sa = extractAnchors(a);
  const sb = extractAnchors(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let overlap = 0;
  for (const t of sa) if (sb.has(t)) overlap++;
  const unionSize = sa.size + sb.size - overlap;
  return unionSize > 0 ? Math.round((overlap / unionSize) * 100) : 0;
}

// ─── Merge execution ──────────────────────────────────────────────────────────

function trimToChars(text: string, limit: number): string {
  if (limit <= 0 || !text) return "";
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 3);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > limit * 0.65 ? cut.slice(0, lastSpace) + "..." : cut + "...";
}

function executeMerge(ar: string, en: string, bias: MergeBias, maxChars: number): string {
  switch (bias) {
    case "arabic_only":  return trimToChars(ar, maxChars);
    case "english_only": return trimToChars(en, maxChars);
    case "arabic_dominant": {
      const arBudget = Math.floor(maxChars * 0.68);
      const enBudget = maxChars - arBudget - 3;
      const arPart   = trimToChars(ar, arBudget);
      const enPart   = en.length > QUALITY_FLOOR ? trimToChars(en, enBudget) : "";
      return enPart ? `${arPart} | ${enPart}` : arPart;
    }
    case "english_dominant": {
      const enBudget = Math.floor(maxChars * 0.68);
      const arBudget = maxChars - enBudget - 3;
      const enPart   = trimToChars(en, enBudget);
      const arPart   = ar.length > QUALITY_FLOOR ? trimToChars(ar, arBudget) : "";
      return arPart ? `${enPart} | ${arPart}` : enPart;
    }
    case "balanced": {
      const half   = Math.floor((maxChars - 3) / 2);
      const arPart = trimToChars(ar, half);
      const enPart = trimToChars(en, half);
      return `${arPart} | ${enPart}`;
    }
  }
}

// ─── Advisory continuity notes ────────────────────────────────────────────────

const BIAS_NOTES: Record<MergeBias, string> = {
  arabic_dominant:  "Arabic-dominant merge; Saudi/Gulf institutional context leads advisory framing.",
  english_dominant: "English-dominant merge; cross-market institutional thinker context leads.",
  balanced:         "Balanced merge; complementary institutional content from both language contexts.",
  arabic_only:      "Arabic context only — English context absent or below quality threshold.",
  english_only:     "English context only — Arabic context absent or below quality threshold.",
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function governContextMerge(input: {
  arabicCtx:  string;
  englishCtx: string;
  question:   string;
  isSaudi?:   boolean;
  maxChars?:  number;
}): MergeGovernanceResult {
  const {
    arabicCtx  = "",
    englishCtx = "",
    question,
    isSaudi    = false,
    maxChars   = 400,
  } = input;

  const ar = arabicCtx.trim();
  const en = englishCtx.trim();

  // Edge: both empty
  if (!ar && !en) {
    return {
      mergedContext: "", mergeBias: "english_only",
      semanticOverlapScore: 0, arQuality: 0, enQuality: 0, mergeQuality: 0,
      advisoryContinuity: "No expert context available for merge.",
    };
  }

  const arQuality = scoreContextQuality(ar, "ar");
  const enQuality = scoreContextQuality(en, "en");

  // Edge: one side below quality floor
  if (!ar || arQuality < QUALITY_FLOOR) {
    return {
      mergedContext: trimToChars(en, maxChars), mergeBias: "english_only",
      semanticOverlapScore: 0, arQuality, enQuality, mergeQuality: enQuality,
      advisoryContinuity: BIAS_NOTES.english_only,
    };
  }
  if (!en || enQuality < QUALITY_FLOOR) {
    return {
      mergedContext: trimToChars(ar, maxChars), mergeBias: "arabic_only",
      semanticOverlapScore: 0, arQuality, enQuality, mergeQuality: arQuality,
      advisoryContinuity: BIAS_NOTES.arabic_only,
    };
  }

  const overlap  = computeSemanticOverlap(ar, en);
  const qLang    = detectQuestionLanguage(question);
  const qualDiff = Math.abs(arQuality - enQuality);

  let bias: MergeBias;

  if (qualDiff <= 20) {
    // Similar quality: avoid redundancy if high overlap, else interleave
    if (overlap > 50) {
      bias = (qLang === "ar" || isSaudi) ? "arabic_dominant" : "english_dominant";
    } else {
      bias = "balanced";
    }
  } else if (arQuality > enQuality) {
    // Arabic clearly better quality
    bias = (qLang === "ar" || isSaudi) ? "arabic_dominant" : "balanced";
  } else {
    // English clearly better quality
    bias = qLang === "en" ? "english_dominant" : "balanced";
  }

  const mergedContext = executeMerge(ar, en, bias, maxChars);

  // Estimate merged quality as weighted average based on dominance
  const arWeight  = bias === "arabic_dominant" ? 0.70 : bias === "balanced" ? 0.50 : bias === "arabic_only" ? 1.0 : 0.30;
  const enWeight  = 1 - arWeight;
  const mergeQuality = Math.round(arQuality * arWeight + enQuality * enWeight);

  return {
    mergedContext,
    mergeBias:            bias,
    semanticOverlapScore: overlap,
    arQuality,
    enQuality,
    mergeQuality,
    advisoryContinuity:   BIAS_NOTES[bias],
  };
}
