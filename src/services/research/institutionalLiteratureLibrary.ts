// Phase-85B: Institutional Literature Library
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Distinct from historicalLearning.ts and historicalAnalogEngine.ts which
// maintain HISTORICAL EPISODE registries (specific market crises and cycles).
//
// This library provides COMPRESSED GOVERNED SUMMARIES of foundational
// analytical literature, frameworks, and methodological insights — not
// event histories. Focus areas:
//   economic_history:     compressed episode lessons (investment implication only)
//   allocator_logic:      institutional allocator frameworks and decision heuristics
//   valuation_framework:  structured valuation methodologies
//   macro_transmission:   causal chains linking macro variables to asset prices
//   regime_framework:     multi-asset regime classification and rotation logic
//   crisis_anatomy:       structural anatomy of financial crises (not episode timelines)
//
// All summaries ≤200 chars. Compressed paraphrase only — no verbatim quotation.
// No copyrighted text. No full-book ingestion.
// No PII. No broker data. Educational/advisory use only.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LiteratureCategory =
  | "economic_history"
  | "allocator_logic"
  | "valuation_framework"
  | "macro_transmission"
  | "regime_framework"
  | "crisis_anatomy";

export interface LiteratureEntry {
  id: string;
  category: LiteratureCategory;
  title: string;
  summary: string;               // ≤200 chars: compressed analytical insight
  investmentImplication: string; // ≤120 chars: actionable implication
  saudiRelevant: boolean;
  saudiAddendum: string | null;  // ≤100 chars: Saudi-specific note, when relevant
  relevanceKeywords: string[];   // lowercase keywords for retrieval
}

// ─── Literature registry ──────────────────────────────────────────────────────
// Bounded: max 40 entries; each compressed to essential insight.

export const LITERATURE_ENTRIES: LiteratureEntry[] = [
  // ── Allocator Logic ───────────────────────────────────────────────────────────
  {
    id: "all-weather-portfolio",
    category: "allocator_logic",
    title: "All-Weather Portfolio Framework (Dalio/Bridgewater)",
    summary: "Assets are held in four quadrants: growth↑, growth↓, inflation↑, inflation↓. Each quadrant has dominant asset classes. Position sizing by risk contribution, not capital weight.",
    investmentImplication: "In stagflation: gold + commodities. In deflation: long bonds. In goldilocks: equities. Risk parity breaks in simultaneous drawdown.",
    saudiRelevant: true,
    saudiAddendum: "Saudi oil-fiscal regime requires an added oil-price layer to the quadrant — oil above breakeven shifts the Saudi quadrant independently of global regime.",
    relevanceKeywords: ["dalio", "all-weather", "risk parity", "portfolio", "allocation", "quadrant", "bridgewater"],
  },
  {
    id: "credit-cycle-positioning",
    category: "allocator_logic",
    title: "Credit Cycle Positioning (Marks/Oaktree)",
    summary: "Marks: the most important thing is where we stand in the cycle. Phases: recovery → expansion → peak → contraction. Risk premium widens at troughs; allocators who buy dislocated credit in contraction earn excess return.",
    investmentImplication: "Buy high-yield at spread peaks (400-500bps+); reduce at compression (<250bps). Cycle position >all other signals.",
    saudiRelevant: false,
    saudiAddendum: null,
    relevanceKeywords: ["marks", "oaktree", "credit cycle", "spread", "high yield", "distressed", "credit positioning"],
  },
  {
    id: "endowment-model",
    category: "allocator_logic",
    title: "Endowment Model (Yale/Swensen)",
    summary: "Long-horizon institutional allocators should maximise illiquidity premium: private equity, real assets, hedge funds, timberland. Illiquidity premium = 2-4% p.a. over liquid equivalents historically.",
    investmentImplication: "Suitable for 10+ year horizons. Fails in forced liquidity events. Saudi SWFs and PIF operate with endowment-adjacent structures.",
    saudiRelevant: true,
    saudiAddendum: "PIF's Vision 2030 portfolio has endowment-model characteristics — long-horizon, illiquid, domestic-focus. Swensen's illiquidity premium applies with domestic concentration risk added.",
    relevanceKeywords: ["endowment", "swensen", "yale", "illiquidity", "private equity", "long horizon", "pif"],
  },
  {
    id: "factor-rotation-logic",
    category: "allocator_logic",
    title: "Factor Rotation and Regime-Driven Factor Premia",
    summary: "Value, momentum, quality, low-volatility and size premia are regime-conditional. Value outperforms in recovery; momentum in trending; quality in late-cycle; low-vol in risk-off regimes.",
    investmentImplication: "Map current regime to factor premia. Momentum works until it doesn't — concentration risk spikes at crowded momentum peaks.",
    saudiRelevant: false,
    saudiAddendum: null,
    relevanceKeywords: ["factor", "value", "momentum", "quality", "low volatility", "size premium", "fama-french"],
  },

  // ── Valuation Frameworks ──────────────────────────────────────────────────────
  {
    id: "cape-valuation",
    category: "valuation_framework",
    title: "CAPE (Cyclically Adjusted P/E) — Shiller",
    summary: "10-year real earnings average smooths the cycle; CAPE above 30 historically predicts below-average 10-year real returns; not a short-run timing tool but a long-run return anchor.",
    investmentImplication: "CAPE >30: lower 10y expected return (1-5% real). CAPE 15-20: normal. CAPE <12: historical buying opportunity. Not a short-run trigger.",
    saudiRelevant: false,
    saudiAddendum: null,
    relevanceKeywords: ["cape", "shiller", "cyclically adjusted", "pe ratio", "valuation", "10-year earnings"],
  },
  {
    id: "equity-risk-premium",
    category: "valuation_framework",
    title: "Equity Risk Premium (ERP) Model",
    summary: "ERP = earnings yield minus real risk-free rate. ERP compression (equities expensive vs bonds) signals rebalancing pressure. ERP expansion (equities cheap) supports allocation increase.",
    investmentImplication: "When ERP <2%: reduce equity allocation or hedge duration. When ERP >5%: equities inexpensive vs bonds; increase equity weight.",
    saudiRelevant: true,
    saudiAddendum: "TASI ERP must account for oil-price dependency: high oil raises earnings ceiling, inflating apparent ERP. Adjust TASI ERP for oil-fiscal correlation.",
    relevanceKeywords: ["equity risk premium", "erp", "earnings yield", "risk free rate", "bond yield", "valuation"],
  },
  {
    id: "tobins-q",
    category: "valuation_framework",
    title: "Tobin's Q — Market vs Replacement Value",
    summary: "Q = market value / replacement cost of assets. Q>1: market values firms above replacement (overvalued vs asset cost). Q<1: firms worth less than their assets (potential value). Mean-reverting over 10-20 year horizons.",
    investmentImplication: "Q >1.5: late-cycle valuation warning. Q <0.7: asset-based value opportunity. Most useful for industrial and capital-intensive sectors.",
    saudiRelevant: false,
    saudiAddendum: null,
    relevanceKeywords: ["tobin", "tobins q", "replacement cost", "market value", "asset value"],
  },
  {
    id: "dcf-rate-sensitivity",
    category: "valuation_framework",
    title: "DCF Rate Sensitivity — Duration of Equities",
    summary: "Long-duration equities (high growth, low current earnings) are most sensitive to discount rate changes. A 100bps rate rise reduces a 30-year DCF value by ~15-25% depending on growth assumptions.",
    investmentImplication: "Rising rate regimes: rotate to short-duration (value, dividend, commodity) and away from long-duration (growth, technology, early-stage). Duration matters as much in equities as in bonds.",
    saudiRelevant: true,
    saudiAddendum: "SAMA rate follows Fed mechanically. TASI duration risk is moderate (oil-linked earnings are short-duration); but Vision 2030 growth stocks carry high duration risk.",
    relevanceKeywords: ["discount rate", "dcf", "duration", "growth stocks", "rate sensitivity", "interest rate"],
  },

  // ── Macro Transmission ────────────────────────────────────────────────────────
  {
    id: "rate-transmission-chain",
    category: "macro_transmission",
    title: "Monetary Policy Transmission Chain",
    summary: "Policy rate → real rate → credit cost → investment demand → corporate earnings → equity discount rate. Time lags: credit 3-6m, investment 6-12m, earnings 12-18m. Each link has uncertainty.",
    investmentImplication: "Equity response to rate changes is lagged; short rates move fast, long rates price expectations, earnings adjust last. Don't time equity on first rate move.",
    saudiRelevant: true,
    saudiAddendum: "SAR peg: SAMA imports US policy rate mechanically. Saudi transmission chain is compressed — SAMA rate → mortgage cost → real estate → construction → TASI bank sector.",
    relevanceKeywords: ["transmission", "monetary policy", "rate", "real rate", "credit cost", "earnings", "fed", "sama"],
  },
  {
    id: "oil-fiscal-tasi-chain",
    category: "macro_transmission",
    title: "Oil → Fiscal → SAMA → TASI Transmission",
    summary: "Oil revenue → Saudi fiscal surplus/deficit → government spending and Aramco capex → banking credit growth → TASI earnings. Oil above $75-80/bbl supports fiscal expansion; below compresses it.",
    investmentImplication: "In high-oil regime: overweight Saudi banks (credit growth), Aramco (capex), and construction. Below breakeven: underweight cyclicals, favour defensives and dividend payers.",
    saudiRelevant: true,
    saudiAddendum: "The $75-80/bbl fiscal breakeven is the key transmission gate. Every $10 change in oil changes Saudi fiscal revenue by ~$40-50bn annually.",
    relevanceKeywords: ["oil", "fiscal", "tasi", "saudi", "aramco", "sama", "breakeven", "government spending", "capex"],
  },
  {
    id: "fx-em-commodity-spillover",
    category: "macro_transmission",
    title: "DXY → EM Equities → Commodity Demand Spillover",
    summary: "Strong USD tightens EM financial conditions (dollar-denominated debt service rises). EM equity outflows reduce commodity demand signal. Commodity prices fall → EM revenue compression cycle.",
    investmentImplication: "DXY rally >5% in 3m: reduce EM and commodity exposure. DXY reversal: EM and commodity recovery typically follows with 1-2 quarter lag.",
    saudiRelevant: true,
    saudiAddendum: "SAR peg provides partial insulation from DXY for Saudi domestic assets but oil is priced in USD so Saudi fiscal receipts still benefit from weak dollar (oil tends to rise).",
    relevanceKeywords: ["dxy", "dollar", "usd", "em", "emerging markets", "commodity", "spillover", "transmission"],
  },
  {
    id: "credit-spread-equity-transmission",
    category: "macro_transmission",
    title: "Credit Spread → Equity Risk Premium Transmission",
    summary: "Investment-grade spreads widen → risk-free rate equivalent rises → equity risk premium compresses → P/E multiples contract. HY spreads are a leading indicator for equity downturns (avg 6-8 week lead).",
    investmentImplication: "IG spread >150bps: equity multiple compression risk elevated. HY spread >500bps: recession probability elevated; equity earnings revision risk high.",
    saudiRelevant: false,
    saudiAddendum: null,
    relevanceKeywords: ["credit spread", "ig spread", "hy spread", "high yield", "investment grade", "equity premium"],
  },

  // ── Regime Frameworks ─────────────────────────────────────────────────────────
  {
    id: "growth-inflation-quadrant",
    category: "regime_framework",
    title: "Growth / Inflation Quadrant Matrix",
    summary: "Four regimes: (1) Growth↑/Inflation↑ = late-cycle, commodities+TIPS. (2) Growth↑/Inflation↓ = goldilocks, equities. (3) Growth↓/Inflation↑ = stagflation, gold+energy. (4) Growth↓/Inflation↓ = deflation, long bonds.",
    investmentImplication: "Identify the dominant quadrant from PMI, CPI, and credit conditions. Rotate assets accordingly. Most dangerous: quadrant transition (pricing uncertainty peaks).",
    saudiRelevant: true,
    saudiAddendum: "Saudi regime adds oil layer: oil price determines which quadrant benefits Saudi assets most. Saudi is most exposed to Quadrant 1 (growth↑+oil↑); most hurt by Quadrant 3 (stagflation with low oil).",
    relevanceKeywords: ["regime", "quadrant", "stagflation", "goldilocks", "growth", "inflation", "deflation", "asset rotation"],
  },
  {
    id: "debt-cycle-phases",
    category: "regime_framework",
    title: "Long-Term Debt Cycle Phases (Dalio)",
    summary: "Long-term debt cycle: accumulation → de-leveraging. Short-term cycles nest within. At peak: debt service exceeds income growth → forced deleveraging. CB response: print/restructure/cut. Duration: 50-75 years.",
    investmentImplication: "Identify cycle phase from debt-to-GDP trend and interest coverage. Late-cycle peak: avoid credit risk, favour real assets. Deleveraging: CB intervention reduces nominal returns.",
    saudiRelevant: false,
    saudiAddendum: null,
    relevanceKeywords: ["debt cycle", "deleveraging", "dalio", "long term", "debt to gdp", "leverage cycle"],
  },
  {
    id: "risk-on-risk-off-dynamics",
    category: "regime_framework",
    title: "Risk-On / Risk-Off Regime Dynamics",
    summary: "RORO: when correlation across assets approaches 1.0 in either direction, diversification fails. Risk-off: all risky assets fall together; safe havens (USD, gold, JGBs) rally. Driven by liquidity and positioning.",
    investmentImplication: "RORO regimes make individual security selection futile — macro regime is the primary signal. Position size down in RORO extremes; exploit mean reversion when RORO fades.",
    saudiRelevant: true,
    saudiAddendum: "In global risk-off, TASI correlates more with EM than with oil — foreign capital flight dominates oil support. Saudi has RORO vulnerability despite strong fundamentals.",
    relevanceKeywords: ["risk on", "risk off", "roro", "correlation", "diversification", "safe haven", "gold", "usd"],
  },

  // ── Crisis Anatomy ─────────────────────────────────────────────────────────────
  {
    id: "minsky-moment-anatomy",
    category: "crisis_anatomy",
    title: "Minsky Moment Anatomy",
    summary: "Progression: (1) Hedge finance — cash flows service debt. (2) Speculative — cash flows cover interest only; principal rolls. (3) Ponzi — cash flows insufficient for interest; requires asset appreciation.",
    investmentImplication: "Ponzi phase: exit early; Ponzi finance is unstable — a rate rise or liquidity dry-up forces liquidation. Monitor corporate interest coverage ratio and repo stress.",
    saudiRelevant: false,
    saudiAddendum: null,
    relevanceKeywords: ["minsky", "ponzi finance", "hedge finance", "speculative", "instability", "leverage", "credit cycle"],
  },
  {
    id: "currency-crisis-anatomy",
    category: "crisis_anatomy",
    title: "Currency Crisis Anatomy (First/Second/Third Generation)",
    summary: "1st gen: fiscal deficit monetisation → reserve drain → peg collapse. 2nd gen: self-fulfilling expectation of devaluation → speculative attack. 3rd gen: corporate FX mismatch + banking fragility → contagion.",
    investmentImplication: "Monitor FX reserve coverage (safe = >12m imports), CB credibility, and dollar-debt mismatch in corporate sector. SAR peg has strong reserve backing (~$450bn).",
    saudiRelevant: true,
    saudiAddendum: "SAR peg is structurally different from typical EM currency crisis: reserves are backed by oil revenue; 1st-gen risk is low; 3rd-gen corporate FX mismatch is also limited given limited USD borrowing.",
    relevanceKeywords: ["currency crisis", "peg", "devaluation", "reserves", "fx", "sar", "speculative attack"],
  },
  {
    id: "sovereign-debt-spiral",
    category: "crisis_anatomy",
    title: "Sovereign Debt Spiral Dynamics",
    summary: "Debt spiral triggers: debt-to-GDP >90% + primary deficit + rising interest rates + growth below debt cost. Once debt dynamics are self-reinforcing, market financing dries up quickly.",
    investmentImplication: "Avoid sovereign debt when: (debt cost > nominal GDP growth rate) + (primary deficit > 2% GDP) + (external financing dependency). Saudi sovereign risk is low due to oil revenue and low debt-to-GDP.",
    saudiRelevant: true,
    saudiAddendum: "Saudi debt-to-GDP ~25%; fiscal breakeven dependent on oil. No debt spiral risk at current oil prices. Risk scenario: oil collapses to <$50/bbl for 3+ years.",
    relevanceKeywords: ["sovereign debt", "debt spiral", "primary deficit", "debt to gdp", "fiscal sustainability", "government debt"],
  },

  // ── Economic History (Investment-Lesson Focus) ────────────────────────────────
  {
    id: "volcker-tightening-lesson",
    category: "economic_history",
    title: "Volcker Tightening (1979-82): Rate Credibility Lesson",
    summary: "Volcker raised Fed funds to 20% to break inflation expectations. Lesson: CB credibility requires willingness to cause short-run pain. Equity markets fell 40%; then recovered as inflation broke.",
    investmentImplication: "When CB is serious about inflation, expect rate overshoot. Equity recovery follows inflation peak — not rate peak. Duration assets most affected.",
    saudiRelevant: false,
    saudiAddendum: null,
    relevanceKeywords: ["volcker", "1979", "1980", "1981", "1982", "inflation", "credibility", "fed funds", "tightening"],
  },
  {
    id: "1994-bond-rout-lesson",
    category: "economic_history",
    title: "1994 Bond Rout: Surprise Rate Cycle Lesson",
    summary: "Fed raised rates 300bps in 12 months; bond markets lost 10% in a year. Markets mispriced the rate cycle duration. Cross-asset contagion hit EM (Mexico peso crisis followed). Duration risk was severely underpriced.",
    investmentImplication: "When terminal rate uncertainty is high, reduce duration and position for overshoot. Rate cycles that surprise markets in speed create credit and EM contagion.",
    saudiRelevant: false,
    saudiAddendum: null,
    relevanceKeywords: ["1994", "bond rout", "rate cycle", "duration", "surprise", "fed", "mexico"],
  },
  {
    id: "2022-inflation-lesson",
    category: "economic_history",
    title: "2022 Inflation Tightening: 60/40 Failure Lesson",
    summary: "2022 simultaneous equity + bond drawdown broke the 60/40 hedge assumption. Inflation drove both asset classes lower. Oil and commodities were the only major positive return. Duration assumption must be reconsidered in inflationary regimes.",
    investmentImplication: "In inflationary regimes: 60/40 is not diversified. Add commodities, TIPS, real assets, and short-duration equities. Saudi and oil exporters are rare inflation beneficiaries.",
    saudiRelevant: true,
    saudiAddendum: "Saudi assets were among 2022's outperformers (TASI +8%, oil dividend) — precisely when global portfolios lost 15-20%. Oil-fiscal transmission made Saudi a natural inflation hedge.",
    relevanceKeywords: ["2022", "inflation", "60/40", "bond equity", "portfolio", "correlation", "diversification"],
  },
];

// ─── Retrieval ─────────────────────────────────────────────────────────────────

export function queryLiteratureLibrary(
  question: string,
  ctx: string,
  regime?: string,
  isSaudi = false,
): LiteratureEntry[] {
  const text = `${question} ${ctx} ${regime ?? ""}`.toLowerCase();
  const matched: LiteratureEntry[] = [];

  for (const entry of LITERATURE_ENTRIES) {
    // Saudi filter: skip non-Saudi entries when Saudi relevance is strong but entry is not relevant
    if (isSaudi && !entry.saudiRelevant) {
      // Only include if keyword match is strong (>= 2 keywords)
      const hits = entry.relevanceKeywords.filter(k => text.includes(k)).length;
      if (hits >= 2) matched.push(entry);
      continue;
    }
    const hits = entry.relevanceKeywords.filter(k => text.includes(k)).length;
    if (hits >= 1) matched.push(entry);
  }

  // Sort by keyword match count (descending), cap at 3 entries
  matched.sort((a, b) => {
    const hitsA = a.relevanceKeywords.filter(k => text.includes(k)).length;
    const hitsB = b.relevanceKeywords.filter(k => text.includes(k)).length;
    return hitsB - hitsA;
  });

  return matched.slice(0, 3);
}

// ─── Context builder ──────────────────────────────────────────────────────────

export function buildLiteratureContext(
  entries: LiteratureEntry[],
  isSaudi = false,
): string {
  if (entries.length === 0) return "";

  const parts = entries.map(e => {
    const base = `[${e.category.replace(/_/g, "-")}] ${e.title}: ${e.investmentImplication}`;
    const saudiNote = isSaudi && e.saudiAddendum ? ` (Saudi: ${e.saudiAddendum})` : "";
    return (base + saudiNote).slice(0, 280);
  });

  return `Institutional literature: ${parts.join(" || ")}`.slice(0, 600);
}
