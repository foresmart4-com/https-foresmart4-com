// Phase-73: Theory + School Comparison Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// No single-school dominance. Compares 11 economic schools across:
//   - Core claim
//   - What they agree on with others
//   - Where they conflict
//   - When they work / when they fail
//   - Empirical support strength
//   - Regime fit (which macro regimes favor this school's predictions)
//
// Output: a balanced, multi-school context string injected into Genesis.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type School =
  | "keynesian"
  | "monetarist"
  | "austrian"
  | "behavioral"
  | "institutional"    // Minsky, endogenous money, financial instability
  | "portfolio_theory" // MPT, CAPM, factor investing
  | "factor_investing"
  | "macro_regime"     // regime-based macro frameworks (Dalio, growth/inflation matrix)
  | "credit_cycle"     // Minsky + BIS + Fisher
  | "reflexivity"      // Soros, feedback loops
  | "adaptive_markets";// Lo — markets adapt; neither fully efficient nor irrational

export interface SchoolProfile {
  school: School;
  name: string;
  coreClaim: string;         // ≤100 chars: the central proposition
  agreesWith: School[];      // schools that share compatible views
  conflictsWith: School[];   // schools with opposing predictions
  worksWhen: string;         // conditions where this school's predictions hold best
  failsWhen: string;         // conditions where this school underperforms
  empiricalStrength: "strong" | "moderate" | "contested" | "limited";
  regimeFit: string[];       // market regimes where most applicable
  keyFigures: string[];      // 2-3 primary thinkers
}

export interface TheoryComparisonResult {
  matchedSchools: SchoolProfile[];
  agreementMap: string;     // where the matched schools agree
  conflictMap: string;      // where they conflict
  dominantSchool: SchoolProfile | null; // most empirically supported for current regime
  minoritySchool: SchoolProfile | null; // legitimate alternative with competing evidence
  comparisonContext: string; // injectable Genesis context ≤300 chars
}

// ─── School profiles ───────────────────────────────────────────────────────────

export const SCHOOL_PROFILES: SchoolProfile[] = [
  {
    school: "keynesian",
    name: "Keynesian Economics",
    coreClaim: "Aggregate demand drives output; fiscal policy is the primary stabilisation tool when monetary policy is ineffective.",
    agreesWith: ["institutional", "behavioral"],
    conflictsWith: ["monetarist", "austrian"],
    worksWhen: "Liquidity trap; ZLB; deficient demand; high unemployment; fiscal multiplier > 1.",
    failsWhen: "Supply-driven inflation; stagflation; crowding-out in high-debt economies; credibility-constrained fiscal space.",
    empiricalStrength: "strong",
    regimeFit: ["bear_ranging", "macro_transition"],
    keyFigures: ["Keynes", "Krugman", "Summers"],
  },
  {
    school: "monetarist",
    name: "Monetarism",
    coreClaim: "Inflation is always and everywhere a monetary phenomenon; stable money growth is superior to discretionary policy.",
    agreesWith: ["austrian"],
    conflictsWith: ["keynesian", "institutional"],
    worksWhen: "Demand-driven inflation; stable supply conditions; credible CB independence; long-run relationships between M2 and prices.",
    failsWhen: "Supply shocks; velocity instability; unconventional monetary tools; global liquidity disconnected from domestic money supply.",
    empiricalStrength: "contested",
    regimeFit: ["high_vol_risk-off", "macro_transition"],
    keyFigures: ["Friedman", "Schwartz", "Bernanke (early work)"],
  },
  {
    school: "austrian",
    name: "Austrian Business Cycle",
    coreClaim: "Artificially low rates cause malinvestment in capital structure; eventual correction is unavoidable and should not be suppressed.",
    agreesWith: ["monetarist"],
    conflictsWith: ["keynesian", "institutional", "macro_regime"],
    worksWhen: "Identifying late-cycle malinvestment; explaining boom-bust without central tendency; post-bubble deleveraging analysis.",
    failsWhen: "Short-run stabilisation; policy prescriptions (no quantifiable policy tool); real-world deflation risk management.",
    empiricalStrength: "limited",
    regimeFit: ["bull_trending", "bear_ranging"],
    keyFigures: ["Hayek", "Mises", "Rothbard"],
  },
  {
    school: "behavioral",
    name: "Behavioral Finance",
    coreClaim: "Cognitive biases (loss aversion, anchoring, herding) systematically affect prices; markets are not fully efficient.",
    agreesWith: ["keynesian", "adaptive_markets", "reflexivity"],
    conflictsWith: ["portfolio_theory", "factor_investing"],
    worksWhen: "Narrative-driven markets; crowded positioning; sentiment extremes; momentum overshoots; retail-driven cycles.",
    failsWhen: "Arbitrage-corrected markets; institutional-dominated liquidity; long-term value convergence; mean-reversion after extremes.",
    empiricalStrength: "strong",
    regimeFit: ["bull_trending", "high_vol_risk-off", "macro_transition"],
    keyFigures: ["Kahneman", "Thaler", "Shiller"],
  },
  {
    school: "institutional",
    name: "Financial Instability / Institutional Economics",
    coreClaim: "Financial systems are inherently unstable; stability breeds risk-taking; credit cycles are endogenous, not exogenous.",
    agreesWith: ["keynesian", "credit_cycle"],
    conflictsWith: ["monetarist", "portfolio_theory"],
    worksWhen: "Late credit cycle; leverage peaks; shadow banking fragility; systemic risk assessment; Minsky moment analysis.",
    failsWhen: "Early cycle recoveries; predicting timing of the Minsky moment; prescriptive stabilisation policy.",
    empiricalStrength: "strong",
    regimeFit: ["bear_ranging", "high_vol_risk-off"],
    keyFigures: ["Minsky", "Kindleberger", "BIS researchers"],
  },
  {
    school: "portfolio_theory",
    name: "Modern Portfolio Theory / CAPM",
    coreClaim: "Risk-efficient portfolios lie on the efficient frontier; expected return is linearly related to systematic risk (beta).",
    agreesWith: ["factor_investing"],
    conflictsWith: ["behavioral", "reflexivity", "institutional"],
    worksWhen: "Long-horizon, liquid markets; institutional multi-asset allocation; diversification in normal correlation regimes.",
    failsWhen: "Correlation breakdown in stress (diversification fails precisely when needed); fat-tail distributions; illiquid markets.",
    empiricalStrength: "moderate",
    regimeFit: ["low_vol_accumulation", "bull_trending"],
    keyFigures: ["Markowitz", "Sharpe", "Black"],
  },
  {
    school: "factor_investing",
    name: "Factor Investing",
    coreClaim: "Systematic exposure to risk premia (value, momentum, quality, low-vol) generates durable excess returns over cycles.",
    agreesWith: ["portfolio_theory"],
    conflictsWith: ["behavioral", "adaptive_markets"],
    worksWhen: "Patient multi-cycle horizon; disciplined rebalancing; factor premia not overly crowded; institutional mandate.",
    failsWhen: "Factor crowding post-discovery; short implementation horizon; factor timing (momentum reversal, value traps).",
    empiricalStrength: "moderate",
    regimeFit: ["bull_trending", "low_vol_accumulation"],
    keyFigures: ["Fama", "French", "Asness"],
  },
  {
    school: "macro_regime",
    name: "Macro Regime Frameworks",
    coreClaim: "Growth and inflation dynamics define regime quadrants; asset class behavior differs systematically across quadrants.",
    agreesWith: ["credit_cycle", "institutional"],
    conflictsWith: ["austrian"],
    worksWhen: "Medium-term regime identification; asset rotation; tactical allocation; CB policy transition periods.",
    failsWhen: "Regime transition timing is highly uncertain; model doesn't predict regimes, only explains them ex-post.",
    empiricalStrength: "moderate",
    regimeFit: ["macro_transition", "bull_trending", "bear_ranging"],
    keyFigures: ["Dalio", "JPMorgan Asset Management", "Goldman Sachs research"],
  },
  {
    school: "credit_cycle",
    name: "Credit Cycle Theory (BIS)",
    coreClaim: "Credit-to-GDP gaps are the most reliable early warning indicators of financial stress; cycles last 15-20 years.",
    agreesWith: ["institutional", "keynesian"],
    conflictsWith: ["monetarist"],
    worksWhen: "Identifying systemic risk build-up; explaining why stress occurs well after credit peak; cross-border contagion.",
    failsWhen: "Predicting exact timing; short-cycle analysis; economies with structural credit constraints (like GCC).",
    empiricalStrength: "strong",
    regimeFit: ["high_vol_risk-off", "bear_ranging"],
    keyFigures: ["BIS (Borio, Shin)", "Fisher", "Drehmann"],
  },
  {
    school: "reflexivity",
    name: "Reflexivity (Soros)",
    coreClaim: "Participants' beliefs about fundamentals change those fundamentals; markets create self-reinforcing trends then abrupt reversals.",
    agreesWith: ["behavioral", "adaptive_markets"],
    conflictsWith: ["portfolio_theory", "factor_investing", "monetarist"],
    worksWhen: "Currency crises; commodity super-cycles; boom-bust equity cycles; narrative-driven sentiment extremes.",
    failsWhen: "Predicting reversal timing; applies to specific episodes but lacks testable prediction framework; not falsifiable.",
    empiricalStrength: "contested",
    regimeFit: ["bull_trending", "high_vol_risk-off", "macro_transition"],
    keyFigures: ["Soros", "Druckenmiller"],
  },
  {
    school: "adaptive_markets",
    name: "Adaptive Markets Hypothesis",
    coreClaim: "Markets are neither fully efficient nor fully irrational; participants adapt; efficiency varies by regime and time.",
    agreesWith: ["behavioral", "reflexivity"],
    conflictsWith: ["portfolio_theory"],
    worksWhen: "Bridging EMH and behavioral finance; explaining regime-dependent strategy performance; institutional evolution.",
    failsWhen: "Specific prediction; harder to operationalise than EMH or behavioral; lacks falsifiable specific claims.",
    empiricalStrength: "moderate",
    regimeFit: ["macro_transition", "bull_trending"],
    keyFigures: ["Lo", "Farmer"],
  },
];

// ─── School detection from question ───────────────────────────────────────────

const SCHOOL_KEYWORDS: Array<{ school: School; pattern: RegExp }> = [
  { school: "keynesian",       pattern: /\b(keynesian|fiscal (stimulus|policy|multiplier)|aggregate demand|demand deficit|ڈیم)\b/i },
  { school: "monetarist",      pattern: /\b(monetarist|friedman|money supply|quantity theory|m2|inflation (is|as) monetary)\b/i },
  { school: "austrian",        pattern: /\b(austrian|hayek|mises|malinvestment|natural rate|capital structure)\b/i },
  { school: "behavioral",      pattern: /\b(behavioral|behavioural|kahneman|thaler|shiller|bias|herding|sentiment|narrative)\b/i },
  { school: "institutional",   pattern: /\b(minsky|financial instability|endogenous (money|credit)|credit cycle|shadow bank)\b/i },
  { school: "portfolio_theory",pattern: /\b(markowitz|capm|efficient frontier|beta|systematic risk|sharpe ratio|mpt)\b/i },
  { school: "factor_investing",pattern: /\b(factor (invest|premium|tilt)|fama.french|momentum (factor|premium)|value (factor|premium)|quality factor)\b/i },
  { school: "macro_regime",    pattern: /\b(macro regime|all.?weather|growth.?inflation (matrix|quadrant)|dalio|risk parity)\b/i },
  { school: "credit_cycle",    pattern: /\b(credit.?to.?gdp|bis credit|debt super.?cycle|credit gap|financial cycle)\b/i },
  { school: "reflexivity",     pattern: /\b(reflexiv|soros|feedback loop|boom.?bust cycle|self.?reinforcing)\b/i },
  { school: "adaptive_markets",pattern: /\b(adaptive market|lo hypothesis|strategy (survival|adapt)|evolving (efficiency|market))\b/i },
];

function detectSchools(question: string, ctx: string): School[] {
  const text = `${question} ${ctx}`.toLowerCase();
  return SCHOOL_KEYWORDS.filter(({ pattern }) => pattern.test(text)).map(({ school }) => school);
}

function findMostEmpiricallySupported(schools: SchoolProfile[]): SchoolProfile | null {
  const order: Record<string, number> = { strong: 3, moderate: 2, contested: 1, limited: 0 };
  return schools.sort((a, b) => (order[b.empiricalStrength] ?? 0) - (order[a.empiricalStrength] ?? 0))[0] ?? null;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function compareTheories(question: string, ctx: string = "", regime?: string): TheoryComparisonResult {
  const detectedSchools = detectSchools(question, ctx);
  const matchedSchools = detectedSchools.length > 0
    ? SCHOOL_PROFILES.filter(p => detectedSchools.includes(p.school))
    : SCHOOL_PROFILES.filter(p => regime && p.regimeFit.some(r => regime.includes(r.replace(/_/g, " ").toLowerCase())));

  const limitedSchools = matchedSchools.slice(0, 4);

  // Agreement map
  const agreements: string[] = [];
  for (let i = 0; i < limitedSchools.length - 1; i++) {
    for (let j = i + 1; j < limitedSchools.length; j++) {
      if (limitedSchools[i].agreesWith.includes(limitedSchools[j].school) ||
          limitedSchools[j].agreesWith.includes(limitedSchools[i].school)) {
        agreements.push(`${limitedSchools[i].name} + ${limitedSchools[j].name} agree`);
      }
    }
  }

  // Conflict map
  const conflicts: string[] = [];
  for (let i = 0; i < limitedSchools.length - 1; i++) {
    for (let j = i + 1; j < limitedSchools.length; j++) {
      if (limitedSchools[i].conflictsWith.includes(limitedSchools[j].school) ||
          limitedSchools[j].conflictsWith.includes(limitedSchools[i].school)) {
        conflicts.push(`${limitedSchools[i].name} conflicts with ${limitedSchools[j].name}`);
      }
    }
  }

  const dominantSchool = findMostEmpiricallySupported([...limitedSchools]);
  const minoritySchool = limitedSchools.find(s => s !== dominantSchool && s.conflictsWith.includes(dominantSchool?.school ?? "keynesian")) ?? null;

  const agreementMap = agreements.length > 0 ? agreements.slice(0, 2).join("; ") : "No direct agreements among matched schools";
  const conflictMap  = conflicts.length > 0  ? conflicts.slice(0, 2).join("; ")  : "No direct conflicts among matched schools";

  const comparisonContext = limitedSchools.length > 0
    ? `Theory lens: [${limitedSchools.map(s => s.name).join(", ")}] | Agree: ${agreementMap.slice(0, 60)} | Conflict: ${conflictMap.slice(0, 60)}`.slice(0, 300)
    : "";

  return { matchedSchools: limitedSchools, agreementMap, conflictMap, dominantSchool, minoritySchool, comparisonContext };
}
