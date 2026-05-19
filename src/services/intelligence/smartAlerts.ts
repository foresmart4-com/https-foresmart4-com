import type { ScannedAsset } from "./marketScanner";

export type AlertKind =
  | "breakout"
  | "reversal"
  | "high_volatility"
  | "unusual_volume"
  | "momentum_surge";

export interface SmartAlert {
  id: string;
  symbol: string;
  name: string;
  kind: AlertKind;
  severity: "low" | "medium" | "high";
  message: string;
  confidence: number; // 0-100
  ts: number;
}

export function buildAlerts(assets: ScannedAsset[]): SmartAlert[] {
  const out: SmartAlert[] = [];
  const now = Date.now();
  for (const a of assets) {
    const nearResistance = a.price >= a.resistance * 0.995;
    const nearSupport = a.price <= a.support * 1.005;
    if (nearResistance && a.macd.hist > 0 && a.rsi < 75) {
      out.push({
        id: `${a.symbol}-brk-${now}`,
        symbol: a.symbol, name: a.name, kind: "breakout",
        severity: a.confidence > 75 ? "high" : "medium",
        message: `Breakout pressure near resistance ${a.resistance}`,
        confidence: a.confidence, ts: now,
      });
    }
    if (((a.rsi > 70 && a.macd.hist < 0) || (a.rsi < 30 && a.macd.hist > 0)) && Math.abs(a.momentum) > 2) {
      out.push({
        id: `${a.symbol}-rev-${now}`,
        symbol: a.symbol, name: a.name, kind: "reversal",
        severity: "medium",
        message: a.rsi > 70 ? "Overbought reversal risk" : "Oversold reversal potential",
        confidence: Math.min(95, a.confidence + 5), ts: now,
      });
    }
    if (a.volatility > 60) {
      out.push({
        id: `${a.symbol}-vol-${now}`,
        symbol: a.symbol, name: a.name, kind: "high_volatility",
        severity: a.volatility > 90 ? "high" : "medium",
        message: `High volatility ${a.volatility}% annualized`,
        confidence: Math.min(90, 50 + Math.round(a.volatility / 3)), ts: now,
      });
    }
    if (a.volumeSpike >= 1.8) {
      out.push({
        id: `${a.symbol}-uvl-${now}`,
        symbol: a.symbol, name: a.name, kind: "unusual_volume",
        severity: a.volumeSpike >= 2.5 ? "high" : "medium",
        message: `Volume spike ${a.volumeSpike}× normal`,
        confidence: Math.min(95, 55 + Math.round(a.volumeSpike * 10)), ts: now,
      });
    }
    if (Math.abs(a.momentum) > 6 && nearSupport === false) {
      out.push({
        id: `${a.symbol}-mom-${now}`,
        symbol: a.symbol, name: a.name, kind: "momentum_surge",
        severity: Math.abs(a.momentum) > 12 ? "high" : "medium",
        message: `Momentum ${a.momentum > 0 ? "surge" : "drop"} ${a.momentum}%`,
        confidence: a.confidence, ts: now,
      });
    }
  }
  return out.sort((x, y) => y.confidence - x.confidence).slice(0, 20);
}
