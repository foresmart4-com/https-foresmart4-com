// Interactive Brokers Client Portal Web API connector.
// Requires a running CP Gateway (https://www.interactivebrokers.com/en/trading/ib-api.php)
// reachable from IBKR_GATEWAY_URL, and a pre-authenticated session.
// No mock data — when the gateway is unreachable or unauthenticated the methods throw.
import {
  BrokerApiError, BrokerConfigError,
  type BrokerAccount, type BrokerOrder, type BrokerPosition, type BrokerQuote,
  type PlaceOrderInput, type StockBroker,
} from "./types";

export interface IbkrConfig {
  baseUrl: string;     // e.g. https://localhost:5000/v1/api  (typical CP Gateway)
  accountId: string;   // IBKR account ID (Uxxxx)
}

export function readIbkrConfig(): IbkrConfig {
  const baseUrl = (process.env.IBKR_GATEWAY_URL ?? "").replace(/\/+$/, "");
  const accountId = process.env.IBKR_ACCOUNT_ID ?? "";
  if (!baseUrl || !accountId) throw new BrokerConfigError("IBKR gateway URL or account ID not configured");
  return { baseUrl, accountId };
}

export class IbkrBroker implements StockBroker {
  public readonly provider = "ibkr" as const;
  constructor(private cfg: IbkrConfig) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BrokerApiError(`IBKR ${path} failed (${res.status}): ${text.slice(0, 200)}`, res.status);
    }
    return (await res.json()) as T;
  }

  async getAccount(): Promise<BrokerAccount> {
    type Summary = Record<string, { amount?: number; value?: string; currency?: string }>;
    const s = await this.request<Summary>(`/portfolio/${encodeURIComponent(this.cfg.accountId)}/summary`);
    const num = (k: string) => Number(s[k]?.amount ?? s[k]?.value ?? 0);
    return {
      provider: "ibkr",
      accountId: this.cfg.accountId,
      status: "active",
      currency: s["netliquidation"]?.currency ?? "USD",
      cash: num("totalcashvalue"),
      equity: num("netliquidation"),
      buyingPower: num("buyingpower"),
      tradingBlocked: false,
    };
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const list = await this.request<Array<Record<string, number | string>>>(
      `/portfolio/${encodeURIComponent(this.cfg.accountId)}/positions/0`,
    );
    return list.map((p) => {
      const qty = Number(p.position ?? 0);
      const avgPrice = Number(p.avgCost ?? 0);
      const marketPrice = Number(p.mktPrice ?? 0);
      const marketValue = Number(p.mktValue ?? qty * marketPrice);
      const unrealizedPnl = Number(p.unrealizedPnl ?? marketValue - qty * avgPrice);
      const cost = qty * avgPrice;
      return {
        symbol: String(p.contractDesc ?? p.ticker ?? ""),
        qty, avgPrice, marketPrice, marketValue, unrealizedPnl,
        unrealizedPnlPct: cost ? (unrealizedPnl / cost) * 100 : 0,
        side: qty >= 0 ? "long" : "short",
      };
    });
  }

  async getOpenOrders(): Promise<BrokerOrder[]> {
    const r = await this.request<{ orders?: Array<Record<string, string | number>> }>(`/iserver/account/orders`);
    return (r.orders ?? []).map((o) => ({
      id: String(o.orderId ?? o.order_id ?? ""),
      symbol: String(o.ticker ?? o.symbol ?? ""),
      side: (String(o.side ?? "").toLowerCase() === "sell" ? "sell" : "buy"),
      type: (String(o.orderType ?? "").toLowerCase() === "lmt" ? "limit" : "market"),
      qty: Number(o.totalSize ?? o.remainingQuantity ?? 0),
      limitPrice: o.price ? Number(o.price) : undefined,
      status: String(o.status ?? "Submitted"),
      filledQty: Number(o.filledQuantity ?? 0),
      submittedAt: Number(o.lastExecutionTime ?? Date.now()),
      updatedAt: Number(o.lastExecutionTime ?? Date.now()),
    }));
  }

  async placeOrder(input: PlaceOrderInput): Promise<BrokerOrder> {
    // IBKR requires a contract ID (conid). Resolve via the search endpoint.
    const search = await this.request<Array<{ conid: number; symbol: string }>>(
      `/iserver/secdef/search?symbol=${encodeURIComponent(input.symbol.toUpperCase())}`,
    );
    const conid = search.find((s) => s.symbol === input.symbol.toUpperCase())?.conid ?? search[0]?.conid;
    if (!conid) throw new BrokerApiError(`IBKR: no contract for ${input.symbol}`);

    const body = {
      orders: [{
        acctId: this.cfg.accountId,
        conid,
        orderType: input.type === "limit" ? "LMT" : "MKT",
        side: input.side.toUpperCase(),
        quantity: input.qty,
        tif: (input.timeInForce ?? "day").toUpperCase(),
        price: input.type === "limit" ? input.limitPrice : undefined,
      }],
    };
    const r = await this.request<Array<{ order_id?: string; id?: string; order_status?: string }>>(
      `/iserver/account/${encodeURIComponent(this.cfg.accountId)}/orders`,
      { method: "POST", body: JSON.stringify(body) },
    );
    const first = r[0] ?? {};
    return {
      id: String(first.order_id ?? first.id ?? ""),
      symbol: input.symbol.toUpperCase(),
      side: input.side, type: input.type, qty: input.qty,
      limitPrice: input.limitPrice,
      status: String(first.order_status ?? "Submitted"),
      filledQty: 0, submittedAt: Date.now(), updatedAt: Date.now(),
    };
  }

  async cancelOrder(id: string): Promise<{ ok: true }> {
    await this.request<unknown>(
      `/iserver/account/${encodeURIComponent(this.cfg.accountId)}/order/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    return { ok: true };
  }

  async getQuote(symbol: string): Promise<BrokerQuote> {
    const search = await this.request<Array<{ conid: number; symbol: string }>>(
      `/iserver/secdef/search?symbol=${encodeURIComponent(symbol.toUpperCase())}`,
    );
    const conid = search.find((s) => s.symbol === symbol.toUpperCase())?.conid ?? search[0]?.conid;
    if (!conid) throw new BrokerApiError(`IBKR: no contract for ${symbol}`);
    const snap = await this.request<Array<Record<string, string | number>>>(
      `/iserver/marketdata/snapshot?conids=${conid}&fields=31,84,86`, // last, bid, ask
    );
    const row = snap[0] ?? {};
    return {
      symbol: symbol.toUpperCase(),
      bid: Number(row["84"] ?? 0),
      ask: Number(row["86"] ?? 0),
      last: Number(row["31"] ?? 0),
      ts: Date.now(),
    };
  }
}
