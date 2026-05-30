// Institutional Narrator Governor
// Master composer for all narrator engines.
// Generates a ≤500-char mandatory surfacing directive injected LAST in the prompt.
//
// Problem this solves:
//   Genesis intelligence exists across multiple systems — CIO frame, historical
//   analog, thesis competition, research desks — but the final response layer
//   does not consistently surface them. Intelligence is computed but not narrated.
//
// This governor:
//   1. Detects which intelligence layers are active
//   2. Generates specific field-surfacing directives from each sub-engine
//   3. Assembles a mandatory directive that appears LAST in the prompt
//      (highest recency → AI reads it just before generating the response)
//   4. Enforces composition order: desks → history → foresight → thesis → CIO → final
//   5. Prevents generic synthesis by naming exact field targets
//
// The directive is NOT a soft suggestion — it is a hard mandate with
// specific field names and expected content patterns.
//
// Budget: ≤500 chars total directive. Each layer contributes ≤100-char fragment.
// No AI calls. No network. Pure deterministic. O(1).

import { buildThesisNarration }    from "./thesisNarratorEngine";
import { buildHistoricalNarration } from "./historicalNarratorEngine";
import { buildCioNarration }        from "./cioNarratorEngine";
import type { ThesisCompetitionProfile } from "@/services/meta/thesisCompetitionEngine";
import type { CioAdvisoryFrame }         from "@/services/advisory/cioAdvisoryEngine";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NarratorInput {
  thesisComp:   ThesisCompetitionProfile | null;
  cioFrame:     CioAdvisoryFrame | null;
  analogResult: {
    dominantEra:      string;
    analogConfidence: number;
    strength:         string;
    whatDiffers:      string;
  } | null;
  crisis: {
    isActiveCrisis: boolean;
    crisisLabel:    string;
  } | null;
  activeDesks:   string[] | null;   // e.g. ["macro","sector","policy"]
  primaryDesk:   string | null;     // e.g. "macro"
  hasGlobalMacro: boolean;
  hasForesight:   boolean;
  isInvestment:   boolean;
  isSaudi:        boolean;
  lang:           "ar" | "en";
}

export interface InstitutionalNarratorResult {
  directive:        string;  // ≤500 chars — inject LAST in prompt
  activeLayerCount: number;
  layerCoverage:    string[];
  surfacingScore:   number;  // 0-100 expected surfacing quality
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function trim(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 3) + "...";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildInstitutionalNarrator(input: NarratorInput): InstitutionalNarratorResult {
  const {
    thesisComp, cioFrame, analogResult, crisis,
    activeDesks, primaryDesk, hasGlobalMacro, hasForesight,
    isInvestment,
  } = input;

  if (!isInvestment) {
    return { directive: "", activeLayerCount: 0, layerCoverage: [], surfacingScore: 0 };
  }

  const fragments: string[] = [];
  const layerCoverage: string[] = [];

  // ── CIO layer ────────────────────────────────────────────────────────────
  if (cioFrame) {
    const cioResult = buildCioNarration({ cioFrame });
    if (cioResult.narratorFragment) {
      fragments.push(cioResult.narratorFragment);
      layerCoverage.push("cio");
    }
  }

  // ── History layer ─────────────────────────────────────────────────────────
  const histResult = buildHistoricalNarration({ analogResult, crisis });
  if (histResult.hasHistory && histResult.narratorFragment) {
    fragments.push(histResult.narratorFragment);
    layerCoverage.push("history");
  }

  // ── Thesis competition layer ──────────────────────────────────────────────
  if (thesisComp) {
    const thesisResult = buildThesisNarration({ competition: thesisComp });
    if (thesisResult.narratorFragment) {
      fragments.push(thesisResult.narratorFragment);
      layerCoverage.push("thesis");
    }
  }

  // ── Research desks layer ──────────────────────────────────────────────────
  if (activeDesks && activeDesks.length > 0) {
    const deskStr = activeDesks.slice(0, 3).join("+");
    const dominantNote = primaryDesk ? `dominant:${primaryDesk}` : "";
    const deskFragment = trim(
      `[DESKS] sectorLens+macroChain: differentiate ${deskStr} desk findings — NOT generic sector commentary${dominantNote ? ` (${dominantNote})` : ""}`,
      100,
    );
    fragments.push(deskFragment);
    layerCoverage.push("desks");
  }

  // ── Global macro / foresight layer ───────────────────────────────────────
  if (hasGlobalMacro) {
    fragments.push(trim("[MACRO] macroChain: use global transmission chain — arrows required (X→Y→Z)", 80));
    layerCoverage.push("global_macro");
  }
  if (hasForesight) {
    fragments.push(trim("[FORESIGHT] scenarios: label each with conditional trigger, not generic upside/base/downside", 80));
    layerCoverage.push("foresight");
  }

  if (fragments.length === 0) {
    return { directive: "", activeLayerCount: 0, layerCoverage: [], surfacingScore: 0 };
  }

  // ── Assemble directive ────────────────────────────────────────────────────
  // Header + fragments + failure warning, total ≤500 chars
  const header  = "INSTITUTIONAL NARRATION MANDATE — surface active intelligence in final answer:";
  const warning = "Generic summary without specific layer references = surfacing failure.";

  const body = fragments.join("\n");
  const full = `${header}\n${body}\n${warning}`;

  const directive = trim(full, 500);

  // Expected surfacing score: 15 per layer, capped at 90
  const surfacingScore = Math.min(90, layerCoverage.length * 15);

  return {
    directive,
    activeLayerCount: layerCoverage.length,
    layerCoverage,
    surfacingScore,
  };
}
