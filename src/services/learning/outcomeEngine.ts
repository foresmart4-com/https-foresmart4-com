/**
 * Outcome Intelligence Engine — Phase 23
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Deterministic auto-inference of thesis outcomes from session data.
 *
 * Design rules:
 * - Conservative: only labels outcomes when evidence is clear; defaults to outcome_unclear
 * - No fake accuracy: never claims measured accuracy without resolved user data
 * - No overfit: confidence pressure capped at ±4 pts, requires ≥3 assessments
 * - Advisory only: outcome labels inform narrative, never trigger execution
 * - No persistence: outcomes are always recomputed fresh from current session data
 */

import type { ThesisEntry } from "@/services/learning/thesisMemory";
import type { IntelligenceEvent } from "@/services/learning/sessionIntelStore";
import type { ResearchCandidate } from "@/services/research/proactiveEngine";

// ─── Types ───────────────────────────────────────────────────────────────────

export type OutcomeLabel =
  | "thesis_confirmed"     // current regime/signals align with thesis direction
  | "thesis_weakened"      // partial contradiction or active conflict signal
  | "thesis_invalidated"   // strong directional contradiction with high session confidence
  | "outcome_unclear";     // insufficient evidence, too recent, or too old

export interface OutcomeAssessment {
  thesisId: string;
  asset: string;
  direction: "bullish" | "bearish" | "neutral";
  originalConfidence: number;
  ageDays: number;
  label: OutcomeLabel;
  note: string;  // 1 sentence, advisory language
}

export interface OutcomeSummary {
  assessments: OutcomeAssessment[];
  confirmed: number;
  weakened: number;
  invalidated: number;
  unclear: number;
  confidencePressure: number; // -4 to +3 pts — feed into anchor computation
  contextString: string;      // compact string for AI injection (≤160 chars)
  hasActionableOutcome: boolean;
}

// ─── Assessment limits ────────────────────────────────────────────────────────

const TOO_RECENT_HOURS = 4;       // don't assess theses < 4h old
const TOO_OLD_DAYS = 14;          // don't assess theses > 14 days old
const CONFIRM_MIN_CONF = 55;      // session confidence required to confirm
const WEAKEN_MIN_CONF = 48;       // session confidence required to weaken
const INVALIDATE_MIN_CONF = 60;   // session confidence required to invalidate

// ─── Single thesis assessor ───────────────────────────────────────────────────

function assessSingle(
  entry: ThesisEntry,
  sessionBus: IntelligenceEvent | null,
  proactiveCandidates: ResearchCandidate[],
): OutcomeAssessment {
  const now = Date.now();
  const ageDays = (now - entry.ts) / 86400000;

  const base: Omit<OutcomeAssessment, "label" | "note"> = {
    thesisId: entry.id,
    asset: entry.asset,
    direction: entry.direction,
    originalConfidence: entry.confidence,
    ageDays,
  };

  // Too recent — no meaningful outcome possible yet
  if (ageDays < TOO_RECENT_HOURS / 24) {
    return { ...base, label: "outcome_unclear", note: "thesis too recent to assess" };
  }

  // Too old — session data no longer reflects the context at thesis time
  if (ageDays > TOO_OLD_DAYS) {
    return { ...base, label: "outcome_unclear", note: "assessment period elapsed — current data insufficient for retrospective" };
  }

  // Neutral theses — direction is unclear, hard to confirm or invalidate
  if (entry.direction === "neutral") {
    return { ...base, label: "outcome_unclear", note: "neutral thesis direction — insufficient directional signal to assess" };
  }

  // Check for active proactive thesis-regime-conflict for this specific asset
  const hasConflict = proactiveCandidates.some(
    (c) =>
      c.trigger === "thesis-regime-conflict" &&
      c.asset.toUpperCase() === entry.asset.toUpperCase(),
  );
  if (hasConflict) {
    return {
      ...base,
      label: "thesis_weakened",
      note: `prior ${entry.asset} thesis conflicts with current macro regime bias`,
    };
  }

  // Insufficient session bus data
  if (!sessionBus?.dominantBias || (sessionBus.confidence ?? 0) < WEAKEN_MIN_CONF) {
    return { ...base, label: "outcome_unclear", note: "session confidence insufficient to assess thesis outcome" };
  }

  const busBias = sessionBus.dominantBias;
  const busConf = sessionBus.confidence ?? 0;

  // Directions agree
  if (entry.direction === busBias) {
    if (busConf >= CONFIRM_MIN_CONF) {
      return {
        ...base,
        label: "thesis_confirmed",
        note: `macro regime continues ${busBias} at ${busConf}% — thesis direction intact`,
      };
    }
    return { ...base, label: "outcome_unclear", note: "directional agreement but session confidence below confirmation threshold" };
  }

  // Directions disagree (bullish vs bearish or vice versa)
  if (busBias !== "neutral") {
    const isFullContradiction =
      (entry.direction === "bullish" && busBias === "bearish") ||
      (entry.direction === "bearish" && busBias === "bullish");

    if (isFullContradiction && busConf >= INVALIDATE_MIN_CONF) {
      return {
        ...base,
        label: "thesis_invalidated",
        note: `current ${busBias} regime bias (${busConf}%) directly contradicts prior ${entry.direction} thesis`,
      };
    }
    if (busConf >= WEAKEN_MIN_CONF) {
      return {
        ...base,
        label: "thesis_weakened",
        note: `current ${busBias} bias challenges prior ${entry.direction} view`,
      };
    }
  }

  return { ...base, label: "outcome_unclear", note: "mixed or insufficient signals" };
}

// ─── Confidence pressure ──────────────────────────────────────────────────────

/**
 * Derives a bounded confidence anchor adjustment from outcome pattern.
 * Only applies when ≥3 assessments exist and a clear pattern emerges.
 * Max ±4 pts — conservative, never overfits.
 */
function computeConfidencePressure(assessments: OutcomeAssessment[]): number {
  const actionable = assessments.filter((a) => a.label !== "outcome_unclear");
  if (actionable.length < 3) return 0;

  const confirmed = actionable.filter((a) => a.label === "thesis_confirmed").length;
  const weakInvalid = actionable.filter((a) =>
    a.label === "thesis_weakened" || a.label === "thesis_invalidated",
  ).length;
  const total = actionable.length;

  if (weakInvalid / total > 0.65) return -4;  // majority weakened/invalidated
  if (weakInvalid / total > 0.45) return -2;  // moderate weakening pattern
  if (confirmed / total > 0.75) return 3;      // strong confirmation pattern
  if (confirmed / total > 0.55) return 1;      // mild confirmation pattern
  return 0;
}

// ─── Context string ───────────────────────────────────────────────────────────

function buildContextString(
  confirmed: number,
  weakened: number,
  invalidated: number,
  unclear: number,
  mostActionable: OutcomeAssessment | undefined,
  ar: boolean,
): string {
  const total = confirmed + weakened + invalidated + unclear;
  if (total === 0) return "";

  const parts: string[] = [];
  if (confirmed > 0) parts.push(ar ? `${confirmed} مؤكدة` : `${confirmed} confirmed`);
  if (weakened > 0) parts.push(ar ? `${weakened} ضعيفة` : `${weakened} weakened`);
  if (invalidated > 0) parts.push(ar ? `${invalidated} ملغاة` : `${invalidated} invalidated`);
  if (unclear > 0 && unclear < total) parts.push(ar ? `${unclear} غير محددة` : `${unclear} unclear`);

  let result = ar
    ? `نتائج الأطروحات السابقة: ${parts.join("، ")}.`
    : `Recent thesis outcomes: ${parts.join(", ")}.`;

  if (mostActionable) {
    result += ` ${ar ? "ملاحظة" : "Notable"}: ${mostActionable.note}`;
  }

  return result.slice(0, 200); // hard cap
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Assesses recent theses against current session data.
 * Pure function — deterministic, no I/O, no AI calls.
 * Operates only on theses within the assessment window (4h–14d).
 */
export function inferThesisOutcomes(
  theses: ThesisEntry[],
  sessionBus: IntelligenceEvent | null,
  proactiveCandidates: ResearchCandidate[],
  ar: boolean = false,
): OutcomeSummary {
  if (!theses.length) {
    return {
      assessments: [],
      confirmed: 0, weakened: 0, invalidated: 0, unclear: 0,
      confidencePressure: 0,
      contextString: "",
      hasActionableOutcome: false,
    };
  }

  // Only assess theses within the window; take the 8 most recent
  const candidates = [...theses]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8);

  const assessments = candidates.map((t) => assessSingle(t, sessionBus, proactiveCandidates));

  const confirmed   = assessments.filter((a) => a.label === "thesis_confirmed").length;
  const weakened    = assessments.filter((a) => a.label === "thesis_weakened").length;
  const invalidated = assessments.filter((a) => a.label === "thesis_invalidated").length;
  const unclear     = assessments.filter((a) => a.label === "outcome_unclear").length;

  const hasActionableOutcome = weakened > 0 || invalidated > 0 || confirmed > 1;

  // Most actionable: prioritise invalidated > weakened > confirmed
  const mostActionable =
    assessments.find((a) => a.label === "thesis_invalidated") ??
    assessments.find((a) => a.label === "thesis_weakened") ??
    (confirmed >= 2 ? assessments.find((a) => a.label === "thesis_confirmed") : undefined);

  const confidencePressure = computeConfidencePressure(assessments);
  const contextString = buildContextString(confirmed, weakened, invalidated, unclear, mostActionable, ar);

  return { assessments, confirmed, weakened, invalidated, unclear, confidencePressure, contextString, hasActionableOutcome };
}
