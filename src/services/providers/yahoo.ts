/**
 * Yahoo Finance fallback — lightweight quote fetcher.
 * No API key required. Used as last-resort for HK/international stocks.
 * Returns structured result, never throws.
 */

export interface YahooQuote {
  symbol: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  currency: string | null;
  exchange: string | null;
  timestamp: number;
  latencyMs: number;
}

export interface YahooError {
  ok: false;
  reason: string;
  message: string;
  translatedSymbol: string;
}

function normalizeHKSymbol(symbol: string): string {
  const s = symbol.toUpperCase().trim();
  if (/^\d{1,4}\.HK$/.test(s)) {
    const num = s.replace(".HK", "");
    return num.padStart(4, "0") + ".HK";
  }
  if (/^\d{5}\.HK$/.test(s)) return s;
  return s;
}

export async function getYahooQuote(symbol: string): Promise<YahooQuote | YahooError> {
  const translated = normalizeHKSymbol(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(translated)}?range=1d&interval=1d`;

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const start = Date.now();
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "ForeSmart/1.0", Accept: "application/json" },
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      return { ok: false, reason: "http_error", message: `Yahoo HTTP ${res.status}`, translatedSymbol: translated };
    }

    const data = await res.json() as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            previousClose?: number;
            currency?: string;
            exchangeName?: string;
            regularMarketVolume?: number;
            regularMarketTime?: number;
          };
        }>;
        error?: { description?: string };
      };
    };

    if (data.chart?.error) {
      return { ok: false, reason: "yahoo_error", message: data.chart.error.description ?? "Yahoo error", translatedSymbol: translated };
    }

    const meta = data.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) {
      return { ok: false, reason: "empty", message: "Yahoo empty price", translatedSymbol: translated };
    }

    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose ?? price;
    const change = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

    return {
      symbol: translated,
      price,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePct * 100) / 100,
      volume: meta.regularMarketVolume ?? null,
      currency: meta.currency ?? "HKD",
      exchange: meta.exchangeName ?? "HKSE",
      timestamp: (meta.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000,
      latencyMs,
    };
  } catch (e) {
    return { ok: false, reason: "network", message: e instanceof Error ? e.message : "network error", translatedSymbol: translated };
  }
}
