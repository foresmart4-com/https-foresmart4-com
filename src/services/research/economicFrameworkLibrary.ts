// Phase-85B: Economic Framework Library
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Distinct from theoryEngine.ts (school COMPARISON) and frameworkSynthesis.ts
// (school SYNTHESIS). This library provides INVESTMENT-ACTIONABLE context
// for each of the 8 specified analytical frameworks — not school comparisons,
// but framework-specific implications for the current question and regime.
//
// Frameworks covered:
//   keynesian     — aggregate demand, fiscal multiplier, investment gap
//   monetarist    — money supply, inflation expectations, rate transmission
//   austrian      — capital structure, malinvestment, business cycle correction
//   behavioral    — cognitive biases, sentiment extremes, narrative divergence
//   credit_cycle  — Minsky phases, leverage, endogenous money, BIS gap
//   market_structure — liquidity, microstructure, price discovery quality
//   capital_cycle — capex phases, productive investment, capacity utilisation
//   regime_analysis — growth/inflation quadrant, asset class rotation matrix
//
// Multi-framework rule: no single framework may dominate analysis.
// Every context string includes at least one competing framework caveat.
//
// Saudi applicability: rated per framework; Saudi-specific notes injected
// when isSaudi is true and applicability is "high" or "moderate".
//
// Educational/advisory only. No autonomous trading. No broker data.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type FrameworkId =
  | "keynesian"
  | "monetarist"
  | "austrian"
  | "behavioral"
  | "credit_cycle"
  | "market_structure"
  | "capital_cycle"
  | "regime_analysis";

export interface EconomicFramework {
  id: FrameworkId;
  name: string;
  coreClaim: string;               // ≤100 chars
  applyWhen: string[];             // regime/market conditions where this framework leads
  investmentImplication: string;   // ≤120 chars: what this framework implies for positioning
  saudiApplicability: "high" | "moderate" | "low";
  saudiNote: string | null;        // compact Saudi-specific note when applicability ≥ moderate
  conflictsWith: FrameworkId[];    // frameworks that oppose this one's main mechanism
  keywords: RegExp;                // question/context match trigger
}

// ─── Framework library ─────────────────────────────────────────────────────────

export const FRAMEWORK_LIBRARY: EconomicFramework[] = [
  {
    id: "keynesian",
    name: "Keynesian Demand Framework",
    coreClaim: "Output is determined by aggregate demand; fiscal policy is the primary stabiliser when rates are constrained.",
    applyWhen: [
      "deficient aggregate demand",
      "near-zero lower bound on rates",
      "high unemployment + weak consumer spending",
      "post-crisis fiscal expansion context",
    ],
    investmentImplication: "Favour cyclicals and infrastructure when fiscal expansion is credible; underweight defensives relative to growth recovery pace.",
    saudiApplicability: "moderate",
    saudiNote: "Saudi fiscal multiplier is lower than open economies (import-heavy); oil revenue is the primary demand driver, not wage growth.",
    conflictsWith: ["monetarist", "austrian"],
    keywords: /\b(fiscal|stimulus|demand|gdp|keynesian|aggregate|نمو|إنفاق حكومي|طلب كلي)\b/i,
  },
  {
    id: "monetarist",
    name: "Monetarist Framework",
    coreClaim: "Inflation is a monetary phenomenon; stable, rule-based policy outperforms discretionary intervention.",
    applyWhen: [
      "demand-driven inflation above target",
      "monetary credibility under test",
      "rate transmission intact and effective",
      "central bank independence under scrutiny",
    ],
    investmentImplication: "Tightening cycles compress duration first; equities re-rate once terminal rate is priced; short-duration and commodity producers benefit in early tightening.",
    saudiApplicability: "moderate",
    saudiNote: "SAMA follows Fed via SAR peg — monetarist transmission is mechanical not discretionary; Saudi rate effects are imported, not domestic.",
    conflictsWith: ["keynesian", "behavioral"],
    keywords: /\b(inflation|monetar|rates?|hike|cut|tightening|easing|fed|central bank|monetary policy|تضخم|فائدة|تشديد|تيسير)\b/i,
  },
  {
    id: "austrian",
    name: "Austrian Business Cycle",
    coreClaim: "Artificially low rates cause malinvestment in the capital structure; eventual correction is unavoidable.",
    applyWhen: [
      "late cycle with prolonged low-rate stimulus",
      "visible overinvestment in specific sectors",
      "post-bubble deleveraging analysis",
      "evaluating capital misallocation risk",
    ],
    investmentImplication: "Identifies bubble sectors ahead of forced correction; favours commodities and real assets when fiat distortion is extreme; no precision on timing.",
    saudiApplicability: "low",
    saudiNote: null,
    conflictsWith: ["keynesian", "regime_analysis"],
    keywords: /\b(malinvestment|austrian|bubble|capital structure|overinvestment|boom.bust|hayek|mises|مضاربة|فقاعة)\b/i,
  },
  {
    id: "behavioral",
    name: "Behavioral Finance Framework",
    coreClaim: "Cognitive biases (anchoring, herding, loss aversion) systematically create mispricings and narratives divorced from fundamentals.",
    applyWhen: [
      "sentiment extremes (greed or fear indexes at edge)",
      "crowded positioning in one direction",
      "narrative driving price above fundamental anchor",
      "retail-driven momentum phase",
    ],
    investmentImplication: "Exploit sentiment divergence from fundamentals; increase position only when crowd is wrong; reduce conviction when narrative is already consensus.",
    saudiApplicability: "high",
    saudiNote: "TASI exhibits strong narrative-driven phases (ARAMCO IPO 2019, Vision 2030 flows); retail participation amplifies herding; contrarian signals are often early.",
    conflictsWith: ["market_structure"],
    keywords: /\b(sentiment|narrative|behavioral|herding|panic|greed|fear|retail|crowd|مشاعر|سلوكي|قطيع|رواية)\b/i,
  },
  {
    id: "credit_cycle",
    name: "Credit Cycle Framework",
    coreClaim: "Financial stability breeds risk-taking; credit is endogenous; Minsky phases (hedge → speculative → Ponzi) determine systemic fragility.",
    applyWhen: [
      "credit spreads compressing or widening sharply",
      "leverage ratios at cycle extremes",
      "shadow banking or repo stress",
      "systemic risk assessment",
    ],
    investmentImplication: "In Minsky hedge phase: extend duration and credit risk. In speculative/Ponzi: deleverage and shorten duration. BIS credit gap >10% = systemic warning.",
    saudiApplicability: "moderate",
    saudiNote: "Saudi banking credit growth tracks oil cycle; mortgage expansion under Vision 2030 is a key Minsky indicator; NIM compression occurs in rate easing phases.",
    conflictsWith: ["monetarist"],
    keywords: /\b(credit|spread|leverage|minsky|debt cycle|funding|shadow bank|نمو الائتمان|فروقات|رافعة مالية)\b/i,
  },
  {
    id: "market_structure",
    name: "Market Structure Framework",
    coreClaim: "Price discovery quality depends on liquidity depth, microstructure integrity, and the balance between informed and noise traders.",
    applyWhen: [
      "liquidity deterioration or bid-ask widening",
      "high-volatility regimes with thin order books",
      "evaluating market efficiency claims",
      "post-shock price action assessment",
    ],
    investmentImplication: "In thin liquidity: widen execution margins; reduce size. In deep liquidity: rely on market signals. Market structure failure invalidates technical levels.",
    saudiApplicability: "high",
    saudiNote: "TASI liquidity is shallower than major global markets; foreign investor flows have outsized price impact; microstructure noise is higher than MSCI EM peers.",
    conflictsWith: ["behavioral"],
    keywords: /\b(liquidity|microstructure|bid.ask|market depth|order book|volume|سيولة|عمق السوق|تداول)\b/i,
  },
  {
    id: "capital_cycle",
    name: "Capital Cycle Framework",
    coreClaim: "High returns attract capital; overcapacity destroys returns; the cycle of capex → competition → margin compression → under-investment → scarcity is persistent.",
    applyWhen: [
      "sector capex at cycle highs or lows",
      "commodity producer investment analysis",
      "evaluating long-run return mean-reversion",
      "identifying sectors in under-investment recovery",
    ],
    investmentImplication: "Buy industries at capex trough (years of under-investment → scarcity premium); sell when capex boom is mature. Oil and Saudi infrastructure are canonical examples.",
    saudiApplicability: "high",
    saudiNote: "Saudi Aramco capex cycle is the primary oil supply signal; Vision 2030 megaproject capex creates multi-year capital cycle dynamics in construction and banking.",
    conflictsWith: [],
    keywords: /\b(capex|capital expenditure|investment cycle|capacity|overcapacity|infrastructure|rامكو.*invest|استثمار رأسمالي|طاقة إنتاجية|مشاريع)\b/i,
  },
  {
    id: "regime_analysis",
    name: "Regime Analysis Framework",
    coreClaim: "Asset returns cluster by macro regime (growth↑/↓ × inflation↑/↓); regime identification is more predictive than point forecasting.",
    applyWhen: [
      "macro regime transition in progress",
      "multi-asset allocation decision",
      "growth vs inflation dominance unclear",
      "cross-asset rotation assessment",
    ],
    investmentImplication: "Map current data to growth/inflation quadrant → rotate toward historically regime-appropriate assets. Stagflation: commodities + TIPS. Goldilocks: equities + EM.",
    saudiApplicability: "high",
    saudiNote: "Saudi regime is oil-fiscal dominant: high oil → fiscal expansion → TASI tailwind. Rate regime is imported (SAR peg). Growth/inflation quadrant applies with oil layer added.",
    conflictsWith: ["austrian"],
    keywords: /\b(regime|quadrant|rotation|growth.inflation|stagflation|goldilocks|risk.on|risk.off|نظام|تحول|تخصيص أصول)\b/i,
  },
];

// ─── Framework selection ───────────────────────────────────────────────────────

export function selectFrameworks(
  question: string,
  ctx: string,
  regime?: string,
): EconomicFramework[] {
  const text = `${question} ${ctx} ${regime ?? ""}`;
  const matched: EconomicFramework[] = [];

  for (const fw of FRAMEWORK_LIBRARY) {
    if (fw.keywords.test(text)) {
      matched.push(fw);
    }
  }

  // Always enforce multi-framework: if only one matched, add the framework
  // most likely to provide a competing view.
  if (matched.length === 1) {
    const conflicts = matched[0].conflictsWith;
    if (conflicts.length > 0) {
      const conflicting = FRAMEWORK_LIBRARY.find(fw => fw.id === conflicts[0]);
      if (conflicting) matched.push(conflicting);
    } else {
      // Default complement: regime_analysis always provides multi-framework context
      const regimefw = FRAMEWORK_LIBRARY.find(fw => fw.id === "regime_analysis");
      if (regimefw && matched[0].id !== "regime_analysis") matched.push(regimefw);
    }
  }

  // Cap at 3 frameworks to stay within context budget
  return matched.slice(0, 3);
}

// ─── Context string builder ───────────────────────────────────────────────────

export function buildFrameworkLibraryContext(
  question: string,
  ctx: string,
  regime?: string,
  isSaudi = false,
): string {
  const frameworks = selectFrameworks(question, ctx, regime);
  if (frameworks.length === 0) return "";

  const parts: string[] = [];
  for (const fw of frameworks) {
    let entry = `${fw.name}: ${fw.investmentImplication}`;
    if (isSaudi && fw.saudiNote && fw.saudiApplicability !== "low") {
      entry += ` [Saudi: ${fw.saudiNote}]`;
    }
    parts.push(entry);
  }

  const conflictNote = (() => {
    const f0 = frameworks[0];
    const conflictingFw = frameworks.find(
      fw => fw.id !== f0.id && f0.conflictsWith.includes(fw.id),
    );
    return conflictingFw
      ? `${f0.name} conflicts with ${conflictingFw.name}: apply both, weight by regime evidence.`
      : null;
  })();

  return [
    `Framework context [${frameworks.map(f => f.id).join("+")}]:`,
    parts.join(" || "),
    conflictNote ? `Conflict: ${conflictNote}` : null,
    "Multi-framework required — no single framework may dominate analysis.",
  ].filter(Boolean).join(" ").slice(0, 550);
}
