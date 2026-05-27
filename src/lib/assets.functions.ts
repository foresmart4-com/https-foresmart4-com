import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AssetClass =
  | "us_stock" | "sa_stock" | "etf" | "bond"
  | "crypto" | "metal" | "commodity" | "cash" | "other";
export type AssetSource = "manual" | "binance" | "alpaca" | "ibkr" | "demo";
export type AssetDataMode = "live" | "delayed" | "manual" | "mock";

export interface UserAssetRow {
  id: string;
  asset_class: AssetClass;
  source: AssetSource;
  symbol: string;
  name: string | null;
  quantity: number;
  avg_cost: number;
  currency: string;
  market: string | null;
  notes: string | null;
  yield_pct: number | null;
  data_mode: AssetDataMode;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PricedAsset extends UserAssetRow {
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  pnl: number;
  pnlPct: number;
  priceMode: AssetDataMode;
}

const AssetClassEnum = z.enum([
  "us_stock", "sa_stock", "etf", "bond",
  "crypto", "metal", "commodity", "cash", "other",
]);

const AddInput = z.object({
  asset_class: AssetClassEnum,
  symbol: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9._\-]+$/),
  name: z.string().trim().max(120).optional().nullable(),
  quantity: z.number().nonnegative().max(1e12),
  avg_cost: z.number().nonnegative().max(1e9),
  currency: z.string().trim().min(2).max(8).default("USD"),
  market: z.string().trim().max(32).optional().nullable(),
  yield_pct: z.number().min(-100).max(1000).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

const UpdateInput = z.object({
  id: z.string().uuid(),
  patch: AddInput.partial(),
});

const CashInput = z.object({
  amount: z.number().min(-1e9).max(1e9).refine((n) => n !== 0, "amount cannot be zero"),
  currency: z.string().trim().min(2).max(8).default("USD"),
  kind: z.enum(["deposit", "withdrawal", "adjustment"]).default("deposit"),
  note: z.string().trim().max(300).optional().nullable(),
});
type CashInputT = z.infer<typeof CashInput>;
type UpdateInputT = z.infer<typeof UpdateInput>;

// ---------- Price fetchers (server-only) ----------
async function fetchCryptoPrice(symbol: string): Promise<{ price: number; mode: AssetDataMode } | null> {
  try {
    const s = symbol.toUpperCase().replace(/USDT?$/, "");
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${s}USDT`);
    if (!r.ok) return null;
    const j = (await r.json()) as { price?: string };
    const p = Number(j.price);
    if (!Number.isFinite(p) || p <= 0) return null;
    return { price: p, mode: "live" };
  } catch { return null; }
}

async function fetchAlpacaQuote(symbol: string): Promise<{ price: number; mode: AssetDataMode } | null> {
  const key = process.env.ALPACA_API_KEY || process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_SECRET_KEY || process.env.ALPACA_API_SECRET_KEY;
  if (!key || !secret) return null;
  const dataUrl = (process.env.ALPACA_DATA_URL || "https://data.alpaca.markets").replace(/\/+$/, "");
  try {
    const r = await fetch(`${dataUrl}/v2/stocks/${encodeURIComponent(symbol)}/trades/latest`, {
      headers: { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { trade?: { p?: number } };
    const p = Number(j.trade?.p);
    if (!Number.isFinite(p) || p <= 0) return null;
    return { price: p, mode: "delayed" };
  } catch { return null; }
}

async function fetchFinnhubQuote(symbol: string): Promise<{ price: number; mode: AssetDataMode } | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { c?: number };
    const p = Number(j.c);
    if (!Number.isFinite(p) || p <= 0) return null;
    return { price: p, mode: "live" };
  } catch { return null; }
}

async function fetchTwelveData(symbol: string): Promise<{ price: number; mode: AssetDataMode } | null> {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${key}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { price?: string };
    const p = Number(j.price);
    if (!Number.isFinite(p) || p <= 0) return null;
    return { price: p, mode: "delayed" };
  } catch { return null; }
}

async function priceForAsset(row: UserAssetRow): Promise<{ price: number; mode: AssetDataMode }> {
  if (row.data_mode === "mock" || row.source === "demo") {
    const drift = 1 + (Math.sin(Date.now() / 60000 + row.symbol.length) * 0.02);
    return { price: Math.max(row.avg_cost || 1, 1) * drift, mode: "mock" };
  }
  if (row.asset_class === "cash") return { price: 1, mode: "manual" };

  if (row.asset_class === "crypto") {
    const c = await fetchCryptoPrice(row.symbol);
    if (c) return c;
  }
  if (row.asset_class === "us_stock" || row.asset_class === "etf" || row.asset_class === "bond") {
    const a = await fetchAlpacaQuote(row.symbol);
    if (a) return a;
    const f = await fetchFinnhubQuote(row.symbol);
    if (f) return f;
  }
  if (row.asset_class === "sa_stock") {
    const t = await fetchTwelveData(row.symbol);
    if (t) return t;
  }
  // metals / commodity / fallback
  return { price: row.avg_cost || 0, mode: "manual" };
}

// ---------- Server functions ----------
export const listUserAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_assets")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("asset_class", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as UserAssetRow[];

    const priced: PricedAsset[] = await Promise.all(
      rows.map(async (r) => {
        const { price, mode } = await priceForAsset(r);
        const marketValue = price * Number(r.quantity || 0);
        const costBasis = Number(r.avg_cost || 0) * Number(r.quantity || 0);
        const pnl = marketValue - costBasis;
        const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
        return { ...r, currentPrice: price, marketValue, costBasis, pnl, pnlPct, priceMode: mode };
      }),
    );

    const totals = priced.reduce(
      (acc, a) => {
        acc.value += a.marketValue;
        acc.cost += a.costBasis;
        acc.pnl += a.pnl;
        if (a.asset_class === "cash") acc.cash += a.marketValue;
        return acc;
      },
      { value: 0, cost: 0, pnl: 0, cash: 0 },
    );

    return { assets: priced, totals, syncedAt: Date.now() };
  });

export const addUserAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AddInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_assets").insert({
      user_id: userId,
      asset_class: data.asset_class,
      symbol: data.symbol.toUpperCase(),
      name: data.name ?? null,
      quantity: data.quantity,
      avg_cost: data.avg_cost,
      currency: data.currency.toUpperCase(),
      market: data.market ?? null,
      yield_pct: data.yield_pct ?? null,
      notes: data.notes ?? null,
      source: "manual",
      data_mode: "manual",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateUserAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch = { ...data.patch } as Record<string, unknown>;
    if (typeof patch.symbol === "string") patch.symbol = patch.symbol.toUpperCase();
    if (typeof patch.currency === "string") patch.currency = (patch.currency as string).toUpperCase();
    const { error } = await (supabase.from("user_assets") as any)
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUserAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_assets")
      .update({ is_active: false })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addManualCash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CashInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const currency = data.currency.toUpperCase();
    const delta = data.kind === "withdrawal" ? -Math.abs(data.amount) : data.amount;

    const { error: e1 } = await supabase.from("manual_cash_entries").insert({
      user_id: userId, currency, amount: data.amount, kind: data.kind, note: data.note ?? null,
    });
    if (e1) throw new Error(e1.message);

    // upsert cash row
    const { data: existing } = await supabase
      .from("user_assets")
      .select("id, quantity")
      .eq("user_id", userId)
      .eq("asset_class", "cash")
      .eq("symbol", currency)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      const newQty = Number(existing.quantity || 0) + delta;
      await supabase.from("user_assets").update({ quantity: newQty }).eq("id", existing.id);
    } else {
      await supabase.from("user_assets").insert({
        user_id: userId, asset_class: "cash", source: "manual", data_mode: "manual",
        symbol: currency, name: `Cash ${currency}`, quantity: Math.max(0, delta),
        avg_cost: 1, currency, market: "CASH",
      });
    }
    return { ok: true };
  });

export const seedDemoBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const demos = [
      { asset_class: "us_stock" as const, symbol: "AAPL", name: "Apple Inc.", quantity: 10, avg_cost: 180, market: "US" },
      { asset_class: "etf" as const, symbol: "SPY", name: "SPDR S&P 500 ETF", quantity: 5, avg_cost: 500, market: "US" },
      { asset_class: "bond" as const, symbol: "TLT", name: "iShares 20+ Yr Treasury", quantity: 8, avg_cost: 92, market: "US", yield_pct: 4.2 },
      { asset_class: "crypto" as const, symbol: "BTC", name: "Bitcoin", quantity: 0.05, avg_cost: 60000, market: "CRYPTO" },
      { asset_class: "metal" as const, symbol: "GOLD", name: "Gold (oz)", quantity: 2, avg_cost: 2300, market: "METAL" },
      { asset_class: "cash" as const, symbol: "USD", name: "Cash USD", quantity: 5000, avg_cost: 1, market: "CASH" },
    ];
    const rows = demos.map((d) => ({
      ...d, user_id: userId, currency: "USD",
      source: "demo" as const, data_mode: "mock" as const,
    }));
    const { error } = await supabase.from("user_assets").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });
