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
  changeFrom5YearsAgo: number;
  trend: "rising" | "falling" | "stable";
  trendStrength: number;
}

const FRED_SERIES = {
  fedFunds:    { id: "FEDFUNDS",      name: "معدل الفائدة الفيدرالية" },
  cpi:         { id: "CPIAUCSL",      name: "مؤشر أسعار المستهلك" },
  unemployment:{ id: "UNRATE",        name: "معدل البطالة" },
  gdp:         { id: "GDPC1",         name: "الناتج المحلي الحقيقي" },
  m2:          { id: "M2SL",          name: "عرض النقود M2" },
  yield10y:    { id: "DGS10",         name: "عائد سندات 10 سنوات" },
  yield2y:     { id: "DGS2",          name: "عائد سندات سنتين" },
  creditSpread:{ id: "BAMLH0A0HYM2",  name: "فارق ائتمان السندات" },
  dollarIndex: { id: "DTWEXBGS",      name: "مؤشر الدولار" },
  housingStarts:{ id: "HOUST",        name: "تصاريح البناء" },
};

const CACHE_6H = 6 * 3600 * 1000;
const _cache = new Map<string, { data: HistoricalSeries; ts: number }>();

async function fetchFREDSeries(
  seriesId: string,
  name: string,
  limit = 60,
): Promise<HistoricalSeries | null> {
  const cacheKey = `${seriesId}-${limit}`;
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_6H) return cached.data;

  const key = process.env.FRED_API_KEY;
  if (!key) return null;

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&limit=${limit}&sort_order=desc&file_type=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const json = await res.json() as {
      observations: Array<{ date: string; value: string }>;
    };

    const points: TimeSeriesPoint[] = json.observations
      .filter((o) => o.value !== "." && !isNaN(Number(o.value)))
      .map((o) => ({ date: o.date, value: Number(o.value) }))
      .reverse();

    if (points.length < 4) return null;

    const latest       = points[points.length - 1].value;
    const oneYearAgo   = points[Math.max(0, points.length - 13)]?.value ?? latest;
    const fiveYearsAgo = points[Math.max(0, points.length - 61)]?.value ?? latest;

    const changeFrom1Y = ((latest - oneYearAgo)   / Math.abs(oneYearAgo))   * 100;
    const changeFrom5Y = ((latest - fiveYearsAgo) / Math.abs(fiveYearsAgo)) * 100;

    // Linear regression over last 12 points
    const recent = points.slice(-12);
    const n     = recent.length;
    const sumX  = recent.reduce((s, _, i) => s + i, 0);
    const sumY  = recent.reduce((s, p) => s + p.value, 0);
    const sumXY = recent.reduce((s, p, i) => s + i * p.value, 0);
    const sumX2 = recent.reduce((s, _, i) => s + i * i, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    const avgValue        = sumY / n;
    const normalizedSlope = avgValue !== 0 ? (slope / Math.abs(avgValue)) * 100 : 0;

    const trend: HistoricalSeries["trend"] =
      normalizedSlope > 0.5 ? "rising" : normalizedSlope < -0.5 ? "falling" : "stable";
    const trendStrength = Math.min(100, Math.abs(normalizedSlope) * 10);

    const result: HistoricalSeries = {
      seriesId,
      name,
      data: points.slice(-24),
      latestValue: latest,
      changeFrom1YearAgo: changeFrom1Y,
      changeFrom5YearsAgo: changeFrom5Y,
      trend,
      trendStrength,
    };

    _cache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch {
    return null;
  }
}

function forecastNextPeriods(series: HistoricalSeries, periods = 3): number[] {
  const values = series.data.map((p) => p.value);
  if (values.length < 6) return [];

  const mean    = values.reduce((s, v) => s + v, 0) / values.length;
  const n       = values.length;
  const sumX    = values.reduce((s, _, i) => s + i, 0);
  const sumY    = values.reduce((s, v) => s + v, 0);
  const sumXY   = values.reduce((s, v, i) => s + i * v, 0);
  const sumX2   = values.reduce((s, _, i) => s + i * i, 0);
  const slope   = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const latest = values[values.length - 1];
  const meanReversionStrength = 0.3;
  const forecasts: number[] = [];

  for (let i = 1; i <= periods; i++) {
    const trendForecast = intercept + slope * (n - 1 + i);
    const deviation     = latest - mean;
    const meanRevAdj    = -deviation * meanReversionStrength * (i / periods);
    forecasts.push(trendForecast + meanRevAdj);
  }
  return forecasts;
}

export interface RealEconomicForecast {
  fedFundsRate: {
    current: number;
    forecast3M: number;
    trend: string;
    arabicSummary: string;
  };
  inflation: {
    current: number;
    yoyChange: number;
    forecast3M: number;
    trend: string;
    arabicSummary: string;
  };
  unemployment: {
    current: number;
    yoyChange: number;
    forecast3M: number;
    trend: string;
    arabicSummary: string;
  };
  yieldCurve: {
    yield10y: number;
    yield2y: number;
    spread: number;
    inverted: boolean;
    arabicSummary: string;
  };
  dollarIndex: {
    current: number;
    trend: string;
    arabicSummary: string;
  };
  overallForecastSummary: string;
  dataConfidence: number;
}

export async function buildRealEconomicForecast(): Promise<RealEconomicForecast | null> {
  const [fedFunds, cpi, unemployment, yield10y, yield2y, dollar] =
    await Promise.all([
      fetchFREDSeries(FRED_SERIES.fedFunds.id,     FRED_SERIES.fedFunds.name,     60),
      fetchFREDSeries(FRED_SERIES.cpi.id,          FRED_SERIES.cpi.name,          60),
      fetchFREDSeries(FRED_SERIES.unemployment.id, FRED_SERIES.unemployment.name, 60),
      fetchFREDSeries(FRED_SERIES.yield10y.id,     FRED_SERIES.yield10y.name,     60),
      fetchFREDSeries(FRED_SERIES.yield2y.id,      FRED_SERIES.yield2y.name,      60),
      fetchFREDSeries(FRED_SERIES.dollarIndex.id,  FRED_SERIES.dollarIndex.name,  60),
    ]);

  if (!fedFunds || !cpi || !unemployment) return null;

  const fedForecast  = forecastNextPeriods(fedFunds, 3);
  const cpiForecast  = forecastNextPeriods(cpi, 3);
  const unempForecast = forecastNextPeriods(unemployment, 3);

  const cpiNow      = cpi.latestValue;
  const cpiYearAgo  = cpi.data[Math.max(0, cpi.data.length - 13)]?.value ?? cpiNow;
  const yoyInflation = ((cpiNow - cpiYearAgo) / cpiYearAgo) * 100;

  const y10    = yield10y?.latestValue ?? 4.5;
  const y2     = yield2y?.latestValue  ?? 4.8;
  const spread = y10 - y2;
  const inverted = spread < 0;

  const dollarCurrent = dollar?.latestValue ?? 100;
  const dollarTrend   = dollar?.trend ?? "stable";

  const loadedCount = [fedFunds, cpi, unemployment, yield10y, yield2y, dollar]
    .filter(Boolean).length;
  const dataConfidence = Math.round((loadedCount / 6) * 100);

  const overallForecastSummary = `=== التوقعات الاقتصادية المبنية على بيانات FRED التاريخية ===

الفائدة الأمريكية:
- الحالية: ${fedFunds.latestValue.toFixed(2)}%
- التوقع خلال 3 أشهر: ${fedForecast[2]?.toFixed(2) ?? "غير متاح"}%
- الاتجاه: ${fedFunds.trend === "rising" ? "صاعد" : fedFunds.trend === "falling" ? "هابط" : "مستقر"}

التضخم (CPI):
- التغير السنوي: ${yoyInflation.toFixed(2)}%
- الاتجاه: ${cpi.trend === "rising" ? "متصاعد ⚠️" : cpi.trend === "falling" ? "متراجع ✅" : "مستقر"}

البطالة:
- الحالية: ${unemployment.latestValue.toFixed(1)}%
- التوقع خلال 3 أشهر: ${unempForecast[2]?.toFixed(1) ?? "غير متاح"}%

منحنى العائد:
- 10 سنوات: ${y10.toFixed(2)}% | سنتان: ${y2.toFixed(2)}%
- الفارق: ${spread.toFixed(2)}%
- ${inverted ? "⚠️ منحنى مقلوب — إشارة ركود تاريخياً" : "✅ منحنى طبيعي"}

مؤشر الدولار: ${dollarCurrent.toFixed(1)} (${dollarTrend === "rising" ? "قوي" : dollarTrend === "falling" ? "ضعيف" : "مستقر"})

ثقة التحليل: ${dataConfidence}% (بناءً على ${loadedCount}/6 مصادر FRED)`.trim();

  return {
    fedFundsRate: {
      current: fedFunds.latestValue,
      forecast3M: fedForecast[2] ?? fedFunds.latestValue,
      trend: fedFunds.trend,
      arabicSummary: `الفائدة ${fedFunds.latestValue.toFixed(2)}% — توقع: ${fedForecast[2]?.toFixed(2) ?? "مستقر"}%`,
    },
    inflation: {
      current: cpi.latestValue,
      yoyChange: yoyInflation,
      forecast3M: cpiForecast[2] ?? cpi.latestValue,
      trend: cpi.trend,
      arabicSummary: `التضخم السنوي ${yoyInflation.toFixed(2)}% — ${cpi.trend === "rising" ? "متصاعد" : cpi.trend === "falling" ? "متراجع" : "مستقر"}`,
    },
    unemployment: {
      current: unemployment.latestValue,
      yoyChange: unemployment.changeFrom1YearAgo,
      forecast3M: unempForecast[2] ?? unemployment.latestValue,
      trend: unemployment.trend,
      arabicSummary: `البطالة ${unemployment.latestValue.toFixed(1)}% — توقع: ${unempForecast[2]?.toFixed(1) ?? "مستقر"}%`,
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
      current: dollarCurrent,
      trend: dollarTrend,
      arabicSummary: `الدولار ${dollarCurrent.toFixed(1)} — ${dollarTrend === "rising" ? "قوي يضغط على الأسواق الناشئة" : dollarTrend === "falling" ? "ضعيف يدعم السلع والناشئة" : "مستقر"}`,
    },
    overallForecastSummary,
    dataConfidence,
  };
}
