import type { Opportunity, RawSignal, GeoEvent, EconEvent, WeatherEvent, Bias } from "./types";

const ASSET_NAMES: Record<string, string> = {
  BTCUSDT: "Bitcoin", ETHUSDT: "Ethereum", SPY: "S&P 500", QQQ: "Nasdaq 100",
  TSLA: "Tesla", AAPL: "Apple", NVDA: "NVIDIA", GLD: "Gold ETF",
  WTI: "WTI Crude", BRENT: "Brent Crude", NATGAS: "Natural Gas",
  GOLD: "Gold", SILVER: "Silver", WHEAT: "Wheat", CORN: "Corn",
};

function biasFromChange(c: number): Bias {
  if (c > 0.6) return "bullish";
  if (c < -0.6) return "bearish";
  return "neutral";
}

function scenarios(bias: Bias, conf: number) {
  const up = bias === "bullish" ? 0.45 + conf * 0.3 : bias === "bearish" ? 0.2 : 0.33;
  const down = bias === "bearish" ? 0.45 + conf * 0.3 : bias === "bullish" ? 0.2 : 0.33;
  const base = Math.max(0, 1 - up - down);
  return [
    { label: "Bull case", probability: +up.toFixed(2), payoff: 6 },
    { label: "Base case", probability: +base.toFixed(2), payoff: 1.5 },
    { label: "Bear case", probability: +down.toFixed(2), payoff: -5 },
  ];
}

export function scanOpportunities(
  signals: RawSignal[],
  geo: GeoEvent[],
  econ: EconEvent[],
  weather: WeatherEvent[],
): Opportunity[] {
  const market = signals.filter((s) => s.category === "market" || s.category === "commodity" || s.category === "crypto");
  const out: Opportunity[] = [];

  for (const s of market) {
    if (!s.symbol) continue;
    const changePct = Number(s.payload?.changePct ?? 0);
    const magnitude = Math.min(1, Math.abs(changePct) / 3);
    const bias = biasFromChange(changePct);

    // Macro tailwinds
    const macroSupport = econ.filter((e) => e.marketImpact === bias).length;
    const geoSupport = geo.filter((g) => g.marketImpact === bias && g.affected.some((a) => s.symbol!.toUpperCase().includes(a.toUpperCase()))).length;
    const supplyShock = weather.filter((w) =>
      w.affectedCommodities.some((c) => s.symbol!.toUpperCase().includes(c.toUpperCase())),
    ).length;

    const supportScore = (macroSupport * 0.15 + geoSupport * 0.25 + supplyShock * 0.2);
    const confidence = Math.min(0.95, 0.4 + magnitude * 0.35 + supportScore);
    if (confidence < 0.45) continue;

    const drivers: string[] = [];
    if (magnitude > 0.5) drivers.push(`Strong tape move (${changePct.toFixed(2)}%)`);
    if (macroSupport) drivers.push(`${macroSupport} macro print(s) align with ${bias} bias`);
    if (geoSupport) drivers.push(`Geopolitical flow supportive`);
    if (supplyShock) drivers.push(`Supply-chain stress detected`);

    out.push({
      id: `opp-${s.symbol}-${s.ts}`,
      asset: s.symbol,
      assetName: ASSET_NAMES[s.symbol] ?? s.symbol,
      kind: supplyShock ? "supply_shock" : geoSupport ? "event_driven" : macroSupport ? "macro_tailwind" : "breakout",
      bias,
      confidence,
      expectedReturn: +(changePct * (1 + supportScore) * 1.4).toFixed(2),
      risk: +(1 - confidence + 0.1).toFixed(2),
      horizonHrs: 24 + Math.round(supportScore * 96),
      drivers,
      scenarios: scenarios(bias, confidence),
      ts: s.ts,
    });
  }

  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 12);
}
