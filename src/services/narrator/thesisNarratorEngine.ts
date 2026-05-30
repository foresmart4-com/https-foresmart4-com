// Thesis Narrator Engine
// Surfaces thesis competition visibly in final response fields.
// Prevents single-narrative dominance — requires explicit counter-thesis framing.
//
// Key problem: thesis competition data is computed but the AI collapses to a
// dominant view without naming the counter thesis or its evidence weight.
//
// Fix: generates specific field directives that name exactly what the AI must
// put in opposingCase, committeeBearCase, and committeeBullCase.
//
// No AI calls. No network. Pure deterministic. O(1).

import type { ThesisCompetitionProfile } from "@/services/meta/thesisCompetitionEngine";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ThesisNarratorResult {
  opposingFragment:  string;  // ≤110 chars: specific directive for opposingCase
  bullFragment:      string;  // ≤110 chars: specific directive for committeeBullCase
  bearFragment:      string;  // ≤110 chars: specific directive for committeeBearCase
  narratorFragment:  string;  // ≤100 chars: snippet for master directive
  contestLabel:      string;  // e.g. "moderately_contested"
  isContested:       boolean; // true when not lopsided
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function trim(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 3) + "...";
}

function eraLabel(stance: "bull" | "bear" | "base"): string {
  return stance === "bull" ? "Bull" : stance === "bear" ? "Bear" : "Base";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildThesisNarration(input: {
  competition: ThesisCompetitionProfile;
}): ThesisNarratorResult {
  const { competition } = input;
  const { bull, base, bear, dominant, contestLevel } = competition;

  // Identify counter thesis (opposite of dominant)
  const counter = dominant === "bull" ? bear : dominant === "bear" ? bull : bear;
  const dom     = dominant === "bull" ? bull : dominant === "bear" ? bear : base;
  const mid     = dominant === "base" ? bull : base;

  // opposingCase: name the counter thesis explicitly with weight and why it loses
  const opposingFragment = trim(
    `Counter[${eraLabel(counter.stance)}](w=${counter.weight}): ${counter.coreAssertion} — counter wins IF: ${counter.keyAssumption}`,
    110,
  );

  // committeeBullCase: name bull coreAssertion and key assumption
  const bullFragment = trim(
    `Bull(w=${bull.weight}): ${bull.coreAssertion} — requires: ${bull.keyAssumption}`,
    110,
  );

  // committeeBearCase: name bear coreAssertion and weak point
  const bearFragment = trim(
    `Bear(w=${bear.weight}): ${bear.coreAssertion} — weak point: ${bear.weakPoint}`,
    110,
  );

  // Narrator fragment for master directive
  const isContested = contestLevel !== "lopsided";
  const narratorFragment = trim(
    `[THESIS] opposingCase: "${counter.coreAssertion.slice(0, 45)}"(w=${counter.weight}) vs dominant "${dom.coreAssertion.slice(0, 35)}"(w=${dom.weight}) [${contestLevel}]`,
    100,
  );

  return {
    opposingFragment,
    bullFragment,
    bearFragment,
    narratorFragment,
    contestLabel: contestLevel,
    isContested,
  };
}
