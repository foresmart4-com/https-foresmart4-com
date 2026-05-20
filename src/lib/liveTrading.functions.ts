// Phase 2 — live trading server functions. All require auth.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadBrokerCredentials } from "@/services/security/apiVault";
import { BinanceClient, type BinanceMode } from "@/services/broker/binanceRealConnector";
import { buildLiveSnapshot, getRecentSnapshots } from "@/services/live/livePortfolio";
import { fetchOrderBook } from "@/services/live/liveOrderBook";
import { computePerformance } from "@/services/live/livePerformance";
import { runAutonomousCycle } from "@/services/live/liveAutonomousEngine";
import { evaluateLiveRisk, isEmergencyStopActive, recordRiskEvent } from "@/services/live/liveRiskGuard";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Mode = z.enum(["testnet", "live"]).default("live");
const LIVE_TRADING_ENABLED = false;

export interface LiveBinanceBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

async function getClient(userId: string, mode: "testnet" | "live"): Promise<BinanceClient | null> {
  // 1. User-stored creds via vault
  const creds = await loadBrokerCredentials(userId, "binance", mode);
  if (creds) return new BinanceClient(creds, mode);
  // 2. Platform-level keys from env (live only)
  if (mode === "live" && process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET_KEY) {
    return new BinanceClient(
      { apiKey: process.env.BINANCE_API_KEY, apiSecret: process.env.BINANCE_SECRET_KEY },
      "live",
    );
  }
  return null;
}

export const getLiveBrokerRuntime = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const provider = (process.env.BROKER_PROVIDER ?? "binance").trim().toLowerCase();
    const mode: BinanceMode = process.env.BINANCE_MODE === "testnet" ? "testnet" : "live";
    return {
      provider,
      isBinance: provider === "binance",
      mode,
      liveTradingEnabled: LIVE_TRADING_ENABLED,
    };
  });

export const getLiveBinanceBalances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ mode: z.enum(["testnet", "live"]).default("live") }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const provider = (process.env.BROKER_PROVIDER ?? "binance").trim().toLowerCase();
    if (provider !== "binance") {
      return {
        status: "not_configured" as const,
        connected: false as const,
        provider,
        mode: data.mode,
        canTrade: false,
        liveTradingEnabled: LIVE_TRADING_ENABLED,
        balances: [] as LiveBinanceBalance[],
        syncedAt: Date.now(),
      };
    }

    const client = await getClient(context.userId, data.mode);
    if (!client) {
      await auditBrokerSync(context.userId, "error", "missing Binance credentials");
      return {
        status: "error" as const,
        connected: false as const,
        provider,
        mode: data.mode,
        canTrade: false,
        liveTradingEnabled: LIVE_TRADING_ENABLED,
        balances: [] as LiveBinanceBalance[],
        syncedAt: Date.now(),
        error: "Binance credentials not configured",
      };
    }

    try {
      const raw = await client.signedRequest<{
        canTrade: boolean;
        balances: { asset: string; free: string; locked: string }[];
      }>("GET", "/api/v3/account");

      const balances = raw.balances
        .map((balance) => {
          const free = Number(balance.free);
          const locked = Number(balance.locked);
          return { asset: balance.asset, free, locked, total: free + locked };
        })
        .filter((balance) => balance.free > 0 || balance.locked > 0)
        .sort((a, b) => b.total - a.total);

      await auditBrokerSync(context.userId, "ok", `synced ${balances.length} live Binance assets`);

      return {
        status: "connected" as const,
        connected: true as const,
        provider,
        mode: data.mode,
        canTrade: raw.canTrade,
        liveTradingEnabled: LIVE_TRADING_ENABLED,
        balances,
        syncedAt: Date.now(),
      };
    } catch (error) {
      await auditBrokerSync(context.userId, "error", (error as Error).message.slice(0, 180));
      return {
        status: "error" as const,
        connected: false as const,
        provider,
        mode: data.mode,
        canTrade: false,
        liveTradingEnabled: LIVE_TRADING_ENABLED,
        balances: [] as LiveBinanceBalance[],
        syncedAt: Date.now(),
        error: "Unable to reach Binance. Please retry shortly.",
      };
    }
  });

async function auditBrokerSync(userId: string, result: "ok" | "error", note: string): Promise<void> {
  try {
    await supabaseAdmin.from("api_key_audit").insert({
      user_id: userId,
      provider: "binance",
      action: "wallet_live_sync",
      result: `${result}: ${note}`,
    } as never);
  } catch {
    // best-effort audit only
  }
}

export const getLivePortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ mode: Mode }).parse(i))
  .handler(async ({ data, context }) => {
    const client = await getClient(context.userId, data.mode);
    if (!client) return { connected: false as const };
    try {
      const snap = await buildLiveSnapshot(context.userId, client);
      return { connected: true as const, snapshot: snap };
    } catch (err) {
      return { connected: false as const, error: (err as Error).message };
    }
  });

export const getLiveOrderBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    mode: Mode, symbol: z.string().min(5).max(20), limit: z.number().int().min(5).max(100).default(20),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const client = await getClient(context.userId, data.mode);
    if (!client) return { connected: false as const };
    return { connected: true as const, book: await fetchOrderBook(client, data.symbol, data.limit) };
  });

export const getLivePerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ report: await computePerformance(context.userId) }));

export const getPortfolioHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(i))
  .handler(async ({ data, context }) => ({ snapshots: await getRecentSnapshots(context.userId, data.limit) }));

export const previewRiskCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    mode: Mode, symbol: z.string(), side: z.enum(["BUY", "SELL"]),
    notionalUSDT: z.number().positive(), aiConfidence: z.number().min(0).max(100),
    refPrice: z.number().positive(), recentPriceChangePct: z.number().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const client = await getClient(context.userId, data.mode);
    const equity = client ? (await import("@/services/broker/binanceAccount"))
      .getAccountInfo(client).then((a) => a.equityUSDT).catch(() => 0) : Promise.resolve(0);
    const eq = await equity;
    const stopActive = await isEmergencyStopActive(context.userId);
    return evaluateLiveRisk({
      userId: context.userId, symbol: data.symbol, side: data.side,
      notionalUSDT: data.notionalUSDT, equityUSDT: eq, aiConfidence: data.aiConfidence,
      refPrice: data.refPrice, recentPriceChangePct: data.recentPriceChangePct,
      emergencyStopActive: stopActive,
    });
  });

export const executeAutonomousSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    mode: Mode,
    symbol: z.string().min(5).max(20),
    side: z.enum(["BUY", "SELL"]),
    refPrice: z.number().positive(),
    aiConfidence: z.number().min(0).max(100),
    rationale: z.string().max(2000),
    regime: z.string().max(60).optional(),
    recentPriceChangePct: z.number().optional(),
    targetAllocationPct: z.number().min(0.1).max(8).default(3),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const client = await getClient(context.userId, data.mode);
    if (!client) throw new Error("No broker connection configured");
    return runAutonomousCycle(context.userId, client, data);
  });

export const triggerEmergencyStop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ reason: z.string().min(1).max(300) }).parse(i))
  .handler(async ({ data, context }) => {
    await recordRiskEvent(context.userId, "critical", "EMERGENCY_STOP", data.reason, { triggeredBy: "USER" });
    return { ok: true };
  });

export const resumeTrading = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await supabaseAdmin.from("risk_events")
      .update({ resolved_at: new Date().toISOString() } as never)
      .eq("user_id", context.userId).eq("category", "EMERGENCY_STOP").is("resolved_at", null);
    return { ok: true };
  });

export const getLiveStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const stopActive = await isEmergencyStopActive(context.userId);
    const { data: recentDecisions } = await supabaseAdmin
      .from("ai_decisions").select("*").eq("user_id", context.userId)
      .order("created_at", { ascending: false }).limit(10);
    const { data: recentExec } = await supabaseAdmin
      .from("execution_history").select("*").eq("user_id", context.userId)
      .order("created_at", { ascending: false }).limit(10);
    const { data: recentRisk } = await supabaseAdmin
      .from("risk_events").select("*").eq("user_id", context.userId)
      .order("created_at", { ascending: false }).limit(10);
    return {
      emergencyStopActive: stopActive,
      decisions: recentDecisions ?? [],
      executions: recentExec ?? [],
      riskEvents: recentRisk ?? [],
    };
  });
