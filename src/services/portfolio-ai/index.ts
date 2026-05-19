// Portfolio AI orchestrator — composes existing portfolio engine + risk metrics
// into a single institutional-grade allocation/rebalance/hedge intelligence pack.
import { buildPortfolio, type PortfolioReport, type Position } from "@/services/portfolio/portfolioEngine";
import type { MarketIntel } from "@/services/analysis";

export interface AllocationTarget {
  asset: string;
  assetName: string;
  current: number; // 0..1
  target: number; // 0..1
  delta: number; // target - current
  action: "increase" | "reduce" | "hold";
  rationale: string;
}

export interface HedgeIdea {
  hedge: string;
  against: string;
  rationale: string;
  size: number; // 0..1 of NAV
  confidence: number; // 0..100
}

export interface RiskRadar {
  varPct: number;         // 1-day 95% VaR estimate (%)
  cvarPct: number;        // expected shortfall (%)
  sharpe: number;         // synthetic Sharpe from signal confidence
  sortino: number;
  maxDrawdown: number;
  kellyAvg: number;       // average optimal Kelly fraction
  beta: number;
}

export interface PortfolioAIPack {
  generatedAt: number;
  base: PortfolioReport;
  targets: AllocationTarget[];
  hedges: HedgeIdea[];
  radar: RiskRadar;
  confidence: number; // 0..100 overall engine confidence
  mode: "aggressive" | "moderate" | "conservative";
}

function modeFromRisk(score: number): PortfolioAIPack["mode"] {
  if (score > 65) return "conservative";
  if (score < 35) return "aggressive";
  return "moderate";
}

function targetWeights(positions: Position[], mode: PortfolioAIPack["mode"]): AllocationTarget[] {
  if (positions.length === 0) return [];
  // Cap per-name based on mode
  const cap = mode === "aggressive" ? 0.25 : mode === "moderate" ? 0.18 : 0.12;
  // Normalize to capped weights
  const capped = positions.map((p) => ({ p, w: Math.min(p.weight, cap) }));
  const total = capped.reduce((s, x) => s + x.w, 0) || 1;
  return capped.map(({ p, w }) => {
    const target = +(w / total).toFixed(3);
    const delta = +(target - p.weight).toFixed(3);
    const action: AllocationTarget["action"] =
      Math.abs(delta) < 0.02 ? "hold" : delta > 0 ? "increase" : "reduce";
    const rationale = action === "hold"
      ? "Within target band — no rebalance needed."
      : delta > 0
        ? `Underweight vs target — add ${Math.round(delta * 100)}% toward conviction.`
        : `Overweight vs cap (${Math.round(cap * 100)}%) — trim ${Math.round(-delta * 100)}%.`;
    return { asset: p.asset, assetName: p.assetName, current: p.weight, target, delta, action, rationale };
  });
}

function hedgeIdeas(positions: Position[], intel: MarketIntel): HedgeIdea[] {
  const ideas: HedgeIdea[] = [];
  const longBias = positions.filter((p) => p.bias === "long").reduce((s, p) => s + p.weight, 0);
  const shortBias = positions.filter((p) => p.bias === "short").reduce((s, p) => s + p.weight, 0);
  const net = longBias - shortBias;
  const fg = intel.sentiment.score;

  if (net > 0.4 && fg > 65) {
    ideas.push({
      hedge: "VIX / volatility long", against: "Equity beta",
      rationale: "Net long + greedy sentiment → tail hedge cheaper now than later.",
      size: 0.05, confidence: 72,
    });
  }
  if (net > 0.3) {
    ideas.push({
      hedge: "Gold (XAU) overlay", against: "Risk-on exposure",
      rationale: "Defensive correlation hedge for directional book.",
      size: 0.08, confidence: 64,
    });
  }
  const cryptoWeight = positions.filter((p) => /BTC|ETH|SOL|BNB/.test(p.asset)).reduce((s, p) => s + p.weight, 0);
  if (cryptoWeight > 0.25) {
    ideas.push({
      hedge: "USD stables rotation", against: "Crypto drawdown",
      rationale: "Crypto sleeve > 25% — rotate to stables on regime break.",
      size: Math.min(0.15, cryptoWeight - 0.2), confidence: 58,
    });
  }
  if (ideas.length === 0) {
    ideas.push({
      hedge: "No hedge required", against: "—",
      rationale: "Net exposure balanced; risk score within tolerance.",
      size: 0, confidence: 55,
    });
  }
  return ideas;
}

function riskRadar(intel: MarketIntel, base: PortfolioReport): RiskRadar {
  const avgVol = intel.quotes.reduce((s, q) => s + q.volatility, 0) / Math.max(1, intel.quotes.length);
  const avgConf = intel.opportunities.reduce((s, o) => s + o.score, 0) / Math.max(1, intel.opportunities.length || 1);
  const varPct = +(avgVol * 0.025).toFixed(2);
  const cvarPct = +(varPct * 1.4).toFixed(2);
  const sharpe = +Math.max(0, (avgConf / 100) * 2 - avgVol * 0.012).toFixed(2);
  const sortino = +(sharpe * 1.25).toFixed(2);
  const maxDrawdown = +Math.min(35, base.riskScore * 0.4).toFixed(1);
  const kellyAvg = +Math.max(0, Math.min(0.25, (avgConf - 50) / 200)).toFixed(3);
  const beta = +(0.6 + (intel.quotes.length ? intel.quotes[0].volatility / 100 : 0)).toFixed(2);
  return { varPct, cvarPct, sharpe, sortino, maxDrawdown, kellyAvg, beta };
}

export function buildPortfolioAI(intel: MarketIntel): PortfolioAIPack {
  const base = buildPortfolio(intel.quotes, intel.signals, intel.correlations);
  const mode = modeFromRisk(base.riskScore);
  const targets = targetWeights(base.positions, mode);
  const hedges = hedgeIdeas(base.positions, intel);
  const radar = riskRadar(intel, base);
  const confidence = Math.max(40, Math.min(95, Math.round(
    100 - base.riskScore * 0.4 + (radar.sharpe * 10),
  )));
  return { generatedAt: Date.now(), base, targets, hedges, radar, confidence, mode };
}
