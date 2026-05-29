// Phase-86B: Unified Cognition Governor
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Cross-brain coordinator: unifies all research intelligence layers into a
// single governed cognition context for prompt injection.
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
//   2. semanticImpact  — analytical pressure enrichment (new in 86B)
//   3. expertKnowledge — thinker/school/playbook intelligence
//   4. policyDelta     — policy expectation gap (new in 86B)
//   5. authority85b    — source authority and literature context
//
// Budget: max 700 chars total (replaces ~1510 chars from three separate injections)
// This ~54% reduction improves signal quality by eliminating cross-layer repetition.
//
// Coverage label: identifies which layers contributed (e.g., "macro+semantic+expert")
//
// No secrets. No PII. No broker data. Educational/advisory only.

import type { SemanticImpactResult } from "./semanticImpactEngine";
import type { PolicyExpectationDelta } from "./policyExpectationModel";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UnifiedCognitionInput {
  authority85b:    string;   // Phase-85B knowledge authority
  expertKnowledge: string;   // Phase-85D expert knowledge (thinker/school/playbook/framework)
  macroSynthesis:  string;   // Phase-86A macro synthesis
  semanticImpact:  SemanticImpactResult;
  policyDelta:     PolicyExpectationDelta;
  question:        string;
  isSaudi:         boolean;
  isInvestment:    boolean;
  regime?:         string;
  maxChars?:       number;   // default 700
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
  totalChars:  number;
  isEmpty:     boolean;
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
    isInvestment,
    maxChars = 700,
  } = input;

  if (!isInvestment) {
    return {
      unifiedContext: "", coverageLabel: "gated",
      layerSizes: { macro: 0, semantic: 0, expert: 0, policy: 0, authority: 0 },
      totalChars: 0, isEmpty: true,
    };
  }

  // Determine which layers have content
  const available = {
    macro:     macroSynthesis.trim().length > 20,
    semantic:  semanticImpact.hasSemanticPressure && semanticImpact.semanticContext.length > 20,
    expert:    expertKnowledge.trim().length > 20,
    policy:    policyDelta.expectationCtx.length > 20,
    authority: authority85b.trim().length > 20,
  };

  const anyAvailable = Object.values(available).some(Boolean);
  if (!anyAvailable) {
    return {
      unifiedContext: "", coverageLabel: "empty",
      layerSizes: { macro: 0, semantic: 0, expert: 0, policy: 0, authority: 0 },
      totalChars: 0, isEmpty: true,
    };
  }

  const budget = allocateBudget(maxChars, available);

  // Assemble layers in priority order
  const parts: string[] = [];
  const labels: string[] = [];
  let used = 0;

  const addLayer = (key: keyof typeof budget, text: string, label: string): void => {
    if (!text.trim() || budget[key] <= 0) return;
    const remaining = maxChars - used;
    if (remaining < 40) return;  // not worth injecting tiny fragments
    const allocated = Math.min(budget[key], remaining);
    const piece = trimToChars(text.trim(), allocated);
    if (piece.length < 20) return;
    parts.push(piece);
    labels.push(label);
    used += piece.length + 3;  // +3 for " | " separator
  };

  addLayer("macro",     macroSynthesis,                "macro");
  addLayer("semantic",  semanticImpact.semanticContext, "semantic");
  addLayer("expert",    expertKnowledge,               "expert");
  addLayer("policy",    policyDelta.expectationCtx,    "policy");
  addLayer("authority", authority85b,                  "authority");

  if (parts.length === 0) {
    return {
      unifiedContext: "", coverageLabel: "assembly_empty",
      layerSizes: { macro: 0, semantic: 0, expert: 0, policy: 0, authority: 0 },
      totalChars: 0, isEmpty: true,
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
    totalChars: unifiedContext.length,
    isEmpty:    false,
  };
}
