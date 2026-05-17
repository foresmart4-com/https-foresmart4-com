// Market data engine — mock live prices + derived metrics
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
}

const BASE: Record<AssetKey, { name: string; price: number; vol: number }> = {
  BTC: { name: "Bitcoin", price: 71420, vol: 2.8 },
  ETH: { name: "Ethereum", price: 3842, vol: 3.1 },
  XAU: { name: "Gold", price: 2418, vol: 0.9 },
  SPX: { name: "S&P 500", price: 5483, vol: 0.7 },
  NDX: { name: "Nasdaq 100", price: 19234, vol: 1.1 },
  OIL: { name: "Crude Oil", price: 82.14, vol: 1.8 },
  DXY: { name: "US Dollar Index", price: 104.27, vol: 0.3 },
};

const _state = new Map<AssetKey, MarketQuote>();

function rand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function buildHistory(base: number, vol: number, seed: number): number[] {
  return Array.from({ length: 24 }, (_, i) => {
    const drift = Math.sin((i + seed) / 4) * vol;
    const noise = (rand(seed + i) - 0.5) * vol;
    return +(base * (1 + (drift + noise) / 100)).toFixed(4);
  });
}

export async function fetchQuote(key: AssetKey): Promise<MarketQuote> {
  const cfg = BASE[key];
  const prev = _state.get(key);
  const seed = Date.now() / 1000 + key.charCodeAt(0);
  const drift = (rand(seed) - 0.5) * cfg.vol;
  const price = +(prev ? prev.price * (1 + drift / 100) : cfg.price * (1 + drift / 100)).toFixed(4);
  const prevClose = prev ? prev.prevClose : cfg.price;
  const changePct = +(((price - prevClose) / prevClose) * 100).toFixed(2);
  const history = prev ? [...prev.history.slice(1), price] : buildHistory(price, cfg.vol, seed);
  const momentum = +(((history[history.length - 1] - history[0]) / history[0]) * 100).toFixed(2);
  const trend: MarketQuote["trend"] = momentum > 0.15 ? "up" : momentum < -0.15 ? "down" : "flat";
  const volatility = Math.min(100, Math.round(Math.abs(changePct) * 12 + cfg.vol * 10));

  const q: MarketQuote = {
    key, name: cfg.name, price, prevClose, changePct,
    volatility, momentum, trend, history, updatedAt: Date.now(),
  };
  _state.set(key, q);
  return q;
}

export async function fetchAllQuotes(keys?: AssetKey[]): Promise<MarketQuote[]> {
  const list = keys ?? (Object.keys(BASE) as AssetKey[]);
  return Promise.all(list.map(fetchQuote));
}
