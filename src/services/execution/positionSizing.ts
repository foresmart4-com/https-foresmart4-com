// Position Risk Engine — risk-adjusted exposure sizing using confidence,
// volatility, regime, portfolio exposure and correlation risk.
import type { MarketQuote, AssetKey } from "@/services/market/marketData";
import type { CalibratedSignal } from "@/services/quant/confidenceEngine";
import type { RegimeReport } from "@/services/quant/regimeDetection";
import type { PortfolioReport } from "@/services/portfolio/portfolioEngine";

export interface PositionSizing {
  asset: AssetKey;
  assetName: string;
  suggestedSizePct: number;   // % of risk capital
  riskAdjustedPct: number;    // after caution scaling
  cautionScore: number;       // 0-100
  exposureWarning: "low" | "moderate" | "elevated" | "critical";
  rationale: string;
}

const REGIME_MULT: Record<RegimeReport["regime"], number> = {
  "Trending Bullish": 1.0,
  "Trending Bearish": 0.85,
  "Sideways": 0.7,
  "High Volatility": 0.55,
  "Panic": 0.3,
  "Risk-On": 1.05,
  "Risk-Off": 0.6,
};

export function calculatePositionSize(
  q: MarketQuote,
  sig: CalibratedSignal | undefined,
  regime: RegimeReport,
  portfolio: PortfolioReport,
): PositionSizing {
  const calConf = sig?.calibratedConfidence ?? 35;
  const uncertainty = sig?.uncertainty ?? 50;
  const volPct = q.volatility / 100;

  // Base = scaled confidence (capped 8% per asset for safety)
  const base = Math.max(0, (calConf - 30) / 70) * 8;
  const regimeMult = REGIME_MULT[regime.regime] ?? 0.8;
  const volMult = 1 - Math.min(0.65, volPct * 0.8);
  const portMult = 1 - Math.min(0.5, (portfolio.totalExposure / 100) * 0.5);
  const corrMult = 1 - Math.min(0.4, (portfolio.correlatedExposure / 100) * 0.4);

  const raw = base * regimeMult * volMult;
  const suggestedSizePct = +Math.max(0, Math.min(8, raw)).toFixed(2);
  const riskAdjustedPct = +Math.max(0, Math.min(suggestedSizePct, raw * portMult * corrMult)).toFixed(2);

  const cautionScore = Math.max(0, Math.min(100, Math.round(
    uncertainty * 0.35 + q.volatility * 0.25 + (100 - calConf) * 0.2
    + portfolio.concentration * 0.1 + (regime.regime === "Panic" ? 30 : regime.regime === "High Volatility" ? 18 : 0),
  )));

  const exposureWarning: PositionSizing["exposureWarning"] =
    cautionScore >= 75 ? "critical" :
    cautionScore >= 55 ? "elevated" :
    cautionScore >= 35 ? "moderate" : "low";

  const rationale = !sig || sig.action === "HOLD"
    ? `Flat sleeve recommended — no high-conviction edge. Caution ${cautionScore}/100.`
    : `${sig.action} sized to ${riskAdjustedPct}% of risk capital — regime "${regime.regime}", vol ${q.volatility}, portfolio exposure ${portfolio.totalExposure}%.`;

  return {
    asset: q.key, assetName: q.name,
    suggestedSizePct, riskAdjustedPct,
    cautionScore, exposureWarning, rationale,
  };
}

export function calculateAllPositionSizes(
  quotes: MarketQuote[],
  signals: CalibratedSignal[],
  regime: RegimeReport,
  portfolio: PortfolioReport,
): PositionSizing[] {
  const sigMap = new Map(signals.map((s) => [s.asset, s]));
  return quotes.map((q) => calculatePositionSize(q, sigMap.get(q.key), regime, portfolio));
}
