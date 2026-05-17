// Smart Alert Engine — synthesises alerts from quotes, signals, events,
// opportunities and sentiment shifts.
import type { MarketQuote } from "@/services/market/marketData";
import type { Signal } from "@/services/signals/signalEngine";
import type { MarketSentimentScore } from "@/services/analysis/marketSentiment";
import type { MarketEvent } from "@/services/events/eventImpactEngine";
import type { Opportunity } from "@/services/opportunities/opportunityScanner";

export type AlertUrgency = "Critical" | "High" | "Medium" | "Low";
export type AlertKind = "Momentum" | "News" | "Opportunity" | "Volatility" | "Sentiment";

export interface SmartAlert {
  id: string;
  kind: AlertKind;
  urgency: AlertUrgency;
  confidence: number; // 0-100
  title: string;
  explanation: string;
  affectedAssets: string[];
  timestamp: number;
}

function urgencyFromScore(v: number): AlertUrgency {
  if (v >= 80) return "Critical";
  if (v >= 60) return "High";
  if (v >= 40) return "Medium";
  return "Low";
}

export function generateAlerts(
  quotes: MarketQuote[],
  signals: Signal[],
  events: MarketEvent[],
  opportunities: Opportunity[],
  sentiment: MarketSentimentScore,
): SmartAlert[] {
  const out: SmartAlert[] = [];
  const now = Date.now();

  // Momentum shifts
  for (const q of quotes) {
    if (Math.abs(q.momentum) > 1.5) {
      const score = Math.min(100, Math.round(Math.abs(q.momentum) * 18 + q.volatility * 0.4));
      out.push({
        id: `al-mom-${q.key}-${now}`,
        kind: "Momentum",
        urgency: urgencyFromScore(score),
        confidence: Math.min(90, 55 + Math.round(Math.abs(q.momentum) * 6)),
        title: `${q.name} momentum shift ${q.momentum > 0 ? "↑" : "↓"} ${q.momentum.toFixed(2)}%`,
        explanation: `Trailing drift breached the alert threshold. Probability of follow-through elevated while volatility (${q.volatility}/100) supports the move.`,
        affectedAssets: [q.key],
        timestamp: now,
      });
    }
  }

  // Breaking news / high-impact events
  for (const e of events.slice(0, 4)) {
    if (e.urgency < 55) continue;
    out.push({
      id: `al-news-${e.id}`,
      kind: "News",
      urgency: urgencyFromScore(e.urgency),
      confidence: Math.min(92, 50 + Math.round(e.strength * 0.4)),
      title: e.headline,
      explanation: `${e.reasoning} Expected impact: ${e.direction}, ${e.duration}.`,
      affectedAssets: e.affectedAssets,
      timestamp: e.publishedAt,
    });
  }

  // High-confidence opportunities
  for (const o of opportunities.filter((x) => x.score >= 75).slice(0, 3)) {
    out.push({
      id: `al-opp-${o.id}`,
      kind: "Opportunity",
      urgency: urgencyFromScore(o.score),
      confidence: o.confidence,
      title: `${o.assetName}: ${o.kind} setup (${o.entryBias})`,
      explanation: o.explanation,
      affectedAssets: [o.asset],
      timestamp: o.timestamp,
    });
  }

  // Volatility spike
  const hot = quotes.filter((q) => q.volatility > 70).sort((a, b) => b.volatility - a.volatility)[0];
  if (hot) {
    out.push({
      id: `al-vol-${hot.key}-${now}`,
      kind: "Volatility",
      urgency: urgencyFromScore(hot.volatility),
      confidence: 75,
      title: `Volatility spike in ${hot.name}`,
      explanation: `Realised volatility at ${hot.volatility}/100. Widen risk parameters; option pricing likely overshoots short-dated.`,
      affectedAssets: [hot.key],
      timestamp: now,
    });
  }

  // Sentiment extremes
  if (sentiment.score >= 80 || sentiment.score <= 20) {
    const greedy = sentiment.score >= 80;
    out.push({
      id: `al-snt-${now}`,
      kind: "Sentiment",
      urgency: "High",
      confidence: 72,
      title: `Market sentiment: ${sentiment.zone}`,
      explanation: greedy
        ? "Positioning stretched — historically asymmetric downside risk. Favor profit-taking and tighter stops."
        : "Capitulation conditions — reward-to-risk improves for patient capital, but timing remains uncertain.",
      affectedAssets: ["SPX", "BTC", "XAU"],
      timestamp: now,
    });
  }

  // Sort: critical first, then by recency
  const order: Record<AlertUrgency, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  return out.sort((a, b) => order[a.urgency] - order[b.urgency] || b.timestamp - a.timestamp).slice(0, 8);
}
