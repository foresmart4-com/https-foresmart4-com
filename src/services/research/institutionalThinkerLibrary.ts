// Phase-85C: Institutional Thinker Library
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Compressed investment-analytical profiles of foundational thinkers.
// NOT biographical — framework, beliefs, market logic, regime fit, biases only.
//
// Tier 1 (academic/institutional): Keynes, Friedman, Minsky, Hayek, Fama, Shiller
// Tier 2 (practitioner):           Buffett, Dalio, Marks, Soros, Druckenmiller
//
// Builds on governedResearch.ts approved source registry (credibilityAnchor values
// are consistent). Does not re-define source authority — delegates to
// authorityRankingEngine for weighting.
//
// Dispute/disagreement map: explicit thinker conflicts stored per profile.
// Use: multi-thinker context exposes competing frameworks on contested questions.
//
// Educational/advisory only. No autonomous trading. No broker data.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ThinkerTier = "tier_1" | "tier_2";

export interface ThinkerProfile {
  id: string;
  name: string;
  tier: ThinkerTier;
  framework: string;             // ≤80 chars: the analytical school/method they pioneered
  coreBelief: string;            // ≤100 chars: central investment/market proposition
  marketLogic: string;           // ≤120 chars: how they derive price/value insights
  regimePreferences: string[];   // regimes where this thinker's framework most applies
  disagreesWith: string[];       // IDs of thinkers they fundamentally conflict with
  knownBias: string;             // ≤80 chars: methodological or ideological lean
  investmentImplication: string; // ≤120 chars: actionable implication of their framework
  keywords: RegExp;              // triggers in question/context
}

// ─── Thinker registry ─────────────────────────────────────────────────────────

export const THINKER_PROFILES: ThinkerProfile[] = [
  // ── Tier 1: Academic / Institutional ─────────────────────────────────────────
  {
    id: "keynes",
    name: "John Maynard Keynes",
    tier: "tier_1",
    framework: "Aggregate demand management; fiscal stabilisation; animal spirits",
    coreBelief: "Markets fail to self-correct; aggregate demand drives output; government intervention is justified when private investment collapses.",
    marketLogic: "Asset prices driven by 'animal spirits' — sentiment and expectations that are self-fulfilling and disconnect from fundamentals.",
    regimePreferences: ["bear_ranging", "macro_transition", "liquidity_trap"],
    disagreesWith: ["hayek", "friedman"],
    knownBias: "Fiscal intervention bias; underweights supply-side and inflation risks.",
    investmentImplication: "In demand-shortage regimes: favour cyclicals and fiscal beneficiaries; expect fiscal multiplier to support earnings recovery.",
    keywords: /\b(keynes|keynesian|aggregate demand|fiscal multiplier|animal spirits|demand.side|طلب كلي|كينز)\b/i,
  },
  {
    id: "friedman",
    name: "Milton Friedman",
    tier: "tier_1",
    framework: "Monetarism; inflation expectations; permanent income hypothesis",
    coreBelief: "Inflation is always monetary; stable money growth rules outperform discretionary policy; markets are fundamentally self-correcting.",
    marketLogic: "Monetary supply changes transmit to prices with a lag of 12-18 months; rate expectations price into long bonds before CPI responds.",
    regimePreferences: ["high_vol_risk_off", "macro_transition", "inflation_shock"],
    disagreesWith: ["keynes", "minsky"],
    knownBias: "Anti-intervention lean; under-estimates financial stability risks and income distribution effects.",
    investmentImplication: "Tightening cycles driven by inflation expectations: short duration, favour short-term bills; inflation break from rate hike is lagged 12-18m.",
    keywords: /\b(friedman|monetar|quantity theory|permanent income|money supply|فريدمان|نظرية النقود)\b/i,
  },
  {
    id: "minsky",
    name: "Hyman Minsky",
    tier: "tier_1",
    framework: "Financial Instability Hypothesis; Ponzi finance phases; endogenous credit cycles",
    coreBelief: "Stability is destabilising — prolonged calm breeds excessive leverage; credit is endogenous not exogenous; crises are system-internal.",
    marketLogic: "Track leverage phase: hedge (cash flow covers all obligations) → speculative → Ponzi (needs asset appreciation to service debt).",
    regimePreferences: ["late_cycle", "credit_expansion", "high_vol_risk_off"],
    disagreesWith: ["friedman", "fama"],
    knownBias: "Instability bias; difficult to predict timing of Minsky moment.",
    investmentImplication: "Identify leverage phase from corporate interest coverage. Ponzi phase → reduce credit risk and duration; exit high-beta before forced selling.",
    keywords: /\b(minsky|ponzi finance|financial instability|hedge finance|leverage phase|مينسكي|عدم الاستقرار)\b/i,
  },
  {
    id: "hayek",
    name: "Friedrich Hayek",
    tier: "tier_1",
    framework: "Austrian business cycle; spontaneous order; price signals as information",
    coreBelief: "Artificially low rates distort capital allocation; suppressing market corrections prolongs the eventual reckoning; prices contain dispersed knowledge.",
    marketLogic: "Credit expansion creates malinvestment in the capital structure; eventual correction is unavoidable and should not be suppressed by stimulus.",
    regimePreferences: ["late_cycle_bubble", "post_crisis_deleveraging"],
    disagreesWith: ["keynes", "minsky"],
    knownBias: "Anti-intervention; no workable short-run policy tool; difficult to time.",
    investmentImplication: "Identify sectors with visible malinvestment (overcapacity, subsidised capital). Favour real assets and commodity producers when fiat distortion is extreme.",
    keywords: /\b(hayek|austrian|malinvestment|spontaneous order|price signal|capital structure|هايك|نمساوية)\b/i,
  },
  {
    id: "fama",
    name: "Eugene Fama",
    tier: "tier_1",
    framework: "Efficient Market Hypothesis; factor premia; rational expectations",
    coreBelief: "Prices fully reflect available information; excess returns require bearing excess risk; factor premia are compensation for systematic risk, not mispricings.",
    marketLogic: "Persistent price patterns are either risk premia (value, size, momentum) or noise; active management is a zero-sum game after fees.",
    regimePreferences: ["low_vol_risk_on", "efficient_deep_liquidity"],
    disagreesWith: ["shiller", "soros", "behavioral"],
    knownBias: "EMH dogma; difficulty explaining momentum and anomalies within risk framework.",
    investmentImplication: "Use factor investing systematically; avoid paying for alpha claims; diversify across uncorrelated risk premia rather than concentrating in active bets.",
    keywords: /\b(fama|efficient market|emh|factor premium|factor invest|fama-french|فاما|السوق الكفوء)\b/i,
  },
  {
    id: "shiller",
    name: "Robert Shiller",
    tier: "tier_1",
    framework: "Narrative economics; CAPE valuation; irrational exuberance; long-run mean reversion",
    coreBelief: "Markets are driven by narratives and emotions; CAPE is a reliable long-run return predictor; irrational exuberance creates predictable valuation cycles.",
    marketLogic: "CAPE above 30 predicts below-average 10-year real returns. Narratives spread virally and self-fulfil, detaching prices from fundamentals.",
    regimePreferences: ["bull_trending", "bubble_formation", "valuation_extremes"],
    disagreesWith: ["fama"],
    knownBias: "Not a short-run timing tool; CAPE can stay elevated for years in high-rate environments.",
    investmentImplication: "CAPE >30: reduce equity weight; CAPE <15: structural buying opportunity. Monitor dominant economic narrative for turning points, not just data.",
    keywords: /\b(shiller|cape|irrational exuberance|narrative economics|cyclically adjusted|شيلر|العقلانية)\b/i,
  },

  // ── Tier 2: Practitioner ──────────────────────────────────────────────────────
  {
    id: "buffett",
    name: "Warren Buffett",
    tier: "tier_2",
    framework: "Value investing; business quality; long-duration compounding; moat analysis",
    coreBelief: "Buy wonderful businesses at fair prices; durable competitive moats compound value; price is what you pay, value is what you get.",
    marketLogic: "Intrinsic value from 10-year owner earnings discounted at risk-free rate; margin of safety; ignore short-term price noise.",
    regimePreferences: ["low_vol_risk_on", "bear_ranging"],
    disagreesWith: ["soros", "druckenmiller"],
    knownBias: "Long-horizon US equity focus; underweights macro/FX/EM dynamics; timing-insensitive.",
    investmentImplication: "Focus on ROCE, earnings predictability, and pricing power. In any regime, overpaying for quality is the main risk. Best applied to individual stock selection.",
    keywords: /\b(buffett|berkshire|value invest|moat|margin of safety|owner earnings|بافيت|القيمة)\b/i,
  },
  {
    id: "dalio",
    name: "Ray Dalio",
    tier: "tier_2",
    framework: "All-weather portfolio; debt cycle phases; growth/inflation quadrant; risk parity",
    coreBelief: "All assets move with the growth/inflation quadrant; debt cycles are the most important macro driver; risk parity balances across regimes.",
    marketLogic: "Position across four quadrants (growth↑/↓ × inflation↑/↓); balance risk not capital; distinguish short-term from long-term debt cycle phase.",
    regimePreferences: ["macro_transition", "multi_asset_allocation", "stagflation"],
    disagreesWith: ["buffett"],
    knownBias: "Proprietary framework; may reflect Bridgewater's own positioning constraints.",
    investmentImplication: "Map to growth/inflation quadrant: stagflation → gold + commodities; goldilocks → equities; deflation → bonds. Risk parity fails in simultaneous drawdowns.",
    keywords: /\b(dalio|all.weather|risk parity|debt cycle|growth inflation|bridgewater|داليو|أسلوب كل الطقس)\b/i,
  },
  {
    id: "marks",
    name: "Howard Marks",
    tier: "tier_2",
    framework: "Credit cycle positioning; second-level thinking; risk-adjusted return; cycle awareness",
    coreBelief: "The single most important thing is where we stand in the cycle; risk is the probability of permanent capital loss; second-level thinking beats consensus.",
    marketLogic: "Credit spreads are the most reliable cycle indicator; buy when risk premium is highest (fear); sell when risk premium is lowest (greed).",
    regimePreferences: ["credit_cycle_trough", "high_vol_risk_off"],
    disagreesWith: [],
    knownBias: "Credit-centric view; primarily applicable to fixed income and distressed contexts.",
    investmentImplication: "IG spreads >200bps or HY >500bps: aggressive entry. Below 100bps/300bps: reduce. Cycle position overrides all other signals for credit allocation.",
    keywords: /\b(marks|oaktree|second.level|credit cycle|risk.adjusted|distressed|هوارد ماركس)\b/i,
  },
  {
    id: "soros",
    name: "George Soros",
    tier: "tier_2",
    framework: "Reflexivity; boom-bust cycle; fallibility of market participants",
    coreBelief: "Market participants' biased perceptions feed back into the fundamentals they are trying to predict; boom-bust cycles are self-reinforcing until they collapse.",
    marketLogic: "Identify reflexive reinforcement loops: rising prices → more buying → higher prices → improved fundamentals (for a while). Exit when loop reverses.",
    regimePreferences: ["bubble_formation", "currency_crisis", "regime_break"],
    disagreesWith: ["fama"],
    knownBias: "Qualitative and non-reproducible; relies on pattern recognition from specific macro contexts.",
    investmentImplication: "In reflexive boom: ride the loop but exit before reversal; reflexivity means the fundamentals ARE changing, not just perceptions. Boom-bust applies to currencies and commodities.",
    keywords: /\b(soros|reflexivit|boom.bust|quantum fund|fallibilit|سوروس|الانعكاسية)\b/i,
  },
  {
    id: "druckenmiller",
    name: "Stanley Druckenmiller",
    tier: "tier_2",
    framework: "Macro trend following; asymmetric risk-taking; liquidity cycle awareness",
    coreBelief: "Liquidity drives asset prices more than fundamentals in the short run; position sizing is more important than being right; preserve capital to bet big when odds are best.",
    marketLogic: "Track liquidity conditions (money supply growth, CB balance sheet) and trend momentum. Only risk large when conviction AND liquidity align.",
    regimePreferences: ["macro_transition", "liquidity_driven", "trending_regimes"],
    disagreesWith: ["buffett"],
    knownBias: "Short-to-medium horizon focus; requires active management and timing discipline.",
    investmentImplication: "Liquidity-first: in CB easing → extend duration and risk assets; in tightening → reduce aggressively. Never lose big; size down in low-conviction environments.",
    keywords: /\b(druckenmiller|liquidity cycle|macro trend|position sizing|asymmetric|duquesne|دراكنميلر)\b/i,
  },
];

// ─── Detection and retrieval ──────────────────────────────────────────────────

export function detectRelevantThinkers(
  question: string,
  ctx: string,
  maxResults = 2,
  expertWeights: Record<string, number> = {},
): ThinkerProfile[] {
  const text = `${question} ${ctx}`;
  const matched: ThinkerProfile[] = [];

  for (const profile of THINKER_PROFILES) {
    if (profile.keywords.test(text)) {
      matched.push(profile);
    }
  }

  // If no explicit name match, infer from framework/regime keywords
  // NOTE: word boundaries prevent false matches (e.g. "cape" in "capex", "rate" in "corporate").
  if (matched.length === 0) {
    const hasBubble   = /\b(bubble|irrational|overvalued|narrative|فقاعة)\b/i.test(text);
    const hasCredit   = /\b(credit spread|credit cycle|leverage|مينسكي|ائتمان)\b/i.test(text);
    const hasValue    = /\b(value invest|intrinsic value|undervalued|shiller|cape ratio|قيمة عادلة)\b/i.test(text);
    const hasMacro    = /\b(macro|regime|asset allocation|all.weather|quadrant|تحول|نظام)\b/i.test(text);
    const hasMonetary = /\b(monetary policy|inflation|rate hik|rate cut|فائدة|تضخم)\b/i.test(text);
    const hasOil      = /\b(oil|breakeven|aramco|fiscal|أرامكو|نفط)\b/i.test(text);

    if (hasBubble) matched.push(THINKER_PROFILES.find(p => p.id === "shiller")!);
    if (hasCredit) matched.push(THINKER_PROFILES.find(p => p.id === "minsky")!);
    if (hasValue)  matched.push(THINKER_PROFILES.find(p => p.id === "buffett")!);
    if (hasMacro)  matched.push(THINKER_PROFILES.find(p => p.id === "dalio")!);
    if (hasMonetary) matched.push(THINKER_PROFILES.find(p => p.id === "friedman")!);
    if (hasOil)    matched.push(THINKER_PROFILES.find(p => p.id === "dalio")!);
  }

  // Deduplicate and cap
  const seen = new Set<string>();
  const unique = matched.filter(p => p && !seen.has(p.id) && seen.add(p.id));

  // Phase-86B: Apply expert weights for adaptive thinker relevance sorting
  if (Object.keys(expertWeights).length > 0) {
    unique.sort((a, b) => {
      const wA = expertWeights[a.id] ?? 1.0;
      const wB = expertWeights[b.id] ?? 1.0;
      return wB - wA;  // higher weight = more relevant = sorted first
    });
  }

  // Ensure at least a conflict is represented if only one thinker found
  if (unique.length === 1 && unique[0].disagreesWith.length > 0) {
    const conflictId = unique[0].disagreesWith[0];
    const conflict = THINKER_PROFILES.find(p => p.id === conflictId);
    if (conflict) unique.push(conflict);
  }

  return unique.slice(0, maxResults).filter(Boolean);
}

// ─── Context builder ──────────────────────────────────────────────────────────

export function buildThinkerContext(
  question: string,
  ctx: string,
  isSaudi = false,
  expertWeights: Record<string, number> = {},
): string {
  const thinkers = detectRelevantThinkers(question, ctx, 2, expertWeights);
  if (thinkers.length === 0) return "";

  const parts = thinkers.map(t => {
    const parts2 = [
      `${t.name} (${t.tier.replace("_", " ")}, ${t.framework.slice(0, 50)}):`,
      t.investmentImplication,
    ];
    if (isSaudi && /oil|fiscal|saudi|aramco/i.test(t.framework + t.investmentImplication)) {
      // Thinker has oil/fiscal relevance — note the regime alignment
      parts2.push("(oil-fiscal context applies)");
    }
    return parts2.join(" ").slice(0, 200);
  });

  const conflictNote = (() => {
    if (thinkers.length < 2) return null;
    const t0 = thinkers[0];
    const t1 = thinkers[1];
    if (t0.disagreesWith.includes(t1.id) || t1.disagreesWith.includes(t0.id)) {
      return `${t0.name} and ${t1.name} conflict: competing frameworks — apply both, weight by regime.`;
    }
    return null;
  })();

  // Conflict note placed before profiles — ensures it survives the char budget
  return [
    `Thinker context [${thinkers.map(t => t.id).join("+")}]:`,
    conflictNote,
    parts.join(" || "),
  ].filter(Boolean).join(" ").slice(0, 420);
}
