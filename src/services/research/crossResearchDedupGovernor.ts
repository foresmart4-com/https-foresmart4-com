// Phase-85C: Cross-Research Deduplication Governor
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Prevents content repetition across the full research intelligence pipeline:
//   stack_7177:   Phase 71-77 research civilization outputs (graph, library,
//                 theory, credibility, intake, feed)
//   authority_85b: Phase-85B governed knowledge context
//   thinker:      Phase-85C institutionalThinkerLibrary output
//   school:       Phase-85C investmentSchoolLibrary output
//   playbook:     Phase-85C allocatorPlaybookLibrary output
//   framework:    Phase-85C dominant framework context
//
// Pipeline:
//   Collect all assembled context strings → compute overlap matrix →
//   assign priority (85C new content vs earlier stacks) → drop pieces
//   that overlap significantly with higher-priority or already-committed
//   context → assemble bounded final output.
//
// Priority order (higher = preferred, kept over lower):
//   1. Playbook context (most regime-specific, least overlap with other layers)
//   2. Thinker context (named thinker signals are distinctive)
//   3. School context (investment school is distinctive from economic theory)
//   4. Framework context (upgraded dominant framework)
//   5. authority_85b (already governed upstream)
//   6. stack_7177 pieces (already committed — used as reference for dedup only)
//
// stack_7177 and authority_85b are REFERENCE ONLY — they are already in the
// prompt. Only Phase-85C pieces (thinker/school/playbook/framework) are output.
// The governor decides which Phase-85C pieces survive dedup vs the earlier stacks.
//
// No secrets. No PII. No broker data. Educational/advisory only.

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CrossResearchInput {
  // Reference context (already committed to prompt — not in output)
  stack7177Pieces:  string[];   // from Phase 71-77
  authority85b:     string;     // from Phase-85B governed knowledge

  // New Phase-85C context pieces (candidates for output)
  thinkerCtx:    string;
  schoolCtx:     string;
  playbookCtx:   string;
  frameworkCtx:  string;

  maxChars?: number;             // default 480
}

export interface CrossResearchResult {
  governedContext: string;       // deduplicated, bounded Phase-85C context
  coverageLabel:   string;       // e.g. "thinker+playbook" or "school+framework"
  dedupReport: {
    candidateCount:  number;     // how many Phase-85C pieces were candidates
    kept:            number;     // how many survived dedup
    removed:         number;     // how many were dropped due to overlap
    truncated:       boolean;
  };
  isEmpty: boolean;
}

// ─── Overlap detection (shared with knowledgeAuthorityGovernor approach) ──────

const DEDUP_THRESHOLD = 0.45;    // lower than 85B's 0.60 — more aggressive cross-stack dedup

function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[.,;:!?()[\]{}|\/\\'"]/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 4),  // ignore short function words
  );
}

function jaccardOverlap(a: string, b: string): number {
  if (!a || !b) return 0;
  const tokA = tokenise(a);
  const tokB = tokenise(b);
  if (tokA.size === 0 || tokB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokA) {
    if (tokB.has(t)) intersection++;
  }
  const union = tokA.size + tokB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function hasSignificantOverlapWithAny(
  candidate: string,
  references: string[],
  threshold = DEDUP_THRESHOLD,
): boolean {
  for (const ref of references) {
    if (jaccardOverlap(candidate, ref) >= threshold) return true;
  }
  return false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function governCrossResearch(input: CrossResearchInput): CrossResearchResult {
  const {
    stack7177Pieces,
    authority85b,
    thinkerCtx,
    schoolCtx,
    playbookCtx,
    frameworkCtx,
    maxChars = 480,
  } = input;

  // Build reference corpus (already committed — used for overlap detection only)
  const reference: string[] = [
    ...stack7177Pieces.filter(Boolean),
    authority85b,
  ].filter(Boolean);

  // Candidates in priority order (playbook first — most distinctive)
  const candidates: Array<{ label: string; text: string }> = [
    { label: "playbook",   text: playbookCtx   },
    { label: "thinker",    text: thinkerCtx    },
    { label: "school",     text: schoolCtx     },
    { label: "framework",  text: frameworkCtx  },
  ].filter(c => c.text.trim().length > 0);

  const report = {
    candidateCount: candidates.length,
    kept: 0,
    removed: 0,
    truncated: false,
  };

  if (candidates.length === 0) {
    return { governedContext: "", coverageLabel: "none", dedupReport: report, isEmpty: true };
  }

  // Dedup pass: keep candidates that don't significantly overlap with references
  // (or with earlier-kept candidates)
  const committed: string[] = [];
  const committedLabels: string[] = [];

  for (const c of candidates) {
    const allRefs = [...reference, ...committed];
    if (hasSignificantOverlapWithAny(c.text, allRefs)) {
      report.removed++;
    } else {
      committed.push(c.text);
      committedLabels.push(c.label);
      report.kept++;
    }
  }

  if (committed.length === 0) {
    return { governedContext: "", coverageLabel: "deduped_empty", dedupReport: report, isEmpty: true };
  }

  // Assemble within budget
  let assembled = committed.join(" | ");
  if (assembled.length > maxChars) {
    assembled = assembled.slice(0, maxChars - 3) + "...";
    report.truncated = true;
  }

  return {
    governedContext: assembled,
    coverageLabel:   committedLabels.join("+"),
    dedupReport:     report,
    isEmpty: false,
  };
}
