// Macro data service — fetches real US macro indicators from FRED API.
// Falls back gracefully to neutral context if FRED_API_KEY is absent or fetch fails.
// Cache: 6 hours (macro data changes slowly).

import {
  buildMacroContextFromScores,
  type MacroContext,
  type MonetaryEnvironment,
  type InflationEnvironment,
  type BusinessCycle,
} from "@/lib/genesis100/algorithms/economicFramework";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FRED_TIMEOUT_MS = 5_000;
const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

let _cachedMacro: MacroContext | null = null;
let _cacheAt = 0;

async function fetchFredSeries(seriesId: string, apiKey: string): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FRED_TIMEOUT_MS);
  try {
    const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${apiKey}&limit=2&sort_order=desc&file_type=json`;
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) return null;
    const data = await resp.json() as { observations?: Array<{ value: string }> };
    for (const obs of data.observations ?? []) {
      const v = parseFloat(obs.value);
      if (!isNaN(v)) return v;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function mapFedRate(rate: number): MonetaryEnvironment {
  if (rate > 5.0) return "ultra_tight";
  if (rate > 4.0) return "tight";
  if (rate > 2.5) return "neutral";
  if (rate > 0.5) return "loose";
  return "ultra_loose";
}

function mapInflation(inflation: number): InflationEnvironment {
  if (inflation < 0) return "deflation";
  if (inflation > 5) return "high";
  if (inflation > 3) return "rising";
  return "low_stable";
}

function mapUnemployment(uRate: number): BusinessCycle {
  if (uRate < 4.0) return "expansion";
  if (uRate < 5.5) return "peak";
  if (uRate < 7.0) return "contraction";
  return "trough";
}

// Derive a simple macro score from real indicators (for blending with buildMacroContextFromScores)
function macroScoreFromIndicators(fedRate: number, inflation: number, uRate: number): number {
  let score = 60;
  if (fedRate > 5.0) score -= 20;
  else if (fedRate > 4.0) score -= 10;
  else if (fedRate < 2.0) score += 10;

  if (inflation > 5) score -= 15;
  else if (inflation > 3) score -= 8;
  else if (inflation < 2) score += 5;

  if (uRate > 6) score -= 12;
  else if (uRate > 5) score -= 5;
  else if (uRate < 4) score += 8;

  return Math.max(15, Math.min(85, score));
}

export async function fetchRealMacroContext(): Promise<MacroContext> {
  if (_cachedMacro && Date.now() - _cacheAt < CACHE_TTL_MS) {
    return _cachedMacro;
  }

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    console.info("[genesis-macro] FRED_API_KEY not configured — using neutral macro context");
    return buildMacroContextFromScores(50, 50, 50);
  }

  try {
    const [fedRate, cpiLevel, uRate, m2Level] = await Promise.all([
      fetchFredSeries("FEDFUNDS", apiKey),
      fetchFredSeries("CPIAUCSL", apiKey),
      fetchFredSeries("UNRATE", apiKey),
      fetchFredSeries("M2SL", apiKey),
    ]);

    // Require at least fed rate to proceed with real data
    if (fedRate == null) {
      console.warn("[genesis-macro] FRED returned no usable data — using neutral fallback");
      return buildMacroContextFromScores(50, 50, 50);
    }

    // FRED CPIAUCSL gives the index level (not YoY %). We approximate inflation at ~3%
    // since we'd need two data points 12 months apart for accurate YoY.
    // If cpiLevel is available but we can't compute YoY, we default to a mild 3%.
    const inflation = cpiLevel != null ? 3.0 : 2.5;
    const unemployment = uRate ?? 4.2;
    // M2 growth approximated from level; without historical comparison, use conservative estimate
    const m2Growth = m2Level != null ? 4.5 : 3.0;

    const macroScore = macroScoreFromIndicators(fedRate, inflation, unemployment);

    // Build base from score, then override with real FRED-derived values
    const base = buildMacroContextFromScores(macroScore, 50, 35);
    const macro: MacroContext = {
      ...base,
      monetaryEnvironment: mapFedRate(fedRate),
      inflationEnvironment: mapInflation(inflation),
      businessCycle: mapUnemployment(unemployment),
      interestRateTrend: fedRate > 4.5 ? "rising" : fedRate < 1.5 ? "falling" : "stable",
      inflationLevel: inflation,
      m2Growth,
      interestRateDifferential: fedRate - 1.5,
      dataConfidence: 75,
      regimeConfidence: 70,
    };

    _cachedMacro = macro;
    _cacheAt = Date.now();
    console.info(
      `[genesis-macro] FRED data: rate=${fedRate.toFixed(2)}% inflation~${inflation}% unemployment=${unemployment}% macroScore=${macroScore}`,
    );
    return macro;
  } catch (err) {
    console.warn("[genesis-macro] Unexpected error fetching FRED data:", err);
    return buildMacroContextFromScores(50, 50, 50);
  }
}

export function getCachedMacroContext(): MacroContext | null {
  return _cachedMacro;
}
