// Phase-70 Part-3: Provider & Latency Optimization
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Analyzes the efficiency of the Genesis provider/routing configuration from
// observable reply metadata. Produces a provider state classification and
// efficiency recommendations.
//
// Provider states:
//   efficient          — quality tier matches routing depth; minimal waste
//   optimal            — institutional/strong quality with appropriate track count
//   retry_heavy        — fallback routing active; primary provider failed
//   provider_imbalanced — expensive deep routing used without quality improvement
//   over_calling        — deep mode used for questions that don't warrant it
//   cost_efficient      — express mode delivering acceptable+ quality (good)
//
// Design rules:
// - Advisory only; no routing authority, no provider switching
// - O(1), deterministic, bounded
// - No AI calls, no execution

import type { QualityTier } from "./qualityHarness";
import type { ReasoningDepth } from "./reasoningCalibration";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ProviderState =
  | "optimal"             // quality and routing depth are well-matched
  | "efficient"           // reasonable quality/cost ratio
  | "retry_heavy"         // fallback path active; primary provider degraded
  | "provider_imbalanced" // deep mode + many tracks but weak output quality
  | "over_calling"        // deep mode for question that didn't need it
  | "cost_efficient";     // express/fast mode achieving acceptable+ quality

export interface ProviderOptimizationResult {
  providerState: ProviderState;
  tracksUsed: number;
  isExpress: boolean;
  isFallback: boolean;
  qualityPerCallRatio: number;      // qualityScore / tracksUsed (higher = more efficient)
  efficiencyRecommendations: string[];
  providerNote: string;             // 1 sentence summary
}

// ─── State derivation ─────────────────────────────────────────────────────────

function deriveProviderState(
  qualityTier: QualityTier | undefined,
  reasoningDepth: ReasoningDepth | undefined,
  tracksUsed: number,
  isExpress: boolean,
  isFallback: boolean,
  qualityScore: number,
): ProviderState {
  const tier = qualityTier ?? "weak";

  // Fallback active → retry_heavy regardless of quality
  if (isFallback) return "retry_heavy";

  // Express mode + acceptable+ quality → cost_efficient (good outcome)
  if (isExpress && (tier === "institutional" || tier === "strong" || tier === "acceptable")) {
    return "cost_efficient";
  }

  // Deep mode (6 tracks) + weak/acceptable quality → provider_imbalanced
  if (tracksUsed >= 5 && (tier === "weak" || (tier === "acceptable" && (reasoningDepth === "shallow" || reasoningDepth === "insufficient")))) {
    return "provider_imbalanced";
  }

  // Deep mode for a question that could have used express
  if (tracksUsed >= 5 && tier === "strong" && isExpress === false) {
    // This is fine — deep mode for strong quality is appropriate
    return "optimal";
  }

  // Institutional quality with any reasonable track count → optimal
  if (tier === "institutional" && tracksUsed >= 3) return "optimal";

  // Good quality/cost ratio
  if (tier === "strong" && tracksUsed <= 4) return "efficient";
  if (tier === "acceptable" && tracksUsed <= 3) return "efficient";

  // Express mode with weak quality — not a provider issue, a quality issue
  if (isExpress && tier === "weak") return "efficient"; // express is cheap, quality needs enrichment

  return "efficient";
}

// ─── Quality-per-call ratio ───────────────────────────────────────────────────

function computeQualityPerCallRatio(qualityScore: number, tracksUsed: number): number {
  // Each track is ~1 API call. Fusion adds 1 more. Express has fewer tracks.
  const estimatedCalls = Math.max(1, tracksUsed + 1);
  return Math.round((qualityScore / estimatedCalls) * 10) / 10;
}

// ─── Efficiency recommendations ───────────────────────────────────────────────

function buildEfficiencyRecommendations(
  state: ProviderState,
  qualityTier: QualityTier | undefined,
  tracksUsed: number,
  isExpress: boolean,
  isFallback: boolean,
  qualityPerCallRatio: number,
): string[] {
  const recs: string[] = [];
  const tier = qualityTier ?? "weak";

  switch (state) {
    case "retry_heavy":
      recs.push("Primary provider in fallback mode — check GEMINI_API_KEY quota and rate limits. OpenAI emergency fallback consuming tokens.");
      recs.push("Consider: raise Gemini RPM limit or add LOVABLE_API_KEY as primary alternative.");
      break;
    case "provider_imbalanced":
      recs.push(`Deep mode (${tracksUsed} tracks) used but quality is ${tier}. Check if track outputs are timing out (reducing effective signal). Consider: add 2s to track timeout.`);
      recs.push("If tracks succeed but fusion output is weak, the investmentEnforcement directive may be truncated by context window. Review maxTokens setting.");
      break;
    case "over_calling":
      recs.push("Deep mode used for a non-investment question — express mode would deliver similar quality at lower cost.");
      break;
    case "cost_efficient":
      // Express mode achieving acceptable+ quality — no action needed
      if (tier === "acceptable" && !isExpress)
        recs.push("Acceptable quality with deep routing — brief mode could achieve similar results at lower latency.");
      break;
    case "optimal":
      break;
    case "efficient":
      if (tier === "acceptable" && tracksUsed >= 4)
        recs.push(`Quality/cost ratio ${qualityPerCallRatio}/point-per-call is moderate. Enrichment post-processing may improve tier without additional API calls.`);
      break;
  }

  if (!isFallback && tier === "weak" && !isExpress)
    recs.push("Weak quality on deep-mode call — enrichReplyFromTracks() should have triggered. Verify investment intent detection covers this question type.");

  return recs.slice(0, 3);
}

// ─── Provider note ────────────────────────────────────────────────────────────

function buildProviderNote(
  state: ProviderState,
  tier: QualityTier | undefined,
  tracksUsed: number,
  qualityPerCallRatio: number,
  isFallback: boolean,
): string {
  const t = tier ?? "weak";
  switch (state) {
    case "optimal":
      return `Optimal: ${t} quality from ${tracksUsed} tracks (${qualityPerCallRatio} pts/call); provider routing is well-matched.`;
    case "efficient":
      return `Efficient: ${t} quality from ${tracksUsed} tracks (${qualityPerCallRatio} pts/call); minor tuning available.`;
    case "retry_heavy":
      return `Fallback active: primary provider failed; OpenAI recovery used. Check API quota and rate limits.`;
    case "provider_imbalanced":
      return `Imbalanced: ${tracksUsed} tracks consumed but quality is ${t} — provider overhead not converting to output quality.`;
    case "over_calling":
      return `Over-calling: deep mode used without quality justification; express mode would be more cost-efficient.`;
    case "cost_efficient":
      return `Cost-efficient: ${t} quality achieved with minimal provider overhead (${tracksUsed} tracks, ${qualityPerCallRatio} pts/call).`;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function assessProviderOptimization(input: {
  qualityTier: QualityTier | undefined;
  qualityScore: number;
  reasoningDepth: ReasoningDepth | undefined;
  tracksUsed: number;
  isExpress: boolean;
  routingMode: string;
}): ProviderOptimizationResult {
  const { qualityTier, qualityScore, reasoningDepth, tracksUsed, isExpress, routingMode } = input;
  const isFallback = routingMode === "fallback";
  const qualityPerCallRatio = computeQualityPerCallRatio(qualityScore, tracksUsed);
  const providerState = deriveProviderState(qualityTier, reasoningDepth, tracksUsed, isExpress, isFallback, qualityScore);
  const efficiencyRecommendations = buildEfficiencyRecommendations(
    providerState, qualityTier, tracksUsed, isExpress, isFallback, qualityPerCallRatio,
  );
  const providerNote = buildProviderNote(providerState, qualityTier, tracksUsed, qualityPerCallRatio, isFallback);

  return { providerState, tracksUsed, isExpress, isFallback, qualityPerCallRatio, efficiencyRecommendations, providerNote };
}
