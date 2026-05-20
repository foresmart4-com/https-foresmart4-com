// Binance live balances — server-only. Uses env-secret BINANCE_API_KEY/SECRET.
// Never exposes secret material to the client. Read-only: no order placement here.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BinanceClient, type BinanceMode } from "@/services/broker/binanceRealConnector";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LIVE_TRADING_ENABLED = false; // hard-disabled — analytics only

export interface BinanceBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

export interface BinanceBalancesResult {
  status: "connected" | "error";
  mode: BinanceMode;
  canTrade: boolean;
  liveTradingEnabled: boolean;
  balances: BinanceBalance[];
  syncedAt: number;
  error?: string;
}

export const getBinanceBalances = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BinanceBalancesResult> => {
    const apiKey = process.env.BINANCE_API_KEY;
    const apiSecret = process.env.BINANCE_SECRET_KEY;
    const mode: BinanceMode = (process.env.BINANCE_MODE as BinanceMode) ?? "live";

    if (!apiKey || !apiSecret) {
      await audit(context.userId, "error", "missing-credentials");
      return {
        status: "error", mode, canTrade: false, liveTradingEnabled: LIVE_TRADING_ENABLED,
        balances: [], syncedAt: Date.now(), error: "Binance credentials not configured",
      };
    }

    try {
      const client = new BinanceClient({ apiKey, apiSecret }, mode);
      const raw = await client.signedRequest<{
        canTrade: boolean;
        balances: { asset: string; free: string; locked: string }[];
      }>("GET", "/api/v3/account");

      const balances: BinanceBalance[] = raw.balances
        .map((b) => {
          const free = Number(b.free);
          const locked = Number(b.locked);
          return { asset: b.asset, free, locked, total: free + locked };
        })
        .filter((b) => b.total > 0)
        .sort((a, b) => b.total - a.total);

      await audit(context.userId, "ok", `synced ${balances.length} assets`);

      return {
        status: "connected", mode, canTrade: raw.canTrade,
        liveTradingEnabled: LIVE_TRADING_ENABLED, balances, syncedAt: Date.now(),
      };
    } catch (err) {
      const msg = (err as Error).message || "Unknown error";
      await audit(context.userId, "error", msg.slice(0, 200));
      return {
        status: "error", mode, canTrade: false, liveTradingEnabled: LIVE_TRADING_ENABLED,
        balances: [], syncedAt: Date.now(),
        error: "Unable to reach Binance. Please retry shortly.",
      };
    }
  });

async function audit(userId: string, result: "ok" | "error", note: string): Promise<void> {
  try {
    await supabaseAdmin.from("api_key_audit").insert({
      user_id: userId,
      provider: "binance",
      action: "sync",
      result: `${result}: ${note}`,
    } as never);
  } catch {
    // best-effort — never block sync on audit failure
  }
}
