// Server functions for real broker + investment plans + autopilot persistence.
// All endpoints require an authenticated Supabase session.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  storeBrokerCredentials, loadBrokerCredentials, listBrokerCredentials, revokeBrokerCredentials,
  type BrokerMode,
} from "@/services/security/apiVault";
import { BinanceClient } from "@/services/broker/binanceRealConnector";
import { getAccountInfo } from "@/services/broker/binanceAccount";
import { placeOrder, type OrderResult } from "@/services/broker/binanceExecution";
import { preflightRisk } from "@/services/broker/binanceRisk";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ModeSchema = z.enum(["testnet", "live"]).default("testnet");

// ---- BROKER CREDENTIALS ----
export const saveBrokerKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    mode: ModeSchema,
    apiKey: z.string().min(20).max(200),
    apiSecret: z.string().min(20).max(200),
    label: z.string().max(80).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const meta = await storeBrokerCredentials(
      context.userId, "binance", data.mode, data.apiKey, data.apiSecret, data.label,
    );
    return { ok: true, meta };
  });

export const listBrokerKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return { items: await listBrokerCredentials(context.userId) };
  });

export const removeBrokerKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await revokeBrokerCredentials(context.userId, data.id);
    return { ok: true };
  });

// ---- ACCOUNT ----
export const fetchAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ mode: ModeSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const creds = await loadBrokerCredentials(context.userId, "binance", data.mode);
    if (!creds) return { connected: false as const };
    try {
      const client = new BinanceClient(creds, data.mode);
      const acct = await getAccountInfo(client);
      return { connected: true as const, mode: data.mode, ...acct };
    } catch (err) {
      return { connected: false as const, error: (err as Error).message };
    }
  });

// ---- ORDER ----
export const submitOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    mode: ModeSchema,
    symbol: z.string().min(5).max(20),
    side: z.enum(["BUY", "SELL"]),
    type: z.enum(["MARKET", "LIMIT", "STOP_LOSS", "TAKE_PROFIT", "STOP_LOSS_LIMIT"]),
    quantity: z.number().positive().max(1_000_000),
    price: z.number().positive().optional(),
    stopPrice: z.number().positive().optional(),
    refPrice: z.number().positive(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const creds = await loadBrokerCredentials(context.userId, "binance", data.mode);
    if (!creds) throw new Error("No broker credentials configured");

    const risk = preflightRisk(data, data.refPrice);
    if (!risk.ok) throw new Error(`Risk rejection: ${risk.reasons.join(", ")}`);

    const client = new BinanceClient(creds, data.mode);
    let result: OrderResult | null = null;
    let status = "FAILED"; let errorMsg: string | null = null;
    try {
      result = await placeOrder(client, data);
      status = result.status;
    } catch (err) {
      errorMsg = (err as Error).message;
    }

    await supabaseAdmin.from("execution_history").insert({
      user_id: context.userId, broker: "binance", mode: data.mode,
      symbol: data.symbol, side: data.side, type: data.type,
      quantity: data.quantity, price: result?.avgPrice ?? data.price ?? data.refPrice,
      status, order_id: result?.orderId ?? null,
      metadata: { errorMsg },
    });

    if (errorMsg) throw new Error(errorMsg);
    return { ok: true, result };
  });

// ---- INVESTMENT PLANS ----
const PlanInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(80),
  plan_type: z.enum(["conservative", "balanced", "aggressive", "ai_adaptive", "custom"]),
  duration_days: z.number().int().min(7).max(3650),
  capital_amount: z.number().positive().max(10_000_000),
  currency: z.string().min(3).max(8).default("USDT"),
  target_markets: z.array(z.string().min(2).max(20)).max(20).default([]),
  risk_level: z.string().min(2).max(20),
  allocation: z.record(z.string(), z.unknown()).default({}),
  projection: z.record(z.string(), z.unknown()).default({}),
  ai_confidence: z.number().min(0).max(100).optional(),
});

export const saveInvestmentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PlanInput.parse(i))
  .handler(async ({ data, context }) => {
    const payload = { ...data, user_id: context.userId } as never;
    const q = data.id
      ? supabaseAdmin.from("investment_plans").update(payload).eq("id", data.id).eq("user_id", context.userId).select().single()
      : supabaseAdmin.from("investment_plans").insert(payload).select().single();
    const { data: row, error } = await q;
    if (error) throw error;
    return { plan: row };
  });

export const listInvestmentPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin.from("investment_plans")
      .select("*").eq("user_id", context.userId).order("created_at", { ascending: false });
    return { plans: data ?? [] };
  });

export const setPlanStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["draft", "active", "paused", "completed", "cancelled"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await supabaseAdmin.from("investment_plans").update({ status: data.status })
      .eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

// ---- AI DECISION LOG ----
export const logAiDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    asset: z.string().min(1).max(20),
    action: z.string().min(1).max(40),
    confidence: z.number().min(0).max(100),
    regime: z.string().max(60).optional(),
    rationale: z.string().max(2000).optional(),
    context: z.record(z.string(), z.unknown()).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await supabaseAdmin.from("ai_decisions").insert({ ...data, user_id: context.userId } as never);
    return { ok: true };
  });

export const listExecutionHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin.from("execution_history")
      .select("*").eq("user_id", context.userId)
      .order("created_at", { ascending: false }).limit(50);
    return { rows: data ?? [] };
  });
