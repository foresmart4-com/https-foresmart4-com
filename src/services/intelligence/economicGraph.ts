/**
 * Economic Intelligence Graph — Phase 45
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Models economic transmission relationships between macro signals,
 * evaluating which channels are currently active and in which direction.
 *
 * Transmission channels:
 *   inflation_to_rates      — CPI dynamics → rate expectations
 *   rates_to_liquidity      — rate changes → global liquidity conditions
 *   liquidity_to_valuations — liquidity level → asset valuation multiples
 *   usd_to_commodities      — USD strength → commodity price direction
 *   oil_to_inflation        — oil prices → inflation transmission
 *   china_to_demand         — China cycle → global industrial demand
 *   policy_to_flows         — CB divergence → cross-border capital flows
 *   sentiment_to_allocation — risk appetite → asset class allocation
 *   rates_to_credit         — rate levels → credit spread dynamics
 *   credit_to_risk_assets   — credit spreads → equity / risk asset pricing
 *
 * Channel states:
 *   reinforcing  — signal is active and amplifying the transmission
 *   weakening    — signal suggests transmission is diminishing
 *   conflicting  — multiple signals push the channel in opposing directions
 *   uncertain    — insufficient signal quality to assess the channel
 *
 * Design rules:
 * - No fake causality: channel states describe observed correlations, not proven causes
 * - No hard-coded certainty: "suggests", "implies", "may reflect" — never "proves"
 * - Honest default: uncertain when evidence is insufficient
 * - Phase-43 interaction: macroCycleState feeds into channel activation
 */

import type { StressLevel, RotationSignal } from "@/services/market/marketIntelEngine";
import type { EventSignificance, MacroEventType } from "@/services/macro/macroEventEngine";
import type { MarketOrchestratorState } from "@/services/intelligence/marketOrchestrator";
import type { CrossMarketRegimeLabel } from "@/services/intelligence/crossMarketRegime";
import type { StrategicBias } from "@/services/intelligence/strategicEngine";
import type { MacroCycleState, MacroRegion } from "@/services/macro/globalMacroMemory";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransmissionChannel =
  | "inflation_to_rates"        // CPI → rate expectations
  | "rates_to_liquidity"        // rate changes → liquidity conditions
  | "liquidity_to_valuations"   // liquidity → asset valuation multiples
  | "usd_to_commodities"        // USD strength → commodity prices
  | "oil_to_inflation"          // oil prices → inflation dynamics
  | "china_to_demand"           // China cycle → global industrial demand
  | "policy_to_flows"           // CB divergence → capital flows
  | "sentiment_to_allocation"   // risk sentiment → asset allocation
  | "rates_to_credit"           // rate levels → credit spreads
  | "credit_to_risk_assets";    // credit spreads → risk asset pricing

export type ChannelState = "reinforcing" | "weakening" | "conflicting" | "uncertain";

export interface ChannelResult {
  channel: TransmissionChannel;
  state: ChannelState;
  note: string;     // 1-sentence hedged description
  noteAr: string;   // Arabic equivalent
}

export interface EconomicGraphInput {
  stressLevel: StressLevel;
  stressScore: number;                    // 0-100
  riskOnScore: number;                    // -100..+100
  macroEventType: MacroEventType | null;
  macroSignificance: EventSignificance;
  rotationSignal: RotationSignal;
  crossMarketLabel: CrossMarketRegimeLabel;
  orchestratorState: MarketOrchestratorState;
  strategicBias: StrategicBias;
  hasConflict: boolean;
  // Phase-43 interaction
  macroCycleState: MacroCycleState;
  dominantRegion: MacroRegion;
  ar: boolean;
}

export interface EconomicGraphResult {
  activeChannels: ChannelResult[];      // channels with meaningful signal
  dominantChannel: TransmissionChannel | null;
  networkStrength: "strong" | "moderate" | "weak" | "fragmented";
  pressureDirection: "pro_risk" | "risk_off" | "mixed" | "neutral";
  narrative: string;                    // 1-2 sentences, hedged language
  contextString: string;                // compact ≤130 chars; empty when weak
}

// ─── Channel evaluation ───────────────────────────────────────────────────────

interface ChannelEval {
  active: boolean;
  state: ChannelState;
}

function evaluateChannels(input: EconomicGraphInput): Map<TransmissionChannel, ChannelEval> {
  const {
    stressLevel, stressScore, riskOnScore, macroEventType, macroSignificance,
    rotationSignal, crossMarketLabel, orchestratorState, strategicBias,
    hasConflict, macroCycleState, dominantRegion,
  } = input;

  const evals = new Map<TransmissionChannel, ChannelEval>();

  // ── inflation_to_rates ────────────────────────────────────────────────────
  {
    const active = macroEventType === "cpi_inflation" || macroCycleState === "tightening_cycle";
    let state: ChannelState = "uncertain";
    if (active) {
      if (macroCycleState === "tightening_cycle") state = "reinforcing";
      else if (macroCycleState === "easing_cycle") state = "weakening";
      else if (macroCycleState === "fragmented_cycle") state = "conflicting";
      else state = "uncertain";
    }
    evals.set("inflation_to_rates", { active, state });
  }

  // ── rates_to_liquidity ────────────────────────────────────────────────────
  {
    const active =
      macroEventType === "interest_rate_decision" ||
      macroEventType === "central_bank_meeting" ||
      macroEventType === "liquidity_monetary" ||
      macroCycleState === "tightening_cycle" ||
      macroCycleState === "easing_cycle";
    let state: ChannelState = "uncertain";
    if (active) {
      if (macroCycleState === "tightening_cycle") state = "reinforcing";    // tightening → liquidity contracting
      else if (macroCycleState === "easing_cycle") state = "weakening";     // easing → liquidity expanding
      else if (macroCycleState === "transition_cycle") state = "conflicting";
      else state = "uncertain";
    }
    evals.set("rates_to_liquidity", { active, state });
  }

  // ── liquidity_to_valuations ───────────────────────────────────────────────
  {
    const active =
      stressLevel === "high" ||
      (macroEventType === "liquidity_monetary" && macroSignificance !== "secondary") ||
      macroCycleState === "tightening_cycle" ||
      macroCycleState === "easing_cycle";
    let state: ChannelState = "uncertain";
    if (active) {
      if (macroCycleState === "tightening_cycle" || stressScore >= 60) state = "reinforcing"; // contraction → compress
      else if (macroCycleState === "easing_cycle") state = "weakening";  // expansion → expand multiples
      else if (hasConflict) state = "conflicting";
      else state = "uncertain";
    }
    evals.set("liquidity_to_valuations", { active, state });
  }

  // ── usd_to_commodities ────────────────────────────────────────────────────
  {
    const active =
      rotationSignal === "metals_bid" ||
      rotationSignal === "defensive_bid" ||
      macroEventType === "oil_price_move" ||
      dominantRegion === "Commodities" ||
      dominantRegion === "FX";
    let state: ChannelState = "uncertain";
    if (active) {
      if (rotationSignal === "metals_bid" && macroCycleState === "tightening_cycle") state = "conflicting";
      else if (rotationSignal === "metals_bid") state = "reinforcing";
      else if (riskOnScore <= -20) state = "reinforcing"; // risk-off → USD up → commodities under pressure
      else if (crossMarketLabel === "conflicting_regime") state = "conflicting";
      else state = "uncertain";
    }
    evals.set("usd_to_commodities", { active, state });
  }

  // ── oil_to_inflation ──────────────────────────────────────────────────────
  {
    const active =
      macroEventType === "oil_price_move" ||
      dominantRegion === "GCC" ||
      dominantRegion === "Commodities";
    let state: ChannelState = "uncertain";
    if (active) {
      if (macroCycleState === "tightening_cycle" && stressLevel !== "low") state = "reinforcing";
      else if (macroCycleState === "easing_cycle") state = "weakening";
      else state = "uncertain";
    }
    evals.set("oil_to_inflation", { active, state });
  }

  // ── china_to_demand ───────────────────────────────────────────────────────
  {
    const active = dominantRegion === "China" || dominantRegion === "EM";
    let state: ChannelState = "uncertain";
    if (active) {
      if (riskOnScore >= 20 && macroCycleState !== "tightening_cycle") state = "reinforcing";
      else if (macroCycleState === "tightening_cycle") state = "weakening";
      else if (macroCycleState === "fragmented_cycle") state = "conflicting";
      else state = "uncertain";
    }
    evals.set("china_to_demand", { active, state });
  }

  // ── policy_to_flows ───────────────────────────────────────────────────────
  {
    const active =
      macroCycleState === "fragmented_cycle" ||
      crossMarketLabel === "conflicting_regime" ||
      crossMarketLabel === "regime_divergence" ||
      macroEventType === "policy_regulatory";
    let state: ChannelState = "uncertain";
    if (active) {
      if (macroCycleState === "fragmented_cycle") state = "reinforcing"; // divergence → active flows
      else if (crossMarketLabel === "conflicting_regime") state = "conflicting";
      else state = "uncertain";
    }
    evals.set("policy_to_flows", { active, state });
  }

  // ── sentiment_to_allocation ───────────────────────────────────────────────
  {
    const absRisk = Math.abs(riskOnScore);
    const active = absRisk >= 25 || orchestratorState === "coordinated_market" || orchestratorState === "unstable_market";
    let state: ChannelState = "uncertain";
    if (active) {
      if (absRisk >= 40 && orchestratorState !== "fragmented_market") state = "reinforcing";
      else if (crossMarketLabel === "conflicting_regime") state = "conflicting";
      else state = "uncertain";
    }
    evals.set("sentiment_to_allocation", { active, state });
  }

  // ── rates_to_credit ───────────────────────────────────────────────────────
  {
    const active =
      macroEventType === "interest_rate_decision" ||
      (macroCycleState === "tightening_cycle" && stressLevel !== "low");
    let state: ChannelState = "uncertain";
    if (active) {
      if (macroCycleState === "tightening_cycle") state = "reinforcing";   // rising rates → wider spreads
      else if (macroCycleState === "easing_cycle") state = "weakening";    // falling rates → tighter spreads
      else state = "uncertain";
    }
    evals.set("rates_to_credit", { active, state });
  }

  // ── credit_to_risk_assets ─────────────────────────────────────────────────
  {
    const active =
      stressLevel === "elevated" || stressLevel === "high" ||
      macroCycleState === "tightening_cycle" ||
      (stressScore >= 50 && macroSignificance !== "secondary");
    let state: ChannelState = "uncertain";
    if (active) {
      if (macroCycleState === "tightening_cycle" && stressLevel !== "low") state = "reinforcing";
      else if (macroCycleState === "easing_cycle" && strategicBias === "constructive") state = "weakening";
      else if (hasConflict) state = "conflicting";
      else state = "uncertain";
    }
    evals.set("credit_to_risk_assets", { active, state });
  }

  return evals;
}

// ─── Channel notes ────────────────────────────────────────────────────────────

const CHANNEL_NOTES: Record<TransmissionChannel, Record<ChannelState, { en: string; ar: string }>> = {
  inflation_to_rates: {
    reinforcing: { en: "Inflation pressure may be reinforcing rate expectations upward.", ar: "ضغط التضخم قد يعزز توقعات ارتفاع الفائدة." },
    weakening:   { en: "Inflation signals suggest rate pressure may be easing.", ar: "إشارات التضخم تُشير إلى تراجع محتمل في ضغط الفائدة." },
    conflicting: { en: "Conflicting inflation signals limit rate-expectation clarity.", ar: "إشارات تضخم متضاربة تُقيّد وضوح توقعات الفائدة." },
    uncertain:   { en: "Inflation-to-rates channel active; direction uncertain.", ar: "قناة التضخم-الفائدة نشطة؛ الاتجاه غير محدد." },
  },
  rates_to_liquidity: {
    reinforcing: { en: "Rate environment may be constraining liquidity conditions.", ar: "بيئة الفائدة قد تُضيّق شروط السيولة." },
    weakening:   { en: "Rate easing signals may support expanding liquidity.", ar: "إشارات خفض الفائدة قد تدعم توسع السيولة." },
    conflicting: { en: "Rate-liquidity channel shows competing signals.", ar: "قناة الفائدة-السيولة تُظهر إشارات متنافسة." },
    uncertain:   { en: "Rate-to-liquidity transmission present; magnitude uncertain.", ar: "انتقال الفائدة-السيولة موجود؛ الحجم غير محدد." },
  },
  liquidity_to_valuations: {
    reinforcing: { en: "Liquidity contraction may be compressing valuation multiples.", ar: "تراجع السيولة قد يضغط على مضاعفات التقييم." },
    weakening:   { en: "Liquidity expansion may be supporting valuation multiples.", ar: "توسع السيولة قد يدعم مضاعفات التقييم." },
    conflicting: { en: "Liquidity-valuation channel shows conflicting signals.", ar: "قناة السيولة-التقييم تُظهر إشارات متضاربة." },
    uncertain:   { en: "Liquidity-to-valuation link present; direction uncertain.", ar: "الصلة بين السيولة والتقييم موجودة؛ الاتجاه غير محدد." },
  },
  usd_to_commodities: {
    reinforcing: { en: "Dollar dynamics may be transmitting to commodity prices.", ar: "ديناميكيات الدولار قد تنتقل إلى أسعار السلع." },
    weakening:   { en: "USD pressure on commodities appears to be easing.", ar: "ضغط الدولار على السلع يبدو في تراجع." },
    conflicting: { en: "USD-commodity relationship shows divergent signals.", ar: "العلاقة بين الدولار والسلع تُظهر إشارات متباعدة." },
    uncertain:   { en: "USD-commodity channel possibly active; confirmation limited.", ar: "قناة الدولار-السلع ربما نشطة؛ التأكيد محدود." },
  },
  oil_to_inflation: {
    reinforcing: { en: "Oil price dynamics may be transmitting to inflation expectations.", ar: "ديناميكيات النفط قد تنتقل إلى توقعات التضخم." },
    weakening:   { en: "Oil-inflation transmission may be moderating.", ar: "الانتقال من النفط إلى التضخم قد يتراجع." },
    conflicting: { en: "Oil-inflation channel shows conflicting directional signals.", ar: "قناة النفط-التضخم تُظهر إشارات اتجاهية متضاربة." },
    uncertain:   { en: "Oil-to-inflation channel possibly active; direction uncertain.", ar: "قناة النفط-التضخم ربما نشطة؛ الاتجاه غير محدد." },
  },
  china_to_demand: {
    reinforcing: { en: "China cycle signals may be supporting global demand.", ar: "إشارات الدورة الصينية قد تدعم الطلب العالمي." },
    weakening:   { en: "China demand signals appear to be moderating.", ar: "إشارات الطلب الصيني تبدو في تراجع." },
    conflicting: { en: "China-demand channel shows competing structural signals.", ar: "قناة الصين-الطلب تُظهر إشارات هيكلية متنافسة." },
    uncertain:   { en: "China-to-demand channel possibly active; confirmation insufficient.", ar: "قناة الصين-الطلب ربما نشطة؛ التأكيد غير كافٍ." },
  },
  policy_to_flows: {
    reinforcing: { en: "Policy divergence may be actively driving capital flow shifts.", ar: "تباعد السياسات قد يقود بنشاط تحولات في تدفقات رأس المال." },
    weakening:   { en: "Policy-flow transmission appears to be moderating.", ar: "انتقال السياسات-التدفقات يبدو في تراجع." },
    conflicting: { en: "Policy-flow channel shows opposing signals across regions.", ar: "قناة السياسات-التدفقات تُظهر إشارات متعاكسة عبر المناطق." },
    uncertain:   { en: "Policy-to-flows channel possibly active; direction uncertain.", ar: "قناة السياسات-التدفقات ربما نشطة؛ الاتجاه غير محدد." },
  },
  sentiment_to_allocation: {
    reinforcing: { en: "Risk sentiment may be reinforcing directional asset allocation.", ar: "معنويات المخاطر قد تعزز توزيع الأصول الاتجاهي." },
    weakening:   { en: "Sentiment-allocation link appears to be losing directional clarity.", ar: "رابط المعنويات-التوزيع يبدو يفقد وضوحه الاتجاهي." },
    conflicting: { en: "Sentiment signals conflict; allocation direction uncertain.", ar: "إشارات المعنويات متضاربة؛ اتجاه التوزيع غير محدد." },
    uncertain:   { en: "Sentiment-to-allocation channel active; strength uncertain.", ar: "قناة المعنويات-التوزيع نشطة؛ القوة غير محددة." },
  },
  rates_to_credit: {
    reinforcing: { en: "Rate dynamics may be transmitting to credit spread widening.", ar: "ديناميكيات الفائدة قد تنتقل إلى توسع فوارق الائتمان." },
    weakening:   { en: "Rate easing may be supporting credit spread compression.", ar: "تيسير الفائدة قد يدعم انضغاط فوارق الائتمان." },
    conflicting: { en: "Rates-credit channel shows conflicting directional signals.", ar: "قناة الفائدة-الائتمان تُظهر إشارات اتجاهية متضاربة." },
    uncertain:   { en: "Rates-to-credit channel possibly active; transmission uncertain.", ar: "قناة الفائدة-الائتمان ربما نشطة؛ الانتقال غير محدد." },
  },
  credit_to_risk_assets: {
    reinforcing: { en: "Credit stress may be transmitting to risk asset headwinds.", ar: "ضغط الائتمان قد ينتقل إلى مقاومة الأصول الخطرة." },
    weakening:   { en: "Credit conditions may be easing pressure on risk assets.", ar: "شروط الائتمان قد تُخفف الضغط على الأصول الخطرة." },
    conflicting: { en: "Credit-risk-asset channel shows competing signals.", ar: "قناة الائتمان-الأصول الخطرة تُظهر إشارات متنافسة." },
    uncertain:   { en: "Credit-to-risk-asset channel possibly active; confirmation limited.", ar: "قناة الائتمان-الأصول الخطرة ربما نشطة؛ التأكيد محدود." },
  },
};

// ─── Network analysis ─────────────────────────────────────────────────────────

function analyzeNetwork(
  evals: Map<TransmissionChannel, ChannelEval>,
): { active: ChannelResult[]; dominant: TransmissionChannel | null; strength: "strong" | "moderate" | "weak" | "fragmented"; direction: "pro_risk" | "risk_off" | "mixed" | "neutral"; } {
  const active: ChannelResult[] = [];

  for (const [channel, ev] of evals) {
    if (!ev.active) continue;
    const notes = CHANNEL_NOTES[channel][ev.state];
    active.push({ channel, state: ev.state, note: notes.en, noteAr: notes.ar });
  }

  if (active.length === 0) {
    return { active: [], dominant: null, strength: "weak", direction: "neutral" };
  }

  // Dominant: prioritize reinforcing channels
  const reinforcing = active.filter(c => c.state === "reinforcing");
  const dominant = (reinforcing.length > 0 ? reinforcing[0] : active[0]).channel;

  // Network strength
  const conflicting = active.filter(c => c.state === "conflicting").length;
  let strength: "strong" | "moderate" | "weak" | "fragmented";
  if (conflicting >= 3) strength = "fragmented";
  else if (reinforcing.length >= 4) strength = "strong";
  else if (reinforcing.length >= 2) strength = "moderate";
  else strength = "weak";

  // Pressure direction
  const proRiskChannels: TransmissionChannel[] = ["sentiment_to_allocation", "liquidity_to_valuations"];
  const riskOffChannels: TransmissionChannel[] = ["inflation_to_rates", "credit_to_risk_assets", "rates_to_credit"];

  const proRiskActive = reinforcing.filter(c => proRiskChannels.includes(c.channel)).length;
  const riskOffActive = reinforcing.filter(c => riskOffChannels.includes(c.channel)).length;
  let direction: "pro_risk" | "risk_off" | "mixed" | "neutral";
  if (proRiskActive > riskOffActive + 1) direction = "pro_risk";
  else if (riskOffActive > proRiskActive + 1) direction = "risk_off";
  else if (proRiskActive > 0 && riskOffActive > 0) direction = "mixed";
  else direction = "neutral";

  return { active: active.slice(0, 4), dominant, strength, direction };
}

// ─── Narrative builder ────────────────────────────────────────────────────────

function buildNarrative(
  dominant: TransmissionChannel | null,
  strength: "strong" | "moderate" | "weak" | "fragmented",
  direction: "pro_risk" | "risk_off" | "mixed" | "neutral",
  ar: boolean,
): string {
  if (!dominant) {
    return ar
      ? "الشبكة الاقتصادية ضعيفة الإشارة؛ لا قنوات نقل نشطة واضحة في الوقت الحالي."
      : "Economic network signal is weak; no clearly active transmission channels at present.";
  }
  const chanLabel = dominant.replace(/_/g, " → ").replace("to", "");
  const dirLabel = ar
    ? { pro_risk: "مؤيد للمخاطر", risk_off: "تحوط من المخاطر", mixed: "مختلط", neutral: "محايد" }[direction]
    : { pro_risk: "pro-risk", risk_off: "risk-off", mixed: "mixed", neutral: "neutral" }[direction];

  return ar
    ? `شبكة اقتصادية ${strength === "fragmented" ? "مجزأة" : strength} — القناة الرئيسية: ${chanLabel}؛ الاتجاه ${dirLabel}. تفسيري فقط — لا ادعاء سببية.`
    : `${strength.charAt(0).toUpperCase() + strength.slice(1)} economic network — dominant channel: ${chanLabel}; ${dirLabel} direction. Interpretive only — no causation claimed.`;
}

// ─── Context string ───────────────────────────────────────────────────────────

function buildContextString(
  dominant: TransmissionChannel | null,
  strength: "strong" | "moderate" | "weak" | "fragmented",
  direction: "pro_risk" | "risk_off" | "mixed" | "neutral",
): string {
  if (!dominant || strength === "weak") return "";
  const chanStr = dominant.replace(/_/g, " → ").replace(" to ", " → ");
  return `Economic graph: ${chanStr}; ${strength} network; ${direction} pressure`.slice(0, 130);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeEconomicGraph(input: EconomicGraphInput): EconomicGraphResult {
  const { ar } = input;

  const evals = evaluateChannels(input);
  const { active, dominant, strength, direction } = analyzeNetwork(evals);
  const narrative = buildNarrative(dominant, strength, direction, ar);
  const contextString = buildContextString(dominant, strength, direction);

  return {
    activeChannels: active,
    dominantChannel: dominant,
    networkStrength: strength,
    pressureDirection: direction,
    narrative,
    contextString,
  };
}
