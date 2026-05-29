// Phase-80: Economic Framework Synthesis
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Upgrades Genesis from theory COMPARISON to framework SYNTHESIS.
// Theory engine (Phase-73) identifies which schools exist and where they agree/conflict.
// This module determines WHICH framework leads given the current regime, WHY it leads,
// WHERE it fails, and what role each alternative plays — with synthesis confidence.
//
// Synthesis states:
//   coherent         — dominant framework well-supported; complementary schools align
//   debated          — dominant contested; 2+ schools carry competing evidence
//   conflicting      — strong schools directly conflict on the same key mechanism
//   low_evidence     — insufficient empirical grounding across matched schools
//   regime_uncertain — no regime anchor; synthesis cannot be grounded
//
// Framework roles:
//   dominant         — highest regime fit + empirical support; leads the reasoning frame
//   supporting       — agrees with dominant; adds complementary analytical dimension
//   conflicting      — explicitly opposes dominant; cannot be reconciled; must be disclosed
//   minority_relevant — different mechanism; useful for scenario or minority case

import { compareTheories, SCHOOL_PROFILES, type School, type SchoolProfile } from "./theoryEngine";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SynthesisState =
  | "coherent"
  | "debated"
  | "conflicting"
  | "low_evidence"
  | "regime_uncertain";

export type FrameworkRole =
  | "dominant"
  | "supporting"
  | "conflicting"
  | "minority_relevant";

export interface FrameworkAssignment {
  profile: SchoolProfile;
  role: FrameworkRole;
  roleRationale: string;   // ≤80 chars: why this role was assigned
}

export interface FrameworkSynthesisResult {
  synthesisState: SynthesisState;
  assignments: FrameworkAssignment[];
  dominantFramework: SchoolProfile | null;
  synthesisExplanation: string;    // ≤200 chars: why dominant leads, where it fails
  minorityInsight: string | null;  // ≤100 chars: what minority framework sees differently
  synthesisContext: string;        // ≤250 chars: compact Genesis-injectable context
  synthesisConfidence: "high" | "moderate" | "low";
}

// ─── Empirical weight ─────────────────────────────────────────────────────────

const EMPIRICAL_WEIGHT: Record<string, number> = {
  strong: 4, moderate: 3, contested: 2, limited: 1,
};

// ─── Synthesis state derivation ───────────────────────────────────────────────

function deriveSynthesisState(
  dominant: SchoolProfile | null,
  conflictingSchools: SchoolProfile[],
  supportingSchools: SchoolProfile[],
  hasRegime: boolean,
  matched: SchoolProfile[],
): SynthesisState {
  if (!dominant) return hasRegime ? "low_evidence" : "regime_uncertain";
  if (!hasRegime && matched.length === 0) return "regime_uncertain";

  const dominantWeight = EMPIRICAL_WEIGHT[dominant.empiricalStrength] ?? 1;
  const hasStrongConflict = conflictingSchools.some(
    s => (EMPIRICAL_WEIGHT[s.empiricalStrength] ?? 1) >= 3,
  );

  if (dominantWeight >= 4 && hasStrongConflict) return "conflicting";
  if (dominantWeight >= 4 && supportingSchools.length > 0) return "coherent";
  if (dominantWeight >= 3 || hasStrongConflict) return "debated";
  return "low_evidence";
}

// ─── Role assignment ──────────────────────────────────────────────────────────

function assignRoles(
  schools: SchoolProfile[],
  dominant: SchoolProfile | null,
): FrameworkAssignment[] {
  if (!dominant) return [];

  return schools.map(s => {
    if (s.school === dominant.school) {
      return {
        profile: s,
        role: "dominant" as FrameworkRole,
        roleRationale: `Highest empirical support (${s.empiricalStrength}); regime fit: ${s.regimeFit[0] ?? "general"}`.slice(0, 80),
      };
    }
    if (s.conflictsWith.includes(dominant.school) || dominant.conflictsWith.includes(s.school)) {
      return {
        profile: s,
        role: "conflicting" as FrameworkRole,
        roleRationale: `Explicitly conflicts with ${dominant.name} on core mechanism`.slice(0, 80),
      };
    }
    if (s.agreesWith.includes(dominant.school) || dominant.agreesWith.includes(s.school)) {
      return {
        profile: s,
        role: "supporting" as FrameworkRole,
        roleRationale: `Compatible with ${dominant.name}; adds ${s.name.split(" ")[0]} dimension`.slice(0, 80),
      };
    }
    return {
      profile: s,
      role: "minority_relevant" as FrameworkRole,
      roleRationale: `Independent mechanism: ${s.worksWhen.split(";")[0]?.trim().slice(0, 50)}`.slice(0, 80),
    };
  });
}

// ─── Synthesis explanation builder ───────────────────────────────────────────

function buildSynthesisExplanation(
  dominant: SchoolProfile,
  conflictingSchools: SchoolProfile[],
  state: SynthesisState,
): string {
  const coreClaim = dominant.coreClaim.slice(0, 70);
  const failsNote = dominant.failsWhen.split(";")[0]?.trim().slice(0, 50) ?? "";
  const conflictNote = conflictingSchools.length > 0
    ? `; contested by ${conflictingSchools[0].name.split(" ")[0]}`
    : "";
  return `Dominant: ${dominant.name} — ${coreClaim} | Fails: ${failsNote}${conflictNote} | Synthesis: ${state}`.slice(0, 200);
}

// ─── Minority insight builder ─────────────────────────────────────────────────

function buildMinorityInsight(
  assignments: FrameworkAssignment[],
  dominant: SchoolProfile,
): string | null {
  const minority = assignments.find(a => a.role === "conflicting" || a.role === "minority_relevant");
  if (!minority) return null;
  const insight = minority.profile.worksWhen.split(";")[0]?.trim() ?? "";
  return `${minority.profile.name}: useful when ${insight.slice(0, 60)}`.slice(0, 100);
}

// ─── Synthesis confidence ─────────────────────────────────────────────────────

function deriveSynthesisConfidence(
  state: SynthesisState,
  dominant: SchoolProfile | null,
): "high" | "moderate" | "low" {
  if (state === "coherent" && dominant?.empiricalStrength === "strong") return "high";
  if (state === "debated" || state === "conflicting") return "moderate";
  return "low";
}

// ─── Synthesis context builder ────────────────────────────────────────────────

function buildSynthesisContext(
  state: SynthesisState,
  assignments: FrameworkAssignment[],
  explanation: string,
  confidence: string,
): string {
  const roleMap = assignments
    .slice(0, 3)
    .map(a => `${a.profile.name.split(" ")[0]}:${a.role.replace("_relevant", "+")}`)
    .join(", ");
  return `Framework synthesis [${state}]: ${roleMap} | ${explanation.slice(0, 120)} | confidence: ${confidence}`.slice(0, 250);
}

// ─── Fallback: regime-based school selection ──────────────────────────────────

const REGIME_SCHOOL_MAP: Record<string, School[]> = {
  bull_trending:      ["factor_investing", "macro_regime", "behavioral", "adaptive_markets"],
  bear_ranging:       ["institutional", "credit_cycle", "keynesian", "behavioral"],
  high_vol_risk_off:  ["institutional", "credit_cycle", "keynesian", "monetarist"],
  macro_transition:   ["macro_regime", "keynesian", "reflexivity", "adaptive_markets"],
  low_vol_accumulation:["portfolio_theory", "factor_investing", "macro_regime"],
};

function selectSchoolsByRegime(regime: string): SchoolProfile[] {
  const key = regime.toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  const match = Object.entries(REGIME_SCHOOL_MAP).find(([r]) => key.includes(r));
  if (!match) return SCHOOL_PROFILES.slice(0, 3);
  return SCHOOL_PROFILES.filter(p => match[1].includes(p.school)).slice(0, 4);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * synthesizeFrameworks — determine the dominant analytical framework and
 * the role of each competing school given current regime and question signals.
 * Builds on compareTheories (Phase-73) and adds synthesis roles and confidence.
 * O(1), pure, no side effects.
 */
export function synthesizeFrameworks(
  question: string,
  context: string = "",
  regime?: string,
): FrameworkSynthesisResult {
  // Use theory engine as detection foundation
  const theoryResult = compareTheories(question, context, regime);
  const hasRegime = !!regime && regime !== "unknown";

  // If no schools detected by keywords, fall back to regime-based selection
  let matched: SchoolProfile[] = theoryResult.matchedSchools.length > 0
    ? theoryResult.matchedSchools
    : hasRegime
    ? selectSchoolsByRegime(regime!)
    : [];

  // Cap to 5 to keep synthesis bounded
  matched = matched.slice(0, 5);

  // Dominant: highest empirical weight among matched schools
  const dominant = matched.length > 0
    ? matched.reduce((best, s) =>
        (EMPIRICAL_WEIGHT[s.empiricalStrength] ?? 0) > (EMPIRICAL_WEIGHT[best.empiricalStrength] ?? 0)
          ? s
          : best,
        matched[0])
    : null;

  // Partition supporting and conflicting relative to dominant
  const conflictingSchools = dominant
    ? matched.filter(s =>
        s.school !== dominant.school &&
        (s.conflictsWith.includes(dominant.school) || dominant.conflictsWith.includes(s.school)),
      )
    : [];
  const supportingSchools = dominant
    ? matched.filter(s =>
        s.school !== dominant.school &&
        (s.agreesWith.includes(dominant.school) || dominant.agreesWith.includes(s.school)),
      )
    : [];

  const synthesisState = deriveSynthesisState(dominant, conflictingSchools, supportingSchools, hasRegime, matched);
  const assignments = assignRoles(matched, dominant);
  const synthesisExplanation = dominant
    ? buildSynthesisExplanation(dominant, conflictingSchools, synthesisState)
    : "No framework synthesis available — insufficient question signals or regime anchor.";
  const minorityInsight = dominant ? buildMinorityInsight(assignments, dominant) : null;
  const synthesisConfidence = deriveSynthesisConfidence(synthesisState, dominant);
  const synthesisContext = buildSynthesisContext(synthesisState, assignments, synthesisExplanation, synthesisConfidence);

  return {
    synthesisState,
    assignments,
    dominantFramework: dominant,
    synthesisExplanation,
    minorityInsight,
    synthesisContext,
    synthesisConfidence,
  };
}
