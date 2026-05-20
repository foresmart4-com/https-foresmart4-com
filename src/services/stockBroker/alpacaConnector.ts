// Alpaca Markets connector — real REST integration. No mock data.
// Docs: https://docs.alpaca.markets/reference
import {
  BrokerApiError, BrokerConfigError,
  type BrokerAccount, type BrokerOrder, type BrokerPosition, type BrokerQuote,
  type PlaceOrderInput, type StockBroker,
} from "./types";

export interface AlpacaConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;   // e.g. https://api.alpaca.markets  or paper-api.alpaca.markets
  dataUrl: string;   // e.g. https://data.alpaca.markets
}

function sanitizeAlpacaUrl(raw: string | undefined, fallback: string): string {
  let v = (raw ?? "").trim();
  if (!v) return fallback;
  // Strip accidental "KEY=" prefix if user pasted the whole env line
  v = v.replace(/^[A-Z_]+\s*=\s*/i, "");
  // Strip surrounding quotes
  v = v.replace(/^["']|["']$/g, "");
  // Drop any path/query — we only want the origin
  try {
    const u = new URL(v);
    return `${u.protocol}//${u.host}`;
  } catch {
    return fallback;
  }
}

function readFirstEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

export function readAlpacaConfig(): AlpacaConfig {
  // Explicit fallback: prefer the user's primary secret names, then Alpaca's *_ID/*_SECRET_KEY aliases.
  const apiKey = readFirstEnv("ALPACA_API_KEY", "ALPACA_API_KEY_ID");
  const apiSecret = readFirstEnv("ALPACA_SECRET_KEY", "ALPACA_API_SECRET_KEY");
  const baseUrl = sanitizeAlpacaUrl(process.env.ALPACA_BASE_URL, "https://paper-api.alpaca.markets");
  const dataUrl = sanitizeAlpacaUrl(process.env.ALPACA_DATA_URL, "https://data.alpaca.markets");

  console.info(`hasKey=${Boolean(apiKey)}`);
  console.info(`hasSecret=${Boolean(apiSecret)}`);
  console.info(`baseUrl=${baseUrl}`);

  if (!apiKey || !apiSecret) throw new BrokerConfigError("Alpaca credentials not configured");
  return { apiKey, apiSecret, baseUrl, dataUrl };
}


export class AlpacaBroker implements StockBroker {
  public readonly provider = "alpaca" as const;
  constructor(private cfg: AlpacaConfig) {}

  private headers(): Record<string, string> {
    return {
      "APCA-API-KEY-ID": this.cfg.apiKey,
      "APCA-API-SECRET-KEY": this.cfg.apiSecret,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(host: "trade" | "data", path: string, init: RequestInit = {}): Promise<T> {
    const base = host === "trade" ? this.cfg.baseUrl : this.cfg.dataUrl;
    const res = await fetch(`${base}${path}`, { ...init, headers: { ...this.headers(), ...(init.headers ?? {}) } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BrokerApiError(`Alpaca ${path} failed (${res.status}): ${text.slice(0, 200)}`, res.status);
    }
    return (await res.json()) as T;
  }

  async getAccount(): Promise<BrokerAccount> {
    const a = await this.request<Record<string, string>>("trade", "/v2/account");
    return {
      provider: "alpaca",
      accountId: a.id,
      status: a.status,
      currency: a.currency ?? "USD",
      cash: Number(a.cash),
      equity: Number(a.equity),
      buyingPower: Number(a.buying_power),
      daytradingBuyingPower: a.daytrading_buying_power ? Number(a.daytrading_buying_power) : undefined,
      patternDayTrader: a.pattern_day_trader === "true" || a.pattern_day_trader === true as unknown as string,
      tradingBlocked: a.trading_blocked === "true" || a.account_blocked === "true",
    };
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const list = await this.request<Array<Record<string, string>>>("trade", "/v2/positions");
    return list.map((p) => {
      const qty = Number(p.qty);
      const avgPrice = Number(p.avg_entry_price);
      const marketPrice = Number(p.current_price);
      const marketValue = Number(p.market_value);
      const unrealizedPnl = Number(p.unrealized_pl);
      const unrealizedPnlPct = Number(p.unrealized_plpc) * 100;
      return {
        symbol: p.symbol, qty, avgPrice, marketPrice, marketValue,
        unrealizedPnl, unrealizedPnlPct,
        side: (p.side as "long" | "short") ?? (qty >= 0 ? "long" : "short"),
      };
    });
  }

  async getOpenOrders(): Promise<BrokerOrder[]> {
    const list = await this.request<Array<Record<string, string>>>("trade", "/v2/orders?status=open&limit=100");
    return list.map(mapAlpacaOrder);
  }

  async placeOrder(input: PlaceOrderInput): Promise<BrokerOrder> {
    const body = {
      symbol: input.symbol.toUpperCase(),
      qty: String(input.qty),
      side: input.side,
      type: input.type,
      time_in_force: input.timeInForce ?? "day",
      limit_price: input.type === "limit" ? input.limitPrice : undefined,
      client_order_id: input.clientOrderId,
    };
    const o = await this.request<Record<string, string>>("trade", "/v2/orders", {
      method: "POST", body: JSON.stringify(body),
    });
    return mapAlpacaOrder(o);
  }

  async cancelOrder(id: string): Promise<{ ok: true }> {
    await this.request<unknown>("trade", `/v2/orders/${encodeURIComponent(id)}`, { method: "DELETE" });
    return { ok: true };
  }

  async getQuote(symbol: string): Promise<BrokerQuote> {
    const sym = symbol.toUpperCase();
    const r = await this.request<{ quote?: { bp: number; ap: number; t: string }; trade?: { p: number; t: string } }>(
      "data", `/v2/stocks/${encodeURIComponent(sym)}/snapshot`,
    );
    const ts = Date.parse(r.trade?.t ?? r.quote?.t ?? new Date().toISOString());
    return {
      symbol: sym,
      bid: Number(r.quote?.bp ?? r.trade?.p ?? 0),
      ask: Number(r.quote?.ap ?? r.trade?.p ?? 0),
      last: Number(r.trade?.p ?? r.quote?.ap ?? 0),
      ts: Number.isFinite(ts) ? ts : Date.now(),
    };
  }
}

function mapAlpacaOrder(o: Record<string, string>): BrokerOrder {
  return {
    id: String(o.id),
    clientOrderId: o.client_order_id ? String(o.client_order_id) : undefined,
    symbol: String(o.symbol),
    side: o.side as "buy" | "sell",
    type: (o.type === "limit" ? "limit" : "market"),
    qty: Number(o.qty),
    limitPrice: o.limit_price ? Number(o.limit_price) : undefined,
    status: String(o.status),
    filledQty: Number(o.filled_qty ?? 0),
    filledAvgPrice: o.filled_avg_price ? Number(o.filled_avg_price) : undefined,
    submittedAt: Date.parse(o.submitted_at ?? o.created_at ?? new Date().toISOString()),
    updatedAt: Date.parse(o.updated_at ?? o.submitted_at ?? new Date().toISOString()),
  };
}
