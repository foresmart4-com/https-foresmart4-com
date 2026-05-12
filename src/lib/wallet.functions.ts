import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!wallet) {
      const { data: created } = await supabase
        .from("wallets")
        .insert({ user_id: userId })
        .select()
        .single();
      return { wallet: created, transactions: [] as any[] };
    }
    const { data: tx } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { wallet, transactions: tx ?? [] };
  });

export const getBankAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("bank_accounts")
      .select("id, institution_name, account_name, account_mask, account_type, currency, is_active, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const getPortfolios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: portfolios } = await supabase
      .from("portfolios")
      .select("*, portfolio_holdings(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return portfolios ?? [];
  });

export const ensureDefaultPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("portfolios")
      .select("id, name")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existing) return existing;
    const { data: created, error } = await supabase
      .from("portfolios")
      .insert({ user_id: userId, name: "محفظتي الرئيسية", strategy: "تداول مباشر من البرنامج" })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const createPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().min(1).max(80), strategy: z.string().max(200).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: p, error } = await supabase
      .from("portfolios")
      .insert({ user_id: userId, name: data.name, strategy: data.strategy ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return p;
  });

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      portfolioId: z.string().uuid(),
      symbol: z.string().min(1).max(20),
      assetName: z.string().max(120).optional(),
      market: z.string().max(40).optional(),
      side: z.enum(["buy", "sell"]),
      quantity: z.number().positive(),
      price: z.number().positive(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const total = data.quantity * data.price;

    const { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (!wallet) throw new Error("Wallet not found");

    if (data.side === "buy" && Number(wallet.balance) < total) {
      throw new Error("Insufficient balance");
    }

    const newBal = data.side === "buy"
      ? Number(wallet.balance) - total
      : Number(wallet.balance) + total;

    await supabase.from("wallets").update({ balance: newBal, updated_at: new Date().toISOString() }).eq("id", wallet.id);

    await supabase.from("wallet_transactions").insert({
      user_id: userId,
      wallet_id: wallet.id,
      type: data.side,
      amount: total,
      currency: wallet.currency,
      reference: data.symbol,
      metadata: { quantity: data.quantity, price: data.price, market: data.market },
    });

    // upsert holding
    const { data: existing } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("portfolio_id", data.portfolioId)
      .eq("symbol", data.symbol)
      .maybeSingle();

    if (data.side === "buy") {
      if (existing) {
        const newQty = Number(existing.quantity) + data.quantity;
        const newAvg = (Number(existing.avg_price) * Number(existing.quantity) + total) / newQty;
        await supabase.from("portfolio_holdings").update({
          quantity: newQty, avg_price: newAvg, updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await supabase.from("portfolio_holdings").insert({
          portfolio_id: data.portfolioId, user_id: userId,
          symbol: data.symbol, asset_name: data.assetName, market: data.market,
          quantity: data.quantity, avg_price: data.price,
        });
      }
    } else if (existing) {
      const newQty = Math.max(0, Number(existing.quantity) - data.quantity);
      if (newQty === 0) {
        await supabase.from("portfolio_holdings").delete().eq("id", existing.id);
      } else {
        await supabase.from("portfolio_holdings").update({ quantity: newQty }).eq("id", existing.id);
      }
    }

    return { ok: true, balance: newBal };
  });
