// Phase-88A: Opportunity Cost Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// DISTINCT FROM existing allocation modules:
//   allocationIntelligence.ts (Phase-68): broad/selective/defensive allocation frames
//   allocatorDecisionEngine.ts (Phase-83B): stance + conviction %
//
// This module adds explicit OPPORTUNITY COST reasoning:
//   "If you deploy here instead of there, what do you give up?"
//   "What does persistent inaction cost over this horizon?"
//
// Institutional allocators always frame decisions in terms of foregone return —
// not just absolute risk, but relative attractiveness vs alternatives.
//
// Three cost axes:
//   1. Deployment vs cash: cost of staying in cash (yield drag vs expected return)
//   2. Asset class rotation: what you give up by holding current over alternative
//   3. Timing cost: early vs late vs never — regime-specific opportunity windows
//
// Saudi-specific: oil-fiscal surplus period has a time window — capturing TASI
// upside during surplus requires deployment during the window; waiting forfeits it.
//
// Educational/advisory only. No autonomous execution. No broker data.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type OpportunityCostSeverity =
  | "high"    // significant foregone return potential; waiting is costly
  | "moderate"// meaningful but not urgent; some foregone return
  | "low"     // small opportunity cost; patience is justified
  | "negligible"; // conditions don't favor deployment; cost of action > inaction

export interface OpportunityCostAnalysis {
  severity:            OpportunityCostSeverity;
  deploymentVsCash:    string;  // ≤100 chars: cost of staying in cash
  rotationCost:        string;  // ≤100 chars: cost of holding wrong asset class
  timingWindow:        string;  // ≤100 chars: how long does this opportunity persist?
  costOfInaction:      string;  // ≤100 chars: cumulative cost of not acting
  opportunityContext:  string;  // injectable ≤220 chars
}

// ─── Severity scoring ─────────────────────────────────────────────────────────

interface OppCostInput {
  regime:         string;
  macroBias:      "bullish" | "bearish" | "neutral";
  creditStress:   "low" | "moderate" | "high" | "extreme";
  stance:         string;  // from AllocatorDecision
  isSaudi:        boolean;
  oilFiscalSup:   boolean | null;
  regimeConf:     number;  // 0-100
  question:       string;
}

function deriveSeverity(input: OppCostInput): OpportunityCostSeverity {
  const { macroBias, creditStress, stance, regimeConf } = input;

  if (creditStress === "high" || creditStress === "extreme") return "low";
  if (stance.includes("avoid")) return "negligible";
  if (stance.includes("wait") && regimeConf < 50)  return "low";

  if (macroBias === "bullish" && creditStress === "low" && regimeConf >= 65) return "high";
  if (macroBias === "bullish" && regimeConf >= 50) return "moderate";
  if (macroBias === "neutral" && creditStress === "low") return "low";

  return "moderate";
}

// ─── Cash drag reasoning ──────────────────────────────────────────────────────

const CASH_DRAG_STATEMENTS: Record<OpportunityCostSeverity, string> = {
  high:       "Holding cash in a bullish regime forfeits index returns; cash drag compounds over time.",
  moderate:   "Cash position earns yield but may underperform risk assets if regime holds.",
  low:        "Cash earns near risk-free rate; opportunity cost is limited while clarity is low.",
  negligible: "Cash is the preferred asset; deploying into adverse conditions is the higher cost.",
};

// ─── Rotation cost reasoning ──────────────────────────────────────────────────

const ROTATION_COST: Record<string, string> = {
  bullish_low:     "Staying in bonds while equities rally forfeits beta; underallocation is permanent foregone return.",
  bullish_moderate:"Defensives lag in a risk-on regime; quality growth names outperform over 6-12m.",
  bearish_moderate:"Holding cyclicals in a bear regime forfeits defensive premium; rotate to quality.",
  bearish_high:    "Holding risk assets in stress regime forfeits capital; downside cost exceeds upside.",
  neutral_low:     "Balanced allocation between growth and value avoids regret risk in either direction.",
  neutral_moderate:"Mixed signals make rotation premature; hold current weights until clarity.",
};

function getRotationKey(macroBias: string, creditStress: string): string {
  return `${macroBias}_${creditStress}`;
}

// ─── Timing window reasoning ─────────────────────────────────────────────────

const TIMING_WINDOWS: Partial<Record<string, string>> = {
  bullish_low:      "Constructive regime: deployment window is open; typically 6-18m duration.",
  bullish_moderate: "Constructive but uncertain: 3-9m window; stage in tranches.",
  bearish_any:      "Adverse regime: no deployment window; wait for credit improvement.",
  neutral_low:      "Neutral with low stress: limited window; selective quality names only.",
  neutral_high:     "Stress conditions: window closed; preserve for next cycle entry.",
  saudi_surplus:    "Saudi fiscal surplus window: deployment during surplus period captures 2030 capex tailwind.",
};

function getTimingWindow(macroBias: string, creditStress: string, isSaudi: boolean, oilFiscalSup?: boolean | null): string {
  if (isSaudi && oilFiscalSup === true) return TIMING_WINDOWS.saudi_surplus ?? "";
  if (macroBias === "bearish") return TIMING_WINDOWS.bearish_any ?? "";
  const key = `${macroBias}_${creditStress}`;
  return TIMING_WINDOWS[key] ?? "Window duration unclear; regime monitoring required.";
}

// ─── Cost of inaction ─────────────────────────────────────────────────────────

const INACTION_COST_MAP: Record<OpportunityCostSeverity, string> = {
  high:       "Every quarter of underdeployment in a constructive regime compounds into meaningful return gap vs benchmark.",
  moderate:   "Waiting 1-2 quarters has manageable cost; waiting 4+ quarters risks missing the core of the move.",
  low:        "Patience has low cost; forced deployment into unclear conditions is more costly than waiting.",
  negligible: "Inaction is the lowest-cost path; deploying in adverse conditions would incur larger loss than foregone gain.",
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildOpportunityCostAnalysis(
  regime: string,
  macroBias: "bullish" | "bearish" | "neutral",
  creditStress: "low" | "moderate" | "high" | "extreme",
  allocatorStance: string,
  regimeConf: number,
  isSaudi: boolean,
  question: string,
  oilPrice?: number | null,
): OpportunityCostAnalysis {
  const oilFiscalSup = oilPrice !== null && oilPrice !== undefined
    ? oilPrice >= 78 : null;

  const input: OppCostInput = {
    regime, macroBias, creditStress, stance: allocatorStance,
    isSaudi, oilFiscalSup, regimeConf, question,
  };

  const severity      = deriveSeverity(input);
  const deployVsCash  = CASH_DRAG_STATEMENTS[severity];
  const rotationKey   = getRotationKey(macroBias, creditStress === "extreme" ? "high" : creditStress);
  const rotationCost  = ROTATION_COST[rotationKey] ?? "Asset rotation cost depends on regime clarification.";
  const timingWindow  = getTimingWindow(macroBias, creditStress, isSaudi, oilFiscalSup);
  const costOfInaction = INACTION_COST_MAP[severity];

  const opportunityContext = [
    `Opportunity cost [${severity}]:`,
    deployVsCash.slice(0, 90),
    `Timing: ${timingWindow.slice(0, 80)}`,
  ].join(" | ").slice(0, 220);

  return {
    severity,
    deploymentVsCash:   deployVsCash,
    rotationCost,
    timingWindow,
    costOfInaction,
    opportunityContext,
  };
}
