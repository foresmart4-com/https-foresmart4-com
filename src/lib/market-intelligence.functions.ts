import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cached, intelQueue } from "@/lib/cache/intelligence-cache";
import {
  analyseTimeframe, analyseSentiment, detectRegime, scoreTrend, scoreVolatility,
  scoreRisk, computeConfidence, recommend, buildExplain, buildSmartAlerts,
  generateRationale, type Bar, type IntelligenceReport, type Timeframe, type CalendarImpact,
} from "@/services/intelligence/marketIntelligenceEngine";

const SymbolInput = z.object({
  symbol: z.string().trim().min(1).max(20).regex(/^[A-Z0-9._-]+$/i),
});

const PortfolioInput = z.object({
  positions: z.array(z.object({
    symbol: z.string().trim().min(1).max(20).regex(/^[A-Z0-9._-]+$/i),
    weight: z.number().min(0).max(1),
  })).min(1).max(30),
});

async function fetchTimeframe(symbol: string, tf: Timeframe): Promise<Bar[]> {
  return cached(`ts:${symbol}:${tf}`, 60_000, async () => {
    return intelQueue.run(async () => {
      try {
        const { getTimeSeries } = await import("@/services/providers/twelvedata");
        const interval = tf === "1day" ? "1day" : tf === "1h" ? "1h" : tf === "15min" ? "15min" : "5min";
        const size = tf === "1day" ? 60 : tf === "1h" ? 48 : 60;
        const r = await getTimeSeries(symbol, interval, size);
        return (r.values || []).map((v) => ({
          datetime: v.datetime,
          open: Number(v.open), high: Number(v.high), low: Number(v.low), close: Number(v.close),
          volume: v.volume ? Number(v.volume) : undefined,
        })).filter((b) => Number.isFinite(b.close));
      } catch {
        return [];
      }
    });
  });
}

async function fetchQuote(symbol: string) {
  return cached(`q:${symbol}`, 30_000, async () =>
    intelQueue.run(async () => {
      try {
        const { getQuote } = await import("@/services/providers/finnhub");
        return await getQuote(symbol);
      } catch {
        try {
          const { getQuote } = await import("@/services/providers/twelvedata");
          const q = await getQuote(symbol);
          return { c: Number(q.close), d: Number(q.change), dp: Number(q.percent_change), h: Number(q.high), l: Number(q.low), o: Number(q.open), pc: Number(q.previous_close), t: Math.floor(Date.now() / 1000) };
        } catch { return null; }
      }
    })
  );
}

async function fetchNews(symbol: string) {
  return cached(`news:${symbol}`, 5 * 60_000, async () =>
    intelQueue.run(async () => {
      try {
        const { getCompanyNews } = await import("@/services/providers/finnhub");
        const to = new Date().toISOString().slice(0, 10);
        const from = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
        const items = await getCompanyNews(symbol, from, to);
        return (items || []).slice(0, 30).map((n) => ({ headline: n.headline, source: n.source, url: n.url }));
      } catch { return []; }
    })
  );
}

async function fetchCalendar(): Promise<CalendarImpact> {
  return cached("calendar:global", 10 * 60_000, async () =>
    intelQueue.run(async () => {
      try {
        const mod = await import("@/lib/economic-calendar.functions");
        // call internal helper-free path: invoke server fn handler directly is tricky; instead replicate fetch.
        const cred = process.env.TRADING_ECONOMICS_KEY || "guest:guest";
        const r = await fetch(`https://api.tradingeconomics.com/calendar?c=${cred}&f=json`, { signal: AbortSignal.timeout(4000) });
        const data = r.ok ? await r.json() as Array<{ Date: string; Country: string; Event: string; Importance: number }> : [];
        const now = Date.now();
        const horizon = now + 48 * 3600 * 1000;
        const upcoming = data
          .filter((e) => { const t = Date.parse(e.Date); return t >= now && t <= horizon; })
          .slice(0, 12)
          .map((e) => ({
            event: e.Event,
            country: e.Country,
            impact: (e.Importance >= 3 ? "high" : e.Importance === 2 ? "medium" : "low") as "low" | "medium" | "high",
            whenISO: e.Date,
            expectedEffect: e.Importance >= 3 ? "FX/yields shock risk" : e.Importance === 2 ? "Sector-level move" : "Minor",
          }));
        void mod;
        return { upcoming, riskWindowHours: 48 };
      } catch {
        return { upcoming: [], riskWindowHours: 48 };
      }
    })
  );
}

async function buildReport(symbol: string): Promise<IntelligenceReport> {
  const SYM = symbol.toUpperCase();
  const [q, b5, b15, b1h, b1d, news, calendar] = await Promise.all([
    fetchQuote(SYM),
    fetchTimeframe(SYM, "5min"),
    fetchTimeframe(SYM, "15min"),
    fetchTimeframe(SYM, "1h"),
    fetchTimeframe(SYM, "1day"),
    fetchNews(SYM),
    fetchCalendar(),
  ]);

  const tfs = [
    analyseTimeframe("5min", b5),
    analyseTimeframe("15min", b15),
    analyseTimeframe("1h", b1h),
    analyseTimeframe("1day", b1d),
  ].filter((x): x is NonNullable<typeof x> => !!x);

  const sentiment = analyseSentiment(news);
  const regime = detectRegime(tfs);
  const trendScore = scoreTrend(tfs);
  const volatilityScore = scoreVolatility(tfs);
  const calendarHigh = calendar.upcoming.filter((e) => e.impact === "high").length;
  const risk = scoreRisk({ volatility: volatilityScore, sentiment: sentiment.score, regime, calendarHigh });
  const confidencePct = computeConfidence({ stats: tfs, sentiment, regime });
  const recommendation = recommend(trendScore, sentiment.score, risk.score);
  const explain = buildExplain(tfs, sentiment, regime, risk);
  const smartAlerts = buildSmartAlerts(tfs, sentiment, regime, calendar);

  const base: Omit<IntelligenceReport, "rationale" | "rationaleAr"> = {
    symbol: SYM,
    generatedAt: Date.now(),
    price: q?.c ?? tfs.at(-1)?.last ?? 0,
    changePct: q?.dp ?? tfs.find((x) => x.timeframe === "1day")?.changePct ?? 0,
    timeframes: tfs,
    trendScore,
    volatilityScore,
    sentiment,
    regime,
    risk,
    confidencePct,
    recommendation,
    explain,
    smartAlerts,
    calendar,
  };
  const { en, ar } = generateRationale(base);
  return { ...base, rationale: en, rationaleAr: ar };
}

export const getMarketIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SymbolInput.parse(d))
  .handler(async ({ data }) => {
    return cached(`report:${data.symbol.toUpperCase()}`, 45_000, () => buildReport(data.symbol));
  });

export const getPortfolioRiskScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PortfolioInput.parse(d))
  .handler(async ({ data }) => {
    const reports = await Promise.all(
      data.positions.map(async (p) => ({ p, r: await cached(`report:${p.symbol.toUpperCase()}`, 45_000, () => buildReport(p.symbol)) }))
    );
    const weightSum = data.positions.reduce((a, p) => a + p.weight, 0) || 1;
    const weighted = reports.reduce(
      (acc, { p, r }) => {
        const w = p.weight / weightSum;
        acc.risk += r.risk.score * w;
        acc.vol += r.volatilityScore * w;
        acc.trend += r.trendScore * w;
        acc.sentiment += r.sentiment.score * w;
        acc.confidence += r.confidencePct * w;
        return acc;
      },
      { risk: 0, vol: 0, trend: 0, sentiment: 0, confidence: 0 }
    );
    const top = [...reports].sort((a, b) => b.r.risk.score - a.r.risk.score).slice(0, 5)
      .map(({ p, r }) => ({ symbol: p.symbol.toUpperCase(), risk: r.risk.score, band: r.risk.band, drivers: r.risk.drivers.slice(0, 2) }));
    return {
      portfolioRisk: Math.round(weighted.risk),
      volatility: Math.round(weighted.vol),
      trend: Math.round(weighted.trend),
      sentiment: Math.round(weighted.sentiment),
      confidence: Math.round(weighted.confidence),
      topRisks: top,
      generatedAt: Date.now(),
    };
  });

export const getWatchlistIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    symbols: z.array(z.string().trim().min(1).max(20).regex(/^[A-Z0-9._-]+$/i)).min(1).max(20),
  }).parse(d))
  .handler(async ({ data }) => {
    const results = await Promise.all(data.symbols.map(async (s) => {
      try {
        const r = await cached(`report:${s.toUpperCase()}`, 60_000, () => buildReport(s));
        return {
          symbol: r.symbol, price: r.price, changePct: r.changePct,
          recommendation: r.recommendation, confidencePct: r.confidencePct,
          trendScore: r.trendScore, sentiment: r.sentiment.label,
          risk: r.risk.band, alerts: r.smartAlerts.length,
        };
      } catch {
        return { symbol: s.toUpperCase(), error: "unavailable" as const };
      }
    }));
    return { items: results, generatedAt: Date.now() };
  });
