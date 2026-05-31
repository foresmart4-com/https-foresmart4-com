// Weight adjuster — smoothly adapts consensus weights from learning insights.
// Changes are logged and stored in STATE only; never forced without human review.

import type { LearningInsights } from "@/lib/genesis100/algorithms/learningEngine";
import type { ConsensusWeights } from "@/lib/genesis100/algorithms/consensusEngine";

// Learning key → ConsensusWeights key mapping
const SCHOOL_KEY_MAP: Record<string, keyof ConsensusWeights> = {
  keynesian: "keynesian",
  monetarist: "monetarist",
  austrian: "austrian",
  behavioral: "behavioral",
  valueInvesting: "valueInvesting",
  globalMacro: "globalMacro",
};

function normalizeWeights(w: ConsensusWeights): ConsensusWeights {
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  if (total <= 0) return w;
  const keys = Object.keys(w) as (keyof ConsensusWeights)[];
  const normalized = { ...w };
  keys.forEach((k) => { normalized[k] = normalized[k] / total; });
  return normalized;
}

function clampWeights(w: ConsensusWeights): ConsensusWeights {
  const keys = Object.keys(w) as (keyof ConsensusWeights)[];
  const clamped = { ...w };
  keys.forEach((k) => { clamped[k] = Math.max(0.05, Math.min(0.35, clamped[k])); });
  return clamped;
}

export function applyLearningToWeights(
  insights: LearningInsights,
  currentWeights: ConsensusWeights,
): ConsensusWeights {
  if (insights.dataInsufficient) return currentWeights;

  const adj = insights.recommendedWeightAdjustments;
  let adjusted: ConsensusWeights = { ...currentWeights };

  for (const [learningKey, wsKey] of Object.entries(SCHOOL_KEY_MAP)) {
    const recommended = adj[learningKey];
    if (recommended == null) continue;

    // Smooth transition: 70% keep current, 30% move toward learning recommendation
    const blended = currentWeights[wsKey] * 0.7 + recommended * 0.3;
    adjusted[wsKey] = blended;

    const delta = blended - currentWeights[wsKey];
    if (Math.abs(delta) > 0.001) {
      console.info(
        `[genesis-learning] Weight adjusted: ${wsKey} ${currentWeights[wsKey].toFixed(3)} → ${blended.toFixed(3)} (Δ${delta >= 0 ? "+" : ""}${delta.toFixed(3)})`,
      );
    }
  }

  // Clamp then normalize — in that order, twice to ensure clean result
  adjusted = clampWeights(adjusted);
  adjusted = normalizeWeights(adjusted);

  // Safety guard: sum must be between 0.95 and 1.05 after normalization
  const total = Object.values(adjusted).reduce((a, b) => a + b, 0);
  if (total < 0.95 || total > 1.05) {
    console.warn("[genesis-learning] Weight normalization drift detected — reverting to current weights");
    return currentWeights;
  }

  return adjusted;
}
