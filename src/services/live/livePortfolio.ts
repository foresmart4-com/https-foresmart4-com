// Live portfolio sync — pulls Binance account, builds snapshot, persists to portfolio_snapshots.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BinanceClient } from "@/services/broker/binanceRealConnector";
import { getAccountInfo, type AccountInfo } from "@/services/broker/binanceAccount";

export interface HoldingView {
  asset: string;
  amount: number;
  priceUSDT: number;
  valueUSDT: number;
  weightPct: number;
}

export interface PortfolioSnapshot {
  equityUSDT: number;
  availableUSDT: number;
  exposurePct: number;
  pnlDay: number;
  pnlTotal: number;
  concentrationHHI: number;
  topHolding: { asset: string; weightPct: number } | null;
  holdings: HoldingView[];
  capturedAt: number;
}

async function priceMap(symbols: string[], client: BinanceClient): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};
  const tickers = await client.publicRequest<{ symbol: string; price: string }[]>("/api/v3/ticker/price", {});
  const map: Record<string, number> = {};
  for (const t of tickers) map[t.symbol] = Number(t.price);
  const out: Record<string, number> = {};
  for (const s of symbols) {
    if (s === "USDT") { out[s] = 1; continue; }
    const sym = `${s}USDT`;
    if (map[sym]) out[s] = map[sym];
  }
  return out;
}

export async function buildLiveSnapshot(
  userId: string, client: BinanceClient, account?: AccountInfo,
): Promise<PortfolioSnapshot> {
  const acct = account ?? await getAccountInfo(client);
  const assets = acct.balances.map((b) => b.asset);
  const prices = await priceMap(assets, client);

  const holdingsRaw = acct.balances.map((b) => {
    const amount = b.free + b.locked;
    const price = prices[b.asset] ?? (b.asset === "USDT" ? 1 : 0);
    return { asset: b.asset, amount, priceUSDT: price, valueUSDT: amount * price };
  }).filter((h) => h.valueUSDT > 0.5);

  const equity = holdingsRaw.reduce((s, h) => s + h.valueUSDT, 0);
  const available = acct.available;
  const holdings: HoldingView[] = holdingsRaw
    .map((h) => ({ ...h, weightPct: equity > 0 ? (h.valueUSDT / equity) * 100 : 0 }))
    .sort((a, b) => b.valueUSDT - a.valueUSDT);

  const nonCash = holdings.filter((h) => h.asset !== "USDT");
  const exposurePct = equity > 0 ? (nonCash.reduce((s, h) => s + h.valueUSDT, 0) / equity) * 100 : 0;
  const hhi = holdings.reduce((s, h) => s + Math.pow(h.weightPct / 100, 2), 0) * 10000;
  const top = nonCash[0] ? { asset: nonCash[0].asset, weightPct: nonCash[0].weightPct } : null;

  // Day PnL from execution_history (realized)
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const { data: today } = await supabaseAdmin
    .from("execution_history").select("pnl")
    .eq("user_id", userId).gte("created_at", startOfDay.toISOString());
  const pnlDay = (today ?? []).reduce((s, r: { pnl: number | null }) => s + (Number(r.pnl) || 0), 0);
  const { data: all } = await supabaseAdmin
    .from("execution_history").select("pnl").eq("user_id", userId);
  const pnlTotal = (all ?? []).reduce((s, r: { pnl: number | null }) => s + (Number(r.pnl) || 0), 0);

  const snap: PortfolioSnapshot = {
    equityUSDT: equity, availableUSDT: available, exposurePct,
    pnlDay, pnlTotal, concentrationHHI: hhi, topHolding: top,
    holdings, capturedAt: Date.now(),
  };

  // Persist
  await supabaseAdmin.from("portfolio_snapshots").insert({
    user_id: userId, equity, available, exposure_pct: exposurePct,
    pnl_day: pnlDay, pnl_total: pnlTotal,
    holdings: holdings as never,
  } as never);

  return snap;
}

export async function getRecentSnapshots(userId: string, limit = 50) {
  const { data } = await supabaseAdmin
    .from("portfolio_snapshots").select("*")
    .eq("user_id", userId).order("captured_at", { ascending: false }).limit(limit);
  return data ?? [];
}
