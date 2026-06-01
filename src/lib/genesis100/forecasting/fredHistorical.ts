import { getCachedMacroContext } from "@/lib/genesis100/macro/macroDataService";

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface HistoricalSeries {
  seriesId: string;
  name: string;
  data: TimeSeriesPoint[];
  latestValue: number;
  changeFrom1YearAgo: number;
  trend: "rising" | "falling" | "stable";
  trendStrength: number;
}

const FRED_SERIES = {
  fedFunds:     { id: "FEDFUNDS",      name: "معدل الفائدة الفيدرالية" },
  cpi:          { id: "CPIAUCSL",      name: "مؤشر أسعار المستهلك" },
  unemployment: { id: "UNRATE",        name: "معدل البطالة" },
  yield10y:     { id: "DGS10",         name: "عائد سندات 10 سنوات" },
  yield2y:      { id: "DGS2",          name: "عائد سندات سنتين" },
  dollarIndex:  { id: "DTWEXBGS",      name: "مؤشر الدولار" },
  realGdp:      { id: "GDPC1",         name: "الناتج المحلي الحقيقي (ربعي)" },
  yieldSpread:  { id: "T10Y2Y",        name: "فارق العائد 10Y-2Y" },
  hySpread:     { id: "BAMLH0A0HYM2",  name: "فروقات السندات عالية العائد" },
  vix:          { id: "VIXCLS",        name: "مؤشر التقلب VIX" },
  mortgage30:   { id: "MORTGAGE30US",  name: "معدل الرهن العقاري 30 سنة" },
};

const CACHE_6H = 6 * 3600 * 1000;
const _cache = new Map<string, { data: HistoricalSeries; ts: number }>();

// Use AbortController instead of AbortSignal.timeout() — Workers runtime compatible
async function fetchWithAbort(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFREDSeries(
  seriesId: string,
  name: string,
): Promise<HistoricalSeries | null> {
  const cacheKey = seriesId;
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_6H) return cached.data;

  const key = process.env.FRED_API_KEY;
  if (!key) {
    console.error(`[fred-historical] FRED_API_KEY missing — cannot fetch ${seriesId}`);
    return null;
  }

  // Try limit=24 first (2 years monthly), fall back to limit=12; retry up to 2 times per limit
  for (const limit of [24, 12]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
        const url =
          `https://api.stlouisfed.org/fred/series/observations` +
          `?series_id=${seriesId}&api_key=${key}&limit=${limit}&sort_order=desc&file_type=json`;

        const res = await fetchWithAbort(url, 8000);

        if (!res.ok) {
          const body = await res.text().catch(() => "(unreadable)");
          console.error(`[fred-historical] ${seriesId} HTTP ${res.status}: ${body.slice(0, 200)}`);
          break; // non-recoverable HTTP error for this limit
        }

        const json = await res.json() as {
          observations?: Array<{ date: string; value: string }>;
          error_message?: string;
        };

        if (json.error_message) {
          console.error(`[fred-historical] ${seriesId} FRED error: ${json.error_message}`);
          break; // API error — skip this limit
        }

        const points: TimeSeriesPoint[] = (json.observations ?? [])
          .filter((o) => o.value !== "." && o.value !== "" && !isNaN(Number(o.value)))
          .map((o) => ({ date: o.date, value: Number(o.value) }))
          .reverse(); // chronological order

        if (points.length < 3) {
          console.warn(`[fred-historical] ${seriesId} returned only ${points.length} valid points (limit=${limit})`);
          break; // try smaller limit
        }

        const latest     = points[points.length - 1].value;
        const yearAgoIdx = Math.max(0, points.length - 13);
        const oneYearAgo = points[yearAgoIdx]?.value ?? latest;
        const changeFrom1Y = Math.abs(oneYearAgo) > 0
          ? ((latest - oneYearAgo) / Math.abs(oneYearAgo)) * 100
          : 0;

        // Linear regression over all available points
        const n     = points.length;
        const sumX  = points.reduce((s, _, i) => s + i, 0);
        const sumY  = points.reduce((s, p) => s + p.value, 0);
        const sumXY = points.reduce((s, p, i) => s + i * p.value, 0);
        const sumX2 = points.reduce((s, _, i) => s + i * i, 0);
        const denom = n * sumX2 - sumX * sumX;
        const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;

        const avgValue        = sumY / n;
        const normalizedSlope = avgValue !== 0 ? (slope / Math.abs(avgValue)) * 100 : 0;
        const trend: HistoricalSeries["trend"] =
          normalizedSlope > 0.5 ? "rising" : normalizedSlope < -0.5 ? "falling" : "stable";
        const trendStrength = Math.min(100, Math.abs(normalizedSlope) * 10);

        const result: HistoricalSeries = {
          seriesId,
          name,
          data: points,
          latestValue: latest,
          changeFrom1YearAgo: changeFrom1Y,
          trend,
          trendStrength,
        };

        _cache.set(cacheKey, { data: result, ts: Date.now() });
        console.info(`[fred-historical] ${seriesId} loaded: latest=${latest} trend=${trend} points=${points.length}`);
        return result;
      } catch (err) {
        console.error(`[fred-historical] ${seriesId} fetch error (limit=${limit} attempt=${attempt}):`, err);
      }
    }
  }
  return null;
}

function forecastNextPeriods(series: HistoricalSeries, periods = 3): number[] {
  const values = series.data.map((p) => p.value);
  if (values.length < 4) return Array(periods).fill(series.latestValue);

  const n         = values.length;
  const sumX      = values.reduce((s, _, i) => s + i, 0);
  const sumY      = values.reduce((s, v) => s + v, 0);
  const sumXY     = values.reduce((s, v, i) => s + i * v, 0);
  const sumX2     = values.reduce((s, _, i) => s + i * i, 0);
  const denom     = n * sumX2 - sumX * sumX;
  const slope     = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;

  const mean   = sumY / n;
  const latest = values[n - 1];
  const meanRevStrength = 0.3;

  return Array.from({ length: periods }, (_, idx) => {
    const i = idx + 1;
    const trendForecast = intercept + slope * (n - 1 + i);
    const meanRevAdj    = -(latest - mean) * meanRevStrength * (i / periods);
    return trendForecast + meanRevAdj;
  });
}

export interface RealEconomicForecast {
  fedFundsRate: { current: number; forecast3M: number; trend: string; arabicSummary: string };
  inflation:    { current: number; yoyChange: number; forecast3M: number; trend: string; arabicSummary: string };
  unemployment: { current: number; yoyChange: number; forecast3M: number; trend: string; arabicSummary: string };
  yieldCurve:   { yield10y: number; yield2y: number; spread: number; inverted: boolean; arabicSummary: string };
  dollarIndex:  { current: number; trend: string; arabicSummary: string };
  overallForecastSummary: string;
  dataConfidence: number;
  dataSource: "fred_live" | "fred_partial" | "macro_cache_fallback";
}

export async function buildRealEconomicForecast(): Promise<RealEconomicForecast> {
  console.info("[fred-historical] buildRealEconomicForecast() starting...");

  const seriesDefs = [
    { id: FRED_SERIES.fedFunds.id,     name: FRED_SERIES.fedFunds.name },
    { id: FRED_SERIES.cpi.id,          name: FRED_SERIES.cpi.name },
    { id: FRED_SERIES.unemployment.id, name: FRED_SERIES.unemployment.name },
    { id: FRED_SERIES.yield10y.id,     name: FRED_SERIES.yield10y.name },
    { id: FRED_SERIES.yield2y.id,      name: FRED_SERIES.yield2y.name },
    { id: FRED_SERIES.dollarIndex.id,  name: FRED_SERIES.dollarIndex.name },
    { id: FRED_SERIES.realGdp.id,      name: FRED_SERIES.realGdp.name },
    { id: FRED_SERIES.yieldSpread.id,  name: FRED_SERIES.yieldSpread.name },
    { id: FRED_SERIES.hySpread.id,     name: FRED_SERIES.hySpread.name },
    { id: FRED_SERIES.vix.id,          name: FRED_SERIES.vix.name },
    { id: FRED_SERIES.mortgage30.id,   name: FRED_SERIES.mortgage30.name },
  ];
  const fetchedResults: Array<HistoricalSeries | null> = [];
  for (const s of seriesDefs) {
    fetchedResults.push(await fetchFREDSeries(s.id, s.name).catch(() => null));
    await new Promise((r) => setTimeout(r, 1000));
  }
  const [fedFunds, cpi, unemployment, yield10y, yield2y, dollar, realGdp, yieldSpread, hySpread, vixSeries, mortgage30] = fetchedResults;

  const loadedCount = fetchedResults.filter(Boolean).length;
  console.info(`[fred-historical] Loaded ${loadedCount}/${seriesDefs.length} FRED series`);
  if (realGdp) console.info(`[fred-historical] Real GDP: ${realGdp.latestValue?.toFixed(1)} trend=${realGdp.trend}`);
  if (yieldSpread) console.info(`[fred-historical] T10Y2Y spread: ${yieldSpread.latestValue?.toFixed(2)}%`);
  if (hySpread) console.info(`[fred-historical] HY spread: ${hySpread.latestValue?.toFixed(2)}%`);
  if (vixSeries) console.info(`[fred-historical] VIX: ${vixSeries.latestValue?.toFixed(1)}`);
  if (mortgage30) console.info(`[fred-historical] Mortgage 30Y: ${mortgage30.latestValue?.toFixed(2)}%`);
  // suppress unused-var lint — these are logged above and available for future expansion
  void [realGdp, yieldSpread, hySpread, vixSeries, mortgage30];

  // Fallback: use cached MacroContext values when FRED series are unavailable
  const cached = getCachedMacroContext();

  const fedRate = fedFunds?.latestValue
    ?? cached?.interestRateDifferential != null
    ? Math.max(0, (cached?.interestRateDifferential ?? 0) + 3.5)
    : 4.33;
  const cpiLevel  = cpi?.latestValue        ?? 310;    // approximate CPI index level
  const uRate     = unemployment?.latestValue ?? (cached?.businessCycle === "contraction" ? 5.5 : 4.2);
  const y10       = yield10y?.latestValue   ?? 4.5;
  const y2        = yield2y?.latestValue    ?? 4.8;
  const dollarVal = dollar?.latestValue     ?? 100;

  // YoY inflation from CPI series if available, else from macroContext
  const yoyInflation = cpi
    ? (() => {
        const now     = cpi.latestValue;
        const yearAgo = cpi.data[Math.max(0, cpi.data.length - 13)]?.value ?? now;
        return Math.abs(yearAgo) > 0 ? ((now - yearAgo) / yearAgo) * 100 : cached?.inflationLevel ?? 3.0;
      })()
    : (cached?.inflationLevel ?? 3.0);

  // Forecasts — use series if loaded, else hold current value
  const fedForecast  = fedFunds  ? forecastNextPeriods(fedFunds, 3)  : [fedRate, fedRate, fedRate];
  const cpiForecast  = cpi       ? forecastNextPeriods(cpi, 3)       : [cpiLevel, cpiLevel, cpiLevel];
  const unempForecast = unemployment ? forecastNextPeriods(unemployment, 3) : [uRate, uRate, uRate];

  const spread   = y10 - y2;
  const inverted = spread < 0;

  const dollarTrend = dollar?.trend ?? "stable";

  const dataConfidence = Math.round((loadedCount / 6) * 100);
  const dataSource: RealEconomicForecast["dataSource"] =
    loadedCount === 6 ? "fred_live" :
    loadedCount > 0   ? "fred_partial" :
    "macro_cache_fallback";

  const overallForecastSummary = `=== التوقعات الاقتصادية المبنية على بيانات FRED التاريخية ===

الفائدة الأمريكية:
- الحالية: ${fedRate.toFixed(2)}%
- التوقع خلال 3 أشهر: ${fedForecast[2]?.toFixed(2) ?? fedRate.toFixed(2)}%
- الاتجاه: ${fedFunds?.trend === "rising" ? "صاعد" : fedFunds?.trend === "falling" ? "هابط" : "مستقر"}

التضخم (CPI):
- التغير السنوي: ${yoyInflation.toFixed(2)}%
- الاتجاه: ${cpi?.trend === "rising" ? "متصاعد ⚠️" : cpi?.trend === "falling" ? "متراجع ✅" : "مستقر"}

البطالة:
- الحالية: ${uRate.toFixed(1)}%
- التوقع خلال 3 أشهر: ${unempForecast[2]?.toFixed(1) ?? uRate.toFixed(1)}%

منحنى العائد:
- 10 سنوات: ${y10.toFixed(2)}% | سنتان: ${y2.toFixed(2)}%
- الفارق: ${spread.toFixed(2)}%
- ${inverted ? "⚠️ منحنى مقلوب — إشارة ركود تاريخياً" : "✅ منحنى طبيعي"}

مؤشر الدولار: ${dollarVal.toFixed(1)} (${dollarTrend === "rising" ? "قوي" : dollarTrend === "falling" ? "ضعيف" : "مستقر"})

ثقة التحليل: ${dataConfidence}% — مصدر: ${dataSource} (${loadedCount}/6 مصادر FRED)`.trim();

  return {
    fedFundsRate: {
      current:    fedRate,
      forecast3M: fedForecast[2] ?? fedRate,
      trend:      fedFunds?.trend ?? "stable",
      arabicSummary: `الفائدة ${fedRate.toFixed(2)}% — توقع: ${fedForecast[2]?.toFixed(2) ?? fedRate.toFixed(2)}%`,
    },
    inflation: {
      current:    cpiLevel,
      yoyChange:  yoyInflation,
      forecast3M: cpiForecast[2] ?? cpiLevel,
      trend:      cpi?.trend ?? "stable",
      arabicSummary: `التضخم السنوي ${yoyInflation.toFixed(2)}% — ${cpi?.trend === "rising" ? "متصاعد" : cpi?.trend === "falling" ? "متراجع" : "مستقر"}`,
    },
    unemployment: {
      current:    uRate,
      yoyChange:  unemployment?.changeFrom1YearAgo ?? 0,
      forecast3M: unempForecast[2] ?? uRate,
      trend:      unemployment?.trend ?? "stable",
      arabicSummary: `البطالة ${uRate.toFixed(1)}% — توقع: ${unempForecast[2]?.toFixed(1) ?? uRate.toFixed(1)}%`,
    },
    yieldCurve: {
      yield10y: y10,
      yield2y:  y2,
      spread,
      inverted,
      arabicSummary: inverted
        ? `منحنى مقلوب (${spread.toFixed(2)}%) — إشارة ركود تاريخية`
        : `منحنى طبيعي (${spread.toFixed(2)}%) — لا إشارة ركود`,
    },
    dollarIndex: {
      current: dollarVal,
      trend:   dollarTrend,
      arabicSummary: `الدولار ${dollarVal.toFixed(1)} — ${dollarTrend === "rising" ? "قوي يضغط على الأسواق الناشئة" : dollarTrend === "falling" ? "ضعيف يدعم السلع والناشئة" : "مستقر"}`,
    },
    overallForecastSummary,
    dataConfidence,
    dataSource,
  };
}
