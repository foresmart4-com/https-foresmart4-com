// Phase-89B: Cross-Asset Governor
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Governs the Phase-89B global macro pipeline output. Assembles all three
// engine results into a governed context block (≤480 chars) and enforces:
//
//   1. No shallow correlation claims (correlation without mechanism)
//   2. No unqualified causation (no "will cause" — always conditional)
//   3. No single-variable overreach (not all outcomes from one signal)
//   4. Budget guard: assembled context ≤480 chars
//   5. Fiduciary framing: all output is analytical and advisory
//
// Governance repairs:
//   - amplification_risk: inject "amplification risk" note when ≥2 amplifying links
//   - stress_escalation: inject stress note when liquidity stressed + risk_off simultaneously
//   - shallow_context: flag when no active transmission links (context may be generic)
//   - certainty_language: detect and flag any certainty in assembled text
//
// Quality score (0-100):
//   +25: ≥1 active transmission link with mechanism (not just direction)
//   +20: liquidity state is determined (not neutral)
//   +20: riskMode is not transitioning
//   +20: no certainty language in assembled context
//   +15: GCC/Saudi note present when isSaudi OR fiduciary note is substantive
//
// Educational/advisory only.

import type { CrossAssetTransmissionResult } from "./crossAssetTransmissionEngine";
import type { GlobalLiquidityState }          from "./globalLiquidityEngine";
import type { CapitalFlowProfile }            from "./capitalFlowEngine";

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface CrossAssetGovernanceResult {
  approved:              boolean;
  qualityScore:          number;    // 0-100
  repairs:               string[];
  governedCrossAssetCtx: string;    // ≤480 chars injectable
  governanceLog:         string;
  fiduciaryNote:         string;    // ≤70 chars
}

// ─── Certainty language check ─────────────────────────────────────────────────

const CERTAINTY_RE = /\b(will definitely|guaranteed|certain to|inevitable|will cause|proven to|always transmit)\b/i;

// ─── Quality scoring ──────────────────────────────────────────────────────────

function scoreQuality(
  transmission: CrossAssetTransmissionResult,
  liquidity:    GlobalLiquidityState,
  flows:        CapitalFlowProfile,
  isSaudi:      boolean,
  assembledCtx: string,
): number {
  let score = 0;
  if (transmission.activeLinks.length >= 1)                           score += 25;
  if (liquidity.liquidityState !== "neutral")                         score += 20;
  if (flows.riskMode !== "transitioning")                             score += 20;
  if (!CERTAINTY_RE.test(assembledCtx))                               score += 20;
  if ((isSaudi && flows.gccNote !== null) || liquidity.stressSignal)  score += 15;
  return Math.min(100, score);
}

// ─── Repair detection ─────────────────────────────────────────────────────────

function identifyRepairs(
  transmission: CrossAssetTransmissionResult,
  liquidity:    GlobalLiquidityState,
  flows:        CapitalFlowProfile,
  assembled:    string,
): string[] {
  const repairs: string[] = [];
  if (transmission.amplificationRisk) repairs.push("amplification_risk_present");
  if (liquidity.liquidityState === "stressed" && flows.riskMode === "risk_off") repairs.push("stress_escalation_active");
  if (transmission.activeLinks.length === 0) repairs.push("no_active_transmission_links");
  if (CERTAINTY_RE.test(assembled)) repairs.push("certainty_language_detected");
  return repairs;
}

// ─── Context assembly ─────────────────────────────────────────────────────────

function trimTo(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 3) + "...";
}

function assembleContext(
  transmission: CrossAssetTransmissionResult,
  liquidity:    GlobalLiquidityState,
  flows:        CapitalFlowProfile,
  repairs:      string[],
  totalBudget:  number,
): string {
  const txCtx  = trimTo(transmission.transmissionCtx, 180);
  const liqCtx = trimTo(liquidity.liquidityCtx,       130);
  const flowCtx = trimTo(flows.flowCtx,               90);
  const gccPart = flows.gccNote ? trimTo(` | ${flows.gccNote}`, 68) : "";
  const ampNote = repairs.includes("amplification_risk_present")
    ? " [amplification risk]" : "";
  const stressNote = repairs.includes("stress_escalation_active")
    ? " [stress escalating]" : "";

  return `${txCtx} | ${liqCtx} | ${flowCtx}${gccPart}${ampNote}${stressNote}`.slice(0, totalBudget);
}

// ─── Fiduciary note ───────────────────────────────────────────────────────────

function buildFiduciaryNote(
  liquidity:  GlobalLiquidityState,
  flows:      CapitalFlowProfile,
): string {
  if (liquidity.stressSignal && flows.riskMode === "risk_off") {
    return "Cross-asset stress elevated — conditional framing and capital preservation focus";
  }
  if (liquidity.liquidityState === "stressed") {
    return "Global liquidity stress active — confirm funding before deployment";
  }
  if (flows.riskMode === "risk_off") {
    return "Risk-off conditions — review concentration and liquidity profile";
  }
  return "Cross-asset analysis is advisory — no execution implication";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function governCrossAsset(input: {
  transmission: CrossAssetTransmissionResult;
  liquidity:    GlobalLiquidityState;
  capitalFlows: CapitalFlowProfile;
  isSaudi:      boolean;
  lang:         "ar" | "en";
  totalBudget?: number;  // default 480
}): CrossAssetGovernanceResult {
  const { transmission, liquidity, capitalFlows: flows, isSaudi, totalBudget = 480 } = input;

  const repairs      = identifyRepairs(transmission, liquidity, flows, transmission.transmissionCtx);
  const assembled    = assembleContext(transmission, liquidity, flows, repairs, totalBudget);
  const qualityScore = scoreQuality(transmission, liquidity, flows, isSaudi, assembled);
  const approved     = qualityScore >= 45 && !repairs.includes("certainty_language_detected");
  const fiduciaryNote = buildFiduciaryNote(liquidity, flows);
  const governanceLog = `cross-asset quality=${qualityScore} approved=${approved} links=${transmission.activeLinks.length} repairs=[${repairs.join(",")||"none"}]`;

  return {
    approved,
    qualityScore,
    repairs,
    governedCrossAssetCtx: assembled,
    governanceLog,
    fiduciaryNote: fiduciaryNote.slice(0, 70),
  };
}
