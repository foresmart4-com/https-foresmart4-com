// Phase-89A: Macro Research Desk
// Pure deterministic — no AI calls, no network, O(1) per call.
//
// Distinct from macroTransmissionEngine.ts (Phase-86A):
//   macroTransmissionEngine: ordered TransmissionStep CHAINS (rates→credit→earnings)
//   macroResearchDesk: institutional DESK BRIEFING — synthesises regime + rates +
//                      inflation + liquidity into a single desk voice with conviction
//
// Distinct from institutionalReasoning.ts (Phase-63):
//   institutionalReasoning: macro chain narrative injected as a prompt context string
//   macroResearchDesk: desk object with structured fields + deskConviction + isActive
//
// The macro desk is the primary voice when the question centres on:
//   rates, inflation, liquidity, regime, monetary policy (not CB-decision-specific),
//   GDP, credit cycles, macro transmission, DXY, risk-on/risk-off
//
// Desk conviction (0-100): how much the macro desk has to say about this question.
// A conviction < 25 = desk is not relevant; do not inject its briefing.
//
// deskBriefing ≤160 chars: injectable desk voice for prompt context.
// Educational/advisory only.

// ─── Types ───────────────────────────────────────────────────────────────────────

export type RatesSignalLabel    = "rising" | "falling" | "on_hold" | "uncertain";
export type InflationRegime     = "elevated" | "normalising" | "below_target" | "unknown";
export type LiquidityCondition  = "tight" | "ample" | "draining" | "injecting" | "neutral";

export interface MacroDeskBriefing {
  deskId:            "macro";
  regimeAssessment:  string;          // ≤55 chars: regime + cycle phase
  ratesSignal:       RatesSignalLabel;
  ratesContext:      string;          // ≤50 chars: rates direction + DXY note
  inflationRegime:   InflationRegime;
  liquidityCondition: LiquidityCondition;
  deskConviction:    number;          // 0-100
  deskBriefing:      string;          // ≤160 chars injectable
  isActive:          boolean;         // false when deskConviction < 25
}

// ─── Relevance detection ──────────────────────────────────────────────────────

const MACRO_DESK_PATTERNS = [
  /\b(rate[s]?|tightening|easing|inflation|liquidity|regime|monetary|gdp|credit.cycle|yield.curve|dxy|risk.on|risk.off|macro|cpi|real.rate|discount.rate)\b/gi,
];

export function scoreMacroRelevance(question: string, ctx: string): number {
  const text = `${question} ${ctx}`;
  let hits = 0;
  for (const p of MACRO_DESK_PATTERNS) {
    p.lastIndex = 0;
    hits += (text.match(p) ?? []).length;
  }
  return Math.min(100, hits * 12 + 10);  // base 10, +12 per keyword hit
}

// ─── Signal derivation ────────────────────────────────────────────────────────

function deriveRatesSignal(
  ratesEnv: string,
  tltChangePct: number | null | undefined,
): RatesSignalLabel {
  const r = ratesEnv.toLowerCase();
  if (/tight|hike|hawkish|rising|restrict/.test(r) || (tltChangePct != null && tltChangePct < -1)) return "rising";
  if (/eas|cut|dovish|falling|pivot|reduce/.test(r) || (tltChangePct != null && tltChangePct > 1)) return "falling";
  if (/hold|pause|on.hold|stable|unchanged/.test(r)) return "on_hold";
  return "uncertain";
}

function deriveInflationRegime(ratesEnv: string, ctx: string): InflationRegime {
  const text = `${ratesEnv} ${ctx}`.toLowerCase();
  // Elevated: inflation text + qualifier, OR CPI/PCE above target, OR hot CPI
  if (/inflat.*(high|elev|above.target|above.4|surging|persistent)/.test(text) ||
      /\b(cpi.above|cpi.high|cpi.elev|hot.cpi|above.target|above.4%|pce.above)\b/.test(text) ||
      /\d+\.\d+%\s*(cpi|pce|inflation)/.test(text))                             return "elevated";
  if (/inflat.*(declin|normal|towards.target|cooling|2\.\d)/.test(text) ||
      /\b(dis.?inflat|deflating|cpi.at.2|cpi.near.target)\b/.test(text))        return "normalising";
  if (/inflat.*(low|below.target|below.2|deflationary)/.test(text))             return "below_target";
  return "unknown";
}

function deriveLiquidityCondition(
  creditStress: "low" | "moderate" | "high" | "extreme",
  ratesEnv: string,
  dxyImpact: string,
): LiquidityCondition {
  const r = (ratesEnv + " " + dxyImpact).toLowerCase();
  if (creditStress === "extreme")                           return "draining";
  if (/qt|quantitative.tight|balance.sheet.con/.test(r))  return "draining";
  if (/qe|inject|expand|ample|unlimited/.test(r))         return "injecting";
  if (creditStress === "high" || /tight.liquid|dxy.ris/.test(r)) return "tight";
  if (/ample|spread.tight|dxy.fall/.test(r))              return "ample";
  return "neutral";
}

// ─── Regime assessment ────────────────────────────────────────────────────────

function buildRegimeAssessment(regime: string, macroBias: string, regimeConf: number): string {
  const label = (regime ?? "macro_transition").replace(/_/g, " ");
  const conf  = regimeConf >= 65 ? "high-conf" : regimeConf >= 40 ? "mod-conf" : "low-conf";
  const bias  = macroBias === "bullish" ? "↑" : macroBias === "bearish" ? "↓" : "→";
  return `${label} ${bias} [${conf}]`.slice(0, 55);
}

// ─── Desk briefing builder ────────────────────────────────────────────────────

function buildDeskBriefing(
  regimeAssessment: string,
  ratesSignal: RatesSignalLabel,
  ratesContext: string,
  inflationRegime: InflationRegime,
  liquidityCondition: LiquidityCondition,
  conviction: number,
): string {
  const rateStr  = ratesSignal === "rising" ? "Rates↑" : ratesSignal === "falling" ? "Rates↓" : "Rates→";
  const infStr   = inflationRegime === "elevated" ? "Inflation high" : inflationRegime === "normalising" ? "Inflation↓" : "Inflation unk";
  const liqStr   = liquidityCondition === "tight" || liquidityCondition === "draining" ? "Liquidity tight" : "Liquidity ok";
  return `MACRO: ${regimeAssessment.slice(0,45)} | ${rateStr} ${infStr} | ${liqStr} | ${ratesContext.slice(0,30)} [conv:${conviction}]`.slice(0, 160);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildMacroDeskBriefing(input: {
  question:          string;
  ctx:               string;
  regime:            string;
  macroBias:         "bullish" | "bearish" | "neutral";
  creditStressLevel: "low" | "moderate" | "high" | "extreme";
  ratesEnv:          string;
  oilLiquidity:      string;
  dxyImpact:         string;
  tltChangePct:      number | null | undefined;
  regimeConf:        number;
}): MacroDeskBriefing {
  const { question, ctx, regime, macroBias, creditStressLevel,
          ratesEnv, oilLiquidity, dxyImpact, tltChangePct, regimeConf } = input;

  const relevanceScore  = scoreMacroRelevance(question, ctx);
  const ratesSignal     = deriveRatesSignal(ratesEnv, tltChangePct);
  const inflationRegime = deriveInflationRegime(ratesEnv, ctx);
  const liquidityCond   = deriveLiquidityCondition(creditStressLevel, ratesEnv, dxyImpact);
  const regimeAssess    = buildRegimeAssessment(regime, macroBias, regimeConf);

  // Rates context: short phrase for briefing
  const ratesContext = ratesSignal === "rising"
    ? `Rates rising; DXY ${/dxy.ris/.test(dxyImpact.toLowerCase()) ? "↑" : "watch"}`
    : ratesSignal === "falling"
    ? `Rates falling; easing cycle active`
    : `Rates on hold; uncertainty high`;

  // Conviction: base from relevance + boost for active signals
  let conviction = Math.min(95, relevanceScore);
  if (ratesSignal !== "uncertain") conviction = Math.min(95, conviction + 10);
  if (inflationRegime !== "unknown") conviction = Math.min(95, conviction + 5);
  if (creditStressLevel === "high" || creditStressLevel === "extreme") conviction = Math.min(95, conviction + 8);

  const isActive = conviction >= 25;

  return {
    deskId:            "macro",
    regimeAssessment:  regimeAssess,
    ratesSignal,
    ratesContext,
    inflationRegime,
    liquidityCondition: liquidityCond,
    deskConviction:    conviction,
    deskBriefing:      buildDeskBriefing(regimeAssess, ratesSignal, ratesContext, inflationRegime, liquidityCond, conviction),
    isActive,
  };
}
