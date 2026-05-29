// Phase-77: Curated Knowledge Feeding
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Connects curated knowledge inputs to Genesis's reasoning systems.
// Bridges: intake records → library → graph → credibility → historical → theory.
// Preserves competing views. Avoids single-school dominance.
// No self-learning. No autonomous internet use. No automatic downloads.
//
// Feed states:
//   connected          — all subsystems engaged; full multi-dimensional context
//   partial            — 2-3 subsystems active; context available but incomplete
//   conflicting        — competing theories or graph conflicts detected; balance required
//   credibility_limited — source quality too low for high-confidence feeding
//   historical_only    — only historical dimension active; no live theory mapping

import { buildResearchLibraryContext }     from "./researchLibrary";
import { queryKnowledgeGraph }             from "./knowledgeGraph";
import { scoreResearchCredibility }        from "./researchCredibilityEngine";
import { findHistoricalAnalog }            from "./historicalLearning";
import { compareTheories }                 from "./theoryEngine";
import type { IntakeRecord }               from "./researchIntake";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type FeedState =
  | "connected"
  | "partial"
  | "conflicting"
  | "credibility_limited"
  | "historical_only";

export interface KnowledgeFeedInput {
  question: string;
  context?: string;
  regime?: string;
  intakeRecords?: IntakeRecord[];
}

export interface FeedDimension {
  dimension: "library" | "graph" | "credibility" | "historical" | "theory";
  active: boolean;
  context: string;   // ≤150 chars
}

export interface KnowledgeFeedResult {
  feedState: FeedState;
  dimensions: FeedDimension[];
  competingViewsNote: string | null;    // present when conflicting schools detected
  sourceQualityNote: string;            // 1 sentence: overall source quality summary
  compositeContext: string;             // ≤400 chars: combined injectable Genesis context
  singleSchoolDominanceWarning: boolean;
  intakeContext: string;                // ≤200 chars: digest of safe intake records
}

// ─── Dimension builders ───────────────────────────────────────────────────────

function buildLibraryDimension(question: string): FeedDimension {
  const ctx = buildResearchLibraryContext(question);
  return {
    dimension: "library",
    active: ctx.length > 0,
    context: ctx.slice(0, 150),
  };
}

function buildGraphDimension(question: string, context: string): FeedDimension {
  const result = queryKnowledgeGraph(question, context);
  return {
    dimension: "graph",
    active: result.matchedNodes.length > 0,
    context: result.graphContext.slice(0, 150),
  };
}

function buildCredibilityDimension(question: string, context: string): FeedDimension {
  const result = scoreResearchCredibility(question, context);
  const active = result.sourceScores.length > 0;
  return {
    dimension: "credibility",
    active,
    context: active ? result.fusionContext.slice(0, 150) : "",
  };
}

function buildHistoricalDimension(question: string, context: string): FeedDimension {
  const result = findHistoricalAnalog(question, context);
  const active = result.matchedEpisode !== null;
  return {
    dimension: "historical",
    active,
    context: active ? result.lessonContext.slice(0, 150) : "",
  };
}

function buildTheoryDimension(question: string, context: string, regime?: string): FeedDimension {
  const result = compareTheories(question, context, regime);
  const active = result.matchedSchools.length > 0;
  return {
    dimension: "theory",
    active,
    context: active ? result.comparisonContext.slice(0, 150) : "",
  };
}

// ─── Feed state derivation ────────────────────────────────────────────────────

function deriveFeedState(
  dimensions: FeedDimension[],
  credibilityDim: FeedDimension,
  theoryResult: ReturnType<typeof compareTheories>,
  graphResult: ReturnType<typeof queryKnowledgeGraph>,
): FeedState {
  const activeCount = dimensions.filter(d => d.active).length;

  // Check credibility gate first
  const credScore = credibilityDim.active
    ? parseInt(credibilityDim.context.match(/(\d{2,3})\/100/)?.[1] ?? "75", 10)
    : 75;
  if (credScore < 55 && credibilityDim.active) return "credibility_limited";

  // Check for conflicts
  const hasConflictingSchools = theoryResult.dominantSchool !== null && theoryResult.minoritySchool !== null;
  const hasGraphConflicts = graphResult.relevantEdges.some(e => e.type === "conflicts_with");
  if (hasConflictingSchools && hasGraphConflicts) return "conflicting";

  // Feed state by active dimension count
  if (activeCount === 0) return "historical_only";
  if (activeCount >= 4) return "connected";
  if (activeCount >= 2) return hasConflictingSchools ? "conflicting" : "partial";
  // Only 1 active — check if it's historical
  const onlyHistorical = dimensions.filter(d => d.active).every(d => d.dimension === "historical");
  if (onlyHistorical) return "historical_only";
  return "partial";
}

// ─── Competing views note ────────────────────────────────────────────────────

function buildCompetingViewsNote(
  theoryResult: ReturnType<typeof compareTheories>,
): string | null {
  if (!theoryResult.dominantSchool || !theoryResult.minoritySchool) return null;
  const d = theoryResult.dominantSchool;
  const m = theoryResult.minoritySchool;
  return `Competing views: ${d.name} (${d.empiricalStrength} evidence) vs ${m.name} — ${theoryResult.conflictMap.slice(0, 80)}`.slice(0, 200);
}

// ─── Source quality note ──────────────────────────────────────────────────────

function buildSourceQualityNote(
  credResult: ReturnType<typeof scoreResearchCredibility>,
  feedState: FeedState,
): string {
  if (!credResult.highestCredibility) {
    return "No approved source detected — applying candidate-review governance; treat as unverified context.";
  }
  const src = credResult.highestCredibility;
  const biasNote = src.biasRisk !== "low" ? `; bias risk: ${src.biasRisk}` : "";
  return `Primary source quality: ${src.sourceName} ${src.credibilityScore}/100 (${src.empiricalSupport}${biasNote}) | feed: ${feedState}.`;
}

// ─── Single-school dominance check ───────────────────────────────────────────

function checkSingleSchoolDominance(
  theoryResult: ReturnType<typeof compareTheories>,
): boolean {
  return theoryResult.matchedSchools.length === 1;
}

// ─── Intake digest ────────────────────────────────────────────────────────────

function buildIntakeDigest(records: IntakeRecord[] | undefined): string {
  if (!records || records.length === 0) return "";
  const safe = records.filter(r => r.safeForFeeding);
  if (safe.length === 0) return "Intake: no safe records — all pending or rejected.";
  const labels = safe.slice(0, 3).map(r => `${r.sourceAttribution} (${r.intakeState.replace(/_/g, "-")}, ${r.credibilityScore}/100)`);
  return `Intake records: ${labels.join("; ")}`.slice(0, 200);
}

// ─── Composite context builder ────────────────────────────────────────────────

function buildCompositeContext(
  feedState: FeedState,
  dimensions: FeedDimension[],
  competingViews: string | null,
  intakeDigest: string,
): string {
  const parts: string[] = [`[feed:${feedState}]`];

  for (const dim of dimensions) {
    if (dim.active && dim.context) {
      parts.push(dim.context.slice(0, 80));
    }
  }

  if (competingViews) parts.push(competingViews.slice(0, 80));
  if (intakeDigest)   parts.push(intakeDigest.slice(0, 60));

  return parts.join(" | ").slice(0, 400);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * feedKnowledge — orchestrate all five knowledge subsystems for a question.
 * Connects library, graph, credibility, historical, and theory engines.
 * Returns a composite feed result for Genesis injection. O(1), no side effects.
 */
export function feedKnowledge(input: KnowledgeFeedInput): KnowledgeFeedResult {
  const { question, context = "", regime, intakeRecords } = input;

  // Run all five dimensions
  const libraryDim     = buildLibraryDimension(question);
  const graphDim       = buildGraphDimension(question, context);
  const credibilityDim = buildCredibilityDimension(question, context);
  const historicalDim  = buildHistoricalDimension(question, context);
  const theoryDim      = buildTheoryDimension(question, context, regime);

  const dimensions: FeedDimension[] = [
    libraryDim, graphDim, credibilityDim, historicalDim, theoryDim,
  ];

  // Pull full results for state/conflict analysis (no extra cost — pure O(1))
  const theoryResult = compareTheories(question, context, regime);
  const graphResult  = queryKnowledgeGraph(question, context);
  const credResult   = scoreResearchCredibility(question, context);

  const feedState           = deriveFeedState(dimensions, credibilityDim, theoryResult, graphResult);
  const competingViewsNote  = buildCompetingViewsNote(theoryResult);
  const sourceQualityNote   = buildSourceQualityNote(credResult, feedState);
  const dominanceWarning    = checkSingleSchoolDominance(theoryResult);
  const intakeContext       = buildIntakeDigest(intakeRecords);

  const compositeContext = buildCompositeContext(
    feedState,
    dimensions,
    competingViewsNote,
    intakeContext,
  );

  return {
    feedState,
    dimensions,
    competingViewsNote,
    sourceQualityNote,
    compositeContext,
    singleSchoolDominanceWarning: dominanceWarning,
    intakeContext,
  };
}

/**
 * getFeedStateLabel — human-readable feed state for UI indicators.
 */
export function getFeedStateLabel(state: FeedState): string {
  switch (state) {
    case "connected":          return "Knowledge feed: connected";
    case "partial":            return "Knowledge feed: partial";
    case "conflicting":        return "Knowledge feed: conflicting views";
    case "credibility_limited":return "Knowledge feed: credibility limited";
    case "historical_only":    return "Knowledge feed: historical only";
  }
}
