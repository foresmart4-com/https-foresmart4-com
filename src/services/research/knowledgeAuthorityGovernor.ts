// Phase-85B: Knowledge Authority Governor
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Capstone of the Phase-85B research intelligence pipeline.
// Receives outputs from all four Phase-85B modules and governs them:
//
//   1. Relevance threshold:  drop inputs below minimum relevance score
//   2. Authority weighting:  apply thesisWeightModifier from authorityRankingEngine
//   3. Duplication filter:   remove overlapping content (>60% substring overlap)
//   4. Anti-noise:           suppress generic boilerplate phrases
//   5. Anti-hype:            suppress sensational language
//   6. Bounded context:      enforce total character budget
//
// Returns a single governed context string for prompt injection and a
// governance report for logging.
//
// Pipeline:
//   authorityRankingEngine → frameworkLibrary → literatureLibrary →
//   liveResearchMonitor → knowledgeAuthorityGovernor → Genesis research layer
//
// No secrets. No PII. No broker data. Educational/advisory only.

import type { AuthorityRankingResult } from "./authorityRankingEngine";
import type { ResearchRelevanceResult } from "./liveResearchMonitor";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GovernanceInput {
  authorityContext:   string;   // from authorityRankingEngine.buildAuthorityContext
  frameworkContext:   string;   // from economicFrameworkLibrary.buildFrameworkLibraryContext
  literatureContext:  string;   // from institutionalLiteratureLibrary.buildLiteratureContext
  researchRelevance:  ResearchRelevanceResult;
  authorityRanking?:  AuthorityRankingResult;
  maxChars?:          number;   // default 580
}

export interface GovernanceReport {
  inputPieces:        number;
  inputChars:         number;
  outputChars:        number;
  noiseFiltered:      number;
  hypeFiltered:       number;
  duplicatesRemoved:  number;
  belowThreshold:     number;
  truncated:          boolean;
}

export interface GovernedKnowledgeResult {
  governedContext:  string;         // clean, bounded, injectable context
  authorityLabel:   string;         // from authorityRankingEngine or derived
  thesisWeightMod:  number;         // net thesis weight modifier (0.45-1.00)
  governanceReport: GovernanceReport;
  isEmpty:          boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const RELEVANCE_THRESHOLD = 25;        // drop inputs where relevance < this
const DUPLICATION_OVERLAP_THRESHOLD = 0.60;
const DEFAULT_MAX_CHARS = 580;

// ─── Anti-noise patterns (generic boilerplate that adds no value) ─────────────

const NOISE_PATTERNS: RegExp[] = [
  /it (is|was) (important|essential|critical) to (note|remember|consider) that/i,
  /as (always|mentioned|discussed|noted|described|explained)/i,
  /in (summary|conclusion|general|essence)/i,
  /\bfundamentally speaking\b/i,
  /\bthe (key|main|primary) (takeaway|point|lesson) is\b/i,
  /\bone should (always|never|consider|think|remember)\b/i,
  /\bof course\b/i,
  /\bneedless to say\b/i,
  /\bin the (long|short) run\b(?! — |[:,])/i,  // standalone filler not part of a technical statement
];

// ─── Anti-hype patterns ───────────────────────────────────────────────────────

const HYPE_PATTERNS: RegExp[] = [
  /\b(must act now|don't miss|guaranteed|certain(ly)?|definitely will|sure to)\b/i,
  /\b(explosive|massive|huge|extraordinary|unprecedented|game.changing)\b/i,
  /\b(moon|rocket|to the moon|100x|10x guaranteed)\b/i,
  /\b(buy everything|sell everything|perfect timing|never been a better)\b/i,
  /\b(this will definitely|always goes up|never fails|infallible)\b/i,
  /\b(secret|insider|everyone knows|the smart money)\b/i,
  /\b(فرصة العمر|ضخ|ثروة طائلة|مضمون|ضمان)\b/i,  // Arabic hype phrases
];

// ─── Duplication detection ────────────────────────────────────────────────────

function computeOverlap(a: string, b: string): number {
  if (!a || !b) return 0;
  const shorter = a.length < b.length ? a : b;
  const longer  = a.length < b.length ? b : a;
  if (shorter.length < 20) return 0;

  // Use sliding window: check if ≥60% of shorter's content appears in longer
  const windowSize = Math.floor(shorter.length * 0.4);
  let matchedChars = 0;

  for (let i = 0; i < shorter.length - windowSize; i += windowSize) {
    const window = shorter.slice(i, i + windowSize);
    if (longer.includes(window)) matchedChars += windowSize;
  }

  return matchedChars / shorter.length;
}

function deduplicatePieces(pieces: string[]): { kept: string[]; removed: number } {
  const kept: string[] = [];
  let removed = 0;

  for (const piece of pieces) {
    const isDuplicate = kept.some(k => computeOverlap(piece, k) >= DUPLICATION_OVERLAP_THRESHOLD);
    if (isDuplicate) {
      removed++;
    } else {
      kept.push(piece);
    }
  }

  return { kept, removed };
}

// ─── Content cleaning ─────────────────────────────────────────────────────────

function applyAntiNoise(text: string): { cleaned: string; filtered: number } {
  let cleaned = text;
  let filtered = 0;
  for (const p of NOISE_PATTERNS) {
    const before = cleaned;
    cleaned = cleaned.replace(p, "").replace(/\s{2,}/g, " ").trim();
    if (cleaned !== before) filtered++;
  }
  return { cleaned, filtered };
}

function applyAntiHype(text: string): { cleaned: string; filtered: number } {
  let cleaned = text;
  let filtered = 0;
  for (const p of HYPE_PATTERNS) {
    const before = cleaned;
    // Replace the hype phrase with an empty string and note the removal
    cleaned = cleaned.replace(p, "[governed]").replace(/\[governed\]/g, "").replace(/\s{2,}/g, " ").trim();
    if (cleaned !== before) filtered++;
  }
  return { cleaned, filtered };
}

// ─── Relevance gating ─────────────────────────────────────────────────────────

function scoreInputRelevance(
  inputKey: "authority" | "framework" | "literature",
  relevance: ResearchRelevanceResult,
): number {
  switch (inputKey) {
    case "authority":  return Math.max(relevance.thesisRelevance, relevance.policyRelevance);
    case "framework":  return Math.max(relevance.thesisRelevance, relevance.regimeRelevance);
    case "literature": return Math.max(relevance.thesisRelevance, relevance.marketRelevance);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function governKnowledgeContext(input: GovernanceInput): GovernedKnowledgeResult {
  const {
    authorityContext,
    frameworkContext,
    literatureContext,
    researchRelevance,
    authorityRanking,
    maxChars = DEFAULT_MAX_CHARS,
  } = input;

  const report: GovernanceReport = {
    inputPieces: 0,
    inputChars: 0,
    outputChars: 0,
    noiseFiltered: 0,
    hypeFiltered: 0,
    duplicatesRemoved: 0,
    belowThreshold: 0,
    truncated: false,
  };

  // Step 1: Collect non-empty inputs with relevance gates
  const candidates: Array<{ key: "authority" | "framework" | "literature"; text: string }> = [
    { key: "authority",  text: authorityContext },
    { key: "framework",  text: frameworkContext },
    { key: "literature", text: literatureContext },
  ].filter(c => c.text.trim().length > 0);

  report.inputPieces = candidates.length;
  report.inputChars  = candidates.reduce((s, c) => s + c.text.length, 0);

  if (candidates.length === 0) {
    return {
      governedContext: "",
      authorityLabel: authorityRanking?.authorityLabel ?? "no_authority",
      thesisWeightMod: authorityRanking?.thesisWeightModifier ?? 0.80,
      governanceReport: report,
      isEmpty: true,
    };
  }

  // Step 2: Relevance threshold filtering
  const relevant = candidates.filter(c => {
    const score = scoreInputRelevance(c.key, researchRelevance);
    if (score < RELEVANCE_THRESHOLD) {
      report.belowThreshold++;
      return false;
    }
    return true;
  });

  // Step 3: Anti-noise and anti-hype cleaning
  const cleaned = relevant.map(c => {
    const { cleaned: c1, filtered: n } = applyAntiNoise(c.text);
    const { cleaned: c2, filtered: h } = applyAntiHype(c1);
    report.noiseFiltered += n;
    report.hypeFiltered  += h;
    return { ...c, text: c2 };
  }).filter(c => c.text.length > 10);

  // Step 4: Duplication filter
  const { kept, removed } = deduplicatePieces(cleaned.map(c => c.text));
  report.duplicatesRemoved = removed;

  if (kept.length === 0) {
    return {
      governedContext: "",
      authorityLabel: authorityRanking?.authorityLabel ?? "no_authority",
      thesisWeightMod: authorityRanking?.thesisWeightModifier ?? 0.80,
      governanceReport: report,
      isEmpty: true,
    };
  }

  // Step 5: Authority weighting — order pieces by authority importance
  // authority context first (sets the credibility frame), then framework, then literature
  const ordered = kept;  // already ordered by input key priority (authority → framework → literature)

  // Step 6: Bounded context assembly
  let assembled = ordered.join(" | ");
  if (assembled.length > maxChars) {
    assembled = assembled.slice(0, maxChars - 3) + "...";
    report.truncated = true;
  }

  report.outputChars = assembled.length;

  // Derive authority label and thesis weight
  const authorityLabel = authorityRanking?.authorityLabel
    ?? (researchRelevance.overallRelevance >= 70 ? "mixed_authority" : "low_authority");

  const thesisWeightMod = authorityRanking?.thesisWeightModifier ?? 0.80;

  return {
    governedContext: assembled,
    authorityLabel,
    thesisWeightMod,
    governanceReport: report,
    isEmpty: false,
  };
}
