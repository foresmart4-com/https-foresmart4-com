/**
 * Knowledge Corpus — Extended Economic Intelligence
 * Pure static module — no network calls, no AI calls, no localStorage writes.
 * Compressed institutional knowledge derived from economics, markets, policy,
 * and financial literature. Extends Phase-28 knowledge library with richer
 * classification, cross-school diversity, and historical analog support.
 *
 * Design rules:
 * - All content is original paraphrase of established economic concepts
 * - No verbatim book quotes, no copyrighted text, no raw passages
 * - No single-school dominance: competing frameworks explicitly represented
 * - No trend chasing: popularity ≠ quality; evidence durability is the filter
 * - Bounded: fixed 22-card corpus; growth requires explicit code change
 * - Advisory framing: all cards use hedged, probabilistic language
 * - No black-box memory: every card has an explicit causal map
 * - Quality filter: excludes trading hype, influencer content, get-rich material
 *
 * Coverage: Minsky / financial instability, Taylor Rule, Fisher equation,
 * EMH / limits to arbitrage, liquidity premium, prospect theory, narrative
 * economics, secular stagnation, debt supercycles, Kindleberger anatomy,
 * sudden stops, stagflation analogs, GFC transmission, factor risk premia,
 * tail risk, endogenous money, Kondratiev super-cycles, Austrian business
 * cycle, anchoring bias, Nixon shock, volatility regimes, market microstructure.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type FrameworkClass =
  | "macro_framework"       // macro regime / cycle frameworks
  | "monetary_framework"    // CB policy, money mechanics
  | "market_framework"      // market structure, microstructure
  | "behavioral_framework"  // behavioral finance, psychology
  | "historical_framework"  // historical episodes and analogs
  | "portfolio_framework"   // portfolio theory, risk premia
  | "policy_framework"      // fiscal, regulatory, structural policy
  | "uncertainty_framework";// tail risk, ambiguity, Knightian uncertainty

export type ThinkingSchool =
  | "keynesian"           // aggregate demand, fiscal multiplier
  | "monetarist"          // money supply, inflation targeting
  | "austrian"            // capital structure, business cycle
  | "behavioral"          // psychological biases and heuristics
  | "institutional"       // financial instability, endogenous credit
  | "post_keynesian"      // endogenous money, debt dynamics
  | "market_microstructure" // order flow, liquidity, price discovery
  | "heterodox";          // non-mainstream but institutionally discussed

export type KnowledgeQualityLabel =
  | "high_institutional_value" // broad CB + academic consensus
  | "contextual_value"         // useful in specific regimes / contexts
  | "debated_framework"        // actively contested across schools
  | "weak_relevance";          // limited current applicability

export interface CorpusCard {
  id: string;
  title: string;                   // framework or concept name
  framework: FrameworkClass;
  school: ThinkingSchool;
  domain: string;                  // macro | credit | behavioral | market | portfolio | history | policy
  compression: string;             // ≤150 chars original compressed insight
  causalMap: string;               // A → B → C (≤100 chars)
  historicalAnalog: string | null; // e.g. "1970s stagflation" — null if no clear analog
  keywords: string[];              // lowercase match keywords
  regimeRelevance: string[];       // market regimes where most applicable
  macroRegions: string[];          // most relevant macro regions (empty = global)
  qualityLabel: KnowledgeQualityLabel;
  thinkingSchool: ThinkingSchool;
  competingView: string | null;    // 1-phrase competing school's counter-argument
}

// ─── Corpus cards ─────────────────────────────────────────────────────────────

export const CORPUS_CARDS: CorpusCard[] = [
  {
    id: "minsky_instability",
    title: "Minsky Financial Instability Hypothesis",
    framework: "macro_framework",
    school: "institutional",
    domain: "credit",
    compression: "Stability breeds instability: long expansions induce speculative then Ponzi finance, culminating in a 'Minsky moment' of forced deleveraging and asset price collapse.",
    causalMap: "Stability → complacency → speculative lending → Ponzi units → liquidity shock → deleveraging",
    historicalAnalog: "2008 GFC pre-crisis phase",
    keywords: ["minsky", "financial instability", "ponzi finance", "deleveraging", "credit expansion", "stability breeds", "leverage cycle", "speculative"],
    regimeRelevance: ["bull_trending", "macro_transition", "high_vol_risk-off"],
    macroRegions: [],
    qualityLabel: "high_institutional_value",
    thinkingSchool: "institutional",
    competingView: "Monetarists: instability stems from monetary policy errors, not endogenous credit cycles",
  },
  {
    id: "taylor_rule",
    title: "Taylor Rule and Interest Rate Rules",
    framework: "monetary_framework",
    school: "monetarist",
    domain: "monetary-policy",
    compression: "CB policy rates can be approximated as a function of inflation deviation from target and output-gap size; persistent deviations from the rule imply easy or tight policy conditions.",
    causalMap: "Inflation gap + output gap → policy rate guidance → real rate → demand → price stability",
    historicalAnalog: "2021-22 below-rule rates → 2022-23 catch-up hikes",
    keywords: ["taylor rule", "interest rate rule", "policy rate", "inflation target", "output gap", "fed funds", "rate setting", "cb policy"],
    regimeRelevance: ["bull_trending", "bear_ranging", "macro_transition"],
    macroRegions: ["US", "Europe"],
    qualityLabel: "high_institutional_value",
    thinkingSchool: "monetarist",
    competingView: "Post-Keynesian: output gap is unmeasurable; rules create procyclical policy errors",
  },
  {
    id: "fisher_real_rates",
    title: "Fisher Equation and Real Interest Rates",
    framework: "macro_framework",
    school: "monetarist",
    domain: "macro",
    compression: "The real interest rate approximates the nominal rate minus expected inflation; asset valuations are discounted at real rates, making inflation expectations central to multi-asset pricing.",
    causalMap: "Nominal rate − expected inflation = real rate → discount rate → equity/gold valuation",
    historicalAnalog: "2022 real rate surge → equity multiple compression",
    keywords: ["real rate", "real interest rate", "fisher", "inflation expectation", "tips", "breakeven", "discount rate", "nominal rate"],
    regimeRelevance: ["bull_trending", "bear_ranging", "macro_transition"],
    macroRegions: [],
    qualityLabel: "high_institutional_value",
    thinkingSchool: "monetarist",
    competingView: "Austrian: real rates set by time preference, not CB fiat; targeting them distorts capital",
  },
  {
    id: "emh_limits_arbitrage",
    title: "Efficient Market Hypothesis and Limits to Arbitrage",
    framework: "market_framework",
    school: "market_microstructure",
    domain: "market-structure",
    compression: "Markets are informationally efficient on average, but limits to arbitrage (funding constraints, noise-trader risk) allow mispricings to persist far longer than theory suggests.",
    causalMap: "Information → price → arbitrage → efficiency (ideal); noise + friction + funding limits → persistent mispricing",
    historicalAnalog: null,
    keywords: ["efficient market", "emh", "arbitrage", "mispricing", "noise trader", "limits to arbitrage", "alpha", "market efficiency", "price discovery"],
    regimeRelevance: ["bull_trending", "bear_ranging", "high_vol_risk-off"],
    macroRegions: [],
    qualityLabel: "debated_framework",
    thinkingSchool: "market_microstructure",
    competingView: "Behavioral: systematic biases prevent efficiency; fundamentals frequently disconnected from price",
  },
  {
    id: "liquidity_premium",
    title: "Liquidity Premium and Illiquidity Discount",
    framework: "portfolio_framework",
    school: "market_microstructure",
    domain: "market-structure",
    compression: "Illiquid assets require a return premium to compensate investors for the inability to exit quickly; liquidity premiums compress during risk-on and widen sharply during stress.",
    causalMap: "Illiquidity → required premium → compresses in bull markets → widens in stress → forced selling → contagion",
    historicalAnalog: "March 2020 liquidity seizure",
    keywords: ["liquidity premium", "illiquidity", "liquidity risk", "bid-ask spread", "market depth", "exit risk", "illiquid assets", "liquidity crisis"],
    regimeRelevance: ["high_vol_risk-off", "bear_ranging", "macro_transition"],
    macroRegions: [],
    qualityLabel: "high_institutional_value",
    thinkingSchool: "market_microstructure",
    competingView: null,
  },
  {
    id: "prospect_theory",
    title: "Prospect Theory and Loss Aversion",
    framework: "behavioral_framework",
    school: "behavioral",
    domain: "behavioral",
    compression: "Losses loom approximately twice as large as equivalent gains in human perception; investors hold losers too long and sell winners too early, distorting market mean-reversion dynamics.",
    causalMap: "Loss aversion → disposition effect → winners sold early, losers held → return asymmetry → momentum + reversal patterns",
    historicalAnalog: null,
    keywords: ["loss aversion", "prospect theory", "behavioral finance", "disposition effect", "kahneman", "tversky", "investor psychology", "mental accounting"],
    regimeRelevance: ["bear_ranging", "high_vol_risk-off", "bull_trending"],
    macroRegions: [],
    qualityLabel: "high_institutional_value",
    thinkingSchool: "behavioral",
    competingView: "Rational-expectations: apparent loss aversion reflects rational risk aversion at market equilibrium",
  },
  {
    id: "narrative_economics",
    title: "Narrative Economics (Shiller Framework)",
    framework: "behavioral_framework",
    school: "behavioral",
    domain: "behavioral",
    compression: "Economic narratives — viral stories about the economy — spread like epidemics and can cause or amplify real economic events by coordinating investor and consumer behavior.",
    causalMap: "Narrative spread → belief coordination → investment/consumption shift → real GDP impact → self-fulfilling dynamics",
    historicalAnalog: "2021 meme-stock frenzy",
    keywords: ["narrative", "story", "viral", "meme", "social contagion", "animal spirits", "behavioral", "shiller", "narrative economics"],
    regimeRelevance: ["bull_trending", "high_vol_risk-off", "macro_transition"],
    macroRegions: [],
    qualityLabel: "contextual_value",
    thinkingSchool: "behavioral",
    competingView: "Monetarist: narratives are epiphenomena; underlying monetary conditions drive real outcomes",
  },
  {
    id: "secular_stagnation",
    title: "Secular Stagnation and Neutral Rate Decline",
    framework: "macro_framework",
    school: "keynesian",
    domain: "macro",
    compression: "Structural forces (demographics, inequality, savings gluts) have lowered the neutral real rate, making monetary policy less potent and fiscal policy more necessary to sustain full employment.",
    causalMap: "Demographics + savings glut → neutral rate ↓ → policy ineffectiveness → fiscal dependence → low-growth trap",
    historicalAnalog: "2010-19 post-GFC low-growth decade",
    keywords: ["secular stagnation", "neutral rate", "r-star", "r*", "savings glut", "demographics", "low growth", "summers", "low inflation", "deflation risk"],
    regimeRelevance: ["bear_ranging", "macro_transition"],
    macroRegions: ["US", "Europe"],
    qualityLabel: "debated_framework",
    thinkingSchool: "keynesian",
    competingView: "Monetarist: stagnation reflects policy errors; structural reforms and sound money can restore growth",
  },
  {
    id: "debt_supercycle",
    title: "Debt Supercycle and Reinhart-Rogoff Threshold",
    framework: "historical_framework",
    school: "institutional",
    domain: "macro",
    compression: "Debt-to-GDP above ~90% is historically associated with meaningfully slower growth across many countries; sovereign debt crises often follow decades of gradual accumulation rather than sudden shifts.",
    causalMap: "Debt accumulation → debt service cost → fiscal crowding-out → growth drag → eventual restructuring or inflating away",
    historicalAnalog: "Post-WW2 debt reduction episodes",
    keywords: ["debt", "debt gdp", "sovereign debt", "debt supercycle", "reinhart", "rogoff", "fiscal", "deficit", "national debt", "debt crisis"],
    regimeRelevance: ["bear_ranging", "macro_transition", "high_vol_risk-off"],
    macroRegions: [],
    qualityLabel: "debated_framework",
    thinkingSchool: "institutional",
    competingView: "Post-Keynesian: high debt is sustainable at low rates; debt-to-GDP threshold claims lack robust empirical support",
  },
  {
    id: "kindleberger_anatomy",
    title: "Kindleberger Boom-Bust Anatomy",
    framework: "historical_framework",
    school: "institutional",
    domain: "crisis",
    compression: "Financial booms follow a recurring anatomy: displacement (new opportunity) → credit expansion → euphoria → distress → revulsion. Each stage has identifiable market signals.",
    causalMap: "Displacement → credit expansion → overtrading → distress signal → panic → revulsion → trough",
    historicalAnalog: "2007-08 financial crisis",
    keywords: ["boom bust", "financial crisis", "manias panics", "kindleberger", "speculative bubble", "revulsion", "displacement", "financial cycle", "euphoria"],
    regimeRelevance: ["bull_trending", "macro_transition", "high_vol_risk-off"],
    macroRegions: [],
    qualityLabel: "high_institutional_value",
    thinkingSchool: "institutional",
    competingView: null,
  },
  {
    id: "sudden_stop",
    title: "Sudden Stop and Balance-of-Payments Crisis",
    framework: "historical_framework",
    school: "institutional",
    domain: "em-macro",
    compression: "Emerging-market economies dependent on external financing are vulnerable to sudden reversals of capital inflows (sudden stops), typically triggered by DXY strength or global risk-off.",
    causalMap: "Global risk-off → DXY rise → EM capital outflow → FX pressure → CB rate hike → growth shock → BoP crisis",
    historicalAnalog: "1997-98 Asian financial crisis",
    keywords: ["sudden stop", "em crisis", "capital outflow", "emerging market", "balance of payments", "currency crisis", "fx reserve", "contagion", "external debt"],
    regimeRelevance: ["high_vol_risk-off", "bear_ranging", "macro_transition"],
    macroRegions: ["EM", "GCC"],
    qualityLabel: "high_institutional_value",
    thinkingSchool: "institutional",
    competingView: null,
  },
  {
    id: "stagflation_1970s",
    title: "1970s Stagflation Historical Analog",
    framework: "historical_framework",
    school: "institutional",
    domain: "history",
    compression: "The 1970s stagflation demonstrated that supply shocks combined with accommodative monetary policy can produce persistent inflation; the cure (Volcker-era tightening) required severe recession.",
    causalMap: "Oil supply shock + loose monetary policy → wage-price spiral → stagflation → aggressive rate hike → recession → disinflation",
    historicalAnalog: "1973-82 stagflation and Volcker tightening",
    keywords: ["stagflation", "1970s", "volcker", "oil shock", "wage price spiral", "supply shock", "opec 1973", "inflation persistence", "cost push"],
    regimeRelevance: ["high_vol_risk-off", "macro_transition"],
    macroRegions: ["US", "Europe"],
    qualityLabel: "high_institutional_value",
    thinkingSchool: "institutional",
    competingView: null,
  },
  {
    id: "gfc_transmission",
    title: "2008 GFC Transmission Mechanism",
    framework: "historical_framework",
    school: "institutional",
    domain: "history",
    compression: "The GFC showed how structured-credit opacity, leverage, and interconnectedness can convert a localised housing correction into a global liquidity seizure within weeks.",
    causalMap: "Subprime losses → structured-product mark-downs → counterparty doubt → funding seizure → deleveraging → global recession",
    historicalAnalog: "2008-09 global financial crisis",
    keywords: ["2008", "gfc", "global financial crisis", "subprime", "lehman", "credit crunch", "structured credit", "cdo", "contagion", "liquidity seizure"],
    regimeRelevance: ["high_vol_risk-off", "macro_transition"],
    macroRegions: ["US"],
    qualityLabel: "high_institutional_value",
    thinkingSchool: "institutional",
    competingView: null,
  },
  {
    id: "factor_risk_premia",
    title: "Factor Investing and Risk Premia",
    framework: "portfolio_framework",
    school: "market_microstructure",
    domain: "portfolio",
    compression: "Asset returns can be decomposed into systematic risk premia (value, momentum, quality, low-volatility, carry) that are rewarded over time because they represent structural, persistent risk.",
    causalMap: "Exposure to systematic risk factor → factor premium → excess return over time → varies by regime + crowding",
    historicalAnalog: null,
    keywords: ["factor", "risk premia", "smart beta", "value", "momentum", "quality", "low vol", "carry", "systematic", "fama french", "factor investing"],
    regimeRelevance: ["bull_trending", "bear_ranging", "high_vol_risk-off"],
    macroRegions: [],
    qualityLabel: "contextual_value",
    thinkingSchool: "market_microstructure",
    competingView: "Behavioral: factors work because of persistent mispricing, not compensation for rational risk",
  },
  {
    id: "tail_risk",
    title: "Tail Risk and Fat-Tailed Distributions",
    framework: "uncertainty_framework",
    school: "heterodox",
    domain: "risk",
    compression: "Financial returns exhibit fat tails: extreme events are far more frequent than normal-distribution models predict. This underpricing of tail risk is systematically exploited by crises.",
    causalMap: "Normal-distribution assumption → underestimated tail → low tail-risk premium → crisis → mark-to-market shock → LTCM / VaR-model failure",
    historicalAnalog: "1998 LTCM / 2008 GFC quant unwind",
    keywords: ["tail risk", "fat tail", "black swan", "taleb", "var", "kurtosis", "extreme events", "distribution", "non-normal", "100-year event", "model risk"],
    regimeRelevance: ["high_vol_risk-off", "macro_transition"],
    macroRegions: [],
    qualityLabel: "high_institutional_value",
    thinkingSchool: "heterodox",
    competingView: "Standard finance: fat tails are an empirical regularity but rational risk models can accommodate them",
  },
  {
    id: "endogenous_money",
    title: "Endogenous Money and Post-Keynesian Credit",
    framework: "monetary_framework",
    school: "post_keynesian",
    domain: "monetary-policy",
    compression: "Banks create money endogenously through lending rather than multiplying a fixed reserve base; money supply is demand-driven and credit cycles precede, not follow, central bank accommodation.",
    causalMap: "Loan demand → bank credit creation → deposit creation → money supply expansion → CB accommodates ex-post",
    historicalAnalog: "2001-07 pre-GFC credit expansion",
    keywords: ["endogenous money", "credit creation", "bank lending", "money multiplier", "reserves", "post keynesian", "mmt", "credit demand"],
    regimeRelevance: ["bull_trending", "macro_transition"],
    macroRegions: [],
    qualityLabel: "debated_framework",
    thinkingSchool: "post_keynesian",
    competingView: "Monetarist: reserve targeting controls credit; CB sets money supply, banks multiply it",
  },
  {
    id: "kondratiev_cycles",
    title: "Kondratiev Super-Cycles and Technological Regimes",
    framework: "macro_framework",
    school: "heterodox",
    domain: "history",
    compression: "Long-wave economic cycles of ~40-60 years may be driven by clusters of technological innovation, creating boom phases followed by structural realignment and creative destruction.",
    causalMap: "Technological cluster → investment boom → overinvestment → structural excess → long-wave trough → new tech cluster",
    historicalAnalog: "Internet wave 1990s-2000s; AI wave 2020s-?",
    keywords: ["kondratiev", "long wave", "super cycle", "technological cycle", "innovation wave", "creative destruction", "schumpeter", "structural cycle"],
    regimeRelevance: ["macro_transition", "bull_trending"],
    macroRegions: [],
    qualityLabel: "debated_framework",
    thinkingSchool: "heterodox",
    competingView: "Mainstream: no reliable empirical evidence for consistent long-wave timing",
  },
  {
    id: "austrian_business_cycle",
    title: "Austrian Business Cycle and Capital Misallocation",
    framework: "macro_framework",
    school: "austrian",
    domain: "macro",
    compression: "Artificially low interest rates cause entrepreneurs to initiate excessively long production processes; when rates normalise, capital misallocations are revealed and liquidated, causing recession.",
    causalMap: "CB keeps rates below natural rate → credit expansion → malinvestment → rate normalisation → investment project abandonment → recession",
    historicalAnalog: "2000-01 TMT bust after late-1990s boom",
    keywords: ["austrian", "business cycle", "malinvestment", "capital misallocation", "natural rate", "hayekian", "artificial boom", "capital structure"],
    regimeRelevance: ["macro_transition", "high_vol_risk-off"],
    macroRegions: [],
    qualityLabel: "debated_framework",
    thinkingSchool: "austrian",
    competingView: "Keynesian: recessions are demand failures, not liquidation of malinvestment; fiscal policy can restore output",
  },
  {
    id: "anchoring_bias",
    title: "Anchoring and Adjustment in Financial Markets",
    framework: "behavioral_framework",
    school: "behavioral",
    domain: "behavioral",
    compression: "Investors anchor excessively on salient reference points (52-week highs, round numbers, IPO prices) and adjust insufficiently toward fundamentals, creating persistent pricing anomalies.",
    causalMap: "Salient anchor → insufficient adjustment → mispricing → slow drift toward fair value → event-driven revision",
    historicalAnalog: null,
    keywords: ["anchoring", "reference point", "52 week high", "round number", "ipo price", "anchoring bias", "adjustment", "behavioral finance", "cognitive bias"],
    regimeRelevance: ["bull_trending", "bear_ranging"],
    macroRegions: [],
    qualityLabel: "contextual_value",
    thinkingSchool: "behavioral",
    competingView: null,
  },
  {
    id: "nixon_shock",
    title: "Nixon Shock and Fiat Money Dynamics",
    framework: "historical_framework",
    school: "institutional",
    domain: "history",
    compression: "The 1971 suspension of gold convertibility created a pure fiat system where exchange rates float freely; this eliminated the anchor on global monetary expansion and set conditions for 1970s inflation.",
    causalMap: "Gold peg suspension → floating rates → monetary expansion freedom → 1970s inflation → oil shock amplification",
    historicalAnalog: "1971-73 Bretton Woods collapse",
    keywords: ["nixon shock", "bretton woods", "gold standard", "fiat money", "dollar peg", "1971", "currency regime", "dollar hegemony", "petrodollar"],
    regimeRelevance: ["macro_transition", "high_vol_risk-off"],
    macroRegions: ["US"],
    qualityLabel: "contextual_value",
    thinkingSchool: "institutional",
    competingView: null,
  },
  {
    id: "volatility_regimes",
    title: "Volatility Regimes and Options Convexity",
    framework: "market_framework",
    school: "market_microstructure",
    domain: "market-structure",
    compression: "Implied volatility exhibits regimes: low-vol regimes suppress realized vol through dealer gamma hedging; a vol spike breaks this dynamic and can cause cascading mechanical selling.",
    causalMap: "Low vol → dealer short-gamma → mechanical buying on dips → vol suppressed → vol spike → long-gamma breaks → selling cascade",
    historicalAnalog: "February 2018 Volmageddon",
    keywords: ["volatility", "vix", "implied vol", "gamma", "options", "vol regime", "vol spike", "realized vol", "dealer hedging", "convexity", "vega", "volmageddon"],
    regimeRelevance: ["high_vol_risk-off", "macro_transition", "bull_trending"],
    macroRegions: [],
    qualityLabel: "high_institutional_value",
    thinkingSchool: "market_microstructure",
    competingView: null,
  },
  {
    id: "market_microstructure",
    title: "Market Microstructure and Liquidity Fragility",
    framework: "market_framework",
    school: "market_microstructure",
    domain: "market-structure",
    compression: "Market liquidity is endogenous: apparent depth in calm conditions can evaporate rapidly under stress when market-makers withdraw; bid-ask spreads and order-book depth are leading stress indicators.",
    causalMap: "Stress → market-maker withdrawal → bid-ask widens → order-book thins → price impact amplified → flash crash potential",
    historicalAnalog: "March 2020 Treasury market dislocation",
    keywords: ["market microstructure", "liquidity", "bid ask", "order book", "market maker", "spread", "flash crash", "price impact", "depth", "slippage"],
    regimeRelevance: ["high_vol_risk-off", "macro_transition"],
    macroRegions: [],
    qualityLabel: "high_institutional_value",
    thinkingSchool: "market_microstructure",
    competingView: null,
  },
];
