// Server functions for real stock broker integration (Alpaca / IBKR).
// LIVE_TRADING_ENABLED is enforced server-side: while false, placeStockOrder
// returns a Preview only and never reaches the broker. No mock data anywhere.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createStockBroker, getStockBrokerRuntime,
  STOCK_LIVE_TRADING_ENABLED, BrokerConfigError, BrokerApiError,
  type BrokerAccount, type BrokerOrder, type BrokerPosition, type StockBrokerProvider,
} from "@/services/stockBroker";
import {
  DEFAULT_STOCK_RISK, evaluateStockOrderRisk, recordStockRiskEvent,
  isStockEmergencyStopActive, getDailyRealizedPnl,
} from "@/services/stockBroker/riskGuard";

type NotConfigured = { ok: false; status: "not_configured"; provider: StockBrokerProvider; liveTradingEnabled: boolean; reason: string };

function notConfigured(): NotConfigured {
  const rt = getStockBrokerRuntime();
  return { ok: false, status: "not_configured", provider: rt.provider, liveTradingEnabled: rt.liveTradingEnabled, reason: rt.reason ?? "Broker not configured" };
}

async function audit(userId: string, action: string, result: "ok" | "error", note: string): Promise<void> {
  try {
    await supabaseAdmin.from("api_key_audit").insert({
      user_id: userId, provider: getStockBrokerRuntime().provider,
      action, result: `${result}: ${note}`.slice(0, 240),
    } as never);
  } catch { /* best-effort */ }
}

export const getStockBrokerRuntimeFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const rt = getStockBrokerRuntime();
    return { ...rt, defaults: DEFAULT_STOCK_RISK };
  });

export const getBrokerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const rt = getStockBrokerRuntime();
    if (!rt.configured) return notConfigured();
    try {
      const broker = createStockBroker();
      const account: BrokerAccount = await broker.getAccount();
      await audit(context.userId, "stock_account_sync", "ok", account.accountId);
      return { ok: true as const, status: "connected" as const, provider: rt.provider, liveTradingEnabled: rt.liveTradingEnabled, account };
    } catch (e) {
      const msg = (e as Error).message;
      await audit(context.userId, "stock_account_sync", "error", msg);
      return { ok: false as const, status: "error" as const, provider: rt.provider, liveTradingEnabled: rt.liveTradingEnabled, reason: msg };
    }
  });

export const getOpenPositions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const rt = getStockBrokerRuntime();
    if (!rt.configured) return notConfigured();
    try {
      const broker = createStockBroker();
      const positions: BrokerPosition[] = await broker.getPositions();
      return { ok: true as const, status: "connected" as const, provider: rt.provider, positions };
    } catch (e) {
      const msg = (e as Error).message;
      await audit(context.userId, "stock_positions_fetch", "error", msg);
      return { ok: false as const, status: "error" as const, provider: rt.provider, reason: msg };
    }
  });

export const getOpenStockOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const rt = getStockBrokerRuntime();
    if (!rt.configured) return notConfigured();
    try {
      const broker = createStockBroker();
      const orders: BrokerOrder[] = await broker.getOpenOrders();
      return { ok: true as const, status: "connected" as const, provider: rt.provider, orders };
    } catch (e) {
      return { ok: false as const, status: "error" as const, provider: rt.provider, reason: (e as Error).message };
    }
  });

export const getBrokerPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const rt = getStockBrokerRuntime();
    if (!rt.configured) return notConfigured();
    try {
      const broker = createStockBroker();
      const [account, positions, orders, dailyPnl, emergencyStop] = await Promise.all([
        broker.getAccount(),
        broker.getPositions(),
        broker.getOpenOrders(),
        getDailyRealizedPnl(context.userId),
        isStockEmergencyStopActive(context.userId),
      ]);
      return {
        ok: true as const,
        status: "connected" as const,
        provider: rt.provider,
        liveTradingEnabled: rt.liveTradingEnabled,
        account, positions, orders,
        risk: { ...DEFAULT_STOCK_RISK, dailyPnlUsd: dailyPnl, emergencyStopActive: emergencyStop },
        syncedAt: Date.now(),
      };
    } catch (e) {
      const msg = (e as Error).message;
      await audit(context.userId, "stock_portfolio_fetch", "error", msg);
      return { ok: false as const, status: "error" as const, provider: rt.provider, reason: msg };
    }
  });

const OrderInput = z.object({
  symbol: z.string().min(1).max(10).regex(/^[A-Za-z.\-]+$/),
  side: z.enum(["buy", "sell"]),
  type: z.enum(["market", "limit"]),
  qty: z.number().positive().max(100_000),
  limitPrice: z.number().positive().max(1_000_000).optional(),
  timeInForce: z.enum(["day", "gtc"]).default("day"),
}).refine((d) => d.type !== "limit" || typeof d.limitPrice === "number", {
  message: "limitPrice required for limit orders", path: ["limitPrice"],
});

export const placeStockOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OrderInput.parse(i))
  .handler(async ({ data, context }) => {
    const rt = getStockBrokerRuntime();
    if (!rt.configured) return notConfigured();

    let refPrice = data.limitPrice ?? 0;
    let broker;
    try {
      broker = createStockBroker();
      if (!refPrice) {
        const q = await broker.getQuote(data.symbol);
        refPrice = q.last || q.ask || q.bid || 0;
      }
    } catch (e) {
      const msg = (e as Error).message;
      await audit(context.userId, "stock_quote_fetch", "error", msg);
      return { ok: false as const, status: "error" as const, provider: rt.provider, reason: msg };
    }

    if (!refPrice) {
      return { ok: false as const, status: "error" as const, provider: rt.provider, reason: "Reference price unavailable" };
    }

    const risk = await evaluateStockOrderRisk({
      userId: context.userId,
      order: { ...data, symbol: data.symbol.toUpperCase() },
      refPrice,
    });

    // Preview branch — always when live trading is disabled
    if (!STOCK_LIVE_TRADING_ENABLED || !risk.allowed) {
      const reason = risk.allowed ? "LIVE_TRADING_ENABLED=false — preview only" : (risk.reason ?? "rejected");
      await audit(context.userId, "stock_order_preview", risk.allowed ? "ok" : "error", reason);
      return {
        ok: true as const,
        status: "preview" as const,
        provider: rt.provider,
        liveTradingEnabled: rt.liveTradingEnabled,
        order: {
          symbol: data.symbol.toUpperCase(), side: data.side, type: data.type, qty: data.qty,
          limitPrice: data.limitPrice, refPrice, notionalUsd: risk.notionalUsd,
        },
        risk,
        reason,
      };
    }

    // Live execution path (only when STOCK_LIVE_TRADING_ENABLED is true server-side)
    try {
      const placed = await broker!.placeOrder({
        symbol: data.symbol.toUpperCase(),
        side: data.side, type: data.type, qty: data.qty,
        limitPrice: data.limitPrice, timeInForce: data.timeInForce,
        clientOrderId: `fs-${context.userId.slice(0, 8)}-${Date.now()}`,
      });
      await supabaseAdmin.from("execution_history").insert({
        user_id: context.userId, broker: rt.provider, mode: "live",
        symbol: placed.symbol, type: placed.type, side: placed.side,
        quantity: placed.qty, price: placed.filledAvgPrice ?? data.limitPrice ?? refPrice,
        status: placed.status, order_id: placed.id,
        metadata: { source: "stock-broker", refPrice, notionalUsd: risk.notionalUsd },
      } as never);
      await audit(context.userId, "stock_order_place", "ok", `${placed.id}/${placed.status}`);
      return { ok: true as const, status: "placed" as const, provider: rt.provider, liveTradingEnabled: rt.liveTradingEnabled, order: placed, risk };
    } catch (e) {
      const msg = (e as Error).message;
      await audit(context.userId, "stock_order_place", "error", msg);
      await recordStockRiskEvent(context.userId, "warning", "STOCK_ORDER_FAILED", msg, { symbol: data.symbol });
      const code = e instanceof BrokerApiError ? e.status : e instanceof BrokerConfigError ? 400 : 500;
      return { ok: false as const, status: "error" as const, provider: rt.provider, reason: msg, code };
    }
  });

export const cancelStockOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ orderId: z.string().min(1).max(80) }).parse(i))
  .handler(async ({ data, context }) => {
    const rt = getStockBrokerRuntime();
    if (!rt.configured) return notConfigured();
    if (!STOCK_LIVE_TRADING_ENABLED) {
      return { ok: false as const, status: "disabled" as const, provider: rt.provider, reason: "LIVE_TRADING_ENABLED=false" };
    }
    try {
      const broker = createStockBroker();
      await broker.cancelOrder(data.orderId);
      await audit(context.userId, "stock_order_cancel", "ok", data.orderId);
      return { ok: true as const, status: "canceled" as const, provider: rt.provider };
    } catch (e) {
      const msg = (e as Error).message;
      await audit(context.userId, "stock_order_cancel", "error", msg);
      return { ok: false as const, status: "error" as const, provider: rt.provider, reason: msg };
    }
  });

export const triggerStockEmergencyStop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ reason: z.string().min(1).max(300) }).parse(i))
  .handler(async ({ data, context }) => {
    await recordStockRiskEvent(context.userId, "critical", "EMERGENCY_STOP", data.reason, { source: "stocks" });
    return { ok: true as const };
  });

export const resumeStockTrading = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await supabaseAdmin.from("risk_events")
      .update({ resolved_at: new Date().toISOString() } as never)
      .eq("user_id", context.userId)
      .eq("category", "EMERGENCY_STOP")
      .is("resolved_at", null);
    return { ok: true as const };
  });
