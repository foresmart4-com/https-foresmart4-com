// Account info — balances, open orders, simple PnL view.
import { BinanceClient } from "./binanceRealConnector";

export interface AccountBalance { asset: string; free: number; locked: number; }
export interface AccountInfo {
  canTrade: boolean;
  balances: AccountBalance[];
  equityUSDT: number;
  available: number;
  lastSyncedAt: number;
}

interface RawBalance { asset: string; free: string; locked: string; }

export async function getAccountInfo(client: BinanceClient): Promise<AccountInfo> {
  const raw = await client.signedRequest<{ canTrade: boolean; balances: RawBalance[] }>("GET", "/api/v3/account");
  const balances = raw.balances
    .map((b) => ({ asset: b.asset, free: Number(b.free), locked: Number(b.locked) }))
    .filter((b) => b.free + b.locked > 0);

  const usdt = balances.find((b) => b.asset === "USDT");
  const equity = usdt ? usdt.free + usdt.locked : 0;

  return {
    canTrade: raw.canTrade,
    balances,
    equityUSDT: equity,
    available: usdt?.free ?? 0,
    lastSyncedAt: Date.now(),
  };
}

export async function getOpenOrders(client: BinanceClient, symbol?: string) {
  return client.signedRequest("GET", "/api/v3/openOrders", symbol ? { symbol } : {});
}
