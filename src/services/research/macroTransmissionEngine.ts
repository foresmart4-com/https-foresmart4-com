// Phase-86A: Macro Transmission Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// DISTINCT FROM crossMarketFusion.ts (Phase-67):
//   crossMarketFusion: 8-dimension causal NARRATIVE strings for prompt injection
//   macroTransmissionEngine: structured CHAIN GRAPH — ordered transmission steps
//   with magnitude qualifiers — usable by thesisImpactEngine for impact scoring.
//
// Models 9 macro trigger types as ordered transmission chains:
//   rate_hike, rate_cut, oil_shock_up, oil_shock_down, inflation_surprise,
//   credit_stress, usd_squeeze, saudi_fiscal_support, saudi_fiscal_pressure
//
// Each chain is an ordered list of TransmissionStep objects:
//   trigger → mechanism → downstream_effect → magnitude → confidence
//
// Chains are selected from question content + live signals + regime label.
// Max 2 chains injected per request to preserve context budget.
//
// Educational/advisory only. No autonomous execution. No broker data.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type MacroTrigger =
  | "rate_hike"
  | "rate_cut"
  | "oil_shock_up"
  | "oil_shock_down"
  | "inflation_surprise"
  | "credit_stress"
  | "usd_squeeze"
  | "saudi_fiscal_support"
  | "saudi_fiscal_pressure";

export type MagnitudeQualifier =
  | "immediate_large"   // >2σ move, same session
  | "medium_term"       // 3-6 month lag
  | "lagged_structural" // 6-18 month lag
  | "conditional"       // only if secondary condition met
  | "partial_offset";   // transmission is dampened by countervailing force

export interface TransmissionStep {
  from:       string;  // source variable
  mechanism:  string;  // ≤60 chars: causal mechanism
  to:         string;  // downstream variable
  magnitude:  MagnitudeQualifier;
  confidence: "high" | "moderate" | "low";
}

export interface MacroChain {
  trigger: MacroTrigger;
  steps:   TransmissionStep[];
  summary: string;         // ≤160 chars: compact causal sentence
  saudiRelevant: boolean;
}

export interface MacroTransmissionResult {
  selectedChains:  MacroChain[];
  dominantChain:   MacroChain | null;
  transmissionCtx: string;  // injectable ≤350 chars
}

// ─── Chain library ─────────────────────────────────────────────────────────────

const MACRO_CHAINS: MacroChain[] = [
  {
    trigger: "rate_hike",
    saudiRelevant: true,
    summary: "CB hike → real rate ↑ → discount rate ↑ → equity multiple compression → long-duration most exposed → credit cost ↑ → capex slowdown → earnings lag.",
    steps: [
      { from: "CB policy rate",    mechanism: "direct transmission",      to: "real rate",          magnitude: "immediate_large",  confidence: "high"     },
      { from: "real rate",         mechanism: "equity discount rate",     to: "P/E multiple",       magnitude: "immediate_large",  confidence: "high"     },
      { from: "real rate",         mechanism: "credit cost repricing",    to: "corporate borrowing",magnitude: "medium_term",      confidence: "high"     },
      { from: "corporate borrowing",mechanism: "capex reduction",         to: "earnings growth",    magnitude: "lagged_structural",confidence: "moderate" },
      { from: "CB policy rate",    mechanism: "SAR peg follow-through",   to: "SAMA rate",          magnitude: "immediate_large",  confidence: "high"     },
    ],
  },
  {
    trigger: "rate_cut",
    saudiRelevant: true,
    summary: "CB cut → real rate ↓ → discount rate ↓ → equity multiple expansion → long-duration bid → credit cost ↓ → growth stimulus → NIM compression for banks.",
    steps: [
      { from: "CB policy rate",    mechanism: "direct transmission",       to: "real rate",          magnitude: "immediate_large",  confidence: "high"    },
      { from: "real rate",         mechanism: "equity discount rate",      to: "P/E multiple",       magnitude: "immediate_large",  confidence: "high"    },
      { from: "real rate",         mechanism: "bond duration bid",         to: "long bond prices",   magnitude: "immediate_large",  confidence: "high"    },
      { from: "credit cost",       mechanism: "credit cost decrease",      to: "economic activity",  magnitude: "lagged_structural",confidence: "moderate"},
      { from: "CB policy rate",    mechanism: "SAR peg follow-through",    to: "SAMA rate → NIM",   magnitude: "medium_term",      confidence: "high"    },
    ],
  },
  {
    trigger: "oil_shock_up",
    saudiRelevant: true,
    summary: "Oil ↑ → Saudi fiscal surplus ↑ → government spending ↑ → TASI earnings growth → SAR peg stable → consumer confidence ↑; global importers face stagflation pressure.",
    steps: [
      { from: "oil price",         mechanism: "Saudi revenue",            to: "fiscal surplus",     magnitude: "immediate_large",  confidence: "high"    },
      { from: "fiscal surplus",    mechanism: "government spending",      to: "TASI earnings",      magnitude: "medium_term",      confidence: "high"    },
      { from: "fiscal surplus",    mechanism: "PIF / Aramco capex",       to: "construction/banks", magnitude: "medium_term",      confidence: "moderate"},
      { from: "oil price",         mechanism: "global inflation proxy",   to: "CB tightening risk", magnitude: "medium_term",      confidence: "moderate"},
      { from: "oil price",         mechanism: "EM oil importers cost",    to: "EM current account", magnitude: "medium_term",      confidence: "moderate"},
    ],
  },
  {
    trigger: "oil_shock_down",
    saudiRelevant: true,
    summary: "Oil ↓ below breakeven → Saudi fiscal deficit ↑ → government spending pressure → TASI earnings headwind → FX reserves drawn → Vision 2030 capex at risk.",
    steps: [
      { from: "oil price",         mechanism: "below fiscal breakeven",   to: "fiscal deficit",     magnitude: "immediate_large",  confidence: "high"    },
      { from: "fiscal deficit",    mechanism: "spending constraint",      to: "government capex",   magnitude: "medium_term",      confidence: "high"    },
      { from: "government capex",  mechanism: "earnings headwind",        to: "TASI equities",      magnitude: "medium_term",      confidence: "high"    },
      { from: "oil price",         mechanism: "SAMA reserve drawdown",    to: "SAR peg stability",  magnitude: "lagged_structural",confidence: "moderate"},
    ],
  },
  {
    trigger: "inflation_surprise",
    saudiRelevant: false,
    summary: "Inflation surprise → CB hawkish shift → real rate ↑ → duration compression → nominal bond losses → equity rotation to short-duration / commodity producers.",
    steps: [
      { from: "CPI surprise",      mechanism: "CB reaction function",    to: "rate expectations",  magnitude: "immediate_large",  confidence: "high"    },
      { from: "rate expectations", mechanism: "bond repricing",          to: "long bond prices",   magnitude: "immediate_large",  confidence: "high"    },
      { from: "rate expectations", mechanism: "equity rotation",         to: "value vs growth",    magnitude: "medium_term",      confidence: "moderate"},
      { from: "inflation",         mechanism: "real earnings erosion",   to: "margins",            magnitude: "medium_term",      confidence: "moderate"},
    ],
  },
  {
    trigger: "credit_stress",
    saudiRelevant: false,
    summary: "Credit spread widening → financial conditions tighten → risk capacity ↓ → equity risk premium ↑ → multiple compression → credit leads equity by ~6 weeks.",
    steps: [
      { from: "credit spreads",    mechanism: "financial conditions",    to: "risk capacity",      magnitude: "immediate_large",  confidence: "high"    },
      { from: "risk capacity",     mechanism: "equity risk premium",     to: "equity multiples",   magnitude: "medium_term",      confidence: "high"    },
      { from: "credit spreads",    mechanism: "leading indicator lag",   to: "equity earnings",    magnitude: "lagged_structural",confidence: "moderate"},
      { from: "spreads",           mechanism: "bank funding cost",       to: "credit availability",magnitude: "medium_term",      confidence: "high"    },
    ],
  },
  {
    trigger: "usd_squeeze",
    saudiRelevant: true,
    summary: "USD ↑ (DXY rally) → EM dollar debt cost ↑ → EM capital outflows → commodity prices ↓ → EM equities underperform; SAR peg insulates Saudi but oil USD receipts rise.",
    steps: [
      { from: "DXY",              mechanism: "EM dollar debt service",   to: "EM financial conditions",magnitude: "medium_term",  confidence: "high"    },
      { from: "DXY",              mechanism: "commodity pricing",        to: "oil/metals price",    magnitude: "medium_term",     confidence: "moderate"},
      { from: "DXY",              mechanism: "capital flow reversal",    to: "EM equity outflows",  magnitude: "immediate_large", confidence: "moderate"},
      { from: "DXY",              mechanism: "SAR peg mechanism",        to: "Saudi importers cost",magnitude: "conditional",     confidence: "moderate"},
    ],
  },
  {
    trigger: "saudi_fiscal_support",
    saudiRelevant: true,
    summary: "Oil above $75-80/bbl → fiscal surplus → government spending expansion → TASI earnings growth → banking credit growth → Vision 2030 capex intact.",
    steps: [
      { from: "oil above breakeven",mechanism: "fiscal surplus",         to: "government spending", magnitude: "medium_term",     confidence: "high"    },
      { from: "government spending",mechanism: "banking credit growth",  to: "banks NIM + loan book",magnitude: "medium_term",    confidence: "high"    },
      { from: "government spending",mechanism: "Vision 2030 projects",   to: "construction/infra",  magnitude: "medium_term",     confidence: "moderate"},
      { from: "fiscal surplus",     mechanism: "SAMA reserve build",     to: "SAR peg credibility", magnitude: "lagged_structural",confidence: "high"  },
    ],
  },
  {
    trigger: "saudi_fiscal_pressure",
    saudiRelevant: true,
    summary: "Oil below $70/bbl → fiscal deficit → spending cuts → TASI headwind → banking credit growth slows → PIF domestic allocation at risk.",
    steps: [
      { from: "oil below breakeven",mechanism: "fiscal deficit",         to: "spending constraints",magnitude: "medium_term",     confidence: "high"    },
      { from: "spending constraints",mechanism: "project delays",        to: "Vision 2030 capex",   magnitude: "medium_term",     confidence: "moderate"},
      { from: "spending constraints",mechanism: "credit growth slowdown",to: "banking sector",      magnitude: "lagged_structural",confidence: "high"  },
      { from: "fiscal deficit",     mechanism: "reserve drawdown",       to: "SAR peg sustainability",magnitude: "conditional",   confidence: "low"    },
    ],
  },
];

// ─── Chain selection ──────────────────────────────────────────────────────────

const CHAIN_KEYWORDS: Record<MacroTrigger, RegExp> = {
  rate_hike:              /\b(rate hike|tighten|hawkish|hike|rate rise|رفع الفائدة|تشديد)\b/i,
  rate_cut:               /\b(rate cut|ease|dovish|pivot|cut rates|خفض الفائدة|تيسير)\b/i,
  oil_shock_up:           /\b(oil rally|oil surge|crude above|brent above|oil positive|نفط يرتفع|صدمة نفطية إيجابية)\b/i,
  oil_shock_down:         /\b(oil crash|oil decline|crude below|brent below|oil negative|نفط ينخفض|صدمة نفطية سلبية)\b/i,
  inflation_surprise:     /\b(inflation|cpi|pce|price pressure|core cpi|inflation surprise|تضخم|ارتفاع الأسعار)\b/i,
  credit_stress:          /\b(credit spread|spread widen|credit stress|high yield|ig spread|ضغط الائتمان|فروقات)\b/i,
  usd_squeeze:            /\b(dxy|dollar rally|usd strength|dollar surge|الدولار يرتفع|تقوي الدولار)\b/i,
  saudi_fiscal_support:   /\b(saudi surplus|saudi fiscal|breakeven support|aramco dividend|فائض سعودي|دعم مالي)\b/i,
  saudi_fiscal_pressure:  /\b(saudi deficit|fiscal pressure|below breakeven|aramco cut|عجز سعودي|ضغط مالي)\b/i,
};

function detectTriggersFromSignals(
  oilPrice?: number | null,
  oilChangePct?: number | null,
  tltChangePct?: number | null,
): MacroTrigger[] {
  const triggers: MacroTrigger[] = [];
  const oil = oilPrice ?? 80;
  const oilChg = oilChangePct ?? 0;
  const tltChg = tltChangePct ?? 0;

  if (oilChg > 2.5) triggers.push("oil_shock_up");
  if (oilChg < -2.5) triggers.push("oil_shock_down");
  if (oil > 80) triggers.push("saudi_fiscal_support");
  if (oil < 68) triggers.push("saudi_fiscal_pressure");
  if (tltChg < -0.8) triggers.push("rate_hike");   // TLT falling = yields rising = hike
  if (tltChg > 0.8)  triggers.push("rate_cut");    // TLT rising = yields falling = cut
  return triggers;
}

export function selectMacroChains(
  question: string,
  ctx: string,
  oilPrice?: number | null,
  oilChangePct?: number | null,
  tltChangePct?: number | null,
  isSaudi = false,
  maxChains = 2,
): MacroTransmissionResult {
  const text = `${question} ${ctx}`;
  const matched = new Map<MacroTrigger, number>();

  // Keyword detection
  for (const [trigger, pattern] of Object.entries(CHAIN_KEYWORDS)) {
    if (pattern.test(text)) {
      matched.set(trigger as MacroTrigger, (matched.get(trigger as MacroTrigger) ?? 0) + 2);
    }
  }

  // Live signal detection
  const signalTriggers = detectTriggersFromSignals(oilPrice, oilChangePct, tltChangePct);
  for (const t of signalTriggers) {
    matched.set(t, (matched.get(t) ?? 0) + 3);  // live signal carries more weight
  }

  // Saudi boost: prefer Saudi chains for Saudi questions
  if (isSaudi) {
    for (const t of ["saudi_fiscal_support","saudi_fiscal_pressure","oil_shock_up","oil_shock_down","rate_hike","rate_cut"] as MacroTrigger[]) {
      if (matched.has(t)) matched.set(t, (matched.get(t) ?? 0) + 1);
    }
  }

  const sorted = [...matched.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxChains);

  const selectedChains = sorted
    .map(([trigger]) => MACRO_CHAINS.find(c => c.trigger === trigger))
    .filter((c): c is MacroChain => !!c);

  const dominant = selectedChains[0] ?? null;

  // Build compact context string
  const parts = selectedChains.map(c => {
    const stepSummary = c.steps.slice(0, 3)
      .map(s => `${s.from} → ${s.to}`)
      .join(" → ");
    return `[${c.trigger}] ${stepSummary} | ${c.summary.slice(0, 100)}`;
  });

  const transmissionCtx = parts.length > 0
    ? `Macro transmission [${selectedChains.map(c => c.trigger).join("+")}]: ${parts.join(" || ")}`.slice(0, 350)
    : "";

  return { selectedChains, dominantChain: dominant, transmissionCtx };
}
