// Phase-86A: Thesis Impact Engine
// Pure deterministic functions — no AI calls, no network, O(1).
//
// COMPLETELY NEW — no equivalent in existing codebase.
//
// Maps macro events to their impact on the current investment thesis.
// "Thesis" is inferred from question + context (bullish/bearish/neutral direction
// + Saudi flag + current macro regime).
//
// Impact categories:
//   strengthens           — event supports the current thesis direction
//   weakens               — event undermines the current thesis direction
//   neutral               — event is not thesis-relevant
//   invalidation_pressure — event approaches or breaches thesis invalidation conditions
//
// Per-impact:
//   impactScore:          0-100 (magnitude of impact)
//   confidenceModifier:   -15 to +15 (adjustment to confidence anchor)
//   reason:               ≤100 chars
//   conditionalInvalidation: string | null (when triggered)
//
// Saudi-specific: oil price relative to $75-80/bbl breakeven is the primary
// Saudi thesis driver. Events that move oil relative to breakeven are scored higher.
//
// No autonomous action. Educational/advisory only.

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ImpactCategory =
  | "strengthens"
  | "weakens"
  | "neutral"
  | "invalidation_pressure";

export type MacroEventType =
  | "rate_change"
  | "oil_price_move"
  | "inflation_print"
  | "credit_spread_move"
  | "fiscal_announcement"
  | "policy_language_shift"
  | "macro_regime_shift"
  | "risk_off_episode"
  | "unknown";

export interface MacroEvent {
  type:         MacroEventType;
  direction:    "positive" | "negative" | "neutral";
  magnitude:    "large" | "medium" | "small";
  saudiImpact:  "direct" | "indirect" | "none";
}

export interface ThesisImpactResult {
  thesisDirection:       "bullish" | "bearish" | "neutral";
  impactCategory:        ImpactCategory;
  impactScore:           number;   // 0-100
  confidenceModifier:    number;   // -15 to +15
  reason:                string;   // ≤100 chars
  conditionalInvalidation: string | null;
  impactContext:         string;   // injectable ≤220 chars
}

// ─── Thesis direction inference ───────────────────────────────────────────────

const BULLISH_SIGNALS = /\b(bullish|positive|opportunity|upside|buy|overweight|constructive|صاعد|إيجابي|فرصة)\b/i;
const BEARISH_SIGNALS = /\b(bearish|negative|downside|sell|underweight|defensive|هابط|سلبي|تجنب)\b/i;
const SAUDI_BREAKEVEN_THRESHOLD = { low: 70, normal: 78, high: 85 };

function inferThesisDirection(question: string, ctx: string): "bullish" | "bearish" | "neutral" {
  const text = `${question} ${ctx}`;
  const bullScore = (text.match(new RegExp(BULLISH_SIGNALS.source, "gi")) ?? []).length;
  const bearScore = (text.match(new RegExp(BEARISH_SIGNALS.source, "gi")) ?? []).length;
  if (bullScore > bearScore + 1) return "bullish";
  if (bearScore > bullScore + 1) return "bearish";
  return "neutral";
}

// ─── Impact rules ─────────────────────────────────────────────────────────────
// For each (eventType × direction × thesisDirection) → impact category + score + modifier

interface ImpactRule {
  eventType:  MacroEventType;
  eventDir:   "positive" | "negative" | "neutral" | "any";
  thesisBias: "bullish" | "bearish" | "neutral" | "any";
  isSaudi:    boolean | "any";
  impact:     ImpactCategory;
  score:      number;
  modifier:   number;
  reason:     string;
  conditionalInvalidation?: string;
}

const IMPACT_RULES: ImpactRule[] = [
  // Rate change rules
  { eventType: "rate_change", eventDir: "negative", thesisBias: "bullish", isSaudi: "any",
    impact: "weakens", score: 55, modifier: -8,
    reason: "Rate hike raises discount rate → equity multiple compression → bullish thesis headwind." },
  { eventType: "rate_change", eventDir: "negative", thesisBias: "bearish", isSaudi: "any",
    impact: "strengthens", score: 50, modifier: +6,
    reason: "Rate hike supports bearish thesis via multiple compression and credit tightening." },
  { eventType: "rate_change", eventDir: "positive", thesisBias: "bullish", isSaudi: "any",
    impact: "strengthens", score: 60, modifier: +10,
    reason: "Rate cut expands equity multiples → bullish thesis supported via lower discount rate." },
  { eventType: "rate_change", eventDir: "positive", thesisBias: "bearish", isSaudi: "any",
    impact: "weakens", score: 50, modifier: -8,
    reason: "Rate cut undermines bearish thesis — easing reduces discount rate headwind." },

  // Oil price rules — Saudi-specific
  { eventType: "oil_price_move", eventDir: "positive", thesisBias: "bullish", isSaudi: true,
    impact: "strengthens", score: 75, modifier: +12,
    reason: "Oil above Saudi breakeven → fiscal surplus → TASI earnings expansion → bullish thesis confirmed." },
  { eventType: "oil_price_move", eventDir: "negative", thesisBias: "bullish", isSaudi: true,
    impact: "weakens", score: 70, modifier: -12,
    reason: "Oil below Saudi breakeven → fiscal deficit pressure → TASI earnings headwind → bullish thesis weakened.",
    conditionalInvalidation: "If oil sustains below $70/bbl for 3+ months, Saudi fiscal thesis is invalidated." },
  { eventType: "oil_price_move", eventDir: "negative", thesisBias: "bullish", isSaudi: false,
    impact: "weakens", score: 40, modifier: -5,
    reason: "Oil decline signals weak global demand → earnings pressure on commodity-linked equities." },
  { eventType: "oil_price_move", eventDir: "positive", thesisBias: "bullish", isSaudi: false,
    impact: "strengthens", score: 35, modifier: +5,
    reason: "Oil rally is inflationary tailwind for commodity producers but may trigger CB tightening." },

  // Inflation print rules
  { eventType: "inflation_print", eventDir: "negative", thesisBias: "bullish", isSaudi: "any",
    impact: "weakens", score: 45, modifier: -7,
    reason: "High inflation print → CB hawkish response → rate expectations ↑ → multiple compression risk." },
  { eventType: "inflation_print", eventDir: "positive", thesisBias: "bullish", isSaudi: "any",
    impact: "strengthens", score: 40, modifier: +7,
    reason: "Low inflation print → CB easing space ↑ → rate cut path opens → multiple expansion." },

  // Credit spread rules
  { eventType: "credit_spread_move", eventDir: "negative", thesisBias: "bullish", isSaudi: "any",
    impact: "weakens", score: 60, modifier: -10,
    reason: "Spread widening tightens financial conditions → risk premium ↑ → equity rerating lower.",
    conditionalInvalidation: "HY spreads >500bps: recession probability elevated; thesis conviction ceiling drops to 50%." },
  { eventType: "credit_spread_move", eventDir: "positive", thesisBias: "bearish", isSaudi: "any",
    impact: "weakens", score: 50, modifier: -8,
    reason: "Spread compression reduces risk premium → equities rerate higher → bearish thesis headwind." },

  // Fiscal announcement (Saudi-specific)
  { eventType: "fiscal_announcement", eventDir: "positive", thesisBias: "bullish", isSaudi: true,
    impact: "strengthens", score: 65, modifier: +10,
    reason: "Saudi fiscal expansion supports Vision 2030 capex → TASI earnings base broadens." },
  { eventType: "fiscal_announcement", eventDir: "negative", thesisBias: "bullish", isSaudi: true,
    impact: "invalidation_pressure", score: 70, modifier: -12,
    reason: "Saudi fiscal contraction → capex cuts → Vision 2030 timeline slippage → thesis at risk.",
    conditionalInvalidation: "Saudi fiscal deficit >5% GDP + oil below $72/bbl = thesis invalidation conditions met." },

  // Risk-off episode
  { eventType: "risk_off_episode", eventDir: "negative", thesisBias: "bullish", isSaudi: "any",
    impact: "weakens", score: 55, modifier: -8,
    reason: "Risk-off episode → correlation spike → TASI sells with global risk assets regardless of fundamentals." },
  { eventType: "risk_off_episode", eventDir: "negative", thesisBias: "bearish", isSaudi: "any",
    impact: "strengthens", score: 50, modifier: +7,
    reason: "Risk-off confirms bearish thesis — defensive positioning validated." },

  // Macro regime shift
  { eventType: "macro_regime_shift", eventDir: "negative", thesisBias: "bullish", isSaudi: "any",
    impact: "weakens", score: 65, modifier: -10,
    reason: "Adverse regime shift invalidates the regime assumption underlying the bullish thesis." },
  { eventType: "macro_regime_shift", eventDir: "positive", thesisBias: "bearish", isSaudi: "any",
    impact: "weakens", score: 60, modifier: -8,
    reason: "Positive regime shift undermines the macro backdrop supporting the bearish thesis." },
];

// ─── Event detection ──────────────────────────────────────────────────────────

export function detectMacroEventType(question: string, ctx: string, eventCtx?: string): MacroEvent {
  const text = `${question} ${ctx} ${eventCtx ?? ""}`;

  const isOil           = /\b(oil|crude|brent|wti|opec|نفط|برنت)\b/i.test(text);
  const isRate          = /\b(rate|fed|ecb|hike|cut|monetary|فائدة|تشديد|تيسير)\b/i.test(text);
  const isInflation     = /\b(cpi|inflation|pce|price|تضخم|أسعار)\b/i.test(text);
  const isCredit        = /\b(spread|credit|high yield|ig spread|فروقات|ائتمان)\b/i.test(text);
  const isFiscal        = /\b(fiscal|budget|deficit|surplus|capex|ميزانية|عجز|فائض)\b/i.test(text);
  const isPolicyLang    = /\b(hawkish|dovish|pivot|language|signal|متشدد|متساهل|تحول)\b/i.test(text);
  const isRegimeShift   = /\b(regime|transition|shift|quadrant|نظام|تحول)\b/i.test(text);
  const isRiskOff       = /\b(risk.off|safe haven|flight to quality|ملاذ آمن|نفور المخاطر)\b/i.test(text);
  const isSaudi         = /\b(saudi|tasi|sama|aramco|breakeven|سعودي|أرامكو)\b/i.test(text);

  const positiveDir = /\b(cut|ease|rally|surplus|above breakeven|positive|تخفيض|ارتفاع|فائض)\b/i.test(text);
  const negativeDir = /\b(hike|tighten|decline|deficit|below breakeven|negative|رفع|انخفاض|عجز)\b/i.test(text);
  const direction: MacroEvent["direction"] = positiveDir && !negativeDir ? "positive"
    : negativeDir && !positiveDir ? "negative" : "neutral";

  const largeMagnitude  = /\b(shock|dramatic|collapse|surge|large|significant|صدمة|انهيار|ارتفاع حاد)\b/i.test(text);
  const magnitude: MacroEvent["magnitude"] = largeMagnitude ? "large" : "medium";

  const saudiImpact: MacroEvent["saudiImpact"] = isSaudi ? "direct" : isOil ? "indirect" : "none";

  const type: MacroEventType = isPolicyLang ? "policy_language_shift"
    : isRegimeShift ? "macro_regime_shift"
    : isRiskOff ? "risk_off_episode"
    : isFiscal ? "fiscal_announcement"
    : isCredit ? "credit_spread_move"
    : isInflation ? "inflation_print"
    : isOil ? "oil_price_move"
    : isRate ? "rate_change"
    : "unknown";

  return { type, direction, magnitude, saudiImpact };
}

// ─── Impact computation ───────────────────────────────────────────────────────

export function computeThesisImpact(
  question: string,
  ctx: string,
  macroEvent: MacroEvent,
  isSaudi: boolean,
): ThesisImpactResult {
  const thesisDirection = inferThesisDirection(question, ctx);

  // Find matching rule (most specific first)
  const matchingRules = IMPACT_RULES.filter(rule => {
    const typeMatch  = rule.eventType === macroEvent.type;
    const dirMatch   = rule.eventDir === macroEvent.direction || rule.eventDir === "any";
    const biasMatch  = rule.thesisBias === thesisDirection || rule.thesisBias === "any";
    const saudiMatch = rule.isSaudi === "any" || rule.isSaudi === isSaudi;
    return typeMatch && dirMatch && biasMatch && saudiMatch;
  });

  // Sort by specificity (isSaudi-specific rules first, then higher scores)
  matchingRules.sort((a, b) => {
    if (a.isSaudi === isSaudi && b.isSaudi !== isSaudi) return -1;
    if (b.isSaudi === isSaudi && a.isSaudi !== isSaudi) return 1;
    return b.score - a.score;
  });

  if (matchingRules.length === 0) {
    return {
      thesisDirection,
      impactCategory: "neutral",
      impactScore: 0,
      confidenceModifier: 0,
      reason: "Event type does not directly impact the detected thesis direction.",
      conditionalInvalidation: null,
      impactContext: "",
    };
  }

  const best = matchingRules[0];
  const magnitudeMultiplier = macroEvent.magnitude === "large" ? 1.3 : macroEvent.magnitude === "medium" ? 1.0 : 0.7;
  const impactScore = Math.min(100, Math.round(best.score * magnitudeMultiplier));
  const confidenceModifier = Math.max(-15, Math.min(15, Math.round(best.modifier * magnitudeMultiplier)));

  const impactContext = [
    `Thesis impact [${best.impact.replace(/_/g, " ")}]:`,
    best.reason.slice(0, 100),
    confidenceModifier !== 0 ? `Confidence: ${confidenceModifier > 0 ? "+" : ""}${confidenceModifier} pts` : null,
    best.conditionalInvalidation ? `Invalidation: ${best.conditionalInvalidation.slice(0, 80)}` : null,
  ].filter(Boolean).join(" | ").slice(0, 220);

  return {
    thesisDirection,
    impactCategory:        best.impact,
    impactScore,
    confidenceModifier,
    reason:                best.reason,
    conditionalInvalidation: best.conditionalInvalidation ?? null,
    impactContext,
  };
}
