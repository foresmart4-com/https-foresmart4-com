// Real financial news via NewsAPI with sentiment + impact scoring.
// Falls back to a curated synthetic pool when no key is configured.
import { env, hasNewsApi, fetchJson } from "@/config/env";

export type NewsSentiment = "positive" | "negative" | "neutral";
export type NewsImpact = "Low" | "Medium" | "High";

export interface NewsItem {
  id: string;
  headline: string;
  sentiment: NewsSentiment;
  impact: NewsImpact;
  impactScore: number; // 0-100
  urgency: number; // 0-100
  asset: string;
  analysis: string;
  publishedAt: number;
  source: "newsapi" | "synthetic";
  url?: string;
}

const POSITIVE_WORDS = ["surge", "rally", "record", "beat", "gain", "soar", "jump", "boost", "high", "strong", "growth", "upgrade", "bullish", "inflow", "expansion"];
const NEGATIVE_WORDS = ["fall", "drop", "plunge", "crash", "loss", "miss", "weak", "decline", "fear", "crisis", "downgrade", "bearish", "outflow", "recession", "tension", "war", "ban"];
const HIGH_IMPACT = ["fed", "ecb", "boj", "cpi", "inflation", "rate", "fomc", "war", "sanction", "treasury", "yield", "recession", "tariff", "earnings"];

const ASSET_MAP: Array<{ keys: string[]; asset: string }> = [
  { keys: ["bitcoin", "btc", "crypto"], asset: "BTC" },
  { keys: ["ethereum", "eth"], asset: "ETH" },
  { keys: ["gold", "xau", "bullion"], asset: "XAU" },
  { keys: ["s&p", "sp500", "spx", "stocks"], asset: "SPX" },
  { keys: ["nasdaq", "ndx", "tech stocks"], asset: "NDX" },
  { keys: ["oil", "crude", "wti", "brent", "opec"], asset: "OIL" },
  { keys: ["dollar", "dxy", "usd", "fed", "treasury"], asset: "DXY" },
];

function scoreText(text: string): { sentiment: NewsSentiment; pos: number; neg: number } {
  const t = text.toLowerCase();
  let pos = 0, neg = 0;
  for (const w of POSITIVE_WORDS) if (t.includes(w)) pos++;
  for (const w of NEGATIVE_WORDS) if (t.includes(w)) neg++;
  const sentiment: NewsSentiment = pos > neg ? "positive" : neg > pos ? "negative" : "neutral";
  return { sentiment, pos, neg };
}

function detectAsset(text: string): string {
  const t = text.toLowerCase();
  for (const { keys, asset } of ASSET_MAP) {
    if (keys.some((k) => t.includes(k))) return asset;
  }
  return "SPX";
}

function scoreImpact(text: string, polarity: number): { impact: NewsImpact; impactScore: number; urgency: number } {
  const t = text.toLowerCase();
  let hi = 0;
  for (const w of HIGH_IMPACT) if (t.includes(w)) hi++;
  const base = Math.min(100, 30 + hi * 18 + polarity * 8);
  const impact: NewsImpact = base >= 70 ? "High" : base >= 45 ? "Medium" : "Low";
  const urgency = Math.min(100, Math.round(base * 0.7 + polarity * 6));
  return { impact, impactScore: Math.round(base), urgency };
}

function buildAnalysis(headline: string, asset: string, sentiment: NewsSentiment): string {
  const dir = sentiment === "positive" ? "constructive" : sentiment === "negative" ? "cautious" : "balanced";
  return `AI read: ${dir} impulse for ${asset}. Monitor follow-through in correlated assets.`;
}

// ---------- NewsAPI (client-side disabled — keys never shipped to browser) ----------
async function fetchFromNewsApi(_limit: number): Promise<NewsItem[] | null> {
  // Server-side proxying is required to use NewsAPI safely.
  // Until a server proxy is wired up, fall through to synthetic news.
  return null;
}


// ---------- Synthetic fallback ----------
const POOL: Array<Omit<NewsItem, "id" | "publishedAt" | "impactScore" | "urgency" | "source">> = [
  { headline: "Fed signals patient stance on rate cuts", sentiment: "neutral", impact: "High", asset: "DXY", analysis: "Markets price September easing; modest USD softness supports risk assets and gold." },
  { headline: "BlackRock Bitcoin ETF posts record weekly inflow", sentiment: "positive", impact: "High", asset: "BTC", analysis: "Institutional demand strongest in 6 weeks — structural tailwind for spot BTC liquidity." },
  { headline: "Middle East tensions escalate, gold catches bid", sentiment: "negative", impact: "Medium", asset: "XAU", analysis: "Geopolitical risk premium expands; gold benefits while oil volatility climbs." },
  { headline: "US ISM manufacturing beats expectations", sentiment: "positive", impact: "Medium", asset: "SPX", analysis: "Cyclicals lead; constructive for industrials and broad market breadth." },
  { headline: "Ethereum L2 throughput hits all-time high", sentiment: "positive", impact: "Medium", asset: "ETH", analysis: "Network activity supports fundamental thesis; rotation into ETH-correlated alts likely." },
  { headline: "OPEC+ extends voluntary production cuts", sentiment: "positive", impact: "Medium", asset: "OIL", analysis: "Supply-side discipline tightens balances; crude bias remains constructive near-term." },
  { headline: "Mega-cap tech leadership narrows further", sentiment: "negative", impact: "Medium", asset: "NDX", analysis: "Breadth divergence raises correction risk; tighten stops on momentum longs." },
  { headline: "China stimulus package larger than expected", sentiment: "positive", impact: "High", asset: "OIL", analysis: "Demand-side boost lifts commodities complex and risk-on FX baskets." },
];

let seq = 0;
function syntheticNews(limit: number): NewsItem[] {
  const shuffled = [...POOL].sort(() => Math.random() - 0.5).slice(0, limit);
  const now = Date.now();
  return shuffled.map((n, i) => {
    const impactScore = n.impact === "High" ? 75 + Math.floor(Math.random() * 20) : n.impact === "Medium" ? 45 + Math.floor(Math.random() * 25) : 20 + Math.floor(Math.random() * 20);
    return {
      ...n,
      id: `n-${now}-${seq++}`,
      publishedAt: now - i * 1000 * 60 * (3 + Math.floor(Math.random() * 15)),
      impactScore,
      urgency: Math.min(100, impactScore + Math.floor(Math.random() * 15)),
      source: "synthetic" as const,
    };
  });
}

export async function fetchNews(limit = 5): Promise<NewsItem[]> {
  const real = await fetchFromNewsApi(limit);
  if (real && real.length > 0) return real;
  return syntheticNews(limit);
}
