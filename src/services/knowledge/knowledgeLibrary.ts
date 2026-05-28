/**
 * Research Knowledge Library — Phase 28
 * Static, bounded library of compressed economic and market frameworks.
 *
 * Design rules:
 * - All content is original paraphrasing of established economic concepts
 * - No book quotes, no copyrighted text, no raw verbatim copying
 * - Each card is a concise concept distillation, not a book summary
 * - Credibility filter applied at construction: only institutionally credible
 *   frameworks included; trading hype, influencer content, and get-rich
 *   material are explicitly excluded
 * - Bounded: fixed 13-card library, no dynamic growth without code changes
 * - Advisory framing: summaries use hedged language; not predictive claims
 */

export interface KnowledgeCard {
  id: string;
  framework: string;            // framework or concept name
  domain: string;               // macro | credit | portfolio | behavioral | central-bank | market-structure
  summary: string;              // 1-2 sentences, original paraphrase, ≤120 chars
  causalMechanism: string;      // "A → B → C" transmission logic
  keywords: string[];           // for query matching (lowercase)
  regimeRelevance: string[];    // which market regimes this is most relevant to
  credibilityLevel: "high";     // all cards in this library are high-credibility only
}

/**
 * Compressed knowledge cards.
 * Credibility: central-bank research, academic economics, institutional finance.
 * Excluded: technical-trading hype, influencer speculation, get-rich frameworks.
 */
export const KNOWLEDGE_CARDS: KnowledgeCard[] = [
  {
    id: "liquidity_cycle",
    framework: "Liquidity Cycle",
    domain: "macro",
    summary: "Central-bank liquidity expansion lowers discount rates, supporting asset valuations; contraction reverses this by raising funding costs and triggering de-risking.",
    causalMechanism: "CB balance sheet expansion → lower real rates → asset re-rating → risk-on; contraction → tighter funding → drawdown",
    keywords: ["liquidity", "qe", "quantitative easing", "central bank", "balance sheet", "funding", "monetary expansion", "risk-on", "risk-off"],
    regimeRelevance: ["bull_trending", "bear_ranging", "macro_transition"],
    credibilityLevel: "high",
  },
  {
    id: "inflation_transmission",
    framework: "Inflation Transmission",
    domain: "macro",
    summary: "Monetary excess typically passes into asset prices first, then producer costs, then wages; core inflation persistence depends on whether second-round wage effects emerge.",
    causalMechanism: "Monetary excess → asset prices → producer costs → wages → core CPI persistence",
    keywords: ["inflation", "cpi", "core inflation", "wage", "second-round", "price level", "monetary", "deflation", "stagflation"],
    regimeRelevance: ["high_vol_risk-off", "macro_transition", "bull_trending"],
    credibilityLevel: "high",
  },
  {
    id: "reflexivity",
    framework: "Reflexivity (Soros Framework)",
    domain: "market-structure",
    summary: "Market participants' beliefs about fundamentals influence those fundamentals, creating feedback loops that drive trends to overshoot before eventually reversing.",
    causalMechanism: "Perception shift → fundamental change → reinforces perception → overshoot → regime reversal",
    keywords: ["reflexivity", "feedback loop", "boom bust", "overshoot", "narrative", "self-reinforcing", "bubble", "momentum"],
    regimeRelevance: ["bull_trending", "bear_ranging", "high_vol_risk-off"],
    credibilityLevel: "high",
  },
  {
    id: "growth_inflation_matrix",
    framework: "Growth / Inflation Regime Matrix",
    domain: "macro",
    summary: "Asset class behavior differs materially across four quadrants: rising-growth/rising-inflation, rising-growth/falling-inflation, declining-growth/rising-inflation (stagflation), and declining-growth/falling-inflation (deflation).",
    causalMechanism: "Growth + inflation trend → regime quadrant → asset class rotations (commodities, TIPS, equities, bonds favoured differently)",
    keywords: ["regime", "growth", "inflation", "stagflation", "deflation", "asset rotation", "macro regime", "quadrant"],
    regimeRelevance: ["bull_trending", "bear_ranging", "high_vol_risk-off", "macro_transition"],
    credibilityLevel: "high",
  },
  {
    id: "central_bank_signaling",
    framework: "Central Bank Forward Guidance",
    domain: "central-bank",
    summary: "Forward guidance pre-commits a central bank to future policy paths, anchoring long-end rates before actual moves; markets typically price rate decisions several meetings in advance.",
    causalMechanism: "CB guidance → long-rate anchoring → yield curve shape → asset valuations → credit conditions",
    keywords: ["fed", "central bank", "forward guidance", "rate hike", "rate cut", "yield curve", "monetary policy", "pivot", "sama", "ecb", "policy rate"],
    regimeRelevance: ["bull_trending", "bear_ranging", "macro_transition"],
    credibilityLevel: "high",
  },
  {
    id: "risk_contribution",
    framework: "Risk Contribution / Risk Parity",
    domain: "portfolio",
    summary: "A traditional 60/40 equity-bond portfolio is effectively ~90% equity-risk; true diversification requires balancing volatility contributions, not just dollar weights, across asset classes.",
    causalMechanism: "Dollar allocation ≠ risk allocation; equity dominates vol → correlated drawdowns; balancing risk contribution → smoother returns",
    keywords: ["portfolio", "diversification", "risk parity", "concentration", "60/40", "volatility", "allocation", "hedge", "correlation"],
    regimeRelevance: ["bull_trending", "bear_ranging", "high_vol_risk-off"],
    credibilityLevel: "high",
  },
  {
    id: "credit_cycle",
    framework: "Credit Cycle",
    domain: "credit",
    summary: "Credit availability drives investment cycles: expansion features loosening standards and rising leverage; contraction features rising spreads, margin calls, and forced selling.",
    causalMechanism: "Easy credit → leverage expansion → asset appreciation → complacency → tightening → spread widening → forced deleveraging",
    keywords: ["credit", "spread", "hy", "high yield", "investment grade", "leverage", "debt", "credit cycle", "sukuk", "bond", "ig", "credit spread"],
    regimeRelevance: ["bull_trending", "bear_ranging", "high_vol_risk-off", "macro_transition"],
    credibilityLevel: "high",
  },
  {
    id: "oil_macro_signal",
    framework: "Oil as Macro Signal (Demand vs Supply)",
    domain: "macro",
    summary: "Oil direction has different implications depending on its driver: demand-led rises signal global expansion; supply-shock rises signal inflationary drag; demand-led falls signal contraction.",
    causalMechanism: "Oil demand-led rise → growth signal; supply-driven rise → cost-push inflation + real income drain; demand-led fall → contraction signal",
    keywords: ["oil", "wti", "brent", "crude", "opec", "energy", "commodity", "oil price", "saudi fiscal", "aramco"],
    regimeRelevance: ["bull_trending", "bear_ranging", "high_vol_risk-off", "macro_transition"],
    credibilityLevel: "high",
  },
  {
    id: "positioning_extremes",
    framework: "Positioning Extremes and Sentiment Reversals",
    domain: "behavioral",
    summary: "Crowded positioning creates asymmetric risk: consensus longs face sharper drawdowns on reversal than fundamentals justify; sentiment extremes often precede trend reversals.",
    causalMechanism: "Crowded trade → small adverse move → forced unwinding → amplified price move; sentiment extreme → contrarian signal",
    keywords: ["positioning", "crowded", "sentiment", "contrarian", "short squeeze", "consensus", "fear", "greed", "cot", "fund flows"],
    regimeRelevance: ["bull_trending", "bear_ranging", "high_vol_risk-off"],
    credibilityLevel: "high",
  },
  {
    id: "dollar_global_tightening",
    framework: "USD Strength as Global Tightening",
    domain: "macro",
    summary: "Dollar strength effectively tightens global financial conditions: dollar-denominated debt becomes costlier to service, commodity exporters face fiscal pressure, and EM capital flows reverse.",
    causalMechanism: "DXY rises → EM debt service cost rises → capital outflows → EM tightening → commodity headwind → SAR-peg tightening pressure",
    keywords: ["dxy", "dollar", "usd", "dollar strength", "em", "emerging market", "dollar debt", "sar", "peg", "gulf", "currency"],
    regimeRelevance: ["bear_ranging", "high_vol_risk-off", "macro_transition"],
    credibilityLevel: "high",
  },
  {
    id: "safe_haven_rotation",
    framework: "Safe-Haven Asset Rotation",
    domain: "market-structure",
    summary: "During risk-off episodes, capital typically rotates toward assets perceived as stores of value or low-risk: gold, sovereign bonds, defensive currencies; the speed of rotation signals stress severity.",
    causalMechanism: "Risk-off trigger → equity selling → bid for gold/bonds/defensive FX → haven premium rises → real rates matter for gold magnitude",
    keywords: ["gold", "safe haven", "risk-off", "flight to quality", "treasury", "xau", "yen", "chf", "bonds", "haven", "defensive"],
    regimeRelevance: ["bear_ranging", "high_vol_risk-off"],
    credibilityLevel: "high",
  },
  {
    id: "btc_liquidity_proxy",
    framework: "BTC as Global Liquidity Proxy",
    domain: "market-structure",
    summary: "BTC has exhibited correlation with global liquidity cycles: rising in expansion phases when dollar liquidity increases, and falling in contraction phases — functioning as a high-beta risk-appetite indicator.",
    causalMechanism: "Global liquidity expansion → dollar weakness → risk appetite → BTC bid; tightening → dollar strength → de-risking → BTC sell",
    keywords: ["btc", "bitcoin", "crypto", "liquidity proxy", "risk appetite", "digital asset", "blockchain"],
    regimeRelevance: ["bull_trending", "bear_ranging", "high_vol_risk-off"],
    credibilityLevel: "high",
  },
  {
    id: "tasi_macro_sensitivity",
    framework: "TASI / Saudi Market Macro Sensitivity",
    domain: "macro",
    summary: "TASI is structurally sensitive to three macro channels: oil price (fiscal revenue and Aramco earnings), USD/SAR peg (restricts independent monetary policy), and global risk appetite (foreign institutional flows).",
    causalMechanism: "Oil → Saudi fiscal surplus/deficit → government spending → non-oil growth; DXY → SAR peg tightening; risk-on/off → foreign flows in/out",
    keywords: ["tasi", "saudi", "aramco", "2222", "sabic", "gulf", "tadawul", "vision 2030", "sama", "riyal", "sar"],
    regimeRelevance: ["bull_trending", "bear_ranging", "macro_transition"],
    credibilityLevel: "high",
  },
];
