// Event Impact Engine — classifies macro/financial events from news headlines
// and projects directional impact, strength, urgency and duration.
import type { NewsItem } from "@/services/news/newsImpact";
import type { AssetKey } from "@/services/market/marketData";

export type EventCategory =
  | "rates" | "inflation" | "etf" | "earnings" | "oil" | "regulation" | "crypto" | "geopolitics" | "macro";

export type EventDirection = "bullish" | "bearish" | "mixed";
export type EventDuration = "intraday" | "days" | "weeks" | "structural";

export interface MarketEvent {
  id: string;
  category: EventCategory;
  headline: string;
  affectedAssets: AssetKey[];
  direction: EventDirection;
  strength: number; // 0-100
  urgency: number; // 0-100
  duration: EventDuration;
  reasoning: string;
  publishedAt: number;
}

const CATEGORY_RULES: Array<{ cat: EventCategory; words: string[]; assets: AssetKey[]; duration: EventDuration; baseStrength: number }> = [
  { cat: "rates", words: ["fed", "fomc", "rate", "ecb", "boj", "yield", "treasury"], assets: ["DXY", "SPX", "NDX", "XAU"], duration: "weeks", baseStrength: 78 },
  { cat: "inflation", words: ["cpi", "inflation", "pce", "ppi"], assets: ["DXY", "SPX", "XAU"], duration: "weeks", baseStrength: 72 },
  { cat: "etf", words: ["etf", "spot etf", "blackrock", "fidelity"], assets: ["BTC", "ETH"], duration: "days", baseStrength: 68 },
  { cat: "earnings", words: ["earnings", "revenue", "guidance", "eps"], assets: ["SPX", "NDX"], duration: "days", baseStrength: 60 },
  { cat: "oil", words: ["opec", "crude", "wti", "brent", "barrel", "supply cut"], assets: ["OIL", "DXY"], duration: "weeks", baseStrength: 65 },
  { cat: "regulation", words: ["sec", "regulation", "ban", "lawsuit", "ruling", "tariff", "sanction"], assets: ["BTC", "ETH", "SPX"], duration: "weeks", baseStrength: 70 },
  { cat: "crypto", words: ["bitcoin", "ethereum", "crypto", "halving", "stablecoin"], assets: ["BTC", "ETH"], duration: "days", baseStrength: 58 },
  { cat: "geopolitics", words: ["war", "tension", "conflict", "attack", "missile"], assets: ["XAU", "OIL", "SPX"], duration: "weeks", baseStrength: 75 },
];

function classify(headline: string): { cat: EventCategory; assets: AssetKey[]; duration: EventDuration; baseStrength: number } {
  const t = headline.toLowerCase();
  for (const r of CATEGORY_RULES) if (r.words.some((w) => t.includes(w))) return r;
  return { cat: "macro", assets: ["SPX"], duration: "days", baseStrength: 45 };
}

function directionFor(news: NewsItem, cat: EventCategory): EventDirection {
  if (news.sentiment === "positive") return cat === "rates" || cat === "inflation" ? "mixed" : "bullish";
  if (news.sentiment === "negative") return "bearish";
  return "mixed";
}

function buildReasoning(category: EventCategory, direction: EventDirection, assets: AssetKey[]): string {
  const dirText =
    direction === "bullish" ? "Probability skew tilts constructive" :
    direction === "bearish" ? "Risk skew tilts defensive" :
    "Two-way risk — outcome path-dependent";
  const map: Record<EventCategory, string> = {
    rates: "Policy-sensitive duration and USD reprice first; equities follow on terminal-rate repricing.",
    inflation: "Inflation surprise shifts real-yield path; gold and rate-sensitive equities lead reaction.",
    etf: "Flow-driven impulse on spot liquidity; structural demand if sustained over multiple sessions.",
    earnings: "Idiosyncratic but indices absorb breadth; watch guidance more than headline EPS.",
    oil: "Supply discipline tightens balances; second-order pass-through into inflation expectations.",
    regulation: "Headline volatility likely; positioning unwinds dominate the first 24h.",
    crypto: "Crypto-native flows lead; correlation to risk assets re-couples on macro events.",
    geopolitics: "Safe-haven bid into gold and USD; risk assets de-rate until de-escalation signal.",
    macro: "Cross-asset reaction proportional to surprise vs. consensus.",
  };
  return `${dirText}. ${map[category]} Focus pairs: ${assets.join(", ")}.`;
}

export function classifyEvents(news: NewsItem[]): MarketEvent[] {
  return news.map((n) => {
    const { cat, assets, duration, baseStrength } = classify(n.headline);
    const direction = directionFor(n, cat);
    const strength = Math.min(100, Math.round(baseStrength * 0.6 + n.impactScore * 0.4));
    const urgency = Math.min(100, Math.round(n.urgency * 0.7 + (Date.now() - n.publishedAt < 3600_000 ? 30 : 10)));
    return {
      id: `evt-${n.id}`,
      category: cat,
      headline: n.headline,
      affectedAssets: assets,
      direction,
      strength,
      urgency,
      duration,
      reasoning: buildReasoning(cat, direction, assets),
      publishedAt: n.publishedAt,
    };
  }).sort((a, b) => b.urgency - a.urgency);
}
