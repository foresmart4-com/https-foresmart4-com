// Phase-72: Research Library
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Distinct from knowledgeLibrary.ts (flat 13-card Phase-28 library):
// this module organises research topics by DOMAIN and links each domain
// to its key theories, primary approved sources, contested areas, and
// historical relevance.
//
// Purpose: when Genesis receives a question, match it to a research domain
// and inject a domain-specific context string that guides institutional depth.

export type ResearchDomain =
  | "monetary_policy"      // CB policy, rates, inflation targeting
  | "fiscal_policy"        // government spending, debt dynamics
  | "credit_cycles"        // Minsky, financial instability, leverage
  | "market_structure"     // microstructure, liquidity, price discovery
  | "behavioral_finance"   // biases, sentiment, reflexivity
  | "portfolio_theory"     // MPT, factor investing, risk premia
  | "regional_economics"   // Saudi/Gulf, EM, regional macro
  | "macro_cycles"         // business cycle, growth-inflation regimes
  | "commodity_economics"  // oil, metals, energy markets
  | "institutional_econ";  // endogenous money, financial architecture

export interface ResearchDomainEntry {
  domain: ResearchDomain;
  keyTheories: string[];          // most important frameworks in this domain
  primarySources: string[];       // approved source names (maps to governedResearch.ts)
  contestedAreas: string[];       // where schools actively disagree
  historicalRelevance: string;    // 1 sentence: what history teaches about this domain
  genesisFocusNote: string;       // 1 sentence: what Genesis should emphasize
}

export const RESEARCH_DOMAINS: ResearchDomainEntry[] = [
  {
    domain: "monetary_policy",
    keyTheories: ["Taylor Rule", "Inflation Targeting", "Quantity Theory of Money", "New Keynesian Macro", "Neo-Fisherite Model"],
    primarySources: ["Federal Reserve", "ECB", "BIS", "Princeton", "MIT", "Chicago"],
    contestedAreas: ["Zero lower bound effectiveness", "Forward guidance credibility", "Monetarism vs New Keynesian", "Fiscal-monetary interaction"],
    historicalRelevance: "Fed tightening cycles (1970s Volcker, 1994, 2004, 2022) show that rate path consistency matters more than any single decision.",
    genesisFocusNote: "Explain the policy transmission mechanism (rate → real rate → discount rate → asset prices) and where the current cycle sits.",
  },
  {
    domain: "fiscal_policy",
    keyTheories: ["Keynesian Multiplier", "Ricardian Equivalence", "Modern Monetary Theory", "Debt Sustainability", "Expansionary Austerity"],
    primarySources: ["IMF", "World Bank", "Harvard", "Princeton", "OECD"],
    contestedAreas: ["Fiscal multiplier size", "MMT validity", "Debt threshold effects", "Crowding out vs crowding in"],
    historicalRelevance: "Post-2008 austerity vs stimulus debate and COVID-era fiscal expansion showed fiscal policy can be highly effective when monetary policy is constrained.",
    genesisFocusNote: "Address the fiscal-monetary interaction and how Saudi oil revenues determine fiscal space — not abstract debt theory.",
  },
  {
    domain: "credit_cycles",
    keyTheories: ["Minsky Financial Instability", "Debt Supercycle (BIS)", "Fisher Debt-Deflation", "Kindleberger Anatomy of Crises", "Shadow Banking"],
    primarySources: ["BIS", "Minsky", "Federal Reserve", "IMF", "LSE"],
    contestedAreas: ["Whether cycles are endogenous or exogenous", "Role of regulation in cycle moderation", "Speed of deleveraging after crises"],
    historicalRelevance: "BIS research shows credit-to-GDP gaps are the most reliable leading indicators of financial stress — 3-4 years before the event.",
    genesisFocusNote: "Focus on current credit spread level, funding stress, and whether the system is in Minsky hedge/speculative/Ponzi phase.",
  },
  {
    domain: "market_structure",
    keyTheories: ["Efficient Market Hypothesis (Fama)", "Limits to Arbitrage", "Adaptive Markets (Lo)", "Microstructure Theory", "Liquidity Premium"],
    primarySources: ["Chicago", "Wharton", "Fama", "LSE", "MIT"],
    contestedAreas: ["Degree of market efficiency", "Role of passive investing", "Price discovery vs noise", "Liquidity illusion"],
    historicalRelevance: "2010 Flash Crash and COVID March 2020 showed that liquidity can evaporate instantly even in previously liquid markets.",
    genesisFocusNote: "Discuss liquidity depth, bid-ask structure, and how market microstructure affects price discovery and volatility in the current regime.",
  },
  {
    domain: "behavioral_finance",
    keyTheories: ["Prospect Theory (Kahneman-Tversky)", "Reflexivity (Soros)", "Narrative Economics (Shiller)", "Behavioral Portfolio Theory", "Herding and Cascades"],
    primarySources: ["Yale", "Shiller", "Soros", "Princeton", "Chicago"],
    contestedAreas: ["Degree to which behavior creates persistent mispricings", "Effectiveness of arbitrage as correction mechanism", "Whether behavioral factors are risk premia or anomalies"],
    historicalRelevance: "Dot-com 2000, 2008 housing, and crypto cycles all exhibited narrative-driven price action well beyond fundamental anchors.",
    genesisFocusNote: "Identify the dominant narrative, where it may be ahead of fundamentals, and what the counter-narrative is.",
  },
  {
    domain: "portfolio_theory",
    keyTheories: ["Modern Portfolio Theory (Markowitz)", "CAPM (Sharpe)", "Factor Investing (Fama-French)", "Risk Parity (Dalio)", "Black-Litterman", "Kelly Criterion"],
    primarySources: ["Chicago", "Wharton", "Fama", "Dalio", "Princeton", "Stanford"],
    contestedAreas: ["Validity of CAPM in practice", "Factor premium persistence after discovery", "Risk parity in rising rate environments"],
    historicalRelevance: "2022 showed that the traditional 60/40 portfolio fails in simultaneous equity+bond drawdowns — diversification assumptions break in high-inflation regimes.",
    genesisFocusNote: "Frame allocation in terms of regime-appropriate factors (momentum vs value vs quality vs low-vol) and correlation breakdown risk.",
  },
  {
    domain: "regional_economics",
    keyTheories: ["Oil Curse / Dutch Disease", "Resource Rent Economics", "Vision 2030 Diversification Model", "SAR Peg Constraint", "Gulf Monetary Union Literature"],
    primarySources: ["SAMA", "IMF", "World Bank", "Oxford", "Columbia"],
    contestedAreas: ["Whether Gulf diversification can reduce oil dependency", "Optimal fiscal breakeven oil price", "Currency peg sustainability under global rate divergence"],
    historicalRelevance: "1986 oil price collapse forced Saudi fiscal contraction showing that high breakeven prices create structural vulnerability.",
    genesisFocusNote: "Always state the Saudi fiscal breakeven (~$75-80/bbl), SAMA rate-following constraint, and which sectors benefit from Vision 2030 spending.",
  },
  {
    domain: "macro_cycles",
    keyTheories: ["Business Cycle Theory (NBER)", "Kondratiev Super-Cycles", "Growth/Inflation Quadrant Matrix", "All-Weather Regime Framework (Dalio)", "Credit-Driven Cycles"],
    primarySources: ["Federal Reserve", "BIS", "Dalio", "Harvard", "MIT"],
    contestedAreas: ["Whether cycles are predictable", "Whether debt super-cycles are real", "Role of fiscal vs monetary policy in cycle management"],
    historicalRelevance: "Post-WWII macro cycles show that the rate and direction of credit growth is more predictive of recessions than leading indicators alone.",
    genesisFocusNote: "State which phase of the macro cycle the current regime represents and which asset classes historically perform in that phase.",
  },
  {
    domain: "commodity_economics",
    keyTheories: ["Oil Supply-Demand Fundamentals", "Commodity Super-Cycles", "Petrodollar Recycling", "Resource Economics", "Energy Transition Dynamics"],
    primarySources: ["Federal Reserve", "IMF", "BIS", "OECD", "World Bank"],
    contestedAreas: ["Peak oil demand timing", "OPEC discipline durability", "Energy transition impact on oil demand trajectory"],
    historicalRelevance: "1973 and 1979 oil shocks showed that energy supply disruptions create stagflationary dynamics resistant to both monetary and fiscal remedies.",
    genesisFocusNote: "Frame oil analysis through: supply discipline, demand growth (China as marginal buyer), and the fiscal breakeven for oil-exporting sovereigns.",
  },
  {
    domain: "institutional_econ",
    keyTheories: ["Endogenous Money (Post-Keynesian)", "Financial Architecture Theory", "Systemic Risk", "Too Big to Fail", "Regulatory Capture"],
    primarySources: ["BIS", "IMF", "Federal Reserve", "LSE", "Cambridge"],
    contestedAreas: ["Whether banks create money or intermediate it", "Optimal banking regulation", "Role of shadow banking in systemic risk"],
    historicalRelevance: "2008 showed that shadow banking and repo market fragility can transmit shocks faster and wider than regulated banking systems.",
    genesisFocusNote: "Address the interbank and repo market conditions, and whether the current financial architecture concentrates or distributes systemic risk.",
  },
];

// ─── Domain detection ──────────────────────────────────────────────────────────

const DOMAIN_KEYWORDS: Array<{ domain: ResearchDomain; keywords: RegExp }> = [
  { domain: "monetary_policy",    keywords: /\b(rate|fed|ecb|central bank|monetary|inflation target|فائدة|سياسة نقدية|بنك مركزي)\b/i },
  { domain: "fiscal_policy",      keywords: /\b(fiscal|budget|deficit|stimulus|government spending|debt|ميزانية|عجز|إنفاق)\b/i },
  { domain: "credit_cycles",      keywords: /\b(credit|spread|leverage|minsky|debt cycle|ائتمان|فروقات|رافعة)\b/i },
  { domain: "regional_economics", keywords: /\b(saudi|tasi|sama|aramco|gulf|vision 2030|سعود|تاسي|خليج|رؤية)\b/i },
  { domain: "behavioral_finance", keywords: /\b(behavioral|sentiment|narrative|panic|greed|fear|reflexivity|سلوكي|مشاعر)\b/i },
  { domain: "portfolio_theory",   keywords: /\b(portfolio|allocation|diversif|factor|risk parity|rebalance|محفظة|تخصيص)\b/i },
  { domain: "commodity_economics",keywords: /\b(oil|commodity|wti|brent|opec|energy|gold|نفط|سلع|طاقة)\b/i },
  { domain: "macro_cycles",       keywords: /\b(cycle|regime|recession|expansion|gdp|pmi|دورة|نظام|نمو)\b/i },
  { domain: "market_structure",   keywords: /\b(liquidity|microstructure|market structure|bid.ask|سيولة|بنية السوق)\b/i },
  { domain: "institutional_econ", keywords: /\b(endogenous|shadow bank|systemic|repo|interbank|مؤسسي|بنك الظل)\b/i },
];

export function detectResearchDomain(question: string): ResearchDomainEntry | null {
  for (const { domain, keywords } of DOMAIN_KEYWORDS) {
    if (keywords.test(question)) {
      return RESEARCH_DOMAINS.find(d => d.domain === domain) ?? null;
    }
  }
  return null;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function buildResearchLibraryContext(question: string): string {
  const domain = detectResearchDomain(question);
  if (!domain) return "";

  return [
    `Research domain: ${domain.domain.replace(/_/g, " ")}`,
    `Key theories: ${domain.keyTheories.slice(0, 3).join(", ")}`,
    `Primary sources: ${domain.primarySources.slice(0, 4).join(", ")}`,
    `Contested: ${domain.contestedAreas[0]}`,
    `Historical note: ${domain.historicalRelevance}`,
    `Genesis focus: ${domain.genesisFocusNote}`,
  ].join(" | ").slice(0, 400);
}
