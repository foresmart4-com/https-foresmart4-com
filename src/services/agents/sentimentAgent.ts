// Sentiment Intelligence Agent — fuses news polarity, fear/greed gauge,
// social proxy (alert volume) and anomaly detection on price/volatility.
import type { AgentContext, AgentSignal } from "./types";

export function runSentimentAgent({ intel }: AgentContext): AgentSignal {
  const drivers: string[] = [];
  const flags: string[] = [];

  // News polarity
  const pos = intel.news.filter((n) => n.sentiment === "positive").length;
  const neg = intel.news.filter((n) => n.sentiment === "negative").length;
  const newsBias = (pos - neg) / Math.max(1, intel.news.length); // -1..1
  drivers.push(`News polarity ${pos > 0 || neg > 0 ? `${pos}↑ / ${neg}↓` : "balanced"}`);

  // Fear & greed
  const fg = intel.sentiment?.score ?? 50;
  drivers.push(`Fear/Greed ${fg}/100 (${intel.sentiment?.zone ?? "neutral"})`);
  if (fg >= 80) flags.push("Greed extreme — mean-reversion risk rising");
  if (fg <= 20) flags.push("Fear extreme — contrarian setups emerging");

  // Social proxy: alert volume is a stand-in for chatter intensity.
  const alertSurge = (intel.alerts?.length ?? 0) > 6 ? 10 : 0;
  if (alertSurge) drivers.push("Alert chatter elevated — attention spike");

  // Anomaly detection: outlier returns relative to volatility
  const anomalies = intel.quotes.filter((q) => Math.abs(q.changePct) > 2.5 * (q.volatility / 100) * 3);
  if (anomalies.length) {
    flags.push(`Anomalous move in ${anomalies.map((a) => a.key).join(", ")}`);
  }

  const score = Math.max(-100, Math.min(100,
    newsBias * 55 + (fg - 50) * 0.8 + alertSurge,
  ));
  const bias = score > 10 ? "bullish" : score < -10 ? "bearish" : "neutral";
  const confidence = Math.min(95, 40 + Math.abs(score) * 0.5 + intel.news.length * 1.5);

  return {
    id: "sentiment", label: "Sentiment Intelligence",
    bias, score, confidence, weight: 0.16,
    headline: bias === "bullish" ? "Sentiment tape constructive"
      : bias === "bearish" ? "Sentiment tape defensive"
      : "Sentiment two-way — no edge from positioning",
    drivers, flags,
  };
}
