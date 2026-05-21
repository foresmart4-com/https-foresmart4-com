import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AlpacaRawAccount = Record<string, string | boolean | null | undefined>;
type AlpacaRawPosition = Record<string, string | null | undefined>;
type AlpacaRawOrder = Record<string, string | null | undefined>;

export interface AlpacaPortfolioSnapshot {
  account: {
    status: string;
    currency: string;
    portfolioValue: number;
    cash: number;
    buyingPower: number;
  };
  positions: Array<{
    symbol: string;
    qty: number;
    marketValue: number;
    avgEntryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
  }>;
  orders: Array<{
    id: string;
    symbol: string;
    side: string;
    qty: number;
    type: string;
    status: string;
    limitPrice?: number;
    submittedAt?: string;
  }>;
}

export type AlpacaPortfolioResult =
  | { ok: true; status: "connected"; provider: "alpaca"; liveTradingEnabled: false; data: AlpacaPortfolioSnapshot; syncedAt: number }
  | { ok: false; status: "not_configured" | "account_error"; provider: "alpaca"; liveTradingEnabled: false; error: string };

export async function fetchAlpacaPortfolio(): Promise<AlpacaPortfolioResult> {
  const key = process.env.ALPACA_API_KEY || process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_SECRET_KEY || process.env.ALPACA_API_SECRET_KEY;
  const baseUrl = (process.env.ALPACA_BASE_URL || "https://paper-api.alpaca.markets").replace(/\/+$/, "");

  console.log({
    alpacaBaseUrl: baseUrl,
    hasAlpacaKey: !!key,
    hasAlpacaSecret: !!secret,
  });

  if (!key || !secret) {
    return {
      ok: false,
      status: "not_configured",
      provider: "alpaca",
      liveTradingEnabled: false,
      error: "Alpaca credentials are not configured",
    };
  }

  const headers = {
    "APCA-API-KEY-ID": key,
    "APCA-API-SECRET-KEY": secret,
  };

  const getJson = async <T,>(path: string): Promise<{ ok: true; data: T } | { ok: false; status: number; text: string }> => {
    const response = await fetch(`${baseUrl}${path}`, { headers });
    if (!response.ok) {
      return { ok: false, status: response.status, text: await response.text().catch(() => "") };
    }
    return { ok: true, data: (await response.json()) as T };
  };

  const accountResponse = await getJson<AlpacaRawAccount>("/v2/account");
  if (!accountResponse.ok) {
    console.error(`Alpaca account request failed status=${accountResponse.status} body=${accountResponse.text.slice(0, 180)}`);
    return {
      ok: false,
      status: "account_error",
      provider: "alpaca",
      liveTradingEnabled: false,
      error: accountResponse.status === 401 ? "401 Unauthorized" : "Failed to load Alpaca account",
    };
  }

  const [positionsResponse, ordersResponse] = await Promise.all([
    getJson<AlpacaRawPosition[]>("/v2/positions"),
    getJson<AlpacaRawOrder[]>("/v2/orders?status=open&limit=100"),
  ]);

  if (!positionsResponse.ok) {
    console.error(`Alpaca positions request failed status=${positionsResponse.status} body=${positionsResponse.text.slice(0, 180)}`);
  }
  if (!ordersResponse.ok) {
    console.error(`Alpaca orders request failed status=${ordersResponse.status} body=${ordersResponse.text.slice(0, 180)}`);
  }

  const account = accountResponse.data;
  const positions = positionsResponse.ok ? positionsResponse.data : [];
  const orders = ordersResponse.ok ? ordersResponse.data : [];

  return {
    ok: true,
    status: "connected",
    provider: "alpaca",
    liveTradingEnabled: false,
    syncedAt: Date.now(),
    data: {
      account: {
        status: String(account.status ?? ""),
        currency: String(account.currency ?? "USD"),
        portfolioValue: Number(account.portfolio_value ?? account.equity ?? 0),
        cash: Number(account.cash ?? 0),
        buyingPower: Number(account.buying_power ?? 0),
      },
      positions: positions.map((position) => ({
        symbol: String(position.symbol ?? ""),
        qty: Number(position.qty ?? 0),
        marketValue: Number(position.market_value ?? 0),
        avgEntryPrice: Number(position.avg_entry_price ?? 0),
        currentPrice: Number(position.current_price ?? 0),
        unrealizedPnl: Number(position.unrealized_pl ?? 0),
      })),
      orders: orders.map((order) => ({
        id: String(order.id ?? ""),
        symbol: String(order.symbol ?? ""),
        side: String(order.side ?? ""),
        qty: Number(order.qty ?? 0),
        type: String(order.type ?? ""),
        status: String(order.status ?? ""),
        limitPrice: order.limit_price ? Number(order.limit_price) : undefined,
        submittedAt: order.submitted_at ? String(order.submitted_at) : undefined,
      })),
    },
  };
}

export const getAlpacaPortfolio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => fetchAlpacaPortfolio());