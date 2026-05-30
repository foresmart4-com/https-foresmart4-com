// LCCR-3: Capital Allocator Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Root cause addressed: Genesis describes regimes without portfolio meaning.
// An institutional allocator needs to know WHERE capital is hiding and WHERE
// it is deploying — not just what regime label applies.
//
// Distinct from existing modules:
//   allocationIntelligence.ts (68)   — allocation frame (broad/selective/defensive)
//   allocatorDecisionEngine.ts (83B) — stance scoring (scale_in/hold/avoid)
//   capitalFlowEngine.ts (89B)       — cross-asset capital flow profile (global level)
//
// This module answers the ALLOCATOR'S CORE QUESTIONS:
//   — Where is institutional capital hiding right now?
//   — Where is it deploying and why?
//   — What sectors are attracting vs. repelling flows?
//   — Cyclicals vs. defensives tilt — and what drives the tilt?
//   — Regime-to-allocation transmission: how does the macro force allocation?
//   — Saudi/GCC: sovereign capital flow logic (SAMA, PIF, Vision 2030)
//
// Educational/advisory only. No execution language. No broker data.

import type { Lang } from "@/lib/ai/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CapitalHidingLocation =
  | "cash_and_tbills"     // short-duration cash instruments; capital on sidelines
  | "government_bonds"    // sovereign bonds; safety and duration bid
  | "gold_and_commodities"// hard assets; inflation hedge; stress safety
  | "investment_grade"    // IG credit; income with quality constraint
  | "defensive_equities"; // utilities, healthcare, staples; low-beta equity

export type CapitalDeployLocation =
  | "growth_equities"     // tech, consumer discretionary; earnings leverage
  | "cyclical_equities"   // energy, materials, industrials; cycle upturn plays
  | "EM_equities"         // emerging market equities; dollar weakness + growth premium
  | "HY_credit"           // high-yield credit; income + carry in benign credit
  | "real_assets";        // real estate, infrastructure; income + inflation hedge

export type CyclicalVsDefensive =
  | "strongly_cyclical"   // clear cyclical bias; regime rewards risk-taking
  | "modestly_cyclical"   // slight cyclical lean; growth but with quality filter
  | "neutral"             // balanced; no strong sector tilt warranted
  | "modestly_defensive"  // slight defensive lean; growth uncertainty warrants caution
  | "strongly_defensive"; // clear defensive bias; capital preservation priority

export interface SectorFlowMap {
  overweight: string[];    // sectors attracting institutional flows
  underweight: string[];   // sectors losing institutional flows
  neutral: string[];       // sectors with no strong directional flow
}

export interface CapitalAllocatorProfile {
  hidingLocation:        CapitalHidingLocation;
  deployLocation:        CapitalDeployLocation;
  cyclicalVsDefensive:   CyclicalVsDefensive;
  sectorFlowMap:         SectorFlowMap;
  transmissionChain:     string;    // ≤130 chars: how regime forces allocation
  saudiFlowLogic:        string;    // ≤130 chars: Saudi/GCC-specific flow logic (or "")
  hidingRationale:       string;    // ≤100 chars
  deployRationale:       string;    // ≤100 chars
  allocatorFlowContext:  string;    // injectable ≤400 chars
}

interface AllocatorInput {
  regime:            string;
  macroBias:         "bullish" | "bearish" | "neutral";
  creditStress:      "low" | "moderate" | "high" | "extreme";
  consensusStrength: "strong" | "moderate" | "weak" | "conflicted";
  regimeConf:        number;       // 0-100
  isSaudi:           boolean;
  oilPrice:          number | null;
  lang:              Lang;
}

// ─── Capital hiding location ──────────────────────────────────────────────────

function deriveHidingLocation(i: AllocatorInput): CapitalHidingLocation {
  if (i.creditStress === "extreme") return "cash_and_tbills";
  if (i.creditStress === "high") return "government_bonds";
  if (i.macroBias === "bearish" && i.consensusStrength !== "strong") return "gold_and_commodities";
  if (i.macroBias === "neutral" && i.regimeConf < 50) return "investment_grade";
  if (i.macroBias === "neutral") return "defensive_equities";
  if (i.macroBias === "bullish" && i.creditStress === "low") return "defensive_equities";
  return "cash_and_tbills";
}

// ─── Capital deploy location ─────────────────────────────────────────────────

function deriveDeployLocation(i: AllocatorInput): CapitalDeployLocation {
  if (i.creditStress === "extreme" || i.creditStress === "high") return "government_bonds" as unknown as CapitalDeployLocation;
  if (i.macroBias === "bullish" && i.creditStress === "low" && i.consensusStrength === "strong") return "growth_equities";
  if (i.macroBias === "bullish" && i.creditStress === "moderate") return "cyclical_equities";
  if (i.macroBias === "neutral") return "real_assets";
  if (i.isSaudi && i.oilPrice !== null && i.oilPrice >= 75 && i.macroBias !== "bearish") return "cyclical_equities";
  return "HY_credit";
}

// ─── Cyclical vs defensive tilt ──────────────────────────────────────────────

function deriveCyclicalTilt(i: AllocatorInput): CyclicalVsDefensive {
  if (i.creditStress === "extreme") return "strongly_defensive";
  if (i.creditStress === "high") return "modestly_defensive";
  if (i.macroBias === "bearish") return "modestly_defensive";
  if (i.consensusStrength === "conflicted") return "neutral";
  if (i.macroBias === "bullish" && i.creditStress === "low" && i.consensusStrength === "strong") return "strongly_cyclical";
  if (i.macroBias === "bullish" && i.creditStress === "moderate") return "modestly_cyclical";
  if (i.isSaudi && i.oilPrice !== null && i.oilPrice >= 80) return "modestly_cyclical";
  return "neutral";
}

// ─── Sector flow map ──────────────────────────────────────────────────────────

function buildSectorFlowMap(i: AllocatorInput, tilt: CyclicalVsDefensive): SectorFlowMap {
  if (tilt === "strongly_defensive") {
    return {
      overweight:  ["Utilities", "Healthcare", "Consumer Staples"],
      underweight: ["Technology", "Consumer Discretionary", "Materials", "Industrials"],
      neutral:     ["Financials", "Energy", "Real Estate"],
    };
  }
  if (tilt === "modestly_defensive") {
    return {
      overweight:  ["Healthcare", "Consumer Staples", "Utilities"],
      underweight: ["Consumer Discretionary", "Materials"],
      neutral:     ["Technology", "Financials", "Energy", "Industrials", "Real Estate"],
    };
  }
  if (tilt === "strongly_cyclical") {
    const saudiSectors = i.isSaudi
      ? ["Petrochemicals", "Banking & Financials", "Industrials"]
      : ["Technology", "Consumer Discretionary", "Industrials"];
    return {
      overweight:  saudiSectors,
      underweight: ["Utilities", "Consumer Staples"],
      neutral:     ["Healthcare", "Real Estate", "Energy"],
    };
  }
  if (tilt === "modestly_cyclical") {
    return {
      overweight:  i.isSaudi
        ? ["Banking & Financials", "Energy", "Industrials"]
        : ["Technology", "Financials", "Industrials"],
      underweight: ["Utilities"],
      neutral:     ["Healthcare", "Consumer Staples", "Real Estate", "Materials"],
    };
  }
  // neutral
  return {
    overweight:  ["Quality Growth", "Dividend-Growth"],
    underweight: [],
    neutral:     ["Technology", "Financials", "Healthcare", "Industrials", "Consumer Staples"],
  };
}

// ─── Transmission chain ───────────────────────────────────────────────────────

function buildTransmissionChain(i: AllocatorInput): string {
  if (i.creditStress === "extreme") {
    return "Extreme credit stress → cost of capital spikes → multiples compress → allocators flee to cash and sovereign bonds.";
  }
  if (i.creditStress === "high") {
    return "High credit stress → refinancing risk rises → high-beta names de-rate → flows rotate into investment grade and government bonds.";
  }
  if (i.macroBias === "bullish" && i.creditStress === "low") {
    return "Risk-on regime + benign credit → earnings leverage justified → flows deploy into growth and cyclical equities.";
  }
  if (i.macroBias === "neutral") {
    return "Neutral macro → earnings diverge by sector → flows concentrate in quality names with visible cash generation.";
  }
  return "Bearish macro → risk premium expands → allocators reduce beta and extend duration in defensive assets.";
}

// ─── Saudi/GCC sovereign flow logic ──────────────────────────────────────────

function buildSaudiFlowLogic(i: AllocatorInput): string {
  if (!i.isSaudi) return "";
  const oilNote = i.oilPrice !== null
    ? (i.oilPrice >= 80
        ? `Oil at $${i.oilPrice} provides SAMA/PIF with deployment capacity.`
        : i.oilPrice >= 65
        ? `Oil at $${i.oilPrice} sustains but constrains sovereign deployment pace.`
        : `Oil at $${i.oilPrice} compresses fiscal surplus — PIF deployment likely pauses.`)
    : "Oil price not available — Saudi flow logic conditional.";
  return `${oilNote} Vision 2030 sectors (tourism, tech, NEOM) attract domestic sovereign flows independent of oil level.`;
}

// ─── Context injection ────────────────────────────────────────────────────────

const HIDE_LABELS: Record<CapitalHidingLocation, string> = {
  cash_and_tbills:     "capital in cash/T-bills (sidelines)",
  government_bonds:    "capital in government bonds (safety bid)",
  gold_and_commodities:"capital in gold/commodities (inflation/stress hedge)",
  investment_grade:    "capital in IG credit (income + quality constraint)",
  defensive_equities:  "capital in defensive equities (low-beta equity)",
};

const CYCLICAL_LABELS: Record<CyclicalVsDefensive, string> = {
  strongly_cyclical:  "strongly cyclical — regime rewards risk-taking",
  modestly_cyclical:  "modestly cyclical — growth with quality filter",
  neutral:            "neutral — no dominant sector tilt",
  modestly_defensive: "modestly defensive — caution warranted",
  strongly_defensive: "strongly defensive — capital preservation priority",
};

// Fix: handle the edge case where deploy is a "capital-hiding" location
function deployLabel(loc: CapitalDeployLocation | string): string {
  const map: Record<string, string> = {
    growth_equities:   "growth equities (tech, discretionary)",
    cyclical_equities: "cyclical equities (energy, materials, industrials)",
    EM_equities:       "EM equities (dollar weakness + growth premium)",
    HY_credit:         "HY credit (income + carry in benign credit)",
    real_assets:       "real assets (infrastructure, real estate)",
    government_bonds:  "government bonds (stress safety — preserve not deploy)",
  };
  return map[loc] ?? loc;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildCapitalAllocatorProfile(input: AllocatorInput): CapitalAllocatorProfile {
  const hidingLoc      = deriveHidingLocation(input);
  const deployLoc      = deriveDeployLocation(input);
  const cyclicalTilt   = deriveCyclicalTilt(input);
  const sectorFlowMap  = buildSectorFlowMap(input, cyclicalTilt);
  const transmission   = buildTransmissionChain(input);
  const saudiFlowLogic = buildSaudiFlowLogic(input);

  const hidingRationale = `Smart money hides in ${HIDE_LABELS[hidingLoc]} given current conditions.`;
  const deployRationale = `Institutional deployment tilts toward ${deployLabel(deployLoc)} when entry conditions are met.`;

  const isAr = input.lang === "ar";

  const flowSummary = sectorFlowMap.overweight.length > 0
    ? `Sectors attracting flows: ${sectorFlowMap.overweight.join(", ")}. Losing flows: ${sectorFlowMap.underweight.join(", ") || "none"}.`
    : `No dominant sector flow — allocators are neutral across segments.`;

  const saudiLine = saudiFlowLogic ? ` Saudi/GCC: ${saudiFlowLogic.slice(0, 100)}` : "";

  const allocatorFlowContext = isAr
    ? [
        `تدفقات رأس المال المؤسسي [${CYCLICAL_LABELS[cyclicalTilt]}]:`,
        `الإخفاء: ${HIDE_LABELS[hidingLoc]}`,
        `النشر: ${deployLabel(deployLoc)}`,
        `سلسلة الانتقال: ${transmission.slice(0, 100)}`,
        saudiFlowLogic ? `السعودية/الخليج: ${saudiFlowLogic.slice(0, 80)}` : "",
        `الرد يجب أن يُظهر أين يذهب رأس المال وليس فقط النظام السوقي.`,
      ].filter(Boolean).join(" | ").slice(0, 400)
    : [
        `Institutional capital flows [${CYCLICAL_LABELS[cyclicalTilt]}]:`,
        `Hiding: ${HIDE_LABELS[hidingLoc]}`,
        `Deploying into: ${deployLabel(deployLoc)}`,
        `Transmission: ${transmission.slice(0, 95)}`,
        `${flowSummary.slice(0, 80)}${saudiLine}`,
        `Answer must state WHERE capital is moving and WHY — not only the regime label.`,
      ].join(" | ").slice(0, 400);

  return {
    hidingLocation:       hidingLoc,
    deployLocation:       deployLoc,
    cyclicalVsDefensive:  cyclicalTilt,
    sectorFlowMap,
    transmissionChain:    transmission,
    saudiFlowLogic,
    hidingRationale,
    deployRationale,
    allocatorFlowContext,
  };
}
