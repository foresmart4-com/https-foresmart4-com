// Portfolio intelligence — synthesises a sample exposure book from
// current signals and quotes, then surfaces concentration risk,
// correlated exposure, and risk warnings. Pure functions.
import type { MarketQuote, AssetKey } from "@/services/market/marketData";
import type { Signal } from "@/services/signals/signalEngine";
import type { CorrelationPair } from "@/services/correlation/correlationEngine";

export interface Position {
  asset: AssetKey;
  assetName: string;
  weight: number; // 0..1
  bias: "long" | "short" | "flat";
  pnlPct: number;
}

export interface PortfolioReport {
  positions: Position[];
  totalExposure: number; // 0..100
  concentration: number; // 0..100 (Herfindahl-style)
  correlatedExposure: number; // 0..100
  riskScore: number; // 0..100
  diversificationSuggestions: string[];
  warnings: string[];
}

export function buildPortfolio(
  quotes: MarketQuote[],
  signals: Signal[],
  correlations: CorrelationPair[],
): PortfolioReport {
  if (quotes.length === 0) {
    return {
      positions: [], totalExposure: 0, concentration: 0, correlatedExposure: 0,
      riskScore: 0, diversificationSuggestions: [], warnings: [],
    };
  }

  const sigMap = new Map(signals.map((s) => [s.asset, s]));
  // Weight derived from confidence; HOLD = small / flat
  const raw = quotes.map((q) => {
    const s = sigMap.get(q.key);
    const w = s ? (s.action === "HOLD" ? 0.05 : s.confidence / 100) : 0.1;
    return { q, s, w };
  });
  const totalW = raw.reduce((a, r) => a + r.w, 0) || 1;

  const positions: Position[] = raw.map(({ q, s, w }) => {
    const bias: Position["bias"] = !s || s.action === "HOLD" ? "flat" : s.action === "BUY" ? "long" : "short";
    return {
      asset: q.key,
      assetName: q.name,
      weight: +(w / totalW).toFixed(3),
      bias,
      pnlPct: +q.changePct.toFixed(2),
    };
  }).sort((a, b) => b.weight - a.weight);

  const totalExposure = Math.min(100, Math.round(positions.filter((p) => p.bias !== "flat")
    .reduce((s, p) => s + p.weight, 0) * 100));

  // Herfindahl concentration
  const hhi = positions.reduce((s, p) => s + p.weight ** 2, 0);
  const concentration = Math.round(hhi * 100);

  // Correlated exposure — sum |corr| * min(weight_i, weight_j)
  const wMap = new Map(positions.map((p) => [p.asset, p.weight]));
  let corrExp = 0;
  for (const c of correlations) {
    const wA = wMap.get(c.a) ?? 0;
    const wB = wMap.get(c.b) ?? 0;
    corrExp += Math.abs(c.coefficient) * Math.min(wA, wB);
  }
  const correlatedExposure = Math.min(100, Math.round(corrExp * 180));

  const avgVol = quotes.reduce((s, q) => s + q.volatility, 0) / quotes.length;
  const riskScore = Math.max(0, Math.min(100, Math.round(
    concentration * 0.35 + correlatedExposure * 0.35 + avgVol * 0.3,
  )));

  const warnings: string[] = [];
  const suggestions: string[] = [];
  if (concentration > 45) warnings.push("Portfolio is concentrated in a few high-conviction names.");
  if (correlatedExposure > 55) warnings.push("Correlated exposure is elevated — diversification benefit reduced.");
  if (riskScore > 70) warnings.push("Aggregate risk score is high — consider trimming.");
  const top = positions[0];
  if (top && top.weight > 0.35) suggestions.push(`Trim ${top.asset} (${Math.round(top.weight * 100)}%) toward target weight.`);
  const flatNames = positions.filter((p) => p.bias === "flat").map((p) => p.asset);
  if (flatNames.length === 0) suggestions.push("All sleeves are directional — consider a defensive bucket.");
  const longBias = positions.filter((p) => p.bias === "long").reduce((s, p) => s + p.weight, 0);
  const shortBias = positions.filter((p) => p.bias === "short").reduce((s, p) => s + p.weight, 0);
  if (Math.abs(longBias - shortBias) > 0.6) suggestions.push("Net exposure is heavily one-sided — add a hedge sleeve.");

  return {
    positions,
    totalExposure,
    concentration,
    correlatedExposure,
    riskScore,
    diversificationSuggestions: suggestions,
    warnings,
  };
}
