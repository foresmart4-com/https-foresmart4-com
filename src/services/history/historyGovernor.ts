// Phase-89C: History Governor
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Governs the Phase-89C economic history pipeline output. Assembles the crisis
// library, historical analogy, and regime history results into a single governed
// context block (≤420 chars) and enforces:
//
//   1. No false analog: strong_analog without whatDiffers is blocked
//   2. No historical overfitting: weak_analog (<40%) cannot anchor strong claims
//   3. No deterministic history claims: "will follow same pattern" is forbidden
//   4. No shallow precedent: crisis archetype without transmission mechanism is blocked
//   5. Budget guard: assembled context ≤420 chars
//
// Governance repairs:
//   false_analog_risk:       strong analog present without structural differentiation
//   weak_analog_anchoring:   weak analog (<40%) used as primary context
//   no_crisis_signal:        no crisis archetype detected — context may be generic
//   no_regime_history:       no active regime history pattern matched
//   certainty_language:      deterministic history phrasing detected
//
// Quality score (0-100):
//   +25: crisis archetype detected with transmission mechanism
//   +20: analog confidence ≥ 40 (partial or strong)
//   +20: whatDiffers is non-empty (honest qualification)
//   +20: active regime history pattern(s) detected
//   +15: no certainty language in assembled context
//
// Educational/advisory only.

import type { CrisisMemoryResult }      from "./crisisHistoryLibrary";
import type { HistoricalAnalogyResult } from "./historicalAnalogyEngine";
import type { RegimeHistoryProfile }    from "./regimeHistoryEngine";

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface HistoryGovernanceResult {
  approved:          boolean;
  qualityScore:      number;    // 0-100
  repairs:           string[];
  governedHistoryCtx: string;   // ≤420 chars injectable
  fiduciaryNote:     string;    // ≤70 chars
  governanceLog:     string;
}

// ─── Certainty language check ─────────────────────────────────────────────────

const CERTAINTY_RE = /\b(will follow the same|history repeats exactly|proven by history|guaranteed by precedent|always happens|certain to follow)\b/i;

// ─── Quality scoring ──────────────────────────────────────────────────────────

function scoreQuality(
  crisis:  CrisisMemoryResult,
  analogy: HistoricalAnalogyResult,
  regime:  RegimeHistoryProfile,
  assembled: string,
): number {
  let score = 0;
  if (crisis.isActiveCrisis)                         score += 25;
  if (analogy.analogConfidence >= 40)                score += 20;
  if (analogy.whatDiffers && analogy.whatDiffers.length > 5) score += 20;
  if (regime.activeRegimes.length > 0)               score += 20;
  if (!CERTAINTY_RE.test(assembled))                 score += 15;
  return Math.min(100, score);
}

// ─── Repair identification ─────────────────────────────────────────────────────

function identifyRepairs(
  crisis:  CrisisMemoryResult,
  analogy: HistoricalAnalogyResult,
  regime:  RegimeHistoryProfile,
  assembled: string,
): string[] {
  const repairs: string[] = [];
  if (analogy.strength === "strong_analog" && (!analogy.whatDiffers || analogy.whatDiffers.length < 10)) {
    repairs.push("false_analog_risk");
  }
  if (analogy.strength === "weak_analog" && !crisis.isActiveCrisis) {
    repairs.push("weak_analog_anchoring");
  }
  if (!crisis.isActiveCrisis) repairs.push("no_crisis_signal");
  if (regime.activeRegimes.length === 0) repairs.push("no_regime_history");
  if (CERTAINTY_RE.test(assembled)) repairs.push("certainty_language_detected");
  return repairs;
}

// ─── Context assembly ─────────────────────────────────────────────────────────

function trimTo(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 3) + "...";
}

function assembleContext(
  crisis:    CrisisMemoryResult,
  analogy:   HistoricalAnalogyResult,
  regime:    RegimeHistoryProfile,
  repairs:   string[],
  budget:    number,
): string {
  const crisisBlock  = crisis.isActiveCrisis
    ? trimTo(crisis.crisisCtx, 160)
    : "No crisis archetype active";
  const analogBlock  = trimTo(analogy.analogCtx, 130);
  const regimeBlock  = regime.activeRegimes.length > 0
    ? trimTo(regime.regimeHistCtx, 100)
    : "";
  const flagBlock    = repairs.includes("false_analog_risk")
    ? " [analog: differentiation required]"
    : repairs.includes("weak_analog_anchoring")
    ? " [analog: weak confidence]"
    : "";

  return [crisisBlock, analogBlock, regimeBlock]
    .filter(Boolean)
    .join(" | ")
    .concat(flagBlock)
    .slice(0, budget);
}

// ─── Fiduciary note ───────────────────────────────────────────────────────────

function buildFiduciaryNote(
  crisis:  CrisisMemoryResult,
  analogy: HistoricalAnalogyResult,
  regime:  RegimeHistoryProfile,
): string {
  if (crisis.dominantCrisis?.archetype.id === "liquidity_shock") {
    return "Liquidity shock: historical precedent = CB backstop required; cash first";
  }
  if (crisis.dominantCrisis?.archetype.id === "banking_stress") {
    return "Banking stress: avoid bank/HY; CB recapitalization is the resolution signal";
  }
  if (analogy.strength === "weak_analog") {
    return "Historical analog is weak — conditional framing only; no strong claims";
  }
  if (regime.activeRegimes.length > 0) {
    return regime.activeRegimes[0].fiduciaryConsideration.slice(0, 65);
  }
  return "History is context not prediction — all analogs are conditional";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function governHistory(input: {
  crisis:    CrisisMemoryResult;
  analogy:   HistoricalAnalogyResult;
  regime:    RegimeHistoryProfile;
  lang:      "ar" | "en";
  budget?:   number;  // default 420
}): HistoryGovernanceResult {
  const { crisis, analogy, regime, budget = 420 } = input;

  const repairs       = identifyRepairs(crisis, analogy, regime, crisis.crisisCtx + analogy.analogCtx);
  const assembled     = assembleContext(crisis, analogy, regime, repairs, budget);
  const qualityScore  = scoreQuality(crisis, analogy, regime, assembled);
  const approved      = qualityScore >= 45 && !repairs.includes("certainty_language_detected");
  const fiduciaryNote = buildFiduciaryNote(crisis, analogy, regime);
  const governanceLog = `history quality=${qualityScore} approved=${approved} crisis=${crisis.isActiveCrisis} analog=${analogy.strength}(${analogy.analogConfidence}%) regime=${regime.activeRegimes.length} repairs=[${repairs.join(",")||"none"}]`;

  return {
    approved,
    qualityScore,
    repairs,
    governedHistoryCtx: assembled,
    fiduciaryNote:      fiduciaryNote.slice(0, 70),
    governanceLog,
  };
}
