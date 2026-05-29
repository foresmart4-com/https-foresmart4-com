// Phase-81: Multi-Perspective Economic Reasoning
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Simulates institutional multi-perspective reasoning across five analytical lenses.
// Each lens activates based on question/context signals and produces a bounded view.
// Genesis uses these lenses to reason with plurality — not to fake consensus.
//
// Five lenses:
//   macro_economist       — growth, inflation, liquidity, cycles
//   central_bank_policy   — rates, policy transmission, financial stability
//   institutional_allocator — portfolio risk, capital allocation, opportunity cost
//   behavioral_market     — sentiment, crowd behavior, positioning, overreaction
//   historical_analog     — similar episodes, regime comparisons, limits of analogy
//
// Perspective states:
//   aligned              — 4+ lenses converge on the same directional signal
//   mixed                — lenses give different emphases; no direct contradiction
//   conflicting          — at least 2 lenses give opposing directional signals
//   uncertainty_dominant — most active lenses flag high uncertainty or regime ambiguity

import { findHistoricalAnalog } from "./historicalLearning";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LensType =
  | "macro_economist"
  | "central_bank_policy"
  | "institutional_allocator"
  | "behavioral_market"
  | "historical_analog";

export type LensDirection = "positive" | "negative" | "neutral" | "uncertain";

export type PerspectiveState =
  | "aligned"
  | "mixed"
  | "conflicting"
  | "uncertainty_dominant";

export interface LensView {
  lens: LensType;
  lensName: string;
  active: boolean;
  direction: LensDirection;
  view: string;            // ≤100 chars: what this lens observes
  concern: string | null;  // ≤60 chars: primary concern
  dominanceScore: number;  // 0–10: how central this lens is to the question
}

export interface MultiPerspectiveResult {
  perspectiveState: PerspectiveState;
  lensViews: LensView[];
  dominantLens: LensView | null;
  competingLens: LensView | null;
  agreementNote: string;
  disagreementNote: string | null;
  perspectiveContext: string;   // ≤300 chars: compact Genesis-injectable context
}

// ─── Lens signal tables ───────────────────────────────────────────────────────

interface LensSignal {
  pattern: RegExp;
  view: string;
  concern: string;
  direction: LensDirection;
  weight: number;   // activation weight (1–3)
}

// Macro Economist Lens
const MACRO_SIGNALS: LensSignal[] = [
  {
    pattern: /\b(stagflat|supply shock|cost.push|oil shock|energy shock|stagflación)\b/i,
    view: "Supply shock: growth-inflation tradeoff deteriorates; policy tools limited on both dimensions.",
    concern: "Stagflation risk; no clean policy tool",
    direction: "negative", weight: 3,
  },
  {
    pattern: /\b(recession|contraction|gdp (decline|fall|negative)|shrink|انكماش|ركود)\b/i,
    view: "Contraction regime: aggregate demand deficient; leading indicators deteriorating.",
    concern: "Earnings + credit cycle synchronised downturn",
    direction: "negative", weight: 3,
  },
  {
    pattern: /\b(inflation|cpi|price (rise|surge)|تضخم|ارتفاع (أسعار|التضخم))\b/i,
    view: "Inflation elevated: real rate dynamics drive discount rates; fiscal space compresses.",
    concern: "CB forced tightening above neutral",
    direction: "negative", weight: 2,
  },
  {
    pattern: /\b(rate cut|easing|pivot|قطع الفائدة|تخفيف|pivot)\b/i,
    view: "Monetary easing: liquidity conditions improving; risk premium compression likely.",
    concern: "Watch for premature easing vs inflation re-ignition",
    direction: "positive", weight: 2,
  },
  {
    pattern: /\b(expansion|recovery|growth (strong|solid)|boom|نمو (قوي|متسارع))\b/i,
    view: "Expansion phase: output gap closing; earnings cycle supportive; watch late-cycle risk.",
    concern: "Overheating risk at late cycle",
    direction: "positive", weight: 2,
  },
  {
    pattern: /\b(gdp|pmi|growth|inflation|liquidity|cycle|macro|نمو|سيولة|دورة)\b/i,
    view: "Macro regime assessment: growth-inflation-liquidity configuration determines asset class path.",
    concern: "Regime inflection risk",
    direction: "neutral", weight: 1,
  },
];

// Central Bank / Policy Lens
const CB_SIGNALS: LensSignal[] = [
  {
    pattern: /\b(rate hike|tighten|hawkish|رفع الفائدة|تشديد|hawkish)\b/i,
    view: "Tightening cycle active: real rate transmission → credit cost → asset multiple compression.",
    concern: "Transmission lag 12–18 months; overshoot risk",
    direction: "negative", weight: 3,
  },
  {
    pattern: /\b(rate cut|dovish|easing|pivot|تخفيف الفائدة|dovish|حمامي)\b/i,
    view: "Easing signal: financial conditions loosening; equity risk premium compresses.",
    concern: "Credibility risk if inflation not contained",
    direction: "positive", weight: 3,
  },
  {
    pattern: /\b(financial stability|systemic|contagion|banking (stress|crisis)|استقرار مالي)\b/i,
    view: "Stability mandate triggered: CB may subordinate inflation target to financial stability.",
    concern: "Lender-of-last-resort activation changes policy calculus",
    direction: "uncertain", weight: 3,
  },
  {
    pattern: /\b(sama|saudi (monetary|rate)|sar peg|بنك مركزي سعودي|سما|ربط الريال)\b/i,
    view: "SAMA rate-follower constraint: SAR peg forces shadow Fed policy; no independent monetary tool.",
    concern: "Fiscal policy is the only Saudi macro lever",
    direction: "neutral", weight: 2,
  },
  {
    pattern: /\b(fed|ecb|boe|boj|monetary policy|policy rate|فائدة|سياسة نقدية)\b/i,
    view: "CB policy transmission: rate signal flows → real economy → credit conditions → asset prices.",
    concern: "Forward guidance credibility and lag effects",
    direction: "neutral", weight: 1,
  },
];

// Institutional Allocator Lens
const ALLOCATOR_SIGNALS: LensSignal[] = [
  {
    pattern: /\b(bear|drawdown|crash|sell.?off|capital (loss|preservation)|هبوط|تراجع (حاد|كبير))\b/i,
    view: "Defensive allocation warranted: capital preservation over return maximisation; quality tilt.",
    concern: "Drawdown duration risk in illiquid positions",
    direction: "negative", weight: 3,
  },
  {
    pattern: /\b(risk.on|bull|opportun|entry (point|level)|add (exposure|position)|محفظة شراء)\b/i,
    view: "Selective risk-on: monitor position crowding and liquidity depth before adding exposure.",
    concern: "Crowding + correlation breakdown in stress",
    direction: "positive", weight: 3,
  },
  {
    pattern: /\b(rebalance|allocation|diversif|portfolio review|factor (tilt|rotation)|تخصيص|إعادة توازن)\b/i,
    view: "Portfolio review: regime shift may invalidate existing factor weights and correlation assumptions.",
    concern: "Correlation breakdown when diversification most needed",
    direction: "neutral", weight: 2,
  },
  {
    pattern: /\b(real assets|commodities|gold|inflation hedge|real estate|أصول حقيقية|تحوط)\b/i,
    view: "Real assets hedge: inflation-sensitive assets warranted when real rate trajectory is negative.",
    concern: "Opportunity cost if rate normalisation resumes",
    direction: "positive", weight: 2,
  },
  {
    pattern: /\b(invest|portfolio|allocation|capital|risk|position|asset|محفظة|استثمار|تخصيص)\b/i,
    view: "Allocation framing: opportunity cost of defensive posture vs drawdown risk of exposure.",
    concern: "Regime misidentification risk",
    direction: "neutral", weight: 1,
  },
];

// Behavioral / Market Lens
const BEHAVIORAL_SIGNALS: LensSignal[] = [
  {
    pattern: /\b(panic|fear|capitulat|max(imum)? pain|extreme (fear|pessimism)|هلع|خوف شديد)\b/i,
    view: "Sentiment extreme fear: historically contrarian signal; timing highly uncertain; no forced buying.",
    concern: "Catching falling knife vs genuine capitulation",
    direction: "positive", weight: 3,
  },
  {
    pattern: /\b(euphoria|bubble|greed|irrational|extreme (optimism|bullishness)|فقاعة|جشع|نشوة)\b/i,
    view: "Sentiment extreme greed: narrative-driven crowding; vulnerable to mean reversion trigger.",
    concern: "Exit liquidity risk in crowded positions",
    direction: "negative", weight: 3,
  },
  {
    pattern: /\b(momentum|trend.follow|crowded (trade|position)|narrative (dominat|driven)|زخم|اتجاه قوي)\b/i,
    view: "Momentum narrative dominant: trend-following in control; watch for reversal catalyst.",
    concern: "Momentum reversal when narrative shifts",
    direction: "uncertain", weight: 2,
  },
  {
    pattern: /\b(sentiment|positioning|retail (buying|selling)|options (flow|skew)|مشاعر|مراكز)\b/i,
    view: "Positioning assessment: crowd behavior and sentiment extremes dictate near-term path.",
    concern: "Sentiment overshoot relative to fundamental anchor",
    direction: "neutral", weight: 2,
  },
  {
    pattern: /\b(behavioral|bias|herding|overreact|reflexiv|soros|سلوكي|قطيع)\b/i,
    view: "Behavioral dynamics active: cognitive biases may be driving mispricing; second-level thinking required.",
    concern: "Arbitrage limits may allow mispricing to persist",
    direction: "neutral", weight: 1,
  },
];

// Historical Analog Lens — augmented by historicalLearning module
const HISTORICAL_SIGNALS: LensSignal[] = [
  {
    pattern: /\b(2008|gfc|global financial crisis|lehman|subprime|أزمة 2008|الأزمة المالية)\b/i,
    view: "2008 analog: credit system shock; velocity collapse; CB lender-of-last-resort essential.",
    concern: "Shadow banking contagion speed underestimated",
    direction: "negative", weight: 3,
  },
  {
    pattern: /\b(1970s|stagflat|volcker|oil shock|1973|1979|stagflación|صدمة نفطية)\b/i,
    view: "1970s stagflation analog: supply-driven; rate credibility required; painful medicine.",
    concern: "Policy tightening recession vs inflation entrenchment",
    direction: "negative", weight: 3,
  },
  {
    pattern: /\b(2000|dotcom|tech bubble|nasdaq (crash|peak)|فقاعة التقنية|2000)\b/i,
    view: "Dotcom 2000 analog: narrative-driven multiples; mean reversion from extremes typically -70%.",
    concern: "Revaluation speed can exceed fundamental correction",
    direction: "negative", weight: 2,
  },
  {
    pattern: /\b(covid|2020|pandemic (shock|recovery)|march 2020|كوفيد|جائحة)\b/i,
    view: "2020 COVID analog: policy response determined recovery speed; fiscal-monetary coordination key.",
    concern: "Inflation legacy from demand+supply distortion",
    direction: "neutral", weight: 2,
  },
  {
    pattern: /\b(historical|analog|similar|episode|1929|depression|great (depression|inflation)|تاريخ|مشابه)\b/i,
    view: "Historical analog active: context useful; structural differences limit direct extrapolation.",
    concern: "Analog reasoning ignores structural regime differences",
    direction: "neutral", weight: 1,
  },
];

// ─── Lens activation ──────────────────────────────────────────────────────────

interface LensDefinition {
  type: LensType;
  name: string;
  activationPattern: RegExp;
  signals: LensSignal[];
  fallbackView: string;
  fallbackConcern: string;
}

const LENS_DEFINITIONS: LensDefinition[] = [
  {
    type: "macro_economist",
    name: "Macro Economist",
    activationPattern: /\b(gdp|growth|inflation|pmi|liquidity|cycle|recession|expansion|macro|stagflat|نمو|تضخم|سيولة|دورة|ركود)\b/i,
    signals: MACRO_SIGNALS,
    fallbackView: "Macro lens: growth-inflation-liquidity regime assessment needed.",
    fallbackConcern: "Regime classification uncertain",
  },
  {
    type: "central_bank_policy",
    name: "Central Bank / Policy",
    activationPattern: /\b(fed|ecb|sama|boe|boj|rate|monetary|policy|fiscal|inflation target|فائدة|سياسة|بنك مركزي|سما)\b/i,
    signals: CB_SIGNALS,
    fallbackView: "Policy lens: rate path and transmission mechanism determine credit conditions.",
    fallbackConcern: "Policy transmission lag and credibility",
  },
  {
    type: "institutional_allocator",
    name: "Institutional Allocator",
    activationPattern: /\b(invest|portfolio|allocat|capital|position|asset class|risk|return|factor|محفظة|استثمار|تخصيص|مخاطرة)\b/i,
    signals: ALLOCATOR_SIGNALS,
    fallbackView: "Allocator lens: risk-adjusted opportunity cost framing required.",
    fallbackConcern: "Regime misidentification drives allocation error",
  },
  {
    type: "behavioral_market",
    name: "Behavioral / Market",
    activationPattern: /\b(sentiment|crowd|momentum|narrative|panic|fear|greed|positioning|euphoria|مشاعر|زخم|هلع|جشع|قطيع)\b/i,
    signals: BEHAVIORAL_SIGNALS,
    fallbackView: "Behavioral lens: crowd positioning and narrative dynamics shape near-term path.",
    fallbackConcern: "Sentiment overshoot relative to fundamentals",
  },
  {
    type: "historical_analog",
    name: "Historical Analog",
    activationPattern: /\b(historical|history|analog|episode|crisis|1929|1970|1973|2000|2008|2020|covid|depression|similar|تاريخ|مشابه|أزمة)\b/i,
    signals: HISTORICAL_SIGNALS,
    fallbackView: "Historical lens: context from prior episodes; structural differences must be stated.",
    fallbackConcern: "Analog overfitting to past without structural adjustment",
  },
];

// ─── Lens view builder ────────────────────────────────────────────────────────

function buildLensView(
  def: LensDefinition,
  question: string,
  context: string,
  histAnalog?: string,
): LensView {
  const text = `${question} ${context}`;
  const isActive = def.activationPattern.test(text);

  let dominanceScore = 0;
  let bestSignal: LensSignal | null = null;

  for (const signal of def.signals) {
    if (signal.pattern.test(text)) {
      dominanceScore += signal.weight;
      if (!bestSignal || signal.weight > bestSignal.weight) bestSignal = signal;
    }
  }

  // Historical analog lens gets extra context from historicalLearning module
  const view = def.type === "historical_analog" && histAnalog
    ? histAnalog.slice(0, 100)
    : bestSignal?.view ?? def.fallbackView;
  const concern = bestSignal?.concern ?? def.fallbackConcern;
  const direction: LensDirection = bestSignal?.direction ?? "neutral";

  return {
    lens: def.type,
    lensName: def.name,
    active: isActive,
    direction,
    view: view.slice(0, 100),
    concern: concern.slice(0, 60),
    dominanceScore: Math.min(10, dominanceScore),
  };
}

// ─── Perspective state derivation ─────────────────────────────────────────────

function derivePerspectiveState(activeLenses: LensView[]): PerspectiveState {
  if (activeLenses.length === 0) return "uncertainty_dominant";

  const directions = activeLenses.map(l => l.direction);
  const positiveCount  = directions.filter(d => d === "positive").length;
  const negativeCount  = directions.filter(d => d === "negative").length;
  const uncertainCount = directions.filter(d => d === "uncertain").length;
  const total = activeLenses.length;

  if (uncertainCount >= Math.ceil(total / 2)) return "uncertainty_dominant";
  if (positiveCount >= 3 || negativeCount >= 3) {
    const dominant = positiveCount >= 3 ? "positive" : "negative";
    const opposing = dominant === "positive" ? negativeCount : positiveCount;
    if (opposing >= 2) return "conflicting";
    return "aligned";
  }
  if (positiveCount >= 1 && negativeCount >= 1) return "conflicting";
  return "mixed";
}

// ─── Agreement / disagreement notes ──────────────────────────────────────────

function buildAgreementNote(activeLenses: LensView[], state: PerspectiveState): string {
  if (state === "aligned") {
    const dir = activeLenses.filter(l => l.direction !== "neutral" && l.direction !== "uncertain")[0]?.direction ?? "neutral";
    const names = activeLenses.filter(l => l.direction === dir).map(l => l.lensName.split("/")[0].trim()).slice(0, 3);
    return `Lenses aligned ${dir}: ${names.join(", ")}`.slice(0, 80);
  }
  if (state === "mixed") {
    return "Lenses mixed: different emphases; no direct contradiction".slice(0, 80);
  }
  return "Partial agreement on regime; no consensus on direction".slice(0, 80);
}

function buildDisagreementNote(activeLenses: LensView[], state: PerspectiveState): string | null {
  if (state !== "conflicting" && state !== "uncertainty_dominant") return null;
  const pos = activeLenses.filter(l => l.direction === "positive").map(l => l.lensName.split("/")[0].trim());
  const neg = activeLenses.filter(l => l.direction === "negative").map(l => l.lensName.split("/")[0].trim());
  if (pos.length > 0 && neg.length > 0) {
    return `Conflict: ${pos.slice(0, 2).join("+")} positive vs ${neg.slice(0, 2).join("+")} negative`.slice(0, 80);
  }
  return "High uncertainty: most lenses flag insufficient regime clarity".slice(0, 80);
}

// ─── Perspective context builder ──────────────────────────────────────────────

function buildPerspectiveContext(
  state: PerspectiveState,
  lenses: LensView[],
  dominant: LensView | null,
  competing: LensView | null,
  agreement: string,
): string {
  const stateLabel = `Perspective [${state}]`;
  const dominantPart = dominant
    ? `Dominant: ${dominant.lensName} — ${dominant.view.slice(0, 70)}`
    : "";
  const competingPart = competing
    ? `Competing: ${competing.lensName} — ${competing.concern?.slice(0, 50) ?? ""}`
    : "";
  const parts = [stateLabel, agreement, dominantPart, competingPart].filter(Boolean);
  return parts.join(" | ").slice(0, 300);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * reasonMultiPerspective — activate five analytical lenses and synthesize
 * a multi-perspective view of the question. Returns aligned/mixed/conflicting
 * state, dominant and competing lens, and a compact context for Genesis.
 * O(1), pure, no side effects.
 */
export function reasonMultiPerspective(
  question: string,
  context: string = "",
  regime?: string,
): MultiPerspectiveResult {
  // Historical lens gets enriched view from historicalLearning
  const histResult = findHistoricalAnalog(question, context);
  const histAnalog = histResult.matchedEpisode
    ? `${histResult.matchedEpisode.name}: ${histResult.matchedEpisode.keyLesson}`.slice(0, 100)
    : undefined;

  // Build all five lens views
  const lensViews = LENS_DEFINITIONS.map(def =>
    buildLensView(def, question, context, def.type === "historical_analog" ? histAnalog : undefined),
  );

  const activeLenses = lensViews.filter(l => l.active);

  // Dominant: highest dominance score among active lenses
  const dominantLens = activeLenses.length > 0
    ? activeLenses.reduce((a, b) => b.dominanceScore > a.dominanceScore ? b : a)
    : null;

  // Competing: highest-scoring lens with different direction from dominant
  const competingLens = dominantLens
    ? activeLenses
        .filter(l => l.lens !== dominantLens.lens && l.direction !== dominantLens.direction && l.direction !== "neutral")
        .sort((a, b) => b.dominanceScore - a.dominanceScore)[0] ?? null
    : null;

  const perspectiveState = derivePerspectiveState(activeLenses);
  const agreementNote    = buildAgreementNote(activeLenses, perspectiveState);
  const disagreementNote = buildDisagreementNote(activeLenses, perspectiveState);
  const perspectiveContext = buildPerspectiveContext(
    perspectiveState, lensViews, dominantLens, competingLens, agreementNote,
  );

  return {
    perspectiveState,
    lensViews,
    dominantLens,
    competingLens,
    agreementNote,
    disagreementNote,
    perspectiveContext,
  };
}
