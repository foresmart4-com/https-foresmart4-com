// Phase-85C: Investment School Library
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Institutional investment schools — distinct from theoryEngine.ts (economic
// school comparison) and economicFrameworkLibrary.ts (macro analytical frameworks).
// This library covers INVESTMENT MANAGEMENT APPROACHES — how professional
// allocators construct portfolios and make decisions.
//
// Schools: value, growth, macro, trend, quality, credit, risk_parity,
//          sovereign_allocation, capital_cycle (9 schools as specified)
//
// Each school entry specifies:
//   - when it outperforms (regime conditions)
//   - when it fails
//   - schools it conflicts with
//   - Saudi applicability + note
//   - key metrics the school focuses on
//
// No single school dominates. Multi-school conflicts are disclosed.
// Educational/advisory only. No autonomous trading. No broker data.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type InvestmentSchoolId =
  | "value"
  | "growth"
  | "macro"
  | "trend"
  | "quality"
  | "credit"
  | "risk_parity"
  | "sovereign_allocation"
  | "capital_cycle";

export interface InvestmentSchool {
  id: InvestmentSchoolId;
  name: string;
  coreClaim: string;              // ≤100 chars
  bestRegimeFor: string[];        // regime conditions where this school outperforms
  failsWhen: string;              // ≤80 chars: failure conditions
  conflictsWith: InvestmentSchoolId[];
  saudiApplicability: "high" | "moderate" | "low";
  saudiNote: string | null;       // ≤100 chars
  keyMetrics: string[];           // 2-3 primary metrics this school focuses on
  investmentLogic: string;        // ≤120 chars: core investment logic
  keywords: RegExp;               // detection keywords
}

// ─── School registry ───────────────────────────────────────────────────────────

export const INVESTMENT_SCHOOLS: InvestmentSchool[] = [
  {
    id: "value",
    name: "Value Investing",
    coreClaim: "Buy assets trading below intrinsic value; reversion to fair value is the source of excess return.",
    bestRegimeFor: ["bear_ranging", "macro_transition", "post_crisis_recovery", "rising_rates"],
    failsWhen: "Growth and momentum dominate; secular low-rate regime inflates multiple on all assets.",
    conflictsWith: ["growth", "trend"],
    saudiApplicability: "moderate",
    saudiNote: "TASI has periodic value dislocations; banks and utilities offer dividend yield value; limited pure-value sector depth.",
    keyMetrics: ["P/B ratio", "CAPE", "Free cash flow yield"],
    investmentLogic: "Price relative to intrinsic value drives return; patience and mean-reversion are the core mechanisms. Margin of safety protects downside.",
    keywords: /\b(value invest|deep value|undervalued|cheap|p\/b|book value|margin of safety|intrinsic|cape|استثمار القيمة|رخيص|قيمة دفترية)\b/i,
  },
  {
    id: "growth",
    name: "Growth Investing",
    coreClaim: "Companies with accelerating earnings, expanding TAM, and durable competitive advantages compound intrinsic value faster than the market expects.",
    bestRegimeFor: ["bull_trending", "low_vol_risk_on", "innovation_cycle", "low_rates"],
    failsWhen: "Rate rises compress long-duration multiples; earnings decelerate after initial expansion phase.",
    conflictsWith: ["value", "credit"],
    saudiApplicability: "low",
    saudiNote: null,
    keyMetrics: ["EPS acceleration", "Revenue growth rate", "TAM penetration"],
    investmentLogic: "Future earnings growth, discounted at low rates, justifies high current multiples. Duration risk is high — rising rates are the primary enemy.",
    keywords: /\b(growth invest|eps growth|earnings acceleration|tam|high multiple|long duration|growth stock|نمو الأرباح|أسهم نمو)\b/i,
  },
  {
    id: "macro",
    name: "Global Macro",
    coreClaim: "Top-down regime identification drives asset class and country allocation; macro forces overwhelm bottom-up stock picking in the short-to-medium term.",
    bestRegimeFor: ["macro_transition", "regime_uncertainty", "crisis_episodes", "currency_moves"],
    failsWhen: "Micro-driven quiet bull markets; regime is stable and predictable; macro calls are consensus.",
    conflictsWith: ["value", "quality"],
    saudiApplicability: "high",
    saudiNote: "Saudi macro is oil-fiscal driven; SAR peg + Fed transmission makes Saudi a pure macro-play; top-down dominates bottom-up in TASI.",
    keyMetrics: ["PMI differentials", "Current account balance", "Rate differentials"],
    investmentLogic: "Identify the macro regime, allocate by country and asset class accordingly. Position sizing and regime conviction matter more than security selection.",
    keywords: /\b(global macro|top.down|macro invest|regime|country allocat|fx|currency|كلي|تخصيص|نظام اقتصادي)\b/i,
  },
  {
    id: "trend",
    name: "Trend / Momentum Following",
    coreClaim: "Persistent price trends reflect regime persistence; momentum factor is empirically robust across asset classes and geographies.",
    bestRegimeFor: ["bull_trending", "bear_trending", "strong_momentum_regime"],
    failsWhen: "Mean-reverting markets; choppy ranging regimes; simultaneous reversal of multiple trends.",
    conflictsWith: ["value", "sovereign_allocation"],
    saudiApplicability: "low",
    saudiNote: null,
    keyMetrics: ["12-month momentum", "200-day MA", "Breakout from range"],
    investmentLogic: "Follow price trends; cut losses early; let winners run. Momentum as a factor earns risk premium from investor anchoring and institutional herding.",
    keywords: /\b(momentum|trend follow|moving average|breakout|technical|price trend|زخم|اتجاه|كسر المقاومة)\b/i,
  },
  {
    id: "quality",
    name: "Quality Investing",
    coreClaim: "High-ROCE, low-debt businesses with durable earnings compound at above-average rates through the cycle; quality premium is persistent and defensive.",
    bestRegimeFor: ["late_cycle", "high_uncertainty", "credit_stress", "slowing_growth"],
    failsWhen: "Early cycle recovery; cheap beaten-down names rerate; quality premium is already priced in.",
    conflictsWith: ["macro", "trend"],
    saudiApplicability: "moderate",
    saudiNote: "Saudi Aramco qualifies as quality (highest-ROCE energy company); banking sector quality is variable — NIM cycle-dependent.",
    keyMetrics: ["ROCE", "Interest coverage ratio", "Earnings consistency (10-year)"],
    investmentLogic: "Own businesses that compound: high and stable ROCE + reinvestment + pricing power. Quality outperforms in stress; underperforms in low-quality rallies.",
    keywords: /\b(quality invest|roce|return on capital|high quality|compounders|earnings quality|جودة|عائد على رأس المال)\b/i,
  },
  {
    id: "credit",
    name: "Credit / Fixed Income",
    coreClaim: "Credit risk premium — the spread over risk-free rate — is the primary source of fixed income excess return; cycle timing determines entry.",
    bestRegimeFor: ["credit_cycle_trough", "spread_peak", "high_vol_risk_off"],
    failsWhen: "Spread compression already extreme; rising rate regime erodes fixed-income total return; defaults rise faster than spread premium.",
    conflictsWith: ["growth", "sovereign_allocation"],
    saudiApplicability: "moderate",
    saudiNote: "Saudi sukuk and government bonds are investment-grade with low default risk; credit spread on Saudi corporates is tight; duration risk relevant in Fed cycle.",
    keyMetrics: ["IG spread", "HY spread", "Default rate forecast"],
    investmentLogic: "Buy credit risk when spread compensates; reduce when spread is at historical lows. Credit leads equities by 6-8 weeks as a forward indicator.",
    keywords: /\b(credit invest|fixed income|spreads?|yield|bonds?|high yield|investment grade|sukuk|صكوك|سندات|فروق الائتمان)\b/i,
  },
  {
    id: "risk_parity",
    name: "Risk Parity",
    coreClaim: "Allocate capital by equalising risk contribution across asset classes; leverage up low-volatility assets to achieve balance across regimes.",
    bestRegimeFor: ["low_vol_risk_on", "normal_correlation_regime", "multi_asset_allocation"],
    failsWhen: "Simultaneous equity-bond drawdown (2022 style); rising rates and rising inflation hit both legs; correlations spike to 1.",
    conflictsWith: ["trend", "sovereign_allocation"],
    saudiApplicability: "low",
    saudiNote: null,
    keyMetrics: ["Risk contribution per asset", "Cross-asset correlation", "Sharpe ratio"],
    investmentLogic: "No asset class should dominate portfolio risk. Leverage the lower-vol assets (bonds) to match contribution. Fails when the diversification assumption breaks.",
    keywords: /\b(risk parity|all.weather|risk contribution|cross.asset balance|dalio portfolio|تعادل المخاطر|محفظة متوازنة)\b/i,
  },
  {
    id: "sovereign_allocation",
    name: "Sovereign / SWF Allocation",
    coreClaim: "Sovereign wealth fund allocation optimises for inter-generational wealth transfer, not short-term returns; liquidity premium and home-country diversification are primary constraints.",
    bestRegimeFor: ["long_horizon", "oil_fiscal_surplus", "diversification_mandate"],
    failsWhen: "Short-term liquidity pressure; political constraints override return optimisation; fiscal deficit forces asset liquidation.",
    conflictsWith: ["trend", "credit"],
    saudiApplicability: "high",
    saudiNote: "PIF and SAMA FX reserves are the primary Saudi sovereign allocation vehicles; PIF's Vision 2030 mandate is domestic-biased; inter-generational transfer is explicit.",
    keyMetrics: ["Fiscal breakeven oil price", "Reserve adequacy ratio", "Domestic vs international allocation split"],
    investmentLogic: "Long-horizon SWF: maximise illiquidity premium; diversify away from oil revenue concentration; domestic capex for Vision 2030 competes with international allocation.",
    keywords: /\b(sovereign|swf|pif|public investment|wealth fund|intergenerational|صندوق الثروة|صندوق الاستثمارات العامة|ثروة سيادية)\b/i,
  },
  {
    id: "capital_cycle",
    name: "Capital Cycle Investing",
    coreClaim: "High returns attract capital; overcapacity compresses returns; industries that under-invest for years create the next scarcity premium.",
    bestRegimeFor: ["commodity_trough", "sector_capex_low", "supply_scarcity", "post_bust_recovery"],
    failsWhen: "Capex boom is already mature; supply response is faster than expected; demand collapses before supply responds.",
    conflictsWith: ["growth", "trend"],
    saudiApplicability: "high",
    saudiNote: "Aramco capex cycle is the primary global oil supply signal; Vision 2030 megaproject capex creates multi-year capital cycle dynamics in Saudi infrastructure, real estate, banking.",
    keyMetrics: ["Industry capex-to-depreciation ratio", "Capacity utilisation", "Supply pipeline growth rate"],
    investmentLogic: "Buy industries at capex trough; sell when capex boom is mature. Long lead times (3-7 years for oil/mining) mean early entry matters more than timing the exact bottom.",
    keywords: /\b(capital cycle|capex cycle|overcapacity|under.investment|supply scarcity|industry structure|دورة رأس المال|استثمار الطاقة)\b/i,
  },
];

// ─── Detection and retrieval ──────────────────────────────────────────────────

export function detectRelevantSchools(
  question: string,
  ctx: string,
  regime?: string,
  isSaudi = false,
  maxResults = 2,
): InvestmentSchool[] {
  const text = `${question} ${ctx} ${regime ?? ""}`;
  const matched: InvestmentSchool[] = [];

  for (const school of INVESTMENT_SCHOOLS) {
    if (school.keywords.test(text)) {
      matched.push(school);
    }
  }

  // Saudi boost: if isSaudi and no match yet, default to macro + sovereign
  if (matched.length === 0 && isSaudi) {
    const macro    = INVESTMENT_SCHOOLS.find(s => s.id === "macro");
    const sov      = INVESTMENT_SCHOOLS.find(s => s.id === "sovereign_allocation");
    if (macro) matched.push(macro);
    if (sov)   matched.push(sov);
  }

  // Regime-based defaults when no keyword match
  if (matched.length === 0) {
    const regimeLower = (regime ?? "").toLowerCase();
    if (/tighten|rate|inflation/.test(regimeLower)) {
      const credit = INVESTMENT_SCHOOLS.find(s => s.id === "credit");
      const value  = INVESTMENT_SCHOOLS.find(s => s.id === "value");
      if (credit) matched.push(credit);
      if (value)  matched.push(value);
    } else if (/bull|trend/.test(regimeLower)) {
      const growth = INVESTMENT_SCHOOLS.find(s => s.id === "growth");
      const trend  = INVESTMENT_SCHOOLS.find(s => s.id === "trend");
      if (growth) matched.push(growth);
      if (trend)  matched.push(trend);
    }
  }

  // If only one, add a conflicting school for balance
  if (matched.length === 1 && matched[0].conflictsWith.length > 0) {
    const conflictId = matched[0].conflictsWith[0];
    const conflict = INVESTMENT_SCHOOLS.find(s => s.id === conflictId);
    if (conflict) matched.push(conflict);
  }

  return matched.slice(0, maxResults).filter(Boolean);
}

// ─── Context builder ──────────────────────────────────────────────────────────

export function buildSchoolContext(
  question: string,
  ctx: string,
  regime?: string,
  isSaudi = false,
): string {
  const schools = detectRelevantSchools(question, ctx, regime, isSaudi);
  if (schools.length === 0) return "";

  const parts = schools.map(s => {
    let entry = `${s.name}: ${s.investmentLogic}`;
    if (isSaudi && s.saudiNote && s.saudiApplicability !== "low") {
      entry += ` [Saudi: ${s.saudiNote}]`;
    }
    return entry.slice(0, 200);
  });

  const conflictNote = (() => {
    if (schools.length < 2) return null;
    const s0 = schools[0];
    const s1 = schools[1];
    if (s0.conflictsWith.includes(s1.id) || s1.conflictsWith.includes(s0.id)) {
      return `${s0.name} and ${s1.name} conflict: both may apply — disclose competing logic.`;
    }
    return null;
  })();

  return [
    `Investment school [${schools.map(s => s.id).join("+")}]:`,
    parts.join(" || "),
    conflictNote,
  ].filter(Boolean).join(" ").slice(0, 420);
}
