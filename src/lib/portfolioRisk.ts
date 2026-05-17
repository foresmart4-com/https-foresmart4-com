// Portfolio risk computation
import { assetPnlMock, type AssetPnl } from "./mock-data";

export type ExposureBreakdown = {
  crypto: number;
  stocks: number;
  commodities: number;
  fx: number;
  other: number;
};

export type PortfolioRiskSnapshot = {
  totalValue: number;
  cash: number;
  netInvested: number;
  largestAsset: { symbol: string; weightPct: number } | null;
  riskiestAsset: { symbol: string; pnlPct: number } | null;
  exposure: ExposureBreakdown;
  diversification: "weak" | "medium" | "good";
  riskScore: number; // 0..100
  recommendations: { ar: string; en: string; severity: "info" | "warning" | "critical" }[];
};

function classify(sym: string): keyof ExposureBreakdown {
  const s = sym.toUpperCase();
  if (["BTC", "ETH", "SOL", "BNB", "ADA", "XRP"].some((x) => s.startsWith(x))) return "crypto";
  if (["XAU", "XAG", "WTI", "SLV"].includes(s)) return "commodities";
  if (s.includes(".SR") || /^[A-Z]{1,5}$/.test(s)) return "stocks";
  return "other";
}

export function computePortfolioRisk(cash = 38120, positions: AssetPnl[] = assetPnlMock): PortfolioRiskSnapshot {
  const valued = positions.map((p) => {
    const value = p.quantity * p.lastPrice;
    const pnlPct = ((p.lastPrice - p.avgCost) / p.avgCost) * 100;
    return { ...p, value, pnlPct };
  });
  const netInvested = valued.reduce((s, p) => s + p.value, 0);
  const totalValue = netInvested + cash;
  const exposure: ExposureBreakdown = { crypto: 0, stocks: 0, commodities: 0, fx: 0, other: 0 };
  for (const p of valued) {
    const k = classify(p.symbol);
    exposure[k] += (p.value / Math.max(totalValue, 1)) * 100;
  }
  const largest = valued.reduce<AssetPnl & { value: number; pnlPct: number } | null>(
    (m, p) => (!m || p.value > m.value ? p : m), null);
  const riskiest = valued.reduce<typeof largest>(
    (m, p) => (!m || p.pnlPct < m.pnlPct ? p : m), null);

  const concentration = largest ? (largest.value / Math.max(totalValue, 1)) * 100 : 0;
  const cryptoExposure = exposure.crypto;
  const downside = valued.filter((p) => p.pnlPct < -3).length;
  let riskScore = 20;
  if (concentration > 40) riskScore += 25;
  else if (concentration > 25) riskScore += 12;
  if (cryptoExposure > 25) riskScore += 20;
  else if (cryptoExposure > 15) riskScore += 10;
  riskScore += Math.min(20, downside * 8);
  if (cash / Math.max(totalValue, 1) < 0.1) riskScore += 10;
  riskScore = Math.min(100, riskScore);

  const filledBuckets = Object.values(exposure).filter((v) => v > 5).length;
  const diversification: PortfolioRiskSnapshot["diversification"] =
    filledBuckets >= 3 && concentration < 40 ? "good" :
    filledBuckets >= 2 ? "medium" : "weak";

  const recommendations: PortfolioRiskSnapshot["recommendations"] = [];
  if (concentration > 35 && largest) {
    recommendations.push({
      severity: "warning",
      ar: `تخفيف وزن ${largest.symbol} — تركيز ${concentration.toFixed(0)}% من المحفظة.`,
      en: `Reduce ${largest.symbol} — concentration ${concentration.toFixed(0)}% of portfolio.`,
    });
  }
  if (riskScore >= 60) {
    recommendations.push({
      severity: "critical",
      ar: "زيادة النقد لتقليل المخاطر الإجمالية.",
      en: "Raise cash to lower overall risk.",
    });
  }
  if (cryptoExposure > 20) {
    recommendations.push({
      severity: "warning",
      ar: "نسبة العملات الرقمية مرتفعة — راجع تنويع المحفظة.",
      en: "Crypto exposure is high — review diversification.",
    });
  }
  if (diversification !== "good") {
    recommendations.push({
      severity: "info",
      ar: "نوّع بين الأسهم/السلع/العملات الرقمية للحصول على تنويع أفضل.",
      en: "Diversify across stocks/commodities/crypto for better balance.",
    });
  }
  for (const p of valued) {
    if (Math.abs(p.pnlPct) > 6) {
      recommendations.push({
        severity: "info",
        ar: `فعّل وقف خسارة على ${p.symbol} لتقلباته العالية.`,
        en: `Enable a stop-loss on ${p.symbol} given its volatility.`,
      });
    }
  }

  return {
    totalValue: Math.round(totalValue),
    cash,
    netInvested: Math.round(netInvested),
    largestAsset: largest ? { symbol: largest.symbol, weightPct: Number(concentration.toFixed(1)) } : null,
    riskiestAsset: riskiest ? { symbol: riskiest.symbol, pnlPct: Number(riskiest.pnlPct.toFixed(2)) } : null,
    exposure: {
      crypto: Number(exposure.crypto.toFixed(1)),
      stocks: Number(exposure.stocks.toFixed(1)),
      commodities: Number(exposure.commodities.toFixed(1)),
      fx: Number(exposure.fx.toFixed(1)),
      other: Number(exposure.other.toFixed(1)),
    },
    diversification,
    riskScore: Math.round(riskScore),
    recommendations: recommendations.slice(0, 6),
  };
}
