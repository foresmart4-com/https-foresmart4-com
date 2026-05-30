// Phase-90A: Conviction Governor
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Distinct from investmentJudgmentEngine.ts (Phase-83B):
//   investmentJudgmentEngine: grades the AI REPLY quality POST-reply (backward-looking)
//   convictionGovernor (90A): governs what CONVICTION LEVEL is appropriate
//                              PRE-AI based on evidence quality — provides a
//                              maxConfidenceAnchor that the AI must not exceed
//
// Distinct from adaptiveInvestmentGovernor.ts (Phase-84A):
//   adaptiveInvestmentGovernor: allow/repair decision for the reply pipeline
//   convictionGovernor (90A): forward-facing conviction ceiling that informs
//                              the AI's confidence calibration
//
// Problem: Genesis sometimes expresses high conviction (65-80% confidence) when
// the evidence quality only warrants 40-55%. This mismatch violates fiduciary
// discipline — an institution never claims high conviction without strong evidence.
//
// Solution: compute a maxConfidenceAnchor from evidence quality dimensions.
// When this is injected into the prompt, the AI must not exceed it.
//
// Evidence quality dimensions:
//   regime_confidence:  from regimeConf (0-100)
//   consensus_quality:  from consensusStrength
//   credit_clarity:     from creditStressLevel (high stress = lower clarity)
//   signal_count:       number of confirming signals (regime + oil + rates + consensus)
//
// Composite conviction score (0-100) → maps to maxConfidenceAnchor (35-78).
// ConvictionJustification: explains WHY conviction is at this level.
//
// requiresQualification: true when evidence is thin → AI must include explicit
// qualification in confidenceCalibration field.
//
// Educational/advisory only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type ConvictionLevel         = "low" | "moderate" | "high" | "contested";
export type ConvictionJustification =
  | "evidence_strong"      // multiple confirming signals; regime clear
  | "evidence_moderate"    // regime established but some uncertainty remains
  | "evidence_thin"        // few confirming signals; limited visibility
  | "conflicting_signals"; // signals pointing in different directions

export interface ConvictionGovernanceResult {
  allowedConviction:    ConvictionLevel;
  justification:        ConvictionJustification;
  maxConfidenceAnchor:  number;  // 0-100: hard ceiling for AI confidence
  convictionNote:       string;  // ≤65 chars: why this conviction level
  requiresQualification: boolean;
}

// ─── Evidence scoring ─────────────────────────────────────────────────────────

function scoreRegimeEvidence(regimeConf: number): number {
  if (regimeConf >= 70) return 25;
  if (regimeConf >= 50) return 18;
  if (regimeConf >= 35) return 10;
  return 4;
}

function scoreConsensusEvidence(strength: "strong" | "moderate" | "weak" | "conflicted"): number {
  return { strong: 25, moderate: 15, weak: 6, conflicted: 0 }[strength] ?? 10;
}

function scoreCreditClarity(stress: "low" | "moderate" | "high" | "extreme"): number {
  // Lower credit stress = higher clarity = more confident anchoring
  return { low: 20, moderate: 14, high: 6, extreme: 0 }[stress] ?? 10;
}

function scoreSignalCount(
  macroBias:    "bullish" | "bearish" | "neutral",
  oilPrice:     number | null | undefined,
  tltChangePct: number | null | undefined,
  isSaudi:      boolean,
): number {
  let count = 0;
  if (macroBias !== "neutral") count++;
  if (oilPrice != null) count++;
  if (tltChangePct != null) count++;
  if (isSaudi && oilPrice != null) count++;  // Saudi gets additional oil signal
  return Math.min(30, count * 8);
}

// ─── Conviction derivation ────────────────────────────────────────────────────

function deriveConviction(composite: number): {
  level: ConvictionLevel;
  justification: ConvictionJustification;
  anchor: number;
  note: string;
} {
  if (composite >= 75) {
    return {
      level:         "high",
      justification: "evidence_strong",
      anchor:        78,
      note:          "Strong evidence quality; conviction ceiling 78%",
    };
  }
  if (composite >= 52) {
    return {
      level:         "moderate",
      justification: "evidence_moderate",
      anchor:        65,
      note:          "Moderate evidence; conviction ceiling 65%",
    };
  }
  if (composite >= 32) {
    return {
      level:         "low",
      justification: "evidence_thin",
      anchor:        52,
      note:          "Thin evidence; conviction ceiling 52%",
    };
  }
  return {
    level:         "contested",
    justification: "conflicting_signals",
    anchor:        40,
    note:          "Conflicting signals; conviction ceiling 40%",
  };
}

// ─── Override rules ───────────────────────────────────────────────────────────
// Specific conditions that hard-cap the conviction anchor

function applyOverrides(
  anchor:       number,
  creditStress: "low" | "moderate" | "high" | "extreme",
  consStrength: "strong" | "moderate" | "weak" | "conflicted",
  regimeConf:   number,
): number {
  if (creditStress === "extreme")         return Math.min(anchor, 45);
  if (creditStress === "high")            return Math.min(anchor, 58);
  if (consStrength === "conflicted")      return Math.min(anchor, 52);
  if (regimeConf < 35)                    return Math.min(anchor, 48);
  return anchor;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function governConviction(input: {
  regimeConf:        number;
  consensusStrength: "strong" | "moderate" | "weak" | "conflicted";
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
  macroBias:         "bullish" | "bearish" | "neutral";
  oilPrice?:         number | null;
  tltChangePct?:     number | null;
  isSaudi:           boolean;
}): ConvictionGovernanceResult {
  const { regimeConf, consensusStrength, creditStressLevel, macroBias, oilPrice, tltChangePct, isSaudi } = input;

  const composite =
    scoreRegimeEvidence(regimeConf) +
    scoreConsensusEvidence(consensusStrength) +
    scoreCreditClarity(creditStressLevel) +
    scoreSignalCount(macroBias, oilPrice, tltChangePct, isSaudi);

  const { level, justification, anchor: baseAnchor, note } = deriveConviction(composite);
  const maxConfidenceAnchor = applyOverrides(baseAnchor, creditStressLevel, consensusStrength, regimeConf);

  return {
    allowedConviction:    level,
    justification,
    maxConfidenceAnchor,
    convictionNote:       note.slice(0, 65),
    requiresQualification: level === "low" || level === "contested",
  };
}
