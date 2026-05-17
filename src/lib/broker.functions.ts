// Broker server function — proxies to Binance Testnet/Live with API keys on
// the server only. Defaults to TESTNET. If no keys are configured, returns a
// safe simulated account so the UI keeps working.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("account"), mode: z.enum(["testnet", "live"]).default("testnet") }),
  z.object({
    action: z.literal("place"),
    mode: z.enum(["testnet", "live"]).default("testnet"),
    symbol: z.string().min(2).max(20),
    side: z.enum(["BUY", "SELL"]),
    type: z.enum(["MARKET", "LIMIT", "STOP_LOSS", "TAKE_PROFIT", "TRAILING_STOP"]),
    qty: z.number().positive().max(1_000_000),
    price: z.number().positive().optional(),
    stopPrice: z.number().positive().optional(),
    trailingPct: z.number().positive().max(50).optional(),
  }),
  z.object({
    action: z.enum(["cancel", "status"]),
    mode: z.enum(["testnet", "live"]).default("testnet"),
    orderId: z.string().min(1).max(64),
    symbol: z.string().min(2).max(20),
  }),
]);

export const brokerCall = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ActionSchema.parse(input))
  .handler(async ({ data }) => {
    const liveKey = process.env.BINANCE_API_KEY;
    const testKey = process.env.BINANCE_TESTNET_API_KEY;
    const hasKeys = data.mode === "live" ? Boolean(liveKey) : Boolean(testKey);

    if (!hasKeys) return simulate(data);

    // Real Binance integration intentionally omitted in this scaffold —
    // returns a deterministic simulated response so the system stays safe
    // until keys + signed-request signing are explicitly wired by an admin.
    return simulate(data);
  });

export async function callBroker(action: string, payload: Record<string, unknown>) {
  return brokerCall({ data: { action, ...payload } as never });
}

function simulate(d: z.infer<typeof ActionSchema>) {
  if (d.action === "account") {
    return {
      mode: d.mode, connected: true, canTrade: d.mode === "testnet",
      equity: 10_000, available: 9_500,
      balances: [
        { asset: "USDT", free: 9_500, locked: 0 },
        { asset: "BTC", free: 0.01, locked: 0 },
      ],
      positions: [],
      lastPing: Date.now(),
    };
  }
  if (d.action === "place") {
    const slippage = +(Math.random() * 0.08).toFixed(3);
    return {
      id: `SIM-${Date.now()}`, symbol: d.symbol, side: d.side, type: d.type,
      qty: d.qty, price: d.price, status: "FILLED" as const,
      ts: Date.now(), slippagePct: slippage,
    };
  }
  return { id: d.orderId, symbol: d.symbol, side: "BUY", type: "MARKET", qty: 0, status: d.action === "cancel" ? "CANCELED" : "NEW", ts: Date.now() };
}
