// Phase-87B: Unified Cognition Governor — meta-cognition upgrade
// Phase-86B: base coordination layer
//
// Phase-87B upgrades:
//   1. questionIntentClassifier  — replaces keyword-winner QuestionType with
//      multi-dimensional intent scoring; layerHints blend with content scores
//   2. contextMergeGovernor      — replaces length-only Arabic merge with
//      quality-scored, overlap-aware, language-dominant merge strategy
//   3. regimeOntologyEngine      — NormalizedRegimeProfile enriches macro layer
//      with a compact composite label (adds ~30 chars, not full framing sentence)
//      to give the AI model explicit regime composition signal
//
// Phase-86B: Cross-brain coordinator that unifies all research intelligence layers
// into a single governed cognition context for prompt injection.
//
// Replaces the three independent Phase-85B/85D/86A prompt injections with one
// coordinated output. Receives:
//
//   authority85b:      Phase-85B knowledge authority context
//   expertKnowledge:   Phase-85D expert knowledge (thinker+school+playbook+framework)
//   macroSynthesis:    Phase-86A macro synthesis (chains+policy+events+thesis impact)
//   semanticImpact:    Phase-86B semantic impact (neutral question enrichment)
//   policyDelta:       Phase-86B policy expectation delta
//
// Priority order (higher = allocated budget first):
//   1. macroSynthesis  — most regime-specific and time-sensitive
//   2. semanticImpact  — analytical pressure enrichment
//   3. expertKnowledge — thinker/school/playbook (Phase-87B: governed merge)
//   4. policyDelta     — policy expectation gap
//   5. authority85b    — source authority and literature context
//
// Budget: max 700 chars total.
// Coverage label: identifies which layers contributed (e.g., "macro+semantic+expert")
//
// No secrets. No PII. No broker data. Educational/advisory only.

import type { SemanticImpactResult } from "./semanticImpactEngine";
import type { PolicyExpectationDelta } from "./policyExpectationModel";
import {
  allocateDynamicBudget,
  deriveLayerScores,
} from "./dynamicBudgetGovernor";
// Phase-87B: meta-cognition upgrades
import type { NormalizedRegimeProfile } from "./regimeOntologyEngine";
import { classifyQuestionIntent } from "./questionIntentClassifier";
import { governContextMerge } from "./contextMergeGovernor";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UnifiedCognitionInput {
  authority85b:    string;   // Phase-85B knowledge authority
  expertKnowledge: string;   // Phase-85D expert knowledge (thinker/school/playbook/framework)
  macroSynthesis:  string;   // Phase-86A macro synthesis
  semanticImpact:  SemanticImpactResult;
  policyDelta:     PolicyExpectationDelta;
  // Phase-87A: explicit Arabic thinker/school contexts — passed to merge governor in 87B
  arabicCtx?:      string;
  question:        string;
  isSaudi:         boolean;
  isInvestment:    boolean;
  regime?:         string;
  maxChars?:       number;   // default 700
  // Phase-87B: optional regime profile from regimeOntologyEngine
  regimeProfile?:  NormalizedRegimeProfile;
}

export interface UnifiedCognitionResult {
  unifiedContext:  string;   // single governed context for prompt injection
  coverageLabel:   string;   // e.g. "macro+semantic+expert"
  layerSizes: {              // char allocation per layer
    macro:    number;
    semantic: number;
    expert:   number;
    policy:   number;
    authority:number;
  };
  totalChars:   number;
  isEmpty:      boolean;
  // Phase-87B: diagnostic fields
  intentLabel?:     string;  // classified question intent
  mergeGovernance?: string;  // merge bias applied to Arabic/English expert contexts
  regimeFraming?:   string;  // institutional framing from regime ontology
}

// ─── Budget allocation ────────────────────────────────────────────────────────

const LAYER_WEIGHTS = {
  macro:    0.35,  // 35% of budget → highest priority
  semantic: 0.20,  // 20%
  expert:   0.22,  // 22%
  policy:   0.10,  // 10%
  authority:0.13,  // 13%
};

function allocateBudget(
  maxChars: number,
  available: { macro: boolean; semantic: boolean; expert: boolean; policy: boolean; authority: boolean },
): Record<keyof typeof LAYER_WEIGHTS, number> {
  const totalWeight = Object.entries(LAYER_WEIGHTS)
    .filter(([k]) => available[k as keyof typeof available])
    .reduce((s, [, w]) => s + w, 0);

  if (totalWeight === 0) return { macro: 0, semantic: 0, expert: 0, policy: 0, authority: 0 };

  const result: Record<keyof typeof LAYER_WEIGHTS, number> = {
    macro: 0, semantic: 0, expert: 0, policy: 0, authority: 0,
  };

  for (const [layer, weight] of Object.entries(LAYER_WEIGHTS)) {
    if (available[layer as keyof typeof available]) {
      result[layer as keyof typeof result] = Math.floor((weight / totalWeight) * maxChars);
    }
  }
  return result;
}

// ─── Content cleaning ─────────────────────────────────────────────────────────

function trimToChars(text: string, limit: number): string {
  if (!text || limit <= 0) return "";
  if (text.length <= limit) return text;
  // Try to cut at last word boundary
  const trimmed = text.slice(0, limit - 3);
  const lastSpace = trimmed.lastIndexOf(" ");
  return lastSpace > limit * 0.7 ? trimmed.slice(0, lastSpace) + "..." : trimmed + "...";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildUnifiedCognition(input: UnifiedCognitionInput): UnifiedCognitionResult {
  const {
    authority85b,
    expertKnowledge,
    macroSynthesis,
    semanticImpact,
    policyDelta,
    arabicCtx,
    question,
    isInvestment,
    regimeProfile,
    maxChars = 700,
  } = input;

  if (!isInvestment) {
    return {
      unifiedContext: "", coverageLabel: "gated",
      layerSizes: { macro: 0, semantic: 0, expert: 0, policy: 0, authority: 0 },
      totalChars: 0, isEmpty: true,
    };
  }

  // Phase-87B: Governed Arabic-English merge replaces length-only Phase-87A logic.
  // contextMergeGovernor selects strategy based on quality scores + semantic overlap.
  const mergeResult = governContextMerge({
    arabicCtx:  arabicCtx ?? "",
    englishCtx: expertKnowledge,
    question,
    isSaudi:    input.isSaudi,
    maxChars:   420,  // generous budget for the expert layer before global trim
  });
  const mergedExpert = mergeResult.mergedContext;

  // Phase-87B: Regime ontology enrichment — prepend compact composite label to macro
  // if a profile is provided and the composite adds non-redundant signal.
  let enrichedMacro = macroSynthesis;
  let regimeFraming: string | undefined;
  if (regimeProfile && regimeProfile.overlays.length > 0) {
    const compactLabel = `[${regimeProfile.compositeLabel}]`;
    // Only prepend if the label is not already present in macroSynthesis
    if (!macroSynthesis.includes(regimeProfile.primaryRegime)) {
      enrichedMacro = macroSynthesis
        ? `${compactLabel} ${macroSynthesis}`
        : compactLabel;
    }
    regimeFraming = regimeProfile.institutionalFraming;
  }

  // Determine which layers have content
  const available = {
    macro:     enrichedMacro.trim().length > 20,
    semantic:  semanticImpact.hasSemanticPressure && semanticImpact.semanticContext.length > 20,
    expert:    mergedExpert.trim().length > 20,
    policy:    policyDelta.expectationCtx.length > 20,
    authority: authority85b.trim().length > 20,
  };

  const anyAvailable = Object.values(available).some(Boolean);
  if (!anyAvailable) {
    return {
      unifiedContext: "", coverageLabel: "empty",
      layerSizes: { macro: 0, semantic: 0, expert: 0, policy: 0, authority: 0 },
      totalChars: 0, isEmpty: true,
      mergeGovernance: mergeResult.mergeBias,
    };
  }

  // Phase-87B: Multi-dimensional intent classification replaces keyword-winner-only
  // QuestionType. layerHints blend with content-derived relevance scores.
  const intentResult  = classifyQuestionIntent(question, enrichedMacro.slice(0, 200));
  const baseScores    = deriveLayerScores(
    enrichedMacro,
    semanticImpact.analyticalPressure,
    mergedExpert,
    policyDelta.deltaScore,
    authority85b,
  );

  // Blend intent layer hints (40% weight) with content-derived scores (60% weight)
  const hints = intentResult.layerHints;
  const blendedScores = {
    macro:     Math.round(baseScores.macro     * 0.60 + (hints.macro     ?? 35) * 0.40),
    semantic:  Math.round(baseScores.semantic  * 0.60 + (hints.semantic  ?? 20) * 0.40),
    expert:    Math.round(baseScores.expert    * 0.60 + (hints.expert    ?? 22) * 0.40),
    policy:    Math.round(baseScores.policy    * 0.60 + (hints.policy    ?? 10) * 0.40),
    authority: Math.round(baseScores.authority * 0.60 + (hints.authority ?? 13) * 0.40),
  };

  // Map intent to the QuestionType shape expected by allocateDynamicBudget
  // (balanced is the safe default — intent already captured in blendedScores)
  const dynBudget = allocateDynamicBudget(maxChars, blendedScores, available, "balanced");
  const budget = {
    macro:     dynBudget.macro,
    semantic:  dynBudget.semantic,
    expert:    dynBudget.expert,
    policy:    dynBudget.policy,
    authority: dynBudget.authority,
  };

  // Assemble layers in priority order
  const parts: string[] = [];
  const labels: string[] = [];
  let used = 0;

  const addLayer = (key: keyof typeof budget, text: string, label: string): void => {
    if (!text.trim() || budget[key] <= 0) return;
    const remaining = maxChars - used;
    if (remaining < 40) return;
    const allocated = Math.min(budget[key], remaining);
    const piece = trimToChars(text.trim(), allocated);
    if (piece.length < 20) return;
    parts.push(piece);
    labels.push(label);
    used += piece.length + 3;
  };

  addLayer("macro",     enrichedMacro,                 "macro");
  addLayer("semantic",  semanticImpact.semanticContext, "semantic");
  addLayer("expert",    mergedExpert,                  "expert");   // Phase-87B: governed merge
  addLayer("policy",    policyDelta.expectationCtx,    "policy");
  addLayer("authority", authority85b,                  "authority");

  if (parts.length === 0) {
    return {
      unifiedContext: "", coverageLabel: "assembly_empty",
      layerSizes: { macro: 0, semantic: 0, expert: 0, policy: 0, authority: 0 },
      totalChars: 0, isEmpty: true,
      intentLabel: intentResult.intent,
      mergeGovernance: mergeResult.mergeBias,
      regimeFraming,
    };
  }

  const unifiedContext = parts.join(" | ");
  const coverageLabel  = labels.join("+");

  return {
    unifiedContext,
    coverageLabel,
    layerSizes: {
      macro:     budget.macro,
      semantic:  budget.semantic,
      expert:    budget.expert,
      policy:    budget.policy,
      authority: budget.authority,
    },
    totalChars:      unifiedContext.length,
    isEmpty:         false,
    intentLabel:     intentResult.intent,
    mergeGovernance: mergeResult.mergeBias,
    regimeFraming,
  };
}
