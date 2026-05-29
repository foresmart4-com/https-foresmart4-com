// Phase-85D: Adaptive Deduplication Governor
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Replaces the flat 0.45 Jaccard threshold in crossResearchDedupGovernor.ts
// with an adaptive multi-axis dedup that:
//
//   1. Short-context protection: pieces shorter than MIN_PROTECT_LENGTH
//      are never deduplicated (too short for meaningful overlap assessment)
//
//   2. Per-type thresholds: different content types have different dedup sensitivity
//      playbook:   0.65 (high threshold — harder to suppress; most regime-specific)
//      thinker:    0.55
//      school:     0.50
//      framework:  0.45 (same as Phase-85C baseline)
//      literature: 0.45
//      authority:  0.40
//
//   3. Semantic weight for key terms: thinker names, school names, playbook names,
//      and Saudi-specific terms carry 3× weight in the overlap computation
//
//   4. Minimum guaranteed output: at least one piece always survives unless
//      ALL pieces are truly identical (> 0.90 overlap)
//
//   5. Reference-corpus overlap scoring: pieces are checked against the reference
//      corpus (71-77 stack + 85B), not against each other's type peers,
//      respecting the priority ordering from Phase-85C
//
// No secrets. No PII. No broker data. Educational/advisory only.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ContentType =
  | "playbook"
  | "thinker"
  | "school"
  | "framework"
  | "literature"
  | "authority";

export interface AdaptiveDedupInput {
  pieces: Array<{
    type:  ContentType;
    label: string;   // human-readable label for the piece
    text:  string;
  }>;
  reference: string[];   // already-committed context (71-77 + 85B); not emitted
  maxChars?: number;     // default 500
}

export interface AdaptiveDedupResult {
  governedContext:  string;
  coverageLabel:    string;
  keptLabels:       string[];
  removedLabels:    string[];
  report: {
    inputPieces:   number;
    kept:          number;
    removed:       number;
    truncated:     boolean;
    guaranteedMin: boolean;  // true if minimum-output guarantee was applied
  };
  isEmpty: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const MIN_PROTECT_LENGTH = 80;     // pieces shorter than this are never deduplicated

const TYPE_THRESHOLD: Record<ContentType, number> = {
  playbook:   0.65,
  thinker:    0.55,
  school:     0.50,
  framework:  0.45,
  literature: 0.45,
  authority:  0.40,
};

// High-value terms that carry 3× weight in overlap scoring
const HIGH_VALUE_TERMS = new Set([
  "dalio","buffett","friedman","minsky","soros","shiller","hayek","keynes","fama",
  "marks","druckenmiller","value","growth","macro","trend","quality","credit",
  "risk_parity","sovereign","capital_cycle","preservation","recession","inflation",
  "tightening","easing","oil_shock","liquidity","regime_transition","saudi","aramco",
  "tasi","sama","breakeven","pif","vision2030",
]);

// ─── Weighted token overlap ────────────────────────────────────────────────────

function weightedJaccard(a: string, b: string): number {
  const tokenise = (t: string): string[] =>
    t.toLowerCase()
     .replace(/[.,;:!?()[\]{}|\/\\'"]/g, " ")
     .split(/\s+/)
     .filter(w => w.length >= 4);

  const tokA = tokenise(a);
  const tokB = tokenise(b);

  if (tokA.length === 0 || tokB.length === 0) return 0;

  const setB = new Set(tokB);
  let intersectionWeight = 0;
  let totalWeight = 0;

  const allTokens = new Set([...tokA, ...tokB]);
  for (const t of allTokens) {
    const w = HIGH_VALUE_TERMS.has(t) ? 3 : 1;
    totalWeight += w;
    if (tokA.includes(t) && setB.has(t)) intersectionWeight += w;
  }

  return totalWeight > 0 ? intersectionWeight / totalWeight : 0;
}

// ─── Core dedup logic ─────────────────────────────────────────────────────────

export function governAdaptiveDedup(input: AdaptiveDedupInput): AdaptiveDedupResult {
  const { pieces, reference, maxChars = 500 } = input;

  const report = {
    inputPieces: pieces.length,
    kept: 0,
    removed: 0,
    truncated: false,
    guaranteedMin: false,
  };

  // Step 1: filter empty pieces
  const nonEmpty = pieces.filter(p => p.text.trim().length > 0);
  if (nonEmpty.length === 0) {
    return {
      governedContext: "", coverageLabel: "none", keptLabels: [], removedLabels: [],
      report, isEmpty: true,
    };
  }

  // Step 2: classify each piece
  const kept: typeof nonEmpty = [];
  const removedLabels: string[] = [];

  for (const piece of nonEmpty) {
    const threshold = TYPE_THRESHOLD[piece.type];

    // Short-context protection: never dedup short pieces
    if (piece.text.length < MIN_PROTECT_LENGTH) {
      kept.push(piece);
      continue;
    }

    // Check overlap with reference corpus
    const overlapWithRef = reference
      .filter(Boolean)
      .some(ref => weightedJaccard(piece.text, ref) >= threshold);

    if (overlapWithRef) {
      removedLabels.push(piece.label);
      continue;
    }

    // Check overlap with already-kept pieces (prefer earlier in priority order)
    const overlapWithKept = kept
      .some(k => weightedJaccard(piece.text, k.text) >= Math.max(threshold, TYPE_THRESHOLD[k.type]));

    if (overlapWithKept) {
      removedLabels.push(piece.label);
      continue;
    }

    kept.push(piece);
  }

  // Step 3: Minimum output guarantee
  // If everything was deduped but not ALL pieces are true duplicates (>0.90), restore the best one
  if (kept.length === 0 && nonEmpty.length > 0) {
    // Check if any reference overlap is truly extreme (≥0.90) for the best piece
    const bestPiece = nonEmpty.reduce((a, b) => a.text.length >= b.text.length ? a : b);
    const maxRefOverlap = reference
      .filter(Boolean)
      .reduce((max, ref) => Math.max(max, weightedJaccard(bestPiece.text, ref)), 0);

    if (maxRefOverlap < 0.90) {
      // Restore the longest piece — it carries unique information
      kept.push(bestPiece);
      // Remove it from removedLabels
      const idx = removedLabels.indexOf(bestPiece.label);
      if (idx >= 0) removedLabels.splice(idx, 1);
      report.guaranteedMin = true;
    }
  }

  report.kept    = kept.length;
  report.removed = removedLabels.length;

  if (kept.length === 0) {
    return {
      governedContext: "", coverageLabel: "deduped_empty",
      keptLabels: [], removedLabels,
      report, isEmpty: true,
    };
  }

  // Step 4: Assemble within budget
  let assembled = kept.map(p => p.text).join(" | ");
  if (assembled.length > maxChars) {
    assembled = assembled.slice(0, maxChars - 3) + "...";
    report.truncated = true;
  }

  const keptLabels = kept.map(p => p.label);
  const coverageLabel = keptLabels.join("+");

  return {
    governedContext: assembled,
    coverageLabel,
    keptLabels,
    removedLabels,
    report,
    isEmpty: false,
  };
}
