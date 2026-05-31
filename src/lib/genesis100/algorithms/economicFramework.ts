export type DebtCyclePhase =
  | "early_expansion"
  | "late_expansion"
  | "slowdown"
  | "recession"
  | "depression"
  | "reflation"
  | "unknown";

export type RiskRegime =
  | "risk_on"
  | "risk_off"
  | "transitioning"
  | "uncertain";

export type MonetaryEnvironment =
  | "ultra_loose"
  | "loose"
  | "neutral"
  | "tight"
  | "ultra_tight";

export type InflationEnvironment =
  | "deflation"
  | "low_stable"
  | "rising"
  | "high"
  | "stagflation";

export type DollarStrength =
  | "strong_rising"
  | "strong_stable"
  | "neutral"
  | "weak_stable"
  | "weak_falling";

export type FiscalStance =
  | "expansionary"
  | "neutral"
  | "contractionary";

export type BusinessCycle =
  | "expansion"
  | "peak"
  | "contraction"
  | "trough";

export type GlobalGrowthTrend =
  | "accelerating"
  | "stable"
  | "decelerating"
  | "contracting";

export type CapitalFlowTrend =
  | "inflow"
  | "neutral"
  | "outflow";

export type GeopoliticalRiskLevel =
  | "low"
  | "moderate"
  | "high"
  | "extreme";

export interface MacroContext {
  debtCyclePhase: DebtCyclePhase;
  riskRegime: RiskRegime;
  monetaryEnvironment: MonetaryEnvironment;
  inflationEnvironment: InflationEnvironment;
  dollarStrength: DollarStrength;
  fiscalStance: FiscalStance;
  businessCycle: BusinessCycle;
  globalGrowthTrend: GlobalGrowthTrend;
  capitalFlowTrend: CapitalFlowTrend;
  geopoliticalRiskLevel: GeopoliticalRiskLevel;
  interestRateTrend: "falling" | "stable" | "rising";
  interestRateDifferential: number;
  inflationLevel: number;
  m2Growth: number;
  outputGap: number;
  debtToGdpRatio: number;
  creditGrowth: number;
  qeActive: boolean;
  yearsOfLowRates: number;
  peRatio: number;
  oilPrice: number;
  fearGreedIndex: number | undefined;
  dataConfidence: number;
  regimeConfidence: number;
}

export interface AssetContext {
  symbol: string;
  assetClass: string;
  marketRegion: string;
  price: number | null;
  changePercent: number | null;
  changePercent30d: number | undefined;
  volume: number | null;
  peRatio: number | undefined;
  priceToBookValue: number | undefined;
  debtToEquity: number | undefined;
  economicMoat: "wide" | "narrow" | "none" | undefined;
  governanceScore: number | undefined;
  discountToIntrinsicValue: number | undefined;
  analystConsensus: string | undefined;
  institutionalSelling: number;
  socialSentiment:
    | "extreme_positive"
    | "positive"
    | "neutral"
    | "negative"
    | "extreme_negative"
    | undefined;
  momentumStrength: number;
  marketDominanceRatio: number;
  interestRateDifferential: number | undefined;
}

// Build a default MacroContext from Gemini intelligence scores
// when live macro data is unavailable.
export function buildMacroContextFromScores(
  macroScore: number,
  sentimentScore: number,
  geopoliticalRisk: number,
): MacroContext {
  const monetaryEnvironment: MonetaryEnvironment =
    macroScore > 70 ? "loose" :
    macroScore > 55 ? "neutral" :
    macroScore > 40 ? "tight" : "ultra_tight";

  const riskRegime: RiskRegime =
    sentimentScore > 65 ? "risk_on" :
    sentimentScore > 45 ? "transitioning" : "risk_off";

  const geopoliticalRiskLevel: GeopoliticalRiskLevel =
    geopoliticalRisk > 75 ? "extreme" :
    geopoliticalRisk > 55 ? "high" :
    geopoliticalRisk > 35 ? "moderate" : "low";

  return {
    debtCyclePhase: macroScore > 60 ? "late_expansion" : "slowdown",
    riskRegime,
    monetaryEnvironment,
    inflationEnvironment: macroScore < 45 ? "high" : "low_stable",
    dollarStrength: "neutral",
    fiscalStance: macroScore > 60 ? "expansionary" : "neutral",
    businessCycle: macroScore > 55 ? "expansion" : "contraction",
    globalGrowthTrend: macroScore > 60 ? "stable" : "decelerating",
    capitalFlowTrend: sentimentScore > 60 ? "inflow" : "neutral",
    geopoliticalRiskLevel,
    interestRateTrend: macroScore > 60 ? "stable" : "rising",
    interestRateDifferential: 0,
    inflationLevel: macroScore < 45 ? 5 : 2.5,
    m2Growth: macroScore > 60 ? 5 : 2,
    outputGap: 0,
    debtToGdpRatio: 100,
    creditGrowth: 5,
    qeActive: macroScore > 70,
    yearsOfLowRates: 3,
    peRatio: 20,
    oilPrice: 75,
    fearGreedIndex: sentimentScore,
    dataConfidence: 55,
    regimeConfidence: 55,
  };
}

export function buildAssetContextFromQuote(
  symbol: string,
  assetClass: string,
  marketRegion: string,
  price: number | null,
  changePercent: number | null,
  volume: number | null,
): AssetContext {
  return {
    symbol,
    assetClass,
    marketRegion,
    price,
    changePercent,
    changePercent30d: undefined,
    volume,
    peRatio: undefined,
    priceToBookValue: undefined,
    debtToEquity: undefined,
    economicMoat: undefined,
    governanceScore: undefined,
    discountToIntrinsicValue: undefined,
    analystConsensus: undefined,
    institutionalSelling: 0,
    socialSentiment: undefined,
    momentumStrength: changePercent != null
      ? Math.min(1, Math.abs(changePercent) / 5)
      : 0,
    marketDominanceRatio: 0.05,
    interestRateDifferential: undefined,
  };
}
