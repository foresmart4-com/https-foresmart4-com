const GDELT_BASE = "https://api.gdeltproject.org/api/v2/doc/doc";

export interface GdeltArticle {
  url: string;
  title: string;
  source: string;
  sourcecountry: string;
  language: string;
  seendate: string;
  tone: number;
  domain: string;
}

export interface GdeltResult {
  articles: GdeltArticle[];
  fetchedAt: string;
  query: string;
  success: boolean;
  error?: string;
}

export interface NewsImpact {
  title: string;
  source: string;
  category: string;
  newsImpactScore: number;
  sentimentScore: number;
  sourceCredibilityPercent: number;
  sourceAgreementScore: number;
  marketImpactWeight: number;
  tone: number;
  url: string;
  fetchedAt: string;
}

const TRACKED_CATEGORIES: Record<string, string[]> = {
  economic: ["economy", "GDP", "unemployment", "economic growth", "recession"],
  oil: ["oil price", "crude oil", "OPEC", "petroleum", "oil production"],
  metals: ["gold price", "silver", "precious metals", "gold market"],
  crypto: ["bitcoin", "ethereum", "cryptocurrency", "crypto market", "blockchain"],
  company: ["earnings", "stock market", "corporate", "IPO", "quarterly results"],
  saudi: ["Saudi Arabia economy", "Saudi stock", "Tadawul", "Saudi oil", "Saudi Aramco"],
  inflation: ["inflation rate", "consumer prices", "CPI", "price index"],
  interest_rates: ["interest rate", "Federal Reserve", "central bank rate", "monetary policy"],
  central_banks: ["Federal Reserve", "ECB", "Bank of England", "central bank", "quantitative"],
  financial_markets: ["stock market", "bond market", "forex", "financial markets", "Wall Street"],
};

const CREDIBLE_DOMAINS = new Set([
  "reuters.com", "bloomberg.com", "ft.com", "wsj.com", "cnbc.com",
  "bbc.com", "aljazeera.com", "alarabiya.net", "argaam.com",
  "marketwatch.com", "economist.com", "nytimes.com", "apnews.com",
]);

function domainCredibility(domain: string): number {
  if (CREDIBLE_DOMAINS.has(domain)) return 90;
  if (domain.endsWith(".gov") || domain.endsWith(".edu")) return 85;
  if (domain.includes("news") || domain.includes("finance") || domain.includes("market")) return 65;
  return 50;
}

function toneToSentiment(tone: number): number {
  return Math.max(-1, Math.min(1, tone / 15));
}

function computeImpactWeight(category: string, sentiment: number, credibility: number): number {
  const categoryWeight: Record<string, number> = {
    economic: 0.85, oil: 0.80, metals: 0.70, crypto: 0.65, company: 0.75,
    saudi: 0.80, inflation: 0.90, interest_rates: 0.95, central_banks: 0.90,
    financial_markets: 0.80,
  };
  const base = categoryWeight[category] ?? 0.60;
  const sentimentFactor = 0.7 + Math.abs(sentiment) * 0.3;
  const credFactor = credibility / 100;
  return Math.min(1, base * sentimentFactor * credFactor);
}

async function fetchGdeltCategory(keywords: string[], maxRecords = 10, timespan = "24h"): Promise<GdeltResult> {
  const query = keywords.join(" OR ");
  const params = new URLSearchParams({
    query,
    mode: "ArtList",
    maxrecords: String(maxRecords),
    timespan: timespan,
    format: "json",
    sort: "ToneDesc",
  });

  const url = `${GDELT_BASE}?${params}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return { articles: [], fetchedAt: new Date().toISOString(), query, success: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json() as { articles?: Array<Record<string, unknown>> };
    const articles: GdeltArticle[] = (data.articles ?? []).map((a) => ({
      url: String(a.url ?? ""),
      title: String(a.title ?? ""),
      source: String(a.source ?? ""),
      sourcecountry: String(a.sourcecountry ?? ""),
      language: String(a.language ?? ""),
      seendate: String(a.seendate ?? ""),
      tone: Number(a.tone ?? 0),
      domain: String(a.domain ?? ""),
    }));

    return { articles, fetchedAt: new Date().toISOString(), query, success: true };
  } catch (err) {
    return {
      articles: [],
      fetchedAt: new Date().toISOString(),
      query,
      success: false,
      error: err instanceof Error ? err.message : "GDELT fetch failed",
    };
  }
}

let cachedIntelligence: {
  data: NewsImpact[];
  fetchedAt: string;
  gdeltActive: boolean;
  categoryBreakdown: Record<string, number>;
} | null = null;
let lastFetchAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function fetchGdeltIntelligence(): Promise<{
  articles: NewsImpact[];
  gdeltActive: boolean;
  fetchedAt: string;
  categoryBreakdown: Record<string, number>;
}> {
  if (cachedIntelligence && Date.now() - lastFetchAt < CACHE_TTL) {
    return { articles: cachedIntelligence.data, gdeltActive: cachedIntelligence.gdeltActive, fetchedAt: cachedIntelligence.fetchedAt, categoryBreakdown: cachedIntelligence.categoryBreakdown };
  }

  const allArticles: NewsImpact[] = [];
  const categoryBreakdown: Record<string, number> = {};
  let anySuccess = false;

  const entries = Object.entries(TRACKED_CATEGORIES);
  const results = await Promise.all(entries.map(([, keywords]) => fetchGdeltCategory(keywords, 5)));

  for (let i = 0; i < entries.length; i++) {
    const [category] = entries[i];
    const result = results[i];
    if (result.success) anySuccess = true;
    categoryBreakdown[category] = result.articles.length;

    for (const article of result.articles) {
      const credibility = domainCredibility(article.domain);
      const sentiment = toneToSentiment(article.tone);
      const impact = computeImpactWeight(category, sentiment, credibility);

      allArticles.push({
        title: article.title,
        source: article.source,
        category,
        newsImpactScore: Math.round(impact * 100),
        sentimentScore: Math.round(sentiment * 100) / 100,
        sourceCredibilityPercent: credibility,
        sourceAgreementScore: Math.round(Math.min(100, credibility * (0.8 + Math.abs(sentiment) * 0.2))),
        marketImpactWeight: Math.round(impact * 1000) / 1000,
        tone: article.tone,
        url: article.url,
        fetchedAt: result.fetchedAt,
      });
    }
  }

  allArticles.sort((a, b) => b.marketImpactWeight - a.marketImpactWeight);

  const now = new Date().toISOString();
  cachedIntelligence = { data: allArticles, fetchedAt: now, gdeltActive: anySuccess, categoryBreakdown };
  lastFetchAt = Date.now();

  return { articles: allArticles, gdeltActive: anySuccess, fetchedAt: now, categoryBreakdown };
}

export function getGdeltFallback(): {
  articles: NewsImpact[];
  gdeltActive: boolean;
  fetchedAt: string;
  categoryBreakdown: Record<string, number>;
} {
  return {
    articles: [],
    gdeltActive: false,
    fetchedAt: new Date().toISOString(),
    categoryBreakdown: Object.fromEntries(Object.keys(TRACKED_CATEGORIES).map((k) => [k, 0])),
  };
}

export function getSourceRegistry(): Array<{ name: string; status: string; type: string; categories: string[] }> {
  return [
    { name: "GDELT Project", status: cachedIntelligence?.gdeltActive ? "live" : "framework_ready_provider_missing", type: "news_aggregator", categories: Object.keys(TRACKED_CATEGORIES) },
    { name: "CoinGecko", status: "live", type: "crypto_market_data", categories: ["crypto"] },
    { name: "Finnhub", status: "framework_ready_provider_missing", type: "stock_data", categories: ["company", "saudi"] },
    { name: "Twelve Data", status: "framework_ready_provider_missing", type: "stock_data", categories: ["company", "financial_markets"] },
    { name: "Alpha Vantage", status: "framework_ready_provider_missing", type: "fundamentals", categories: ["company", "economic"] },
  ];
}

export function getCredibilityReport(): {
  averageCredibility: number;
  totalSources: number;
  highCredibilityCount: number;
  categories: string[];
  lastUpdated: string;
} {
  const articles = cachedIntelligence?.data ?? [];
  const total = articles.length;
  const avg = total > 0 ? articles.reduce((sum, a) => sum + a.sourceCredibilityPercent, 0) / total : 0;
  const highCred = articles.filter((a) => a.sourceCredibilityPercent >= 80).length;

  return {
    averageCredibility: Math.round(avg * 100) / 100,
    totalSources: total,
    highCredibilityCount: highCred,
    categories: Object.keys(TRACKED_CATEGORIES),
    lastUpdated: cachedIntelligence?.fetchedAt ?? new Date().toISOString(),
  };
}
