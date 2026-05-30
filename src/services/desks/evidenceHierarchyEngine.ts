// Phase-89A: Evidence Hierarchy Engine
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Weights and assembles evidence from multiple research desks into a single
// governed synthesis context (≤400 chars) for prompt injection.
//
// Evidence hierarchy principle:
//   The desk with the highest conviction + routing weight contributes most
//   context chars. Secondary and tertiary desks contribute proportionally.
//
// Weight allocation per primaryDesk:
//   macro primary:   macro=58%, sector=22%, policy=20%
//   sector primary:  sector=55%, macro=28%, policy=17%
//   policy primary:  policy=55%, macro=28%, sector=17%
//   mixed:           equal weights among active desks
//
// Budget: total ≤400 chars.
// Minimum contribution per active desk: 60 chars (to avoid trivial fragments).
//
// evidenceConfidence: weighted average of desk convictions.
// dominantDesk: the desk contributing most chars.
//
// The synthesis context format:
//   "Research desks [{primary}→{secondary}→{tertiary}]: {primary briefing} | {secondary briefing} | {tertiary briefing}"
//
// No execution language. Educational/advisory only.

import type { MacroDeskBriefing }  from "./macroResearchDesk";
import type { SectorDeskBriefing } from "./sectorResearchDesk";
import type { PolicyDeskBriefing } from "./policyResearchDesk";
import type { DeskRoutingResult, ActiveDesk, PrimaryDesk } from "./researchRoutingGovernor";

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface EvidenceHierarchyResult {
  deskPriority:       ActiveDesk[];  // ordered highest → lowest evidence weight
  dominantDesk:       ActiveDesk;
  evidenceWeights:    Record<ActiveDesk, number>;  // share 0-100 (sum ≈ 100 across active)
  evidenceConfidence: number;         // 0-100 weighted average conviction
  synthesisContext:   string;         // ≤400 chars injectable
}

// ─── Weight tables ────────────────────────────────────────────────────────────

type WeightAlloc = Record<ActiveDesk, number>;  // percentages 0-100

const WEIGHT_TABLE: Record<PrimaryDesk, WeightAlloc> = {
  macro:   { macro: 58, sector: 22, policy: 20 },
  sector:  { macro: 28, sector: 55, policy: 17 },
  policy:  { macro: 28, sector: 17, policy: 55 },
  mixed:   { macro: 34, sector: 33, policy: 33 },
};

// ─── Evidence weight computation ──────────────────────────────────────────────

function computeEvidenceWeights(
  routing: DeskRoutingResult,
  macroConv:  number,
  sectorConv: number,
  policyConv: number,
): Record<ActiveDesk, number> {
  const base  = WEIGHT_TABLE[routing.primaryDesk];
  const total = routing.activeDesks.reduce((s, d) => s + base[d], 0);
  if (total === 0) return { macro: 34, sector: 33, policy: 33 };

  // Normalise to active desks only
  const result: Record<ActiveDesk, number> = { macro: 0, sector: 0, policy: 0 };
  for (const desk of routing.activeDesks) {
    result[desk] = Math.round((base[desk] / total) * 100);
  }

  // Blend with conviction (30% conviction, 70% route weight)
  const convMap: Record<ActiveDesk, number> = { macro: macroConv, sector: sectorConv, policy: policyConv };
  for (const desk of routing.activeDesks) {
    result[desk] = Math.round(result[desk] * 0.70 + convMap[desk] * 0.30);
  }

  return result;
}

// ─── Context assembly ─────────────────────────────────────────────────────────

function trimTo(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 3) + "...";
}

function charBudgetForDesk(
  desk: ActiveDesk,
  weights: Record<ActiveDesk, number>,
  activeDesks: ActiveDesk[],
  totalBudget: number,
  minChars: number,
): number {
  const weightTotal = activeDesks.reduce((s, d) => s + (weights[d] ?? 0), 0);
  if (weightTotal === 0) return Math.floor(totalBudget / activeDesks.length);
  const raw = Math.floor((weights[desk] / weightTotal) * totalBudget);
  return Math.max(minChars, raw);
}

function assembleContext(
  ordered: ActiveDesk[],
  weights: Record<ActiveDesk, number>,
  macroBriefing:  MacroDeskBriefing,
  sectorBriefing: SectorDeskBriefing,
  policyBriefing: PolicyDeskBriefing,
  routing: DeskRoutingResult,
  totalBudget: number,
): string {
  const briefingMap: Record<ActiveDesk, string> = {
    macro:  macroBriefing.isActive  ? macroBriefing.deskBriefing  : "",
    sector: sectorBriefing.isActive ? sectorBriefing.deskBriefing : "",
    policy: policyBriefing.isActive ? policyBriefing.deskBriefing : "",
  };

  const headerOverhead = 30; // "Research desks [x→y]: " prefix
  const perSepOverhead = 3;  // " | " between pieces
  const contentBudget  = totalBudget - headerOverhead - (ordered.length - 1) * perSepOverhead;

  const parts: string[] = [];
  let usedBudget = 0;

  for (let i = 0; i < ordered.length; i++) {
    const desk = ordered[i];
    const briefing = briefingMap[desk];
    if (!briefing || briefing.length < 10) continue;

    const remaining  = contentBudget - usedBudget;
    const deskBudget = i === ordered.length - 1
      ? remaining
      : charBudgetForDesk(desk, weights, ordered, contentBudget, 60);

    const trimmed = trimTo(briefing, Math.max(60, deskBudget));
    if (trimmed.length < 20) continue;
    parts.push(trimmed);
    usedBudget += trimmed.length;
  }

  if (parts.length === 0) return "";

  const deskLabel = routing.activeDesks.slice(0, 3).join("→");
  return `Research desks [${deskLabel}]: ${parts.join(" | ")}`.slice(0, totalBudget);
}

// ─── Evidence confidence ──────────────────────────────────────────────────────

function computeEvidenceConfidence(
  ordered: ActiveDesk[],
  weights: Record<ActiveDesk, number>,
  convMap: Record<ActiveDesk, number>,
): number {
  const totalWeight = ordered.reduce((s, d) => s + (weights[d] ?? 0), 0);
  if (totalWeight === 0) return 50;
  const weighted = ordered.reduce((s, d) => s + (convMap[d] ?? 0) * (weights[d] ?? 0), 0);
  return Math.min(95, Math.round(weighted / totalWeight));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildEvidenceHierarchy(input: {
  routing:        DeskRoutingResult;
  macroBriefing:  MacroDeskBriefing;
  sectorBriefing: SectorDeskBriefing;
  policyBriefing: PolicyDeskBriefing;
  totalBudget?:   number;  // default 400
}): EvidenceHierarchyResult {
  const { routing, macroBriefing, sectorBriefing, policyBriefing, totalBudget = 400 } = input;

  const convMap: Record<ActiveDesk, number> = {
    macro:  macroBriefing.deskConviction,
    sector: sectorBriefing.deskConviction,
    policy: policyBriefing.deskConviction,
  };

  const evidenceWeights = computeEvidenceWeights(
    routing, convMap.macro, convMap.sector, convMap.policy,
  );

  // Order active desks by evidence weight descending
  const ordered: ActiveDesk[] = (routing.activeDesks.length > 0 ? routing.activeDesks : ["macro"])
    .sort((a, b) => (evidenceWeights[b] ?? 0) - (evidenceWeights[a] ?? 0));

  const dominantDesk     = ordered[0] ?? "macro";
  const evidenceConfidence = computeEvidenceConfidence(ordered, evidenceWeights, convMap);
  const synthesisContext = assembleContext(
    ordered, evidenceWeights,
    macroBriefing, sectorBriefing, policyBriefing,
    routing, totalBudget,
  );

  return {
    deskPriority:       ordered,
    dominantDesk,
    evidenceWeights,
    evidenceConfidence,
    synthesisContext,
  };
}
