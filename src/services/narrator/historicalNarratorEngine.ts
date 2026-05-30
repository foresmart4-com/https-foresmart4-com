// Historical Narrator Engine
// Forces visible historical reasoning in the final response.
// Prevents history mention without analytical use.
//
// Key problem: history context is injected but the AI produces a generic
// "historical precedents suggest..." without naming the specific analog,
// what differs, or the precedent limit.
//
// Fix: generates a specific HISTORICAL lens directive for perspectiveMap
// that names the exact era, analog confidence, and structural difference.
//
// No AI calls. No network. Pure deterministic. O(1).

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HistoricalNarratorInput {
  analogResult: {
    dominantEra:      string;   // e.g. "2022_tightening"
    analogConfidence: number;   // 0-100
    strength:         string;   // "strong_analog" | "partial_analog" | "weak_analog"
    whatDiffers:      string;   // ≤65 chars structural difference
  } | null;
  crisis: {
    isActiveCrisis: boolean;
    crisisLabel:    string;   // e.g. "banking stress"
  } | null;
}

export interface HistoricalNarratorResult {
  historicalVoiceDirective: string;  // ≤130 chars: what perspectiveMap.HISTORICAL must say
  crisisNote:               string;  // ≤70 chars: crisis-specific field note (if active)
  narratorFragment:         string;  // ≤100 chars: snippet for master directive
  hasHistory:               boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function trim(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 3) + "...";
}

function eraDisplay(era: string): string {
  return era.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function strengthLabel(s: string): string {
  if (s === "strong_analog")  return "STRONG";
  if (s === "partial_analog") return "PARTIAL";
  return "WEAK";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildHistoricalNarration(input: HistoricalNarratorInput): HistoricalNarratorResult {
  const { analogResult, crisis } = input;

  const hasAnalog = analogResult != null && analogResult.dominantEra !== "neutral";
  const hasActiveCrisis = crisis?.isActiveCrisis === true;
  const hasHistory = hasAnalog || hasActiveCrisis;

  if (!hasHistory) {
    return {
      historicalVoiceDirective: "",
      crisisNote:               "",
      narratorFragment:         "",
      hasHistory:               false,
    };
  }

  // Historical voice directive: what perspectiveMap HISTORICAL lens must say
  let historicalVoiceDirective = "";
  if (hasAnalog && analogResult) {
    const era    = eraDisplay(analogResult.dominantEra);
    const conf   = analogResult.analogConfidence;
    const label  = strengthLabel(analogResult.strength);
    const differs = analogResult.whatDiffers;
    historicalVoiceDirective = trim(
      `HISTORICAL: ${era}(${label}/${conf}%) — differs: ${differs} — precedent is context not prediction`,
      130,
    );
  }

  // Crisis note: crisis-specific requirement
  let crisisNote = "";
  if (hasActiveCrisis && crisis) {
    crisisNote = trim(
      `Crisis active[${crisis.crisisLabel}]: caveats must name transmission risk`,
      70,
    );
  }

  // Narrator fragment for master directive
  const narratorFragment = hasAnalog && analogResult
    ? trim(
        `[HISTORY] perspectiveMap HISTORICAL: name "${eraDisplay(analogResult.dominantEra)}" + state differs: "${analogResult.whatDiffers.slice(0, 38)}"`,
        100,
      )
    : hasActiveCrisis && crisis
    ? trim(`[HISTORY] crisis[${crisis.crisisLabel}] active — caveats must name transmission`, 100)
    : "";

  return {
    historicalVoiceDirective,
    crisisNote,
    narratorFragment,
    hasHistory,
  };
}
