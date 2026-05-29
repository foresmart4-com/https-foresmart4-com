// Phase-85C: Allocator Playbook Library
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Institutional allocator playbooks — regime-conditional allocation logic
// used by professional institutional investors. NOT investment recommendations.
// Educational reasoning only — shows how institutional allocators THINK,
// not what they should DO.
//
// Playbooks: preservation, recession, inflation, tightening, easing,
//            oil_shock, liquidity_crisis, regime_transition, em_allocation
//
// Each playbook contains:
//   - signals that activate it
//   - historically favoured asset classes (descriptive, not prescriptive)
//   - historically avoided asset classes
//   - primary risk to the playbook
//   - institutional reasoning behind the allocation logic
//   - Saudi-specific consideration (where applicable)
//
// No autonomous execution. No broker data. Advisory/educational use only.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PlaybookId =
  | "preservation"
  | "recession"
  | "inflation"
  | "tightening"
  | "easing"
  | "oil_shock"
  | "liquidity_crisis"
  | "regime_transition"
  | "em_allocation";

export interface AllocatorPlaybook {
  id: PlaybookId;
  name: string;
  signals: string[];              // conditions that activate this playbook
  historicallyFavoured: string[]; // asset classes that have historically performed in this regime
  historicallyAvoided: string[];  // asset classes that have historically suffered
  primaryRisk: string;            // ≤80 chars: main risk to the playbook thesis
  saudiConsideration: string | null; // ≤100 chars
  historicalPrecedent: string;    // ≤100 chars: reference episode
  institutionalLogic: string;     // ≤150 chars: reasoning behind the allocation logic
  keywords: RegExp;               // detection triggers
}

// ─── Playbook registry ────────────────────────────────────────────────────────

export const ALLOCATOR_PLAYBOOKS: AllocatorPlaybook[] = [
  {
    id: "preservation",
    name: "Capital Preservation Playbook",
    signals: [
      "extreme uncertainty about regime direction",
      "multiple concurrent risk-off signals",
      "confidence in existing thesis is low",
      "waiting for confirmation before deployment",
    ],
    historicallyFavoured: ["Short-term government bills", "Cash and equivalents", "Gold", "Investment-grade short duration"],
    historicallyAvoided:  ["High-beta equities", "Long duration bonds", "EM assets", "Credit risk"],
    primaryRisk: "Missing recovery rally; inflation erodes real value of cash during prolonged wait.",
    saudiConsideration: "SAMA's SAR peg provides currency stability; Saudi SAR cash preserves purchasing power relative to USD in normal regimes.",
    historicalPrecedent: "Endowments in 2008: moved to T-bills; recovered capital for deployment at trough.",
    institutionalLogic: "Preserve NAV until conviction is reestablished; the cost of patience (yield drag) is less than the cost of deploying in uncertainty.",
    keywords: /\b(preservation|capital protect|defensive|safe haven|risk.off|uncertain|wait|أمان|حماية رأس المال|حذر|دفاعي)\b/i,
  },
  {
    id: "recession",
    name: "Recession Playbook",
    signals: [
      "GDP growth turning negative or near-zero",
      "Leading indicators (PMI, credit spreads, yield curve) deteriorating",
      "Earnings revisions negative across broad market",
      "Credit spreads widening from low base",
    ],
    historicallyFavoured: ["Long-duration government bonds", "Defensive equities (utilities, consumer staples)", "Gold", "Short USD (if CB eases)"],
    historicallyAvoided:  ["Cyclical equities", "High-yield credit", "Commodities", "EM equities"],
    primaryRisk: "Fiscal/monetary stimulus creates V-shaped recovery faster than expected; being too defensive misses the rebound.",
    saudiConsideration: "Saudi fiscal cushion (Vision 2030 spending) can offset recession effects domestically; oil price is the more important variable than global GDP for Saudi.",
    historicalPrecedent: "Post-2008: long bonds rallied 20%; defensive equities outperformed cyclicals by 40% trough-to-trough.",
    institutionalLogic: "Earnings decline + multiple compression = double equity hit; bonds benefit from CB easing response. Rotate to quality and duration.",
    keywords: /\b(recession|downturn|contraction|pmis? below|negative gdp|yield curve invert|ركود|تباطؤ|انكماش)\b/i,
  },
  {
    id: "inflation",
    name: "Inflation Playbook",
    signals: [
      "CPI persistently above CB target",
      "Real rates negative (nominal below inflation)",
      "Commodity prices in sustained uptrend",
      "Wage-price spiral indicators active",
    ],
    historicallyFavoured: ["Commodities", "TIPS / inflation linkers", "Energy equities", "Real assets / infrastructure", "Commodity-exporting equities"],
    historicallyAvoided:  ["Long-duration nominal bonds", "High-multiple growth equities", "Consumer-sensitive defensives"],
    primaryRisk: "Inflation breaks faster than expected (supply resolution); CB hikes tip into recession, reversing inflation trades.",
    saudiConsideration: "Saudi is a structural inflation beneficiary (oil and commodity revenue rises); TASI and Aramco historically outperform in inflation regimes.",
    historicalPrecedent: "2022: commodity equities +40%, long bonds -20%, growth equities -35%; Saudi TASI +8% — canonical inflation beneficiary.",
    institutionalLogic: "Real assets maintain purchasing power; nominal bonds lose real value; commodity producers earn higher margins as prices rise.",
    keywords: /\b(inflation|cpi|rising prices|real rate negative|commodity|tips|linker|تضخم|أسعار مرتفعة|سلع)\b/i,
  },
  {
    id: "tightening",
    name: "Monetary Tightening Playbook",
    signals: [
      "CB actively raising rates or signalling imminent hikes",
      "Terminal rate uncertainty elevated",
      "Money market rates rising faster than long rates (bear flattening or inversion)",
      "Fed funds futures pricing aggressive hike path",
    ],
    historicallyFavoured: ["Short-duration bonds (2y bills)", "Financials / banks (NIM expansion)", "Value equities", "Cash"],
    historicallyAvoided:  ["Long-duration bonds", "Growth equities (long-duration)", "Real estate", "High-leverage companies"],
    primaryRisk: "Tightening overshoots; recession follows sooner than expected, forcing pivot — transition from tightening to easing playbook rapidly.",
    saudiConsideration: "SAMA follows Fed mechanically via SAR peg. Saudi banks benefit from NIM expansion in tightening cycle. TASI mortgage-related real estate exposed.",
    historicalPrecedent: "1994 surprise tightening: 10y bonds -10%, short bills +0%; 2022: similar dynamics with S&P -20% and short-duration bonds flat.",
    institutionalLogic: "Duration risk is the primary enemy. Shorten the portfolio's rate sensitivity. Favour assets where higher rates improve income (banks, short bills).",
    keywords: /\b(tightening|rate hikes?|rate rise|hawkish|terminal rate|short duration|restrict|تشديد|رفع الفائدة|متشدد)\b/i,
  },
  {
    id: "easing",
    name: "Monetary Easing Playbook",
    signals: [
      "CB cutting rates or signalling pivot to easing",
      "Real rates falling from elevated levels",
      "Credit spreads beginning to compress from wide levels",
      "Forward guidance explicitly dovish",
    ],
    historicallyFavoured: ["Long-duration government bonds", "Growth equities", "Emerging market equities", "High-yield credit (early in cycle)", "Gold"],
    historicallyAvoided:  ["Cash (yield erodes relative to bonds)", "Financials (NIM compression)"],
    primaryRisk: "Easing fails to stimulate if structural demand is weak (liquidity trap); inflation re-accelerates, forcing reversal.",
    saudiConsideration: "SAMA rate cuts follow Fed; Saudi mortgage demand rises; real estate and construction benefit. Banking NIM compresses.",
    historicalPrecedent: "2019 Fed pivot: growth equities +35%, long bonds +12%; 2020 emergency cuts: 60-day spike in long bonds then equity recovery.",
    institutionalLogic: "Falling discount rate expands valuations on long-duration assets. Credit spreads compress as risk appetite returns. Extend duration and risk exposure.",
    keywords: /\b(easing|rate cut|dovish|pivot|accommodative|lower rates|تيسير|خفض الفائدة|تحول|متساهل)\b/i,
  },
  {
    id: "oil_shock",
    name: "Oil Shock Playbook",
    signals: [
      "Oil price moving >20% in either direction",
      "OPEC supply decision significantly deviating from expectations",
      "Geopolitical supply disruption affecting major production regions",
      "Oil below $70/bbl or above $100/bbl sustained",
    ],
    historicallyFavoured: ["Energy equities (positive shock)", "Saudi/Gulf equities (positive shock)", "Short oil consumers (negative shock)", "Inflation hedges (positive shock)"],
    historicallyAvoided:  ["Oil importers/consumers (positive shock)", "Airlines, shipping", "Saudi/Gulf equities (negative shock)"],
    primaryRisk: "Oil shock reverses faster than positioned (demand destruction caps positive shock; supply response caps negative shock).",
    saudiConsideration: "Saudi is the canonical oil shock beneficiary (positive) or victim (negative). $75-80/bbl breakeven is the fiscal gate: above = surplus; below = deficit pressure.",
    historicalPrecedent: "1973 shock: Saudi revenues 5x; 2014-16 collapse: SAMA reserves fell $200bn; 2022: Saudi TASI +8% while global equities -20%.",
    institutionalLogic: "Oil-fiscal transmission: oil price → Saudi revenue → government spending → TASI earnings → TASI performance. Allocate accordingly on both sides of the shock.",
    keywords: /\b(oil shock|oil price|opec|brent|wti|crude|breakeven|نفط|أرامكو|أوبك|صدمة نفطية|برنت)\b/i,
  },
  {
    id: "liquidity_crisis",
    name: "Liquidity Crisis Playbook",
    signals: [
      "Repo market stress or collateral shortage",
      "Credit spreads spiking >200bps in weeks",
      "Cross-currency basis swaps diverging sharply",
      "Money market fund outflows accelerating",
    ],
    historicallyFavoured: ["USD cash", "Short-term US Treasuries", "Gold (initial panic hedge)", "CB liquidity facilities"],
    historicallyAvoided:  ["All illiquid assets", "Commercial paper", "Long corporate bonds", "EM assets"],
    primaryRisk: "CB intervention arrives faster than expected — being too defensive misses the policy-driven recovery.",
    saudiConsideration: "Saudi has $400bn+ FX reserves and low external debt — insulated from USD liquidity crises. TASI may sell off with global risk assets but fundamental impairment is low.",
    historicalPrecedent: "March 2020: all assets fell simultaneously; Fed unlimited QE reversed within 3 weeks. Sept 2008: similar but 6-month recovery.",
    institutionalLogic: "In acute liquidity crisis, correlation goes to 1. Preserve liquidity first — all other analysis is secondary until CB backstop is established.",
    keywords: /\b(liquidity crisis|repo stress|collateral|money market|dollar shortage|credit crunch|أزمة سيولة|شح السيولة|ريبو)\b/i,
  },
  {
    id: "regime_transition",
    name: "Regime Transition Playbook",
    signals: [
      "Macro regime shifting (growth/inflation quadrant changing)",
      "Prior market consensus breaking down",
      "Multiple conflicting signals between asset classes",
      "Historical analog suggesting end of current regime",
    ],
    historicallyFavoured: ["Lower-conviction diversified positioning", "Optionality — flexible allocation, not concentrated bets", "Real assets (maintain purchasing power through regime ambiguity)"],
    historicallyAvoided:  ["Concentrated high-conviction positions", "Illiquid assets", "Leveraged positions"],
    primaryRisk: "Transition takes longer than expected; excessive conservatism during a false-start transition incurs opportunity cost.",
    saudiConsideration: "Saudi regime is primarily driven by oil cycle — regime transition in Saudi is often oil-price-led, not macro-led. Monitor OPEC decisions and oil demand data.",
    historicalPrecedent: "2021-22 inflation regime shift: portfolios optimised for 2010s low-inflation regime suffered 30-40% drawdowns.",
    institutionalLogic: "When regime is uncertain, reduce conviction and size. The cost of being wrong in a transition is higher than the cost of missing early returns in the new regime.",
    keywords: /\b(regime transition|regime change|macro shift|regime uncertain|transitioning|تحول النظام|تغيير النظام|غير واضح النظام)\b/i,
  },
  {
    id: "em_allocation",
    name: "Emerging Market Allocation Playbook",
    signals: [
      "DXY weakening (EM debt relief)",
      "Commodity prices rising (EM revenue growth)",
      "Global risk appetite recovering",
      "EM growth differential vs developed markets widening",
    ],
    historicallyFavoured: ["EM equities (commodity-linked)", "EM local currency bonds", "EM high-dividend equities"],
    historicallyAvoided:  ["EM during USD rally", "EM fiscal deficit countries during tightening", "EM with high USD debt burden"],
    primaryRisk: "DXY reversal triggers capital flight; EM vulnerability to contagion from unrelated crises.",
    saudiConsideration: "Saudi is classified as EM/frontier by MSCI but behaves differently — oil-fiscal cycle dominates; SAR peg insulates from EM currency risk. Saudi is an atypical EM.",
    historicalPrecedent: "2002-07: EM supercycle driven by China demand + weak USD + commodity boom. 2013 Taper Tantrum: EM -30% on USD strength.",
    institutionalLogic: "EM allocation is a macro bet on USD, global growth, and commodity prices. Country selection within EM is critical — fiscal position, FX reserves, and commodity exposure.",
    keywords: /\b(emerging market|em |em equities|em allocation|frontier|developing market|الأسواق الناشئة|ناشئة)\b/i,
  },
];

// ─── Detection and retrieval ──────────────────────────────────────────────────

export function detectRelevantPlaybooks(
  question: string,
  ctx: string,
  regime?: string,
  isSaudi = false,
  oilPrice?: number | null,
  maxResults = 1,
): AllocatorPlaybook[] {
  const text = `${question} ${ctx} ${regime ?? ""}`;
  const matched: AllocatorPlaybook[] = [];
  const scores = new Map<PlaybookId, number>();

  for (const pb of ALLOCATOR_PLAYBOOKS) {
    if (pb.keywords.test(text)) {
      const keywordMatches = pb.signals.filter(s =>
        text.toLowerCase().includes(s.slice(0, 20).toLowerCase()),
      ).length;
      scores.set(pb.id, keywordMatches + 1);
      matched.push(pb);
    }
  }

  // Oil price gate: force oil_shock playbook when price is extreme
  if (oilPrice !== null && oilPrice !== undefined) {
    if (oilPrice < 65 || oilPrice > 95) {
      const oilPb = ALLOCATOR_PLAYBOOKS.find(p => p.id === "oil_shock");
      if (oilPb && !scores.has("oil_shock")) {
        scores.set("oil_shock", 2);
        matched.push(oilPb);
      }
    }
  }

  if (matched.length === 0) return [];

  // Sort by score (keyword + signal relevance)
  matched.sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
  return matched.slice(0, maxResults);
}

// ─── Context builder ──────────────────────────────────────────────────────────

export function buildPlaybookContext(
  question: string,
  ctx: string,
  regime?: string,
  isSaudi = false,
  oilPrice?: number | null,
): string {
  const playbooks = detectRelevantPlaybooks(question, ctx, regime, isSaudi, oilPrice);
  if (playbooks.length === 0) return "";

  const parts = playbooks.map(pb => {
    const favoured = pb.historicallyFavoured.slice(0, 3).join(", ");
    const avoided  = pb.historicallyAvoided.slice(0, 2).join(", ");
    let entry = `${pb.name}: ${pb.institutionalLogic} | Favoured: ${favoured} | Avoided: ${avoided}`;
    if (isSaudi && pb.saudiConsideration) {
      entry += ` | Saudi: ${pb.saudiConsideration}`;
    }
    return entry.slice(0, 320);
  });

  return [
    `Allocator playbook [${playbooks.map(p => p.id).join("+")}]:`,
    parts.join(" || "),
    "Educational reasoning only — no execution implication.",
  ].join(" ").slice(0, 450);
}
