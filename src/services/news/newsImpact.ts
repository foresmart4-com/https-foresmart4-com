export type NewsSentiment = "positive" | "negative" | "neutral";
export type NewsImpact = "Low" | "Medium" | "High";

export interface NewsItem {
  id: string;
  headline: string;
  sentiment: NewsSentiment;
  impact: NewsImpact;
  impactScore: number; // 0-100
  asset: string;
  analysis: string;
  publishedAt: number;
}

const POOL: Omit<NewsItem, "id" | "publishedAt" | "impactScore">[] = [
  {
    headline: "Fed signals patient stance on rate cuts",
    sentiment: "neutral", impact: "High", asset: "DXY",
    analysis: "Markets price September easing; modest USD softness supports risk assets and gold.",
  },
  {
    headline: "BlackRock Bitcoin ETF posts record weekly inflow",
    sentiment: "positive", impact: "High", asset: "BTC",
    analysis: "Institutional demand strongest in 6 weeks — structural tailwind for spot BTC liquidity.",
  },
  {
    headline: "Middle East tensions escalate, gold catches bid",
    sentiment: "negative", impact: "Medium", asset: "XAU",
    analysis: "Geopolitical risk premium expands; gold benefits while oil volatility climbs.",
  },
  {
    headline: "US ISM manufacturing beats expectations",
    sentiment: "positive", impact: "Medium", asset: "SPX",
    analysis: "Cyclicals lead; constructive for industrials and broad market breadth.",
  },
  {
    headline: "Ethereum L2 throughput hits all-time high",
    sentiment: "positive", impact: "Medium", asset: "ETH",
    analysis: "Network activity supports fundamental thesis; rotation into ETH-correlated alts likely.",
  },
  {
    headline: "OPEC+ extends voluntary production cuts",
    sentiment: "positive", impact: "Medium", asset: "OIL",
    analysis: "Supply-side discipline tightens balances; crude bias remains constructive near-term.",
  },
  {
    headline: "Mega-cap tech leadership narrows further",
    sentiment: "negative", impact: "Medium", asset: "NDX",
    analysis: "Breadth divergence raises correction risk; tighten stops on momentum longs.",
  },
  {
    headline: "China stimulus package larger than expected",
    sentiment: "positive", impact: "High", asset: "OIL",
    analysis: "Demand-side boost lifts commodities complex and risk-on FX baskets.",
  },
];

let seq = 0;
export async function fetchNews(limit = 5): Promise<NewsItem[]> {
  const shuffled = [...POOL].sort(() => Math.random() - 0.5).slice(0, limit);
  const now = Date.now();
  return shuffled.map((n, i) => ({
    ...n,
    id: `n-${now}-${seq++}`,
    publishedAt: now - i * 1000 * 60 * (3 + Math.floor(Math.random() * 15)),
    impactScore: n.impact === "High" ? 75 + Math.floor(Math.random() * 20) :
                 n.impact === "Medium" ? 45 + Math.floor(Math.random() * 25) :
                 20 + Math.floor(Math.random() * 20),
  }));
}
