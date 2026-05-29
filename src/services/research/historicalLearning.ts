// Phase-74: Historical Economic Learning
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Distinct from bookIntelligence.ts (Phase 28/KnowledgeCorpus): that module
// produces compact institutional lessons from 22 static corpus cards.
// This module maintains a richer historical episode registry covering:
//   - Great Depression, Inflation regimes, Oil shocks, Fed cycles
//   - 2008 GFC, COVID, Liquidity crises, Saudi/Oil history
//   - Regional crises, Global macro cycles
//
// Analog strength classification:
//   strong_analog   — current regime shares 3+ key characteristics
//   weak_analog     — shares 1-2 characteristics; use with caution
//   regime_difference — different in key ways; do not apply this analog
//
// Output: historical analog + lessons + what is different this time.
// Never deterministic prediction. Advisory and contextual only.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AnalogStrength =
  | "strong_analog"       // 3+ shared characteristics; high contextual relevance
  | "weak_analog"         // 1-2 shared characteristics; limited applicability
  | "regime_difference";  // key structural differences; do not apply this analog

export type HistoricalDomain =
  | "great_depression"    // 1929-1939
  | "inflation_regime"    // 1970s stagflation, hyperinflations
  | "oil_shock"           // 1973, 1979, 1986, 2008 oil moves
  | "fed_cycle"           // major Fed tightening/easing cycles
  | "gfc_2008"            // 2008 Global Financial Crisis
  | "covid"               // 2020 pandemic shock and recovery
  | "liquidity_crisis"    // 1998 LTCM, 2011 EU debt, 2020 March
  | "saudi_oil_history"   // Saudi-specific oil and fiscal history
  | "regional_crisis"     // EM crises, Asian 1997, Latin America
  | "macro_cycle";        // post-WWII business cycle episodes

export interface HistoricalEpisode {
  id: string;
  name: string;
  period: string;              // e.g. "1973-1974"
  domain: HistoricalDomain;
  characteristics: string[];   // 3-5 key features of this episode
  macroTransmission: string;   // A → B → C chain that drove the crisis/recovery
  assetClassBehavior: string;  // 1-2 sentences: what happened to key assets
  howItEnded: string;          // 1 sentence: resolution mechanism
  saudiDimension: string | null; // Saudi/Gulf-specific note, or null if not relevant
  keyLesson: string;           // 1 sentence: what can be applied as analogical context
  analogKeywords: string[];    // lowercase keywords that trigger this episode
}

export interface HistoricalAnalogResult {
  matchedEpisode: HistoricalEpisode | null;
  analogStrength: AnalogStrength;
  lessonContext: string;        // injectable context ≤200 chars
  whatIsDifferent: string | null; // key structural difference from current regime
}

// ─── Historical episode registry ──────────────────────────────────────────────

export const HISTORICAL_EPISODES: HistoricalEpisode[] = [
  {
    id: "great_depression",
    name: "Great Depression",
    period: "1929-1939",
    domain: "great_depression",
    characteristics: ["bank failures cascade", "deflation spiral", "gold standard constraint", "demand collapse", "global trade contraction"],
    macroTransmission: "Stock crash → bank failures → credit contraction → demand collapse → deflation → debt-deflation spiral",
    assetClassBehavior: "Equities lost 80-90%; gold appreciated (via dollar devaluation); bonds mixed; commodities fell sharply.",
    howItEnded: "Fiscal expansion (New Deal) + gold standard abandonment + WWII spending broke the deflation trap.",
    saudiDimension: null,
    keyLesson: "Deflation + credit contraction is self-reinforcing; CB must act as lender of last resort and avoid premature tightening.",
    analogKeywords: ["deflation", "bank failure", "great depression", "1929", "credit contraction", "gold standard"],
  },
  {
    id: "1970s_stagflation",
    name: "1970s Stagflation",
    period: "1973-1982",
    domain: "inflation_regime",
    characteristics: ["oil supply shock", "wage-price spiral", "policy credibility loss", "negative real rates initially", "eventual Volcker shock"],
    macroTransmission: "Oil supply shock → cost-push inflation → CB delayed response → inflationary expectations embedded → Volcker shock → deep recession",
    assetClassBehavior: "Equities struggled in real terms; gold surged; oil-linked assets performed; bonds destroyed in real returns.",
    howItEnded: "Volcker raised rates to 20%+ — breaking inflation at the cost of a severe 1982 recession.",
    saudiDimension: "Saudi Arabia gained significant fiscal power; oil revenues created the modern petrodollar recycling system.",
    keyLesson: "Supply-driven inflation is resistant to demand-side CB tools; delaying tightening embeds expectations and makes eventual adjustment more painful.",
    analogKeywords: ["stagflation", "1970s", "oil shock", "volcker", "supply shock", "wage price spiral", "cost push inflation"],
  },
  {
    id: "oil_shock_1986",
    name: "1986 Oil Price Collapse",
    period: "1985-1987",
    domain: "oil_shock",
    characteristics: ["Saudi production increase", "OPEC discipline breakdown", "oil price halved", "Gulf fiscal stress", "dollar weakening"],
    macroTransmission: "OPEC quota violation → Saudi production surge → oil glut → price collapse → Gulf fiscal contraction → regional spending cuts",
    assetClassBehavior: "Oil equities collapsed; global inflation fell; Gulf markets contracted; US consumers benefited.",
    howItEnded: "OPEC re-discipline over 1986-1987; price stabilised at lower level.",
    saudiDimension: "Saudi fiscal breakeven far exceeded market prices; significant government spending cuts; lessons for managing oil dependency.",
    keyLesson: "Saudi fiscal space is critically dependent on oil prices above breakeven; OPEC discipline determines Saudi macro stability.",
    analogKeywords: ["1986 oil", "oil collapse", "opec breakdown", "oil supply glut", "saudi fiscal"],
  },
  {
    id: "asian_crisis_1997",
    name: "Asian Financial Crisis",
    period: "1997-1998",
    domain: "regional_crisis",
    characteristics: ["currency peg stress", "foreign debt in USD", "sudden stop in capital flows", "IMF conditionality", "contagion across region"],
    macroTransmission: "Currency peg overvaluation → capital outflows → FX reserves depleted → peg abandonment → corporate USD debt crisis → contagion",
    assetClassBehavior: "EM currencies collapsed 30-80%; equities fell severely; USD surged; US Treasuries as safe haven.",
    howItEnded: "IMF programs + current account adjustment + eventual capital inflows as valuations bottomed.",
    saudiDimension: "SAR peg maintained but regional EM stress elevated; oil weakness compounded Gulf fiscal pressure.",
    keyLesson: "Fixed exchange rate regimes become vulnerable when domestic fundamentals diverge from the anchor currency; sudden stops are brutal.",
    analogKeywords: ["asian crisis", "1997", "currency peg", "sudden stop", "em crisis", "sar peg", "devaluation"],
  },
  {
    id: "gfc_2008",
    name: "2008 Global Financial Crisis",
    period: "2007-2009",
    domain: "gfc_2008",
    characteristics: ["mortgage credit bubble", "shadow banking fragility", "leverage unwind", "interbank freeze", "systemic contagion"],
    macroTransmission: "Mortgage defaults → MBS write-downs → bank capital impairment → interbank freeze → credit contraction → recession",
    assetClassBehavior: "Global equities fell 50-60%; credit spreads exploded; oil fell from $147 to $32; gold held relatively well; USD surged initially.",
    howItEnded: "Coordinated CB intervention (QE, TARP, swap lines) + fiscal stimulus + bank recapitalization broke the feedback loop.",
    saudiDimension: "Oil collapse from $147 to $32 created Saudi fiscal stress; TASI fell ~75%; Vision 2030 not yet conceived.",
    keyLesson: "Shadow banking fragility transmits faster than regulated banking; lender of last resort function is non-negotiable for preventing cascade.",
    analogKeywords: ["2008", "gfc", "financial crisis", "lehman", "subprime", "shadow banking", "credit crunch", "systemic risk"],
  },
  {
    id: "covid_2020",
    name: "COVID Pandemic Shock",
    period: "2020-2021",
    domain: "covid",
    characteristics: ["exogenous demand-supply shock", "fastest CB response in history", "fiscal transfers at scale", "sectoral divergence", "supply chain disruption"],
    macroTransmission: "Lockdowns → demand collapse + supply disruption → CB/fiscal response → reflation → supply-chain inflation → rate rise cycle",
    assetClassBehavior: "Sharp Q1 2020 crash recovered within months; technology surged; travel/hospitality collapsed; commodities initially fell then surged.",
    howItEnded: "Vaccines + reopening + fiscal normalization; residual inflation required aggressive rate cycle.",
    saudiDimension: "Oil briefly went negative in April 2020 (WTI futures); Saudi fiscal stress severe; rapid Vision 2030 acceleration post-recovery.",
    keyLesson: "Exogenous shocks can be violent but short-lived when CB/fiscal response is credible; supply-chain inflation can outlast the initial shock by 18-24 months.",
    analogKeywords: ["covid", "pandemic", "2020", "lockdown", "supply chain", "reflation", "fiscal transfer"],
  },
  {
    id: "2022_inflation_cycle",
    name: "2022 Inflation + Rate Cycle",
    period: "2022-2023",
    domain: "fed_cycle",
    characteristics: ["fastest Fed tightening in 40 years", "multi-decade inflation peak", "inverted yield curve", "bond-equity correlation breakdown", "supply-driven component"],
    macroTransmission: "Post-COVID supply chain + energy shock → inflation surge → Fed 425bps in 12 months → yield curve inversion → recession risk → real-rate shock to valuations",
    assetClassBehavior: "Bonds worst year since 1788; equities fell 20-25%; 60/40 portfolio deeply negative; USD surged; commodities outperformed.",
    howItEnded: "Inflation moderated as supply chains normalized; Fed paused at terminal rate; soft landing debate unresolved.",
    saudiDimension: "Oil above $100 created significant Saudi fiscal surplus; TASI outperformed global equities in 2022; Aramco dividend supported.",
    keyLesson: "Rate cycles this fast break the bond-equity diversification assumption; duration assets are most vulnerable; oil exporters are relative beneficiaries.",
    analogKeywords: ["2022", "rate hike", "inflation cycle", "yield curve", "bond equity", "fed tightening", "inverted yield"],
  },
  {
    id: "saudi_oil_1986_2014",
    name: "Saudi Oil Revenue Cycles",
    period: "1986, 2014-2016",
    domain: "saudi_oil_history",
    characteristics: ["oil below breakeven", "fiscal deficit emerges", "SAMA reserves drawn down", "domestic spending cut", "austerity measures"],
    macroTransmission: "Oil below $75-80 breakeven → fiscal deficit → SAMA reserve drawdown → domestic liquidity tightening → TASI pressure → non-oil sector slowdown",
    assetClassBehavior: "TASI fell significantly in both episodes; banking sector NIM squeezed; Vision 2030 capex threatened.",
    howItEnded: "Oil price recovery + OPEC production discipline + NEOM/Vision 2030 announcement created new narrative.",
    saudiDimension: "Saudi Arabia's fiscal breakeven is the primary macro lever — everything flows from whether oil is above or below $75-80/bbl.",
    keyLesson: "Saudi macro stability is deeply oil-price-contingent; below breakeven creates a feedback loop of fiscal → spending → non-oil growth contraction.",
    analogKeywords: ["saudi", "tasi", "oil breakeven", "sama", "fiscal deficit", "vision 2030", "aramco", "riyal"],
  },
  {
    id: "1994_fed_surprise",
    name: "1994 Fed Rate Shock",
    period: "1994",
    domain: "fed_cycle",
    characteristics: ["unexpected Fed tightening", "bond market rout", "EM contagion", "Mexico Tequila Crisis", "low inflation"],
    macroTransmission: "Fed surprise 300bps tightening → bond yields spike globally → EM borrowing costs surge → Mexico FX crisis → global market stress",
    assetClassBehavior: "US bonds worst year since 1920s; EM sovereign bonds collapsed; equities fell sharply then recovered.",
    howItEnded: "Fed paused; inflation contained; market recovered within 18 months.",
    saudiDimension: null,
    keyLesson: "Unexpected central bank tightening can cause more damage than a slower but telegraphed cycle; EM is most vulnerable to US rate surprises.",
    analogKeywords: ["1994", "fed surprise", "bond rout", "tequila crisis", "rate shock", "unexpected tightening"],
  },
  {
    id: "oil_supercycle_2003_2008",
    name: "Commodity Super-Cycle 2003-2008",
    period: "2003-2008",
    domain: "oil_shock",
    characteristics: ["China demand surge", "underinvestment in supply", "commodity-driven EM boom", "USD weakness", "oil from $25 to $147"],
    macroTransmission: "China industrialisation → commodity demand surge → supply constraints → price spike → EM fiscal windfall → global growth acceleration",
    assetClassBehavior: "Commodities outperformed; EM equities surged; energy equities outperformed; US dollar structurally weak.",
    howItEnded: "2008 GFC demand shock collapsed commodity prices; China stimulus restarted cycle partially 2009-2011.",
    saudiDimension: "Saudi Arabia benefited enormously — oil above $100 funded Vision reserves and surplus.",
    keyLesson: "China is the marginal demand driver for global commodities; a structural Chinese growth shift changes the commodity supercycle narrative.",
    analogKeywords: ["commodity super-cycle", "china demand", "oil supercycle", "2003 2008", "emerging market boom", "commodity boom"],
  },
];

// ─── Analog matching ──────────────────────────────────────────────────────────

function countCharacteristicMatches(episode: HistoricalEpisode, question: string, ctx: string): number {
  const text = `${question} ${ctx}`.toLowerCase();
  return episode.analogKeywords.filter(k => text.includes(k)).length;
}

function deriveAnalogStrength(matchCount: number): AnalogStrength {
  if (matchCount >= 3) return "strong_analog";
  if (matchCount >= 1) return "weak_analog";
  return "regime_difference";
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function findHistoricalAnalog(question: string, ctx: string = ""): HistoricalAnalogResult {
  const scores = HISTORICAL_EPISODES.map(ep => ({
    ep,
    matchCount: countCharacteristicMatches(ep, question, ctx),
  })).filter(s => s.matchCount > 0).sort((a, b) => b.matchCount - a.matchCount);

  const top = scores[0];
  if (!top) {
    return { matchedEpisode: null, analogStrength: "regime_difference", lessonContext: "", whatIsDifferent: null };
  }

  const analogStrength = deriveAnalogStrength(top.matchCount);
  const ep = top.ep;

  const lessonContext = analogStrength === "strong_analog"
    ? `Historical analog (${ep.name}, ${ep.period}): ${ep.keyLesson} Transmission: ${ep.macroTransmission.slice(0, 80)}.`.slice(0, 200)
    : analogStrength === "weak_analog"
    ? `Weak analog (${ep.name}): ${ep.keyLesson.slice(0, 100)} — apply cautiously; current context may differ.`.slice(0, 200)
    : "";

  const whatIsDifferent = analogStrength !== "strong_analog"
    ? `${ep.name} differs in: ${ep.characteristics.slice(0, 2).join(", ")} — verify before applying.`
    : null;

  return { matchedEpisode: ep, analogStrength, lessonContext, whatIsDifferent };
}
