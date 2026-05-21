import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ASSET_TYPES = ["US_STOCK","SAUDI_STOCK","CRYPTO","METAL","COMMODITY","BOND","ETF","CASH"] as const;
export type WatchAssetType = typeof ASSET_TYPES[number];

export interface WatchlistRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  item_count: number;
}
export interface WatchlistItemRow {
  id: string;
  watchlist_id: string;
  symbol: string;
  name: string | null;
  asset_type: WatchAssetType;
  market: string | null;
  note: string | null;
  created_at: string;
}

const NameInput = z.object({ name: z.string().trim().min(1).max(80) });
const IdInput = z.object({ id: z.string().uuid() });
const RenameInput = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(80) });
const ListItemsInput = z.object({ watchlist_id: z.string().uuid() });
const AddItemInput = z.object({
  watchlist_id: z.string().uuid(),
  symbol: z.string().trim().min(1).max(30).regex(/^[A-Z0-9./\-_]+$/i),
  name: z.string().trim().max(120).optional(),
  asset_type: z.enum(ASSET_TYPES),
  market: z.string().trim().max(40).optional(),
  note: z.string().trim().max(200).optional(),
});

export const listWatchlists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ watchlists: WatchlistRow[] }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_watchlists")
      .select("id,name,created_at,updated_at, user_watchlist_items(count)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows: WatchlistRow[] = (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      created_at: r.created_at,
      updated_at: r.updated_at,
      item_count: Array.isArray(r.user_watchlist_items) ? (r.user_watchlist_items[0]?.count ?? 0) : 0,
    }));
    return { watchlists: rows };
  });

export const createWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => NameInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("user_watchlists")
      .insert({ user_id: userId, name: data.name })
      .select("id,name,created_at,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return { watchlist: row };
  });

export const renameWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RenameInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_watchlists")
      .update({ name: data.name })
      .eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_watchlists")
      .delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWatchlistItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ListItemsInput.parse(d))
  .handler(async ({ data, context }): Promise<{ items: WatchlistItemRow[] }> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("user_watchlist_items")
      .select("*")
      .eq("user_id", userId)
      .eq("watchlist_id", data.watchlist_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: (rows ?? []) as WatchlistItemRow[] };
  });

export const addWatchlistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AddItemInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("user_watchlist_items").insert({
      user_id: userId,
      watchlist_id: data.watchlist_id,
      symbol: data.symbol.toUpperCase(),
      name: data.name ?? null,
      asset_type: data.asset_type,
      market: data.market ?? null,
      note: data.note ?? null,
    });
    if (error) {
      if (error.code === "23505") throw new Error("ALREADY_EXISTS");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const removeWatchlistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_watchlist_items")
      .delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
