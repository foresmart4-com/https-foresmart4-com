/**
 * Meta-Reasoning Engine — Phase 10
 * Evaluates quality, consistency, calibration, and uncertainty of a Genesis AI reply.
 * Pure function — no network calls, no side effects, no localStorage.
 *
 * Detects:
 * - thesis ↔ regime contradictions
 * - overconfidence (high confidence + weak evidence or conflicted consensus)
 * - evidence insufficiency (missing or thin evidence at high confidence)
 * - multi-agent disagreement driving uncertainty
 * - scenario probability inconsistencies
 * Produces a compact context hint (≤120 chars) for injection into the next query.
 */
import type { GenesisReply } from "@/lib/genesis.functions";

export type UncertaintyTier = "likely" | "possible" | "uncertain" | "conflicting";
export type ReasoningQuality = "strong" | "adequate" | "weak";

export interface ContradictionResult {
  detected: boolean;
  details: string[];
}

export interface MetaReasoningResult {
  contradiction: ContradictionResult;
  weakEvidenceFlags: string[];
  uncertaintyTier: UncertaintyTier;
  overconfidenceRisk: boolean;
  reasoningScore: number;  // 0–100 composite quality
  compactHint: string;     // ≤120 chars for next-query context injection
}

// ─── Contradiction Detection ──────────────────────────────────────────────────

function detectContradictions(reply: GenesisReply): ContradictionResult {
  const details: string[] = [];
  const regime = (reply.regime ?? "").toLowerCase();
  const thesis = (reply.thesis ?? "").toLowerCase();
  const confidence = reply.confidence;

  // Thesis direction ↔ regime direction
  const isBullThesis = /bull|long|upside|rise|rally|buy|growth/.test(thesis);
  const isBearThesis = /bear|short|downside|fall|drop|sell|decline|correction/.test(thesis);
  const isBearRegime = /bear|risk.?off|selloff|recession/.test(regime);
  const isBullRegime = /bull|risk.?on|accumulation/.test(regime);

  if (isBullThesis && isBearRegime) {
    details.push("Thesis is bullish but regime is risk-off — structural headwind");
  }
  if (isBearThesis && isBullRegime) {
    details.push("Thesis is bearish but regime is bull/risk-on — counter-trend position");
  }

  // Conflicted consensus + high confidence
  if (reply.consensusStrength === "conflicted" && confidence >= 65) {
    details.push(`Conflicted agent consensus with ${confidence}% confidence — agents disagree on direction`);
  }

  // Uncertainty warning + high confidence
  if (reply.uncertaintyWarning && confidence >= 65) {
    details.push("Uncertainty warning present despite elevated confidence level");
  }

  // Scenario probability check — should sum near 100%
  if (reply.scenarios?.length) {
    const total = reply.scenarios.reduce((sum, s) => sum + (parseInt(s.probability) || 0), 0);
    if (total > 0 && Math.abs(total - 100) > 15) {
      details.push(`Scenario probabilities sum to ~${total}% — internal inconsistency`);
    }
  }

  // Invalidation condition already resembles current regime (thesis may be invalidated)
  const invalidation = (reply.invalidation ?? "").toLowerCase();
  if (invalidation && regime && isBearRegime && /bear|risk.?off|rate|recession|inflation/.test(invalidation) && isBullThesis) {
    details.push("Invalidation condition matches current regime — thesis may already be challenged");
  }

  return { detected: details.length > 0, details };
}

// ─── Weak Evidence Detection ──────────────────────────────────────────────────

function detectWeakEvidence(reply: GenesisReply): string[] {
  const flags: string[] = [];
  const confidence = reply.confidence;
  const evidence = reply.evidence ?? [];
  const confidenceDrivers = reply.confidenceDrivers ?? [];

  // High confidence with no supporting evidence
  if (confidence >= 65 && evidence.length === 0) {
    flags.push("High confidence without institutional evidence anchors");
  }
  // Very high confidence with thin evidence
  if (confidence >= 80 && evidence.length < 2) {
    flags.push("Very high confidence — fewer than 2 evidence factors cited");
  }
  // Thesis present but no catalysts (weak inference chain)
  if (reply.thesis && !(reply.catalysts?.length)) {
    flags.push("Thesis has no near-term catalysts — directional view unsupported");
  }
  // Thesis present but no invalidation (no falsifiability)
  if (reply.thesis && !reply.invalidation) {
    flags.push("Thesis lacks an invalidation condition — reasoning not falsifiable");
  }
  // Low consensus strength + high confidence
  if (reply.consensusStrength === "weak" && confidence >= 70) {
    flags.push("Weak agent consensus despite elevated confidence");
  }
  // Confidence drivers absent when confidence ≥ 60
  if (confidence >= 60 && confidenceDrivers.length === 0 && evidence.length === 0) {
    flags.push("No confidence drivers or evidence at moderate-to-high confidence");
  }

  return flags;
}

// ─── Uncertainty Tier ─────────────────────────────────────────────────────────

function computeUncertaintyTier(
  reply: GenesisReply,
  contradiction: ContradictionResult,
): UncertaintyTier {
  if (
    contradiction.detected ||
    reply.consensusStrength === "conflicted" ||
    reply.disagreementNote
  ) return "conflicting";

  if (
    reply.confidence < 40 ||
    reply.uncertaintyWarning ||
    reply.confidenceLabel === "low"
  ) return "uncertain";

  if (reply.confidence < 70 || reply.consensusStrength === "weak") return "possible";

  return "likely";
}

// ─── Overconfidence Protection ────────────────────────────────────────────────

function isOverconfident(
  reply: GenesisReply,
  contradiction: ContradictionResult,
  weakFlags: string[],
): boolean {
  const c = reply.confidence;
  if (c >= 85) return true;  // near-certainty is almost always overconfident for markets
  if (c >= 70 && contradiction.detected) return true;
  if (c >= 70 && weakFlags.length >= 2) return true;
  if (c >= 65 && reply.consensusStrength === "conflicted") return true;
  if (c >= 70 && reply.disagreementNote) return true;
  return false;
}

// ─── Reasoning Score ──────────────────────────────────────────────────────────

function scoreReasoning(
  reply: GenesisReply,
  contradiction: ContradictionResult,
  weakFlags: string[],
  overconfident: boolean,
): number {
  let score = 65; // baseline

  // Completeness bonuses
  if (reply.thesis)            score += 5;
  if (reply.reasoning)         score += 3;
  if (reply.catalysts?.length) score += 4;
  if (reply.invalidation)      score += 4;
  if (reply.evidence?.length)  score += 5;
  if (reply.confidenceDrivers?.length) score += 3;
  if (reply.consensusStrength === "strong") score += 6;
  if (reply.consensusStrength === "moderate") score += 3;
  if (reply.reasoningQuality === "strong") score += 5;
  if (reply.reasoningQuality === "adequate") score += 2;

  // Deductions
  score -= contradiction.details.length * 12;
  score -= weakFlags.length * 6;
  if (overconfident) score -= 10;
  if (reply.consensusStrength === "conflicted") score -= 8;
  if (reply.reasoningQuality === "weak") score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Compact Hint Builder ─────────────────────────────────────────────────────

function buildCompactHint(
  contradiction: ContradictionResult,
  weakFlags: string[],
  overconfident: boolean,
  score: number,
  tier: UncertaintyTier,
): string {
  if (score >= 75 && !contradiction.detected && !overconfident) return "";

  const parts: string[] = [];
  if (contradiction.detected) parts.push(`contradiction: ${contradiction.details[0]?.slice(0, 50) ?? "detected"}`);
  if (overconfident) parts.push("overconfidence risk");
  if (weakFlags.length) parts.push(`weak evidence: ${weakFlags[0]?.slice(0, 40) ?? "flagged"}`);
  if (tier === "conflicting") parts.push("conflicting signals");

  if (!parts.length) return "";
  const hint = `Meta-QA: ${parts.join(" | ")}`;
  return hint.length <= 120 ? hint : `${hint.slice(0, 117)}…`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function evaluateReply(reply: GenesisReply | null | undefined): MetaReasoningResult | null {
  if (!reply) return null;

  const contradiction = detectContradictions(reply);
  const weakFlags = detectWeakEvidence(reply);
  const tier = computeUncertaintyTier(reply, contradiction);
  const overconfident = isOverconfident(reply, contradiction, weakFlags);
  const score = scoreReasoning(reply, contradiction, weakFlags, overconfident);
  const compactHint = buildCompactHint(contradiction, weakFlags, overconfident, score, tier);

  return { contradiction, weakEvidenceFlags: weakFlags, uncertaintyTier: tier, overconfidenceRisk: overconfident, reasoningScore: score, compactHint };
}

/** Map reasoning score to quality label (fallback for when AI omits reasoningQuality). */
export function scoreToQuality(score: number): ReasoningQuality {
  if (score >= 72) return "strong";
  if (score >= 50) return "adequate";
  return "weak";
}
