// Phase-88B: Second-Order Effect Engine
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Problem: Genesis often states the DIRECT effect of a macro event but stops
// there. Institutional foresight requires tracing the SECOND-ORDER and
// THIRD-ORDER transmission — what happens downstream AFTER the direct effect
// lands, especially contagion across sectors and asset classes.
//
// Solution: Pre-computed second-order chains for 8 macro trigger types.
// Chains are selected by keyword detection from question + context text.
// Multiple triggers can be active simultaneously — the engine returns the
// highest-magnitude chain plus a Saudi-specific supplement when isSaudi.
//
// Chain format: Primary event → Direct effect → 2nd order → 3rd order (optional)
// Compact arrow notation for prompt injection (≤220 chars).
//
// Distinct from macroTransmissionEngine.ts (Phase-86A):
//   macroTransmissionEngine: ordered TransmissionStep graph for AI structured output
//   secondOrderEffectEngine: 2nd/3rd order downstream chains for prompt context preparation
//
// No execution language. Educational/advisory foresight only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type SecondOrderTrigger =
  | "rate_shock_up"
  | "rate_shock_down"
  | "oil_shock_negative"
  | "oil_shock_positive"
  | "inflation_surprise_up"
  | "credit_contraction"
  | "liquidity_withdrawal"
  | "liquidity_injection";

export interface SecondOrderEffect {
  trigger:     SecondOrderTrigger;
  primary:     string;  // ≤55 chars: primary event
  direct:      string;  // ≤60 chars: immediate direct effect
  secondOrder: string;  // ≤65 chars: second-order downstream
  thirdOrder?: string;  // ≤55 chars: further downstream (optional)
  amplifying:  boolean; // does 2nd order amplify the primary shock?
  timelag:     "same_session" | "weeks" | "months";
}

export interface SecondOrderChainResult {
  trigger:           SecondOrderTrigger;
  activeTriggers:    SecondOrderTrigger[];
  primaryEffect:     SecondOrderEffect;
  chainContext:      string;  // ≤220 chars injectable (arrow notation)
  amplificationRisk: boolean;
  saudiSpecific:     string | null;  // ≤90 chars Saudi-specific supplement
}

// ─── Chain library ────────────────────────────────────────────────────────────

const SECOND_ORDER_CHAINS: Record<SecondOrderTrigger, SecondOrderEffect> = {
  rate_shock_up: {
    trigger:     "rate_shock_up",
    primary:     "CB rate shock / aggressive hike",
    direct:      "P/E multiple compression → equity sell-off",
    secondOrder: "Credit spreads widen → corporate funding cost rises → capex cuts",
    thirdOrder:  "Earnings revisions lower → dividend coverage pressure",
    amplifying:  true,
    timelag:     "weeks",
  },
  rate_shock_down: {
    trigger:     "rate_shock_down",
    primary:     "CB emergency cut / pivot",
    direct:      "Duration bid → long-bond rally → risk premium compression",
    secondOrder: "Credit spreads tighten → refinancing wave → multiple expansion",
    thirdOrder:  "Growth re-rating → EM/Gulf inflows accelerate",
    amplifying:  false,  // easing is generally de-amplifying for stress
    timelag:     "weeks",
  },
  oil_shock_negative: {
    trigger:     "oil_shock_negative",
    primary:     "Oil price decline below fiscal breakeven",
    direct:      "Saudi/Gulf fiscal surplus narrows → government spending reviews",
    secondOrder: "Bank credit growth decelerates → NIM pressure → real estate softening",
    thirdOrder:  "Household wealth effect weakens → consumption slowdown",
    amplifying:  true,
    timelag:     "months",
  },
  oil_shock_positive: {
    trigger:     "oil_shock_positive",
    primary:     "Oil price rise above fiscal target",
    direct:      "Fiscal surplus widens → government capex acceleration",
    secondOrder: "Bank credit expansion → real estate demand bid → sector rotation into financials",
    thirdOrder:  "Vision 2030 project acceleration → equity re-rating",
    amplifying:  false,
    timelag:     "months",
  },
  inflation_surprise_up: {
    trigger:     "inflation_surprise_up",
    primary:     "Inflation print materially above expectation",
    direct:      "CB credibility stress → term premium expansion → curve steepens",
    secondOrder: "Long-duration assets reprice → pension fund rebalancing → equity pressure",
    thirdOrder:  "Real wage compression → consumption slowdown → earnings miss",
    amplifying:  true,
    timelag:     "weeks",
  },
  credit_contraction: {
    trigger:     "credit_contraction",
    primary:     "Credit spreads blow out / lending standards tighten",
    direct:      "Corporate funding cost rises → investment grade issuance freezes",
    secondOrder: "HY stress → M&A/LBO unwinding → equity multiple pressure",
    thirdOrder:  "Layoffs rise → unemployment lag → demand destruction",
    amplifying:  true,
    timelag:     "months",
  },
  liquidity_withdrawal: {
    trigger:     "liquidity_withdrawal",
    primary:     "CB balance sheet contraction / QT acceleration",
    direct:      "Excess reserves drain → repo rate pressure → short-end stress",
    secondOrder: "Risk premium re-expansion → EM/Gulf capital outflow → spread widening",
    thirdOrder:  "Dollar funding squeeze → USD strength → commodity price pressure",
    amplifying:  true,
    timelag:     "weeks",
  },
  liquidity_injection: {
    trigger:     "liquidity_injection",
    primary:     "CB emergency liquidity / QE announcement",
    direct:      "Repo market stabilises → bank funding pressure eases",
    secondOrder: "Risk premium compression → credit spreads tighten → risk assets bid",
    thirdOrder:  "Dollar softens → EM/Gulf inflows → cross-border demand recovery",
    amplifying:  false,
    timelag:     "same_session",
  },
};

// Saudi-specific second-order supplements
const SAUDI_SUPPLEMENTS: Partial<Record<SecondOrderTrigger, string>> = {
  rate_shock_up:       "SAMA follows Fed → mortgage rate rise → real estate demand cools → Tadawul bank NIM pressured",
  rate_shock_down:     "SAMA rate cut → mortgage demand revival → Saudi bank NIM compressed but volume expands",
  oil_shock_negative:  "Aramco free-float pressure → fiscal breakeven at risk → government PIF drawdown risk",
  oil_shock_positive:  "Saudi surplus reinvestment via PIF → domestic equity bid → Vision 2030 acceleration",
  inflation_surprise_up: "SAMA cannot hike independently (peg) → real rate stays negative → asset inflation risk",
  credit_contraction:  "Saudi bank credit slowdown → SME funding gap → non-oil GDP growth slows",
};

// ─── Trigger detection ────────────────────────────────────────────────────────

// Patterns use word boundary at start; no trailing \b for prefix/stem matches.
// Priority order is explicit — rate_shock_down checked before rate_shock_up
// to prevent "rate shock down" text from matching the upside pattern first.
const TRIGGER_PATTERNS: Record<SecondOrderTrigger, RegExp> = {
  // Easing/cut checked before hike so "rate shock down" does not match the hike pattern
  rate_shock_down:       /\b(rate.cut|emergency.cut|pivot|dovish.surprise|rate.reduction|fed.cuts|cuts.rate|rate.shock.down|dovish.pivot)\b/i,
  rate_shock_up:         /\b(rate.hike|aggressive.hike|75bps|100bps|hawkish.surprise|overtightening|rates.rise|tlt.fall|rate.shock(?!.down))\b/i,
  // Prefix/stem patterns so "falls"/"fell"/"crashing"/"crashed" all match
  oil_shock_negative:    /\boil\w*\s+(fall\w*|fell|crash\w*|drop\w*|declin\w*|below|plunge\w*|collaps\w*)|\bbrent\s+(below|fell|crash\w*)|\bwti\s+(below|crash\w*)|\bcrude\s+(fall\w*|crash\w*)/i,
  oil_shock_positive:    /\b(oil.rise|oil.spike|oil.surge|brent.above.80|oil.rally|crude.rally|supply.cut)\b/i,
  inflation_surprise_up: /\b(inflation.surprise|cpi.above|inflation.above.expect|inflation.shock|hot.cpi|sticky.inflation)\b/i,
  // Use spread.wid (prefix) to match widening/widened/wide; no trailing word boundary
  credit_contraction:    /\b(spread.wid|credit.stress|hy.blow|credit.crunch|funding.freeze|default.risk|spread.blow|hy.stress)\b/i,
  liquidity_withdrawal:  /\b(qt.accelerat|qe.reverse|balance.sheet.contraction|reserve.drain|liquidity.withdraw)\b/i,
  liquidity_injection:   /\b(qe|liquidity.inject|emergency.easing|balance.sheet.expand|unlimited.purchase|repo.support)\b/i,
};

// Priority order: most-specific triggers before general ones
const TRIGGER_PRIORITY: SecondOrderTrigger[] = [
  "oil_shock_negative",
  "oil_shock_positive",
  "credit_contraction",
  "liquidity_injection",
  "liquidity_withdrawal",
  "rate_shock_down",     // down before up — prevents "shock down" text matching up-pattern
  "rate_shock_up",
  "inflation_surprise_up",
];

function detectTriggers(text: string): SecondOrderTrigger[] {
  const detected: SecondOrderTrigger[] = [];
  for (const trigger of TRIGGER_PRIORITY) {
    if (TRIGGER_PATTERNS[trigger].test(text)) detected.push(trigger);
  }
  return detected;
}

// Fallback: infer trigger from regime when no explicit keyword match
function inferTriggerFromRegime(
  primaryRegime: string,
  macroBias: "bullish" | "bearish" | "neutral",
  creditStress: "low" | "moderate" | "high" | "extreme",
): SecondOrderTrigger {
  if (creditStress === "extreme") return "credit_contraction";
  if (creditStress === "high" && /bear/.test(primaryRegime)) return "credit_contraction";
  if (/high_vol_risk_off/.test(primaryRegime)) return "liquidity_withdrawal";
  if (/bull_trending/.test(primaryRegime) && macroBias === "bearish") return "rate_shock_up";
  if (/bear_ranging/.test(primaryRegime) && macroBias === "bullish") return "rate_shock_down";
  return "rate_shock_up";  // conservative default
}

// ─── Context builder ──────────────────────────────────────────────────────────

function buildChainContext(effect: SecondOrderEffect, saudiNote: string | null): string {
  const arrowChain = effect.thirdOrder
    ? `${effect.primary} → ${effect.direct} → ${effect.secondOrder} → ${effect.thirdOrder}`
    : `${effect.primary} → ${effect.direct} → ${effect.secondOrder}`;

  const base = arrowChain.length > 185 ? arrowChain.slice(0, 182) + "..." : arrowChain;
  if (saudiNote && (base.length + saudiNote.length + 10) <= 220) {
    return `${base} | Saudi: ${saudiNote}`;
  }
  return base;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildSecondOrderEffects(input: {
  question:          string;
  ctx:               string;
  primaryRegime:     string;
  macroBias:         "bullish" | "bearish" | "neutral";
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
  isSaudi:           boolean;
}): SecondOrderChainResult {
  const { question, ctx, primaryRegime, macroBias, creditStressLevel, isSaudi } = input;
  const text = `${question} ${ctx}`.toLowerCase();

  const activeTriggers = detectTriggers(text);
  const trigger: SecondOrderTrigger = activeTriggers.length > 0
    ? activeTriggers[0]
    : inferTriggerFromRegime(primaryRegime, macroBias, creditStressLevel);

  const primaryEffect = SECOND_ORDER_CHAINS[trigger];
  const saudiNote     = isSaudi ? (SAUDI_SUPPLEMENTS[trigger] ?? null) : null;
  const chainContext  = buildChainContext(primaryEffect, saudiNote);

  return {
    trigger,
    activeTriggers,
    primaryEffect,
    chainContext,
    amplificationRisk: primaryEffect.amplifying,
    saudiSpecific: saudiNote,
  };
}
