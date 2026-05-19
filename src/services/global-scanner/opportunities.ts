// Build OpportunityCards from raw feeds: ranking, urgency, impact, risk,
// scenarios, portfolio-fit and explainable reasoning.
import type {
  AssetClass, Bias, OpportunityCard, ProactiveAlert, RawFeed, ScannerSnapshot, Scenario,
} from "./types";
import { correlationsFor, detectFlow } from "./correlation";

const ASSET_NAMES: Record<string, string> = {
  BTCUSDT: "Bitcoin", ETHUSDT: "Ethereum", SOLUSDT: "Solana",
  SPY: "S&P 500 ETF", QQQ: "Nasdaq 100 ETF", NVDA: "NVIDIA", AAPL: "Apple", TSLA: "Tesla", AMZN: "Amazon",
  EURUSD: "Euro / USD", USDJPY: "USD / Yen", GBPUSD: "Sterling / USD", DXY: "Dollar Index",
  GOLD: "Gold", SILVER: "Silver", WTI: "WTI Crude", BRENT: "Brent Crude", NATGAS: "Natural Gas",
  WHEAT: "Wheat", CORN: "Corn",
};

const CLASS_MAP: Record<string, AssetClass> = {};
for (const s of ["SPY","QQQ","NVDA","AAPL","TSLA","AMZN"]) CLASS_MAP[s] = "equities";
for (const s of ["BTCUSDT","ETHUSDT","SOLUSDT"]) CLASS_MAP[s] = "crypto";
for (const s of ["EURUSD","USDJPY","GBPUSD","DXY"]) CLASS_MAP[s] = "forex";
for (const s of ["GOLD","SILVER","WTI","BRENT","NATGAS","WHEAT","CORN"]) CLASS_MAP[s] = "commodities";

function biasFromChange(p: number): Bias {
  if (p > 0.5) return "bullish";
  if (p < -0.5) return "bearish";
  return "neutral";
}

function scenariosFor(bias: Bias, confidence: number): Scenario[] {
  const c = confidence / 100;
  const up = bias === "bullish" ? 0.45 + c * 0.3 : bias === "bearish" ? 0.18 : 0.33;
  const down = bias === "bearish" ? 0.45 + c * 0.3 : bias === "bullish" ? 0.18 : 0.33;
  const base = Math.max(0, 1 - up - down);
  return [
    { label: "Bull case",  probability: +up.toFixed(2),   payoff: 6 },
    { label: "Base case",  probability: +base.toFixed(2), payoff: 1.5 },
    { label: "Bear case",  probability: +down.toFixed(2), payoff: -5 },
  ];
}

export function buildOpportunities(feeds: RawFeed[]): { opportunities: OpportunityCard[]; alerts: ProactiveAlert[] } {
  const opportunities: OpportunityCard[] = [];
  const alerts: ProactiveAlert[] = [];

  const macroBias =
    feeds.filter((f) => f.category === "macro" && f.bias === "bullish").length -
    feeds.filter((f) => f.category === "macro" && f.bias === "bearish").length;
  const geoEvents = feeds.filter((f) => f.category === "geopolitical");
  const weatherEvents = feeds.filter((f) => f.category === "weather");
  const cbEvents = feeds.filter((f) => f.category === "cb_speech");
  const earningsEvents = feeds.filter((f) => f.category === "earnings");
  const news = feeds.filter((f) => f.category === "breaking_news");

  const market = feeds.filter((f) => f.symbol && CLASS_MAP[f.symbol!]);
  for (const f of market) {
    const symbol = f.symbol!;
    const changePct = Number(f.payload?.changePct ?? 0);
    const magnitude = Math.min(1, Math.abs(changePct) / 3);
    const bias = biasFromChange(changePct);
    if (bias === "neutral" && magnitude < 0.2) continue;

    // Cross-domain support
    const macroSupport = macroBias > 0 && bias === "bullish" ? 0.12 : macroBias < 0 && bias === "bearish" ? 0.12 : 0;
    const geoSupport = geoEvents.some((g) => g.bias === bias) ? 0.1 : 0;
    const weatherSupport = weatherEvents.length && (symbol === "WTI" || symbol === "BRENT" || symbol === "NATGAS") ? 0.18 : 0;
    const cbSupport = cbEvents.some((c) => c.bias === bias) ? 0.08 : 0;
    const earningsSupport = earningsEvents.some((e) => e.symbol === symbol) ? 0.15 : 0;

    const support = macroSupport + geoSupport + weatherSupport + cbSupport + earningsSupport;
    const confidence = Math.min(95, Math.round((0.42 + magnitude * 0.32 + support) * 100));
    if (confidence < 50) continue;

    const flow = detectFlow(symbol, feeds);
    const flowBoost = flow ? Math.min(15, Math.abs(flow.netFlow) * 15) : 0;
    const urgency = Math.min(100, Math.round(magnitude * 60 + support * 80 + flowBoost));
    const expectedReturn = +(changePct * (1 + support) * 1.5).toFixed(2);
    const riskScore = Math.min(100, Math.round(40 + Math.abs(changePct) * 8 + (geoEvents.length ? 10 : 0)));
    const riskAdjustedScore = Math.max(0, Math.min(100, Math.round(confidence - riskScore * 0.25 + flowBoost * 0.6)));

    const reasonParts: string[] = [];
    reasonParts.push(`${symbol} ${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}% tape move`);
    if (macroSupport) reasonParts.push("macro print aligns");
    if (geoSupport) reasonParts.push("geopolitical flow supportive");
    if (weatherSupport) reasonParts.push("supply-chain stress");
    if (cbSupport) reasonParts.push("central bank stance aligns");
    if (earningsSupport) reasonParts.push("earnings catalyst");
    if (flow) reasonParts.push(`institutional flow ${flow.netFlow > 0 ? "↑" : "↓"}`);

    opportunities.push({
      id: `opp-${symbol}-${f.ts}`,
      assetClass: CLASS_MAP[symbol],
      symbol,
      assetName: ASSET_NAMES[symbol] ?? symbol,
      bias,
      urgency,
      confidence,
      expectedReturn,
      riskScore,
      riskAdjustedScore,
      horizonHrs: 24 + Math.round(support * 96),
      drivers: reasonParts,
      scenarios: scenariosFor(bias, confidence),
      impactForecast: [
        { window: "1h", magnitude: +(Math.abs(changePct) * 0.4).toFixed(2), direction: bias },
        { window: "1d", magnitude: +(Math.abs(changePct) * (1 + support)).toFixed(2), direction: bias },
        { window: "1w", magnitude: +(Math.abs(changePct) * (1 + support * 1.5)).toFixed(2), direction: bias },
      ],
      correlations: correlationsFor(symbol).slice(0, 3),
      flowAlignment: flow,
      portfolioFit: {
        diversifies: CLASS_MAP[symbol] !== "equities",
        concentrationRisk: +(0.2 + (CLASS_MAP[symbol] === "equities" ? 0.3 : 0)).toFixed(2),
        suggestedAllocPct: Math.max(1, Math.min(8, Math.round(riskAdjustedScore / 12))),
      },
      reasoning: reasonParts.join(" · "),
      ts: f.ts,
    });
  }

  // Proactive cross-domain alerts
  if (geoEvents.length >= 2) alerts.push({
    id: `alert-geo-${Date.now()}`, ts: Date.now(), severity: "high",
    title: "Multiple geopolitical events clustered",
    detail: geoEvents.map((g) => g.headline).slice(0, 3).join(" • "),
    symbols: ["GOLD", "WTI", "DXY"],
    source: "geopolitical",
  });
  if (weatherEvents.length) alerts.push({
    id: `alert-weather-${Date.now()}`, ts: Date.now(), severity: "watch",
    title: "Weather supply-chain disruption",
    detail: weatherEvents[0].headline,
    symbols: ["WTI", "NATGAS"],
    source: "weather",
  });
  if (cbEvents.length) alerts.push({
    id: `alert-cb-${Date.now()}`, ts: Date.now(), severity: "high",
    title: "Central bank speech detected",
    detail: cbEvents[0].headline,
    symbols: ["DXY", "GOLD", "SPY"],
    source: "macro",
  });
  // Anomaly detection: oversized moves
  for (const f of market) {
    const c = Number(f.payload?.changePct ?? 0);
    if (Math.abs(c) >= 2.5) alerts.push({
      id: `alert-anom-${f.symbol}-${f.ts}`, ts: f.ts,
      severity: Math.abs(c) >= 4 ? "critical" : "high",
      title: `${f.symbol} anomaly: ${c >= 0 ? "+" : ""}${c.toFixed(2)}%`,
      detail: "Move exceeds historical band — verify catalyst before trading",
      symbols: [f.symbol!],
      source: "anomaly",
    });
  }
  // Breaking news cluster
  if (news.length >= 3) alerts.push({
    id: `alert-news-${Date.now()}`, ts: Date.now(), severity: "info",
    title: "News-flow surge",
    detail: `${news.length} market-moving headlines in last 25min`,
    symbols: [],
    source: "news",
  });

  opportunities.sort((a, b) => b.urgency * (b.riskAdjustedScore / 100) - a.urgency * (a.riskAdjustedScore / 100));
  alerts.sort((a, b) => b.ts - a.ts);

  return { opportunities: opportunities.slice(0, 24), alerts: alerts.slice(0, 20) };
}

export function summarize(feeds: RawFeed[], opps: OpportunityCard[]): ScannerSnapshot["metrics"] & { sources: { source: string; events: number }[] } {
  const bySource = new Map<string, number>();
  for (const f of feeds) bySource.set(f.source, (bySource.get(f.source) ?? 0) + 1);
  return {
    feedCount: feeds.length,
    highUrgency: opps.filter((o) => o.urgency >= 70).length,
    riskAdjustedAvg: opps.length ? +(opps.reduce((s, o) => s + o.riskAdjustedScore, 0) / opps.length).toFixed(1) : 0,
    bullish: opps.filter((o) => o.bias === "bullish").length,
    bearish: opps.filter((o) => o.bias === "bearish").length,
    neutral: opps.filter((o) => o.bias === "neutral").length,
    sources: [...bySource.entries()].map(([source, events]) => ({ source, events })),
  };
}
