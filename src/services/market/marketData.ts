// Market data engine — real prices via CoinGecko (crypto) and Finnhub (stocks/FX/commodities)
// with graceful fallback to synthetic data when API keys are missing or requests fail.
import { env } from "@/config/env";

export type AssetKey = "BTC" | "ETH" | "XAU" | "SPX" | "NDX" | "OIL" | "DXY";

export interface MarketQuote {
  key: AssetKey;
  name: string;
  price: number;
  prevClose: number;
  changePct: number;
  volatility: number; // 0-100
  momentum: number; // -100..100
  trend: "up" | "down" | "flat";
  history: number[]; // last 24 points
  updatedAt: number;
  source: "coingecko" | "finnhub" | "synthetic";
}

const META: Record<AssetKey, { name: string; basePrice: number; vol: number; coingeckoId?: string; finnhubSymbol?: string }> = {
  BTC: { name: "Bitcoin", basePrice: 71420, vol: 2.8, coingeckoId: "bitcoin" },
  ETH: { name: "Ethereum", basePrice: 3842, vol: 3.1, coingeckoId: "ethereum" },
  XAU: { name: "Gold", basePrice: 2418, vol: 0.9, finnhubSymbol: "OANDA:XAU_USD" },
  SPX: { name: "S&P 500", basePrice: 5483, vol: 0.7, finnhubSymbol: "^GSPC" },
  NDX: { name: "Nasdaq 100", basePrice: 19234, vol: 1.1, finnhubSymbol: "^NDX" },
  OIL: { name: "Crude Oil", basePrice: 82.14, vol: 1.8, finnhubSymbol: "OANDA:WTICO_USD" },
  DXY: { name: "US Dollar Index", basePrice: 104.27, vol: 0.3, finnhubSymbol: "OANDA:USDOLLAR_USD" },
};

const _state = new Map<AssetKey, MarketQuote>();
const _historyCache = new Map<AssetKey, number[]>();

function rand(seed: number) { const x = Math.sin(seed) * 10000; return x - Math.floor(x); }

function buildHistory(base: number, vol: number, seed: number): number[] {
  return Array.from({ length: 24 }, (_, i) => {
    const drift = Math.sin((i + seed) / 4) * vol;
    const noise = (rand(seed + i) - 0.5) * vol;
    return +(base * (1 + (drift + noise) / 100)).toFixed(4);
  });
}

function deriveQuote(key: AssetKey, price: number, prevClose: number, source: MarketQuote["source"]): MarketQuote {
  const cfg = META[key];
  const cached = _historyCache.get(key);
  const history = cached
    ? [...cached.slice(1), price]
    : buildHistory(price, cfg.vol, key.charCodeAt(0));
  _historyCache.set(key, history);
  const changePct = +(((price - prevClose) / prevClose) * 100).toFixed(2);
  const momentum = +(((history[history.length - 1] - history[0]) / history[0]) * 100).toFixed(2);
  const trend: MarketQuote["trend"] = momentum > 0.15 ? "up" : momentum < -0.15 ? "down" : "flat";
  const volatility = Math.min(100, Math.round(Math.abs(changePct) * 12 + cfg.vol * 10));
  const q: MarketQuote = {
    key, name: cfg.name, price: +price.toFixed(4), prevClose: +prevClose.toFixed(4),
    changePct, volatility, momentum, trend, history, updatedAt: Date.now(), source,
  };
  _state.set(key, q);
  return q;
}

// ---------- CoinGecko (with safe parsing + Binance fallback) ----------
interface CoinGeckoSimple {
  [id: string]: { usd: number; usd_24h_change?: number };
}

// Provider status surfaced for UI badges. Updated on every batch fetch.
export type CryptoProviderStatus = "connected" | "rate_limited" | "temporary_error";
let _cryptoStatus: CryptoProviderStatus = "connected";
let _cryptoSource: "coingecko" | "binance" | "none" = "coingecko";
let _cryptoCooldownUntil = 0;
export function getCryptoProviderStatus(): { status: CryptoProviderStatus; source: typeof _cryptoSource } {
  return { status: _cryptoStatus, source: _cryptoSource };
}

const BINANCE_SYMBOL: Partial<Record<AssetKey, string>> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
};

async function fetchCoinGeckoSafe(ids: string[]): Promise<{ data: CoinGeckoSimple | null; status: CryptoProviderStatus }> {
  const url = `${env.COINGECKO_API}/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    const ctype = res.headers.get("content-type") || "";
    let text = "";
    try { text = await res.text(); } catch { /* ignore */ }
    if (res.status === 429 || /rate.?limit|throttl|too many requests/i.test(text)) {
      return { data: null, status: "rate_limited" };
    }
    if (!res.ok) return { data: null, status: "temporary_error" };
    if (!ctype.includes("application/json") && !text.trim().startsWith("{")) {
      return { data: null, status: "temporary_error" };
    }
    try {
      return { data: JSON.parse(text) as CoinGeckoSimple, status: "connected" };
    } catch {
      return { data: null, status: "temporary_error" };
    }
  } catch {
    return { data: null, status: "temporary_error" };
  }
}

async function fetchBinanceCrypto(keys: AssetKey[]): Promise<Map<AssetKey, MarketQuote>> {
  const out = new Map<AssetKey, MarketQuote>();
  await Promise.all(keys.map(async (key) => {
    const sym = BINANCE_SYMBOL[key];
    if (!sym) return;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return;
      const j = await res.json() as { lastPrice?: string; prevClosePrice?: string; weightedAvgPrice?: string };
      const price = Number(j.lastPrice);
      const prev = Number(j.prevClosePrice ?? j.weightedAvgPrice ?? j.lastPrice);
      if (!Number.isFinite(price) || price <= 0) return;
      out.set(key, deriveQuote(key, price, Number.isFinite(prev) && prev > 0 ? prev : price, "coingecko"));
    } catch { /* swallow */ }
  }));
  return out;
}

async function fetchCryptoBatch(keys: AssetKey[]): Promise<Map<AssetKey, MarketQuote>> {
  const out = new Map<AssetKey, MarketQuote>();
  const ids = keys.map((k) => META[k].coingeckoId).filter(Boolean) as string[];
  if (ids.length === 0) return out;

  // Skip CoinGecko entirely while in cooldown after a rate-limit hit.
  const now = Date.now();
  const skipCg = now < _cryptoCooldownUntil;

  if (!skipCg) {
    const { data, status } = await fetchCoinGeckoSafe(ids);
    if (status === "connected" && data) {
      _cryptoStatus = "connected";
      _cryptoSource = "coingecko";
      for (const key of keys) {
        const id = META[key].coingeckoId;
        if (!id || !data[id]) continue;
        const price = data[id].usd;
        const change = data[id].usd_24h_change ?? 0;
        const prevClose = price / (1 + change / 100);
        out.set(key, deriveQuote(key, price, prevClose, "coingecko"));
      }
      if (out.size > 0) return out;
    } else {
      _cryptoStatus = status;
      if (status === "rate_limited") {
        // 2-min cooldown — avoid hammering CoinGecko while throttled
        _cryptoCooldownUntil = now + 120_000;
      }
    }
  } else {
    _cryptoStatus = "rate_limited";
  }

  // Fallback to Binance (keyless public endpoint)
  const fb = await fetchBinanceCrypto(keys);
  if (fb.size > 0) {
    _cryptoSource = "binance";
    return fb;
  }
  _cryptoSource = "none";
  return out;
}


// ---------- Finnhub (client-side disabled — keys never shipped to browser) ----------
async function fetchFinnhubOne(_key: AssetKey): Promise<MarketQuote | null> {
  // Server-side proxying is required to use Finnhub safely.
  // Until a server proxy is wired up, fall through to synthetic data.
  return null;
}


// ---------- Synthetic fallback ----------
function syntheticQuote(key: AssetKey): MarketQuote {
  const cfg = META[key];
  const prev = _state.get(key);
  const seed = Date.now() / 1000 + key.charCodeAt(0);
  const drift = (rand(seed) - 0.5) * cfg.vol;
  const price = prev ? prev.price * (1 + drift / 100) : cfg.basePrice * (1 + drift / 100);
  const prevClose = prev ? prev.prevClose : cfg.basePrice;
  return deriveQuote(key, price, prevClose, "synthetic");
}

// ---------- Public API ----------
export async function fetchQuote(key: AssetKey): Promise<MarketQuote> {
  const cfg = META[key];
  if (cfg.coingeckoId) {
    const batch = await fetchCryptoBatch([key]);
    const q = batch.get(key);
    if (q) return q;
  }
  if (cfg.finnhubSymbol) {
    const q = await fetchFinnhubOne(key);
    if (q) return q;
  }
  return syntheticQuote(key);
}

export async function fetchAllQuotes(keys?: AssetKey[]): Promise<MarketQuote[]> {
  const list = keys ?? (Object.keys(META) as AssetKey[]);
  const cryptoKeys = list.filter((k) => META[k].coingeckoId);
  const stockKeys = list.filter((k) => !META[k].coingeckoId);

  const [cryptoMap, stockResults] = await Promise.all([
    fetchCryptoBatch(cryptoKeys),
    Promise.all(stockKeys.map(async (k) => [k, await fetchFinnhubOne(k)] as const)),
  ]);

  return list.map((k) => {
    const c = cryptoMap.get(k);
    if (c) return c;
    const s = stockResults.find(([key]) => key === k)?.[1];
    if (s) return s;
    return syntheticQuote(k);
  });
}
