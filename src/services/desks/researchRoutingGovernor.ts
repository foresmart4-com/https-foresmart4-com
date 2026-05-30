// Phase-89A: Research Routing Governor
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Routes each investment question to the appropriate research desk(s).
// Uses per-desk relevance scores from each desk's internal scorer to
// determine the primary desk and active secondary desks.
//
// Routing logic:
//   1. Score each desk independently using its domain keyword scoring function
//   2. Primary desk = highest scoring desk (≥35 conviction threshold)
//   3. Secondary desks = all desks with conviction ≥ 25 (excluding primary)
//   4. If two desks score within 10pts of each other → primary = "mixed"
//   5. If no desk scores ≥ 35 → route to macro (safest default)
//
// primaryDesk = "mixed" when:
//   - Two or more desks within 10pts of each other AND both ≥ 35
//   - OR question explicitly combines macro + sector + policy signals
//
// Conviction weights are passed from the routing governor to the evidence
// hierarchy engine for final assembly weighting.
//
// No execution language. Educational/advisory only.

import { scoreMacroRelevance }  from "./macroResearchDesk";
import { scoreSectorRelevance } from "./sectorResearchDesk";
import { scorePolicyRelevance } from "./policyResearchDesk";

// ─── Types ───────────────────────────────────────────────────────────────────────

export type ActiveDesk   = "macro" | "sector" | "policy";
export type PrimaryDesk  = ActiveDesk | "mixed";

export interface DeskRoutingResult {
  primaryDesk:       PrimaryDesk;
  activeDesks:       ActiveDesk[];
  convictionWeights: Record<ActiveDesk, number>;  // 0-100 each
  routingConfidence: number;   // 0-100: confidence in routing decision
  routingRationale:  string;   // ≤60 chars: why this routing
}

// ─── Mixed question detector ──────────────────────────────────────────────────

const MIXED_EXPLICIT_PATTERN = /\b(cross.*sector|macro.*sector|policy.*sector|sector.*policy|rates.*sector|oil.*bank|aramco.*bank|fiscal.*bank|fiscal.*energy)\b/i;

// ─── Routing logic ─────────────────────────────────────────────────────────────

function classifyPrimary(
  macroScore: number,
  sectorScore: number,
  policyScore: number,
  question: string,
  ctx: string,
): { primary: PrimaryDesk; rationale: string } {
  const text = `${question} ${ctx}`;
  const THRESHOLD = 35;

  // Explicit mixed signal
  if (MIXED_EXPLICIT_PATTERN.test(text)) {
    return { primary: "mixed", rationale: "Multi-desk signals detected explicitly" };
  }

  const top2Spread = Math.abs(
    Math.max(macroScore, sectorScore, policyScore) -
    [macroScore, sectorScore, policyScore].sort((a, b) => b - a)[1]
  );

  // Two top desks within 10pts → mixed
  const topScore = Math.max(macroScore, sectorScore, policyScore);
  if (topScore >= THRESHOLD && top2Spread <= 10) {
    return { primary: "mixed", rationale: `Top 2 desks within ${top2Spread}pts — mixed routing` };
  }

  if (topScore < THRESHOLD) {
    return { primary: "macro", rationale: "No dominant desk signal — default to macro" };
  }

  if (topScore === macroScore)  return { primary: "macro",  rationale: `Macro desk leads (score=${macroScore})` };
  if (topScore === sectorScore) return { primary: "sector", rationale: `Sector desk leads (score=${sectorScore})` };
  return { primary: "policy", rationale: `Policy desk leads (score=${policyScore})` };
}

function buildActiveDesks(
  macroScore: number,
  sectorScore: number,
  policyScore: number,
): ActiveDesk[] {
  const desks: { id: ActiveDesk; score: number }[] = [
    { id: "macro",  score: macroScore  },
    { id: "sector", score: sectorScore },
    { id: "policy", score: policyScore },
  ];
  return desks.filter(d => d.score >= 25).sort((a, b) => b.score - a.score).map(d => d.id);
}

function computeRoutingConfidence(
  primary: PrimaryDesk,
  macroScore: number,
  sectorScore: number,
  policyScore: number,
): number {
  const topScore = Math.max(macroScore, sectorScore, policyScore);
  // Mixed routing: multi-desk signal is itself a signal of question richness; +3 bonus
  if (primary === "mixed") return Math.min(80, topScore + 3);
  return Math.min(95, topScore + 5);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function routeToDesks(input: {
  question: string;
  ctx:      string;
}): DeskRoutingResult {
  const { question, ctx } = input;

  const macroScore  = scoreMacroRelevance(question, ctx);
  const sectorScore = scoreSectorRelevance(question, ctx);
  const policyScore = scorePolicyRelevance(question, ctx);

  const { primary, rationale } = classifyPrimary(macroScore, sectorScore, policyScore, question, ctx);
  const activeDesks = buildActiveDesks(macroScore, sectorScore, policyScore);
  const routingConfidence = computeRoutingConfidence(primary, macroScore, sectorScore, policyScore);

  return {
    primaryDesk:       primary,
    activeDesks:       activeDesks.length > 0 ? activeDesks : ["macro"], // always have at least one
    convictionWeights: { macro: macroScore, sector: sectorScore, policy: policyScore },
    routingConfidence,
    routingRationale:  rationale.slice(0, 60),
  };
}
