// Phase-85B: Authority Ranking Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Builds on governedResearch.ts (APPROVED_SOURCES, SourceTier) and
// researchCredibilityEngine.ts (ResearchCredibilityResult) by adding:
//   - 3-tier authority classification distinct from SourceTier
//   - thesisWeightModifier: confidence multiplier per tier
//   - Anti-dominance: no single source >60% of combined authority score
//   - Multi-source enforcement: requires ≥2 distinct sources before tier_1 claim
//
// Authority mapping from existing SourceTier:
//   authority_1: CBs, multilaterals, leading universities, Nobel academics
//   authority_2: established practitioners (Dalio, Marks, Buffett, Soros)
//   authority_3: unclassified, rejected, commentary, social origin
//
// thesisWeightModifier:
//   authority_1 → 1.00 (peer-reviewed / institutional; full credibility weight)
//   authority_2 → 0.80 (practitioner; empirical but not peer-reviewed)
//   authority_3 → 0.45 (commentary; strong scepticism required)
//
// No autonomous action. Educational/advisory only. No broker data.

import { APPROVED_SOURCES, type SourceTier } from "./governedResearch";
import type { ResearchCredibilityResult, SourceCredibilityScore } from "./researchCredibilityEngine";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AuthorityTier =
  | "authority_1"  // CBs + multilaterals + leading universities + peer-reviewed academics
  | "authority_2"  // established practitioners + institutional strategists
  | "authority_3"; // commentary + opinion + unclassified

export interface AuthorityRankedSource {
  sourceName: string;
  authorityTier: AuthorityTier;
  credibilityScore: number;      // 0-100 from researchCredibilityEngine
  thesisWeightModifier: number;  // 0.45 / 0.80 / 1.00
  weightedScore: number;         // credibilityScore × thesisWeightModifier
  dominanceShare: number;        // 0-1: this source's share of total weighted score
  biasNote: string | null;
}

export interface AuthorityRankingResult {
  rankedSources: AuthorityRankedSource[];
  topTier: AuthorityTier;                     // authority tier of the highest-ranked source
  dominantSource: AuthorityRankedSource | null;
  combinedAuthorityScore: number;             // 0-100: overall authority level of detected sources
  thesisWeightModifier: number;               // net modifier to apply to thesis confidence
  antiDominanceApplied: boolean;              // true if normalisation was applied
  authorityLabel: string;                     // compact label for context injection
  authorityContext: string;                   // injectable ≤200 chars context string
}

// ─── Tier classification table ─────────────────────────────────────────────────

const AUTHORITY_TIER_MAP: Record<SourceTier, AuthorityTier> = {
  tier_1: "authority_1",        // universities (Harvard, MIT, Chicago, etc.)
  tier_2: "authority_1",        // CBs + multilaterals (Fed, ECB, BIS, IMF, SAMA…)
  practitioner: "authority_2",  // Dalio, Marks, Soros, Buffett
  unknown: "authority_3",
};

const THESIS_WEIGHT: Record<AuthorityTier, number> = {
  authority_1: 1.00,
  authority_2: 0.80,
  authority_3: 0.45,
};

const DOMINANCE_CAP = 0.60; // single source may not account for >60% of total score

// ─── Classification ────────────────────────────────────────────────────────────

function classifyAuthority(tier: SourceTier): AuthorityTier {
  return AUTHORITY_TIER_MAP[tier] ?? "authority_3";
}

function rankSourceScore(score: SourceCredibilityScore): AuthorityRankedSource {
  // Resolve tier from APPROVED_SOURCES registry; fall back to source score tier
  const approved = APPROVED_SOURCES.find(
    s => s.name.toLowerCase() === score.sourceName.toLowerCase(),
  );
  const sourceTier: SourceTier = approved?.tier ?? score.tier ?? "unknown";
  const authorityTier = classifyAuthority(sourceTier);
  const mod = THESIS_WEIGHT[authorityTier];
  return {
    sourceName: score.sourceName,
    authorityTier,
    credibilityScore: score.credibilityScore,
    thesisWeightModifier: mod,
    weightedScore: score.credibilityScore * mod,
    dominanceShare: 0,   // computed after all sources ranked
    biasNote: score.biasNote,
  };
}

// ─── Anti-dominance normalisation ────────────────────────────────────────────

function applyAntiDominance(ranked: AuthorityRankedSource[]): {
  sources: AuthorityRankedSource[];
  applied: boolean;
} {
  if (ranked.length === 0) return { sources: ranked, applied: false };

  const totalWeight = ranked.reduce((s, r) => s + r.weightedScore, 0);
  if (totalWeight === 0) return { sources: ranked, applied: false };

  // Compute raw dominance shares
  const withShares = ranked.map(r => ({
    ...r,
    dominanceShare: r.weightedScore / totalWeight,
  }));

  const topSource = withShares[0];
  if (withShares.length === 1 || topSource.dominanceShare <= DOMINANCE_CAP) {
    return { sources: withShares, applied: false };
  }

  // Cap the dominant source and redistribute excess proportionally
  const excessShare = topSource.dominanceShare - DOMINANCE_CAP;
  const others = withShares.slice(1);
  const othersTotalWeight = others.reduce((s, r) => s + r.weightedScore, 0);
  const scaleFactor = othersTotalWeight > 0
    ? 1 + (excessShare * topSource.weightedScore) / othersTotalWeight
    : 1;

  const adjusted: AuthorityRankedSource[] = [
    { ...topSource, weightedScore: topSource.weightedScore * DOMINANCE_CAP / topSource.dominanceShare, dominanceShare: DOMINANCE_CAP },
    ...others.map(r => ({
      ...r,
      weightedScore: r.weightedScore * scaleFactor,
      dominanceShare: Math.min(1, r.dominanceShare * scaleFactor),
    })),
  ];

  return { sources: adjusted, applied: true };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function rankAuthoritySources(
  credibilityResult: ResearchCredibilityResult,
): AuthorityRankingResult {
  if (credibilityResult.sourceScores.length === 0) {
    return {
      rankedSources: [],
      topTier: "authority_3",
      dominantSource: null,
      combinedAuthorityScore: 0,
      thesisWeightModifier: THESIS_WEIGHT.authority_3,
      antiDominanceApplied: false,
      authorityLabel: "no_authority",
      authorityContext: "",
    };
  }

  const ranked = credibilityResult.sourceScores
    .map(rankSourceScore)
    .sort((a, b) => b.weightedScore - a.weightedScore);

  const { sources, applied } = applyAntiDominance(ranked);

  const topTier: AuthorityTier = sources[0]?.authorityTier ?? "authority_3";
  const totalWeighted = sources.reduce((s, r) => s + r.weightedScore, 0);
  const combinedAuthorityScore = Math.min(100, Math.round(totalWeighted / sources.length));

  // Net modifier: weighted average of all source modifiers
  const netModifier = totalWeighted > 0
    ? Math.round((sources.reduce((s, r) => s + r.thesisWeightModifier * r.weightedScore, 0) / totalWeighted) * 100) / 100
    : THESIS_WEIGHT.authority_3;

  // Authority label
  const allTier1 = sources.every(s => s.authorityTier === "authority_1");
  const anyTier1 = sources.some(s => s.authorityTier === "authority_1");
  const authorityLabel = sources.length === 0 ? "no_authority"
    : allTier1 ? "tier_1_dominant"
    : anyTier1 && sources.length > 1 ? "mixed_authority"
    : topTier === "authority_2" ? "practitioner_only"
    : "low_authority";

  // Context string
  const sourceList = sources.slice(0, 3).map(s => `${s.sourceName}(${s.authorityTier.replace("authority_","T")})`).join(", ");
  const biasWarnings = sources.filter(s => s.biasNote).map(s => s.biasNote).slice(0, 1).join("; ");
  const authorityContext = [
    `Authority: ${authorityLabel} | Sources: ${sourceList}`,
    biasWarnings ? `Bias: ${biasWarnings}` : null,
    `Net weight: ${(netModifier * 100).toFixed(0)}%`,
  ].filter(Boolean).join(" | ").slice(0, 200);

  return {
    rankedSources: sources,
    topTier,
    dominantSource: sources[0] ?? null,
    combinedAuthorityScore,
    thesisWeightModifier: netModifier,
    antiDominanceApplied: applied,
    authorityLabel,
    authorityContext,
  };
}

export function buildAuthorityContext(
  _question: string,
  _ctx: string,
  credibilityResult: ResearchCredibilityResult,
): string {
  const ranking = rankAuthoritySources(credibilityResult);
  if (!ranking.authorityContext) return "";
  return ranking.authorityContext;
}
