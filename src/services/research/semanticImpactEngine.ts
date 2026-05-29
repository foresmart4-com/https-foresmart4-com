// Phase-86B: Semantic Impact Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Extends thesisImpactEngine.ts (Phase-86A) to handle NEUTRAL analytical
// questions where the existing IMPACT_RULES return score=0.
//
// Problem: thesisImpactEngine requires a directional thesis (bullish/bearish)
// to produce non-zero scores. Purely analytical questions ("what does X mean?",
// "how does Y transmit?", "compare A and B") always yield score=0.
//
// Solution: semantic pressure scoring — even without a directional thesis,
// macro events create three types of analytical pressure:
//
//   analyticalPressure (0-100):
//     Magnitude of the event regardless of thesis direction.
//     High event magnitude → high pressure on any allocator to re-examine thesis.
//
//   confidencePressure (0-100):
//     How much does this event reduce certainty about ANY position?
//     High policy surprise + high event magnitude → high confidence pressure.
//
//   allocationImplication:
//     What SHOULD an uncommitted allocator consider given this event?
//     Derived from event type + Saudi context.
//
// Also adds: invalidationCheck — whether the event triggers known invalidation
// conditions (e.g., oil below $70 for Saudi fiscal thesis, regardless of direction).
//
// No autonomous execution. Educational/advisory only.

import type { LiveMacroMonitorResult, MacroEventLabel } from "./liveMacroMonitor";
import type { PolicyIntelligenceResult } from "./policyIntelligenceEngine";
import {
  computeMagnitudeAdjustedConfidence,
  countCorroboratingSaignals,
} from "./magnitudeConfidenceEngine";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SemanticImpactResult {
  analyticalPressure:    number;  // 0-100: event significance for any analyst
  confidencePressure:    number;  // 0-100: uncertainty injection from this event
  allocationImplication: string;  // ≤150 chars: what an uncommitted allocator should consider
  invalidationCheck:     string | null;  // ≤100 chars: known invalidation trigger, if relevant
  semanticContext:       string;  // injectable ≤220 chars
  hasSemanticPressure:   boolean;
}

// ─── Pressure scoring ─────────────────────────────────────────────────────────

const EVENT_ANALYTICAL_WEIGHT: Partial<Record<MacroEventLabel, number>> = {
  rate_shock_up:       70,  // CB rate shocks are high analytical significance
  rate_shock_down:     65,
  oil_shock_positive:  60,
  oil_shock_negative:  75,  // downside oil is higher analytical pressure (fiscal risk)
  risk_off:            65,
  risk_on:             45,
  usd_squeeze:         50,
  equity_stress:       60,
  oil_fiscal_support:  40,  // oil level events are lower pressure than shock events
  oil_fiscal_pressure: 80,  // pressure below breakeven is highest for Saudi
  no_event:             0,
};

const EVENT_CONFIDENCE_IMPACT: Partial<Record<MacroEventLabel, number>> = {
  rate_shock_up:       60,
  rate_shock_down:     55,
  oil_shock_negative:  65,
  oil_shock_positive:  35,
  risk_off:            70,  // risk-off events maximally reduce allocator certainty
  equity_stress:       65,
  usd_squeeze:         40,
  oil_fiscal_pressure: 70,
  no_event:             0,
};

// ─── Allocation implication rules ─────────────────────────────────────────────

const ALLOCATION_IMPLICATIONS: Partial<Record<MacroEventLabel, {
  general: string;
  saudi: string;
}>> = {
  rate_shock_up: {
    general: "Rate shock: review portfolio duration exposure — long-duration assets at highest risk; short-term bills and banks partially offset.",
    saudi:   "SAMA follows Fed mechanically — Saudi mortgages re-price higher; TASI real estate sector faces NIM headwind.",
  },
  rate_shock_down: {
    general: "Rates falling: duration extension opportunity opens — long bonds bid; growth equities re-rate; cash drag increases.",
    saudi:   "SAMA rate cut follows — Saudi bank NIM compresses but mortgage demand recovers; equities re-rate on lower discount.",
  },
  oil_shock_negative: {
    general: "Oil decline: commodity producers and energy equities face earnings pressure; oil importers benefit.",
    saudi:   "Oil below Saudi fiscal breakeven ($75-80): government spending under pressure; TASI earnings growth at risk; Vision 2030 timeline at risk.",
  },
  oil_shock_positive: {
    general: "Oil rally: commodity producers benefit; inflation re-acceleration risk for central banks.",
    saudi:   "Oil above Saudi breakeven: fiscal surplus expanding; TASI earnings supported; Aramco capex and PIF allocation intact.",
  },
  oil_fiscal_pressure: {
    general: "Oil at fiscal pressure level: oil-exporting sovereign budgets constrained.",
    saudi:   "Oil below $70: Saudi fiscal deficit risk — spending cuts, banking credit growth slows, Vision 2030 capex reviews.",
  },
  risk_off: {
    general: "Risk-off: correlation to 1 — diversification fails temporarily; cash and safe havens outperform.",
    saudi:   "Risk-off: TASI correlates to EM risk despite strong fundamentals; foreign flow reversal is the primary mechanism.",
  },
  equity_stress: {
    general: "Equity drawdown: review concentration and conviction — >2.5% single-day drops signal positioning change.",
    saudi:   "Global equity stress propagates to TASI via foreign investor flows — fundamental Saudi support may not offset near-term.",
  },
};

// ─── Invalidation check ───────────────────────────────────────────────────────

const INVALIDATION_CONDITIONS: Array<{
  trigger: (events: LiveMacroMonitorResult, isSaudi: boolean) => boolean;
  message: string;
}> = [
  {
    trigger: (ev, isSaudi) => isSaudi && ev.events.some(e => e.label === "oil_fiscal_pressure"),
    message: "Saudi fiscal thesis invalidation condition approaching: oil at or below $70/bbl.",
  },
  {
    trigger: (ev) => ev.events.some(e => e.label === "oil_shock_negative" && e.magnitudePct > 5),
    message: "Large oil crash (>5%): commodity-related thesis may require conviction downgrade.",
  },
  {
    trigger: (ev) => ev.events.some(e => e.label === "risk_off" && e.magnitudePct > 2),
    message: "Risk-off event: cross-asset correlation spike — individual thesis temporarily secondary to regime.",
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildSemanticImpact(
  question: string,
  ctx: string,
  liveEvents: LiveMacroMonitorResult,
  policyIntel: PolicyIntelligenceResult,
  isSaudi: boolean,
  regime?: string,
): SemanticImpactResult {
  if (liveEvents.noSignal || !liveEvents.primaryEvent) {
    return {
      analyticalPressure:    0,
      confidencePressure:    0,
      allocationImplication: "",
      invalidationCheck:     null,
      semanticContext:       "",
      hasSemanticPressure:   false,
    };
  }

  const primary = liveEvents.primaryEvent;

  // Phase-87A: Magnitude-aware analytical pressure — scale base weight by event magnitude
  const basePressure = EVENT_ANALYTICAL_WEIGHT[primary.label] ?? 20;
  const corrobCount = countCorroboratingSaignals({
    tltDown:  liveEvents.events.some(e => e.label === "rate_shock_up"),
    tltUp:    liveEvents.events.some(e => e.label === "rate_shock_down"),
    spyDown:  liveEvents.events.some(e => e.label === "equity_stress" || e.label === "risk_off"),
    spyUp:    liveEvents.events.some(e => e.label === "risk_on"),
    goldUp:   liveEvents.events.some(e => e.label === "risk_off"),
    oilDown:  liveEvents.events.some(e => e.label === "oil_shock_negative"),
    oilUp:    liveEvents.events.some(e => e.label === "oil_shock_positive"),
  });
  const magnitudeResult = computeMagnitudeAdjustedConfidence({
    primaryMagnitudePct: primary.magnitudePct,
    corroboratingCount:  corrobCount,
    regimeLabel:         regime,
    baseConfidence:      basePressure,
  });
  const analyticalPressure = magnitudeResult.magnitudeAdjustedConfidence;

  // Phase-87A: Magnitude-aware confidence pressure — replaces flat EVENT_CONFIDENCE_IMPACT
  const baseConf = EVENT_CONFIDENCE_IMPACT[primary.label] ?? 10;
  const surpriseBoost = (policyIntel.dominantSignal?.surpriseScore ?? 0) * 0.3;
  const magnitudeConfidence = computeMagnitudeAdjustedConfidence({
    primaryMagnitudePct: primary.magnitudePct,
    corroboratingCount:  corrobCount,
    regimeLabel:         regime,
    baseConfidence:      baseConf,
  });
  const confidencePressure = Math.min(100, Math.round(
    magnitudeConfidence.magnitudeAdjustedConfidence + surpriseBoost,
  ));

  // Allocation implication
  const impl = ALLOCATION_IMPLICATIONS[primary.label];
  const allocationImplication = impl
    ? (isSaudi ? impl.saudi : impl.general)
    : `${primary.label.replace(/_/g, " ")}: review allocation assumptions given this signal.`;

  // Invalidation check
  const invalidationCheck = INVALIDATION_CONDITIONS
    .find(c => c.trigger(liveEvents, isSaudi))
    ?.message ?? null;

  if (analyticalPressure < 25) {
    return {
      analyticalPressure, confidencePressure, allocationImplication, invalidationCheck,
      semanticContext: "", hasSemanticPressure: false,
    };
  }

  const confidenceLine = confidencePressure >= 40
    ? ` Certainty pressure: ${confidencePressure}/100.`
    : "";

  const invalidationLine = invalidationCheck
    ? ` Invalidation check: ${invalidationCheck.slice(0, 80)}`
    : "";

  const semanticContext = [
    `Semantic impact [${primary.label}]:`,
    allocationImplication.slice(0, 150),
    confidenceLine,
    invalidationLine,
  ].filter(Boolean).join(" ").slice(0, 220);

  return {
    analyticalPressure, confidencePressure, allocationImplication, invalidationCheck,
    semanticContext, hasSemanticPressure: analyticalPressure >= 25,
  };
}
