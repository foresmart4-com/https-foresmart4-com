// Phase-70 Part-1+4: Adaptive Intelligence Optimization + Coherence Audit
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Part 1 — Optimization state:
//   Analyzes the Genesis pipeline's efficiency from reply signals to determine
//   whether it is running optimally, over-recovering, under-escalating, etc.
//   Produces tuning recommendations for the operation team.
//
// Part 4 — Institutional coherence audit:
//   For each intelligence layer (Phases 63-69), checks whether its characteristic
//   output is present in the reply. Returns a per-layer influence map:
//   influencing | partial | silent
//   Silent layers indicate a disconnected/unused context injection.
//
// Optimization states:
//   optimal          — quality is institutional/strong with minimal enrichment
//   balanced         — reasonable quality/efficiency trade-off
//   retry_heavy      — enrichment triggered too often; recovery path overloaded
//   shallow_sensitive — reasoningDepth repeatedly shallow; calibration threshold too low
//   over_recovery    — enrichment ran on replies that were already strong
//   under_escalated  — weak quality but enrichment was not triggered
//
// Design rules:
// - Observation only; no autonomous remediation
// - O(1), deterministic, bounded
// - No routing authority, no provider switching

import type { GenesisReply } from "@/lib/genesis.functions";
import type { QualityTier } from "./qualityHarness";
import type { InvestmentQualityState } from "./qualityGate";
import type { ReasoningDepth } from "./reasoningCalibration";
import type { ConsistencyState } from "./consistencyEngine";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type OptimizationState =
  | "optimal"          // institutional/strong quality; no unnecessary enrichment
  | "balanced"         // acceptable quality/efficiency; minor gaps
  | "retry_heavy"      // enrichment/recovery triggered too frequently
  | "shallow_sensitive"// reasoningDepth is shallow; calibration threshold too aggressive
  | "over_recovery"    // enrichment ran but reply was already at strong/institutional
  | "under_escalated"; // weak quality but no enrichment was triggered

export type LayerInfluence = "influencing" | "partial" | "silent";

export interface LayerAudit {
  layer: string;
  phase: string;
  influence: LayerInfluence;
  signal: string; // what was checked
}

export interface AdaptiveOptimizationResult {
  optimizationState: OptimizationState;
  layerAudit: LayerAudit[];
  silentLayers: string[];         // layer names with no detected influence
  tuningRecommendations: string[]; // specific, actionable tuning suggestions
  efficiencyNote: string;          // 1 sentence overall efficiency assessment
}

// ─── Optimization state derivation ────────────────────────────────────────────

export function deriveOptimizationState(
  qualityTier: QualityTier | undefined,
  reasoningDepth: ReasoningDepth | undefined,
  qualityGateState: InvestmentQualityState,
  consistencyState: ConsistencyState,
  tracksUsed: number,
  isExpress: boolean,
): OptimizationState {
  const tier = qualityTier ?? "weak";
  const depth = reasoningDepth ?? "shallow";
  const wasEnriched = qualityGateState === "rejected_shallow" || qualityGateState === "missing_required_fields" || qualityGateState === "shallow_but_usable";

  // Over-recovery: enrichment ran but reply was already strong
  if (wasEnriched && (tier === "institutional" || tier === "strong")) return "over_recovery";

  // Under-escalated: weak quality but enrichment not triggered
  if (!wasEnriched && tier === "weak" && depth === "shallow") return "under_escalated";

  // Optimal: strong quality, reasonable track usage, no enrichment needed
  if (tier === "institutional" && !wasEnriched && tracksUsed >= 3) return "optimal";
  if (tier === "strong" && !wasEnriched && consistencyState === "stable") return "optimal";

  // Retry heavy: enrichment active + consistency still unstable (recovering from systemic issue)
  if (wasEnriched && consistencyState === "unstable_generation") return "retry_heavy";

  // Shallow sensitive: depth is shallow even after enrichment
  if (wasEnriched && depth === "shallow") return "shallow_sensitive";

  // Balanced: everything else
  return "balanced";
}

// ─── Tuning recommendations ───────────────────────────────────────────────────

function buildTuningRecommendations(
  state: OptimizationState,
  silentLayers: string[],
  qualityTier: QualityTier | undefined,
  tracksUsed: number,
  isExpress: boolean,
): string[] {
  const recs: string[] = [];

  switch (state) {
    case "over_recovery":
      recs.push("Quality gate threshold may be too aggressive — enrichment triggered on already-strong replies. Consider raising the 'shallow_but_usable' threshold.");
      break;
    case "under_escalated":
      recs.push("Weak quality reply passed without enrichment — check qualityGate.ts investment intent detection for this question type.");
      break;
    case "retry_heavy":
      recs.push("Enrichment + consistency repair both active — reply had structural issues after enrichment. Check if track data is populated (tracksUsed > 0).");
      if (tracksUsed < 2) recs.push("Low track count — consider expanding track timeout from 8s to 10s for investment questions.");
      break;
    case "shallow_sensitive":
      recs.push("Reasoning depth remains shallow after enrichment — macroChain injection may not be reaching the AI prompt. Verify investmentEnforcement directive is injected before fusionDirective.");
      break;
    case "optimal":
      break;
    case "balanced":
      if ((qualityTier === "acceptable" || qualityTier === "weak") && tracksUsed < 4)
        recs.push("Express mode (fewer tracks) used for investment question — consider routing to deep mode for investment intent.");
      if (isExpress)
        recs.push("Brief mode active — detailed mode produces stronger reasoning depth for investment questions.");
      break;
  }

  if (silentLayers.length > 0) {
    recs.push(`Silent intelligence layers detected: [${silentLayers.join(", ")}] — these modules injected context but left no footprint in the reply.`);
  }
  if (silentLayers.includes("Sector Intelligence (64)"))
    recs.push("sectorLens absent — check that buildSectorIntelligenceContext() is triggered for this question type.");
  if (silentLayers.includes("Committee Debate (65)"))
    recs.push("committeeStance/selectionFramework absent — check isCompanySelectionQuestion() pattern match for this question.");

  return recs.slice(0, 4);
}

// ─── Layer coherence audit ─────────────────────────────────────────────────────
// Checks whether each intelligence layer left its characteristic footprint on the reply.

export function auditLayerInfluence(reply: GenesisReply): LayerAudit[] {
  const audits: LayerAudit[] = [];

  // Phase 63: Institutional Reasoning Hardening
  audits.push({
    layer: "Institutional Reasoning (63)", phase: "63",
    influence: (reply.macroChain && reply.bullCase && reply.bearCase) ? "influencing"
      : (reply.macroChain || reply.bullCase) ? "partial" : "silent",
    signal: "macroChain, bullCase, bearCase",
  });

  // Phase 64: Sector Intelligence
  audits.push({
    layer: "Sector Intelligence (64)", phase: "64",
    influence: reply.sectorLens ? "influencing" : "silent",
    signal: "sectorLens",
  });

  // Phase 65: Committee Debate
  audits.push({
    layer: "Committee Debate (65)", phase: "65",
    influence: (reply.selectionFramework && reply.committeeStance) ? "influencing"
      : (reply.selectionFramework || reply.committeeStance || reply.committeeBullCase) ? "partial"
      : "silent",
    signal: "selectionFramework, committeeStance",
  });

  // Phase 66: Reasoning Calibration
  audits.push({
    layer: "Reasoning Calibration (66)", phase: "66",
    influence: (reply.reasoningDepth !== undefined && reply.evidenceStrength !== undefined) ? "influencing"
      : reply.reasoningDepth !== undefined ? "partial" : "silent",
    signal: "reasoningDepth, evidenceStrength",
  });

  // Phase 67: Cross-Market Fusion
  audits.push({
    layer: "Cross-Market Fusion (67)", phase: "67",
    influence: (reply.crossAssetConfirmation && reply.trackViewCrossAsset) ? "influencing"
      : (reply.crossAssetConfirmation || reply.trackViewMacro) ? "partial" : "silent",
    signal: "crossAssetConfirmation, trackViewCrossAsset",
  });

  // Phase 68: Allocation Intelligence
  audits.push({
    layer: "Allocation Intelligence (68)", phase: "68",
    influence: reply.selectionFramework ? "influencing"
      : /broad|selective|allocation|defensive.*framework/i.test(
          [reply.outlook, reply.baseCase, reply.sectorLens].filter(Boolean).join(" ")) ? "partial"
      : "silent",
    signal: "selectionFramework / allocation framing in outlook",
  });

  // Phase 69: Quality Harness
  audits.push({
    layer: "Quality Harness (69)", phase: "69",
    influence: reply.qualityTier !== undefined ? "influencing" : "silent",
    signal: "qualityTier, qualityScore",
  });

  // Core multi-agent tracks (A-F)
  audits.push({
    layer: "Multi-Agent Tracks (A-F)", phase: "12+",
    influence: (reply.trackViewMacro && reply.trackViewTechnical && reply.trackViewRisk) ? "influencing"
      : (reply.trackViewMacro || reply.arbitrationReason) ? "partial" : "silent",
    signal: "trackViewMacro, trackViewTechnical, arbitrationReason",
  });

  // Governance (disclaimer, no execution language)
  const hasDisclaimer = (reply.disclaimer?.length ?? 0) > 10;
  const noExecution = !/buy now|sell now|execute|rebalance now/i.test(
    [reply.headline, reply.outlook, reply.thesis].filter(Boolean).join(" "));
  audits.push({
    layer: "Governance Safety", phase: "core",
    influence: hasDisclaimer && noExecution ? "influencing" : "partial",
    signal: "disclaimer present, no execution language",
  });

  // Investment Synthesis (Phase 62)
  audits.push({
    layer: "Investment Synthesis (62)", phase: "62",
    influence: (reply.regime && reply.thesis && (reply.evidence?.length ?? 0) >= 2) ? "influencing"
      : (reply.regime || reply.thesis) ? "partial" : "silent",
    signal: "regime, thesis, evidence",
  });

  return audits;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function assessAdaptiveOptimization(
  reply: GenesisReply,
  qualityGateState: InvestmentQualityState,
  consistencyState: ConsistencyState,
  tracksUsed: number,
  isExpress: boolean,
): AdaptiveOptimizationResult {
  const qualityTier = reply.qualityTier;
  const reasoningDepth = reply.reasoningDepth;

  const optimizationState = deriveOptimizationState(
    qualityTier, reasoningDepth, qualityGateState, consistencyState, tracksUsed, isExpress,
  );

  const layerAudit = auditLayerInfluence(reply);
  const silentLayers = layerAudit.filter(a => a.influence === "silent").map(a => a.layer);

  const tuningRecommendations = buildTuningRecommendations(
    optimizationState, silentLayers, qualityTier, tracksUsed, isExpress,
  );

  const efficiencyNote = (() => {
    const tier = qualityTier ?? "weak";
    const silent = silentLayers.length;
    switch (optimizationState) {
      case "optimal": return `Optimal: ${tier} quality with ${tracksUsed} tracks; ${silent} silent layer(s).`;
      case "balanced": return `Balanced: ${tier} quality with ${tracksUsed} tracks; ${silent} silent layer(s); minor tuning available.`;
      case "over_recovery": return `Over-recovery: enrichment triggered on ${tier} reply; threshold may be too aggressive.`;
      case "under_escalated": return `Under-escalated: ${tier} quality without enrichment trigger; detection gap possible.`;
      case "retry_heavy": return `Retry-heavy: enrichment + consistency repair both active; structural issue in reply generation.`;
      case "shallow_sensitive": return `Shallow-sensitive: depth remains shallow after enrichment; context injection may not be reaching the model.`;
    }
  })();

  return { optimizationState, layerAudit, silentLayers, tuningRecommendations, efficiencyNote };
}
