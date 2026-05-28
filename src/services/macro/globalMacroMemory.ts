/**
 * Global Macro Memory — Phase 43
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Provides long-horizon global macro context by classifying the current
 * macro cycle, detecting the dominant region, and identifying active
 * structural themes from question keywords and market signals.
 *
 * Macro cycle states:
 *   stable_cycle      — coherent, persistent macro regime; structural support
 *   transition_cycle  — macro structure shifting; regime inflection in progress
 *   tightening_cycle  — monetary tightening dominant; rate/credit stress primary
 *   easing_cycle      — easing or pivot dominant; liquidity support present
 *   fragmented_cycle  — regional divergence; no global macro consensus
 *   uncertain_cycle   — insufficient signal for cycle classification
 *
 * Regional coverage:
 *   US | Europe | UK | China | GCC | EM |
 *   Commodities | FX | Rates | Crypto | Liquidity | Global
 *
 * Design rules:
 * - No deterministic forecasting: cycle states describe structural patterns
 * - No fabricated themes: only themes with signal evidence are included
 * - Honest default: uncertain_cycle when evidence is insufficient
 * - Hedged language only in narratives
 */

import type { MarketRegime, StressLevel, RotationSignal } from "@/services/market/marketIntelEngine";
import type { EventSignificance, MacroEventType } from "@/services/macro/macroEventEngine";
import type { MarketOrchestratorState } from "@/services/intelligence/marketOrchestrator";
import type { CrossMarketRegimeLabel } from "@/services/intelligence/crossMarketRegime";
import type { StrategicBias } from "@/services/intelligence/strategicEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MacroCycleState =
  | "stable_cycle"      // coherent, persistent macro regime
  | "transition_cycle"  // regime inflection; structure changing
  | "tightening_cycle"  // monetary tightening dominant
  | "easing_cycle"      // easing / pivot dominant
  | "fragmented_cycle"  // regional divergence; no global consensus
  | "uncertain_cycle";  // insufficient signal

export type MacroRegion =
  | "US" | "Europe" | "UK" | "China" | "GCC" | "EM"
  | "Commodities" | "FX" | "Rates" | "Crypto" | "Liquidity" | "Global";

export type MacroTheme =
  | "rate_policy"       // CB policy is a primary driver
  | "inflation"         // inflation dynamics in focus
  | "liquidity"         // global liquidity primary factor
  | "credit_stress"     // credit / spread stress elevated
  | "commodity_cycle"   // commodity price cycle
  | "usd_dynamics"      // USD strength / weakness driving outcomes
  | "china_demand"      // China growth / demand cycle
  | "em_flows"          // EM capital flows
  | "oil_fiscal"        // oil price → fiscal → regional transmission
  | "risk_sentiment"    // aggregate risk sentiment driving allocation
  | "policy_divergence" // global CB policy divergence
  | "structural_shift"; // structural macro transition underway

export interface GlobalMacroMemoryInput {
  question: string;
  marketRegime: MarketRegime;
  riskOnScore: number;             // -100..+100
  stressLevel: StressLevel;
  stressScore: number;             // 0-100
  macroEventType: MacroEventType | null;
  macroSignificance: EventSignificance;
  orchestratorState: MarketOrchestratorState;
  crossMarketLabel: CrossMarketRegimeLabel;
  strategicBias: StrategicBias;
  rotationSignal: RotationSignal;
  ar: boolean;
}

export interface GlobalMacroMemoryResult {
  macroCycle: MacroCycleState;
  dominantRegion: MacroRegion;
  activeThemes: MacroTheme[];
  structuralPressure: "high" | "moderate" | "low" | "absent";
  liquiditySignal: "expanding" | "contracting" | "neutral" | "uncertain";
  policySignal: "tightening" | "easing" | "neutral" | "diverging";
  narrative: string;                  // 1-2 sentences, hedged language
  contextString: string;              // compact ≤130 chars; empty when uncertain
}

// ─── Region detection ─────────────────────────────────────────────────────────

const REGION_PATTERNS: Partial<Record<MacroRegion, RegExp>> = {
  US:          /\b(fed|fomc|federal reserve|s&?p|nasdaq|spy|qqq|treasury|t-?bill|us equity|usd|dollar|powell|wall street|10y|us market)\b/i,
  Europe:      /\b(ecb|europe|eurozone|euro|eur\b|eu\b|european|germany|france|dax|cac|stoxx|lagarde|bund)\b/i,
  UK:          /\b(boe|bank of england|uk\b|gbp|british|pound sterling|ftse|bailey)\b/i,
  China:       /\b(china|pboc|yuan|cny|renminbi|chinese|hong kong|hsi|shanghai|shenzhen|csi)\b/i,
  GCC:         /\b(saudi|aramco|tasi|gcc|gulf|uae|aed|opec|riyadh|dubai|kuwait|qatar|bahrain|ksa)\b/i,
  EM:          /\b(emerging market|em\b|brics?|brazil|india|indonesia|turkey|mexico|south africa|em fund)\b/i,
  Commodities: /\b(gold|xau|oil|wti|brent|crude|copper|silver|commodity|commodities|paxg|metals?)\b/i,
  FX:          /\b(forex|fx\b|currency|currencies|exchange rate|dxy|dxy|dollar index|eur.?usd|gbp.?usd|usd.?jpy)\b/i,
  Rates:       /\b(rates?|yields?|bond|bonds|treasury|duration|inverted curve|2-year|10-year|tlt|ycc)\b/i,
  Crypto:      /\b(bitcoin|btc|eth|ethereum|crypto|defi|altcoin|binance|coinbase|stablecoin)\b/i,
  Liquidity:   /\b(liquidity|repo|reverse repo|fed balance|m2|money supply|credit condition|funding|qt|qe)\b/i,
};

function detectRegion(question: string, rotationSignal: RotationSignal, macroEventType: MacroEventType | null): MacroRegion {
  // Rotation signal hints
  if (rotationSignal === "metals_bid") return "Commodities";
  if (macroEventType === "oil_price_move") return "Commodities";
  if (macroEventType === "liquidity_monetary") return "Liquidity";

  // Keyword-based detection — first match wins
  const order: MacroRegion[] = ["GCC", "China", "UK", "Europe", "US", "EM", "Crypto", "Commodities", "FX", "Rates", "Liquidity"];
  for (const region of order) {
    const pat = REGION_PATTERNS[region];
    if (pat && pat.test(question)) return region;
  }

  return "Global";
}

// ─── Macro cycle derivation ───────────────────────────────────────────────────

function deriveCycle(input: GlobalMacroMemoryInput): MacroCycleState {
  const { marketRegime, riskOnScore, stressLevel, macroEventType,
    macroSignificance, orchestratorState, crossMarketLabel, strategicBias } = input;

  // Tightening: stress + rate/inflation events + risk-off pressure
  if (
    stressLevel === "high" ||
    (stressLevel === "elevated" && riskOnScore < -20 &&
      (macroEventType === "interest_rate_decision" || macroEventType === "cpi_inflation"))
  ) return "tightening_cycle";

  // Easing: risk-on regime + constructive bias + easing-type macro event
  if (
    marketRegime === "risk_on" &&
    (strategicBias === "constructive" || strategicBias === "opportunistic") &&
    (macroEventType === "interest_rate_decision" || macroEventType === "liquidity_monetary" ||
      macroEventType === "central_bank_meeting") &&
    riskOnScore >= 25
  ) return "easing_cycle";

  // Transition: structural rotation underway with macro event significance
  if (
    (orchestratorState === "regime_rotation" || orchestratorState === "transition_market") &&
    macroSignificance !== "uncertain"
  ) return "transition_cycle";

  // Fragmented: cross-market conflict or uncertain strategic bias with stress
  if (
    crossMarketLabel === "conflicting_regime" || crossMarketLabel === "regime_divergence" ||
    (strategicBias === "uncertain" && stressLevel === "elevated")
  ) return "fragmented_cycle";

  // Stable: coherent risk-on, low stress, coordinated markets
  if (
    marketRegime === "risk_on" &&
    stressLevel === "low" &&
    orchestratorState === "coordinated_market" &&
    riskOnScore >= 30
  ) return "stable_cycle";

  return "uncertain_cycle";
}

// ─── Active themes ─────────────────────────────────────────────────────────────

function detectThemes(
  input: GlobalMacroMemoryInput,
  cycle: MacroCycleState,
  region: MacroRegion,
): MacroTheme[] {
  const { question, macroEventType, macroSignificance, stressLevel,
    riskOnScore, rotationSignal, crossMarketLabel, orchestratorState,
    strategicBias } = input;
  const themes = new Set<MacroTheme>();

  // Rate policy
  if (macroEventType === "interest_rate_decision" || macroEventType === "central_bank_meeting") {
    themes.add("rate_policy");
  }
  // Inflation
  if (macroEventType === "cpi_inflation" || cycle === "tightening_cycle") {
    themes.add("inflation");
  }
  // Liquidity
  if (macroEventType === "liquidity_monetary" || stressLevel === "high") {
    themes.add("liquidity");
  }
  // Credit stress
  if (stressLevel === "elevated" || stressLevel === "high") {
    themes.add("credit_stress");
  }
  // Commodity cycle
  if (rotationSignal === "metals_bid" || macroEventType === "oil_price_move") {
    themes.add("commodity_cycle");
  }
  // USD dynamics — keyword-based
  if (/\b(dxy|usd|dollar|dollar index|dollar strength|dollar weakness|dxy)\b/i.test(question)) {
    themes.add("usd_dynamics");
  }
  // China demand
  if (region === "China" || /\b(china|pboc|yuan|chinese demand)\b/i.test(question)) {
    themes.add("china_demand");
  }
  // EM flows
  if (region === "EM" || /\b(emerging market|em flows|capital flows|em\b)\b/i.test(question)) {
    themes.add("em_flows");
  }
  // Oil fiscal
  if (region === "GCC" || macroEventType === "oil_price_move") {
    themes.add("oil_fiscal");
  }
  // Risk sentiment
  if (Math.abs(riskOnScore) >= 30 && (macroSignificance === "critical" || macroSignificance === "meaningful")) {
    themes.add("risk_sentiment");
  }
  // Policy divergence
  if (crossMarketLabel === "conflicting_regime" && macroEventType === "interest_rate_decision") {
    themes.add("policy_divergence");
  }
  // Structural shift
  if (orchestratorState === "regime_rotation" && macroSignificance === "critical") {
    themes.add("structural_shift");
  }

  return [...themes].slice(0, 4); // cap at 4 most relevant themes
}

// ─── Structural pressure ──────────────────────────────────────────────────────

function deriveStructuralPressure(
  cycle: MacroCycleState,
  stressLevel: StressLevel,
  macroSignificance: EventSignificance,
  crossMarketLabel: CrossMarketRegimeLabel,
): "high" | "moderate" | "low" | "absent" {
  if (
    cycle === "tightening_cycle" ||
    (stressLevel === "high" && macroSignificance === "critical")
  ) return "high";

  if (
    cycle === "fragmented_cycle" ||
    stressLevel === "elevated" ||
    crossMarketLabel === "conflicting_regime" ||
    macroSignificance === "critical"
  ) return "moderate";

  if (cycle === "transition_cycle" || macroSignificance === "meaningful") return "low";

  if (cycle === "uncertain_cycle") return "absent";

  return "low";
}

// ─── Liquidity signal ─────────────────────────────────────────────────────────

function deriveLiquiditySignal(
  cycle: MacroCycleState,
  macroEventType: MacroEventType | null,
  strategicBias: StrategicBias,
  riskOnScore: number,
): "expanding" | "contracting" | "neutral" | "uncertain" {
  if (cycle === "uncertain_cycle") return "uncertain";
  if (
    cycle === "easing_cycle" ||
    (macroEventType === "liquidity_monetary" && strategicBias === "constructive" && riskOnScore > 20)
  ) return "expanding";
  if (
    cycle === "tightening_cycle" ||
    (macroEventType === "interest_rate_decision" && riskOnScore < 0)
  ) return "contracting";
  if (cycle === "fragmented_cycle" || cycle === "transition_cycle") return "uncertain";
  return "neutral";
}

// ─── Policy signal ────────────────────────────────────────────────────────────

function derivePolicySignal(
  cycle: MacroCycleState,
  crossMarketLabel: CrossMarketRegimeLabel,
): "tightening" | "easing" | "neutral" | "diverging" {
  if (cycle === "tightening_cycle") return "tightening";
  if (cycle === "easing_cycle") return "easing";
  if (cycle === "fragmented_cycle" || crossMarketLabel === "conflicting_regime") return "diverging";
  return "neutral";
}

// ─── Narrative builder ────────────────────────────────────────────────────────

function buildNarrative(
  cycle: MacroCycleState,
  region: MacroRegion,
  themes: MacroTheme[],
  policySignal: "tightening" | "easing" | "neutral" | "diverging",
  ar: boolean,
): string {
  const themeNote = themes.length > 0
    ? (ar ? `؛ محاور نشطة: ${themes.slice(0, 2).map(t => t.replace(/_/g, " ")).join("، ")}` :
       `; active themes: ${themes.slice(0, 2).map(t => t.replace(/_/g, " ")).join(", ")}`)
    : "";

  if (ar) {
    const cycleLabels: Record<MacroCycleState, string> = {
      stable_cycle: "دورة كلية مستقرة",
      transition_cycle: "دورة انتقالية",
      tightening_cycle: "دورة تشديد",
      easing_cycle: "دورة تيسير",
      fragmented_cycle: "دورة مجزأة",
      uncertain_cycle: "دورة غير محددة",
    };
    return `${cycleLabels[cycle]} — التركيز على منطقة ${region}${themeNote}. إطار استشاري — لا تنبؤ هيكلي.`;
  }
  const cycleLabels: Record<MacroCycleState, string> = {
    stable_cycle: "Stable macro cycle",
    transition_cycle: "Macro transition in progress",
    tightening_cycle: "Tightening cycle dominant",
    easing_cycle: "Easing cycle supported",
    fragmented_cycle: "Fragmented macro cycle",
    uncertain_cycle: "Macro cycle uncertain",
  };
  return `${cycleLabels[cycle]} — ${region} in focus${themeNote}. Advisory framework — not a structural forecast.`;
}

// ─── Context string ───────────────────────────────────────────────────────────

function buildContextString(
  cycle: MacroCycleState,
  region: MacroRegion,
  policySignal: "tightening" | "easing" | "neutral" | "diverging",
  structuralPressure: "high" | "moderate" | "low" | "absent",
): string {
  if (cycle === "uncertain_cycle" && structuralPressure === "absent") return "";
  const pressureNote = structuralPressure !== "absent" && structuralPressure !== "low"
    ? `; structural pressure ${structuralPressure}` : "";
  return `Macro memory: ${cycle.replace(/_/g, " ")}; ${region}; ${policySignal} policy${pressureNote}`.slice(0, 130);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeGlobalMacroMemory(
  input: GlobalMacroMemoryInput,
): GlobalMacroMemoryResult {
  const { ar, stressLevel, macroEventType, macroSignificance,
    crossMarketLabel, orchestratorState, strategicBias, riskOnScore, rotationSignal } = input;

  const macroCycle = deriveCycle(input);
  const dominantRegion = detectRegion(input.question, rotationSignal, macroEventType);
  const activeThemes = detectThemes(input, macroCycle, dominantRegion);
  const structuralPressure = deriveStructuralPressure(macroCycle, stressLevel, macroSignificance, crossMarketLabel);
  const liquiditySignal = deriveLiquiditySignal(macroCycle, macroEventType, strategicBias, riskOnScore);
  const policySignal = derivePolicySignal(macroCycle, crossMarketLabel);
  const narrative = buildNarrative(macroCycle, dominantRegion, activeThemes, policySignal, ar);
  const contextString = buildContextString(macroCycle, dominantRegion, policySignal, structuralPressure);

  return {
    macroCycle,
    dominantRegion,
    activeThemes,
    structuralPressure,
    liquiditySignal,
    policySignal,
    narrative,
    contextString,
  };
}
