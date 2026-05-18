// Live order book / depth aggregation — public Binance REST.
import { BinanceClient } from "@/services/broker/binanceRealConnector";

export interface DepthLevel { price: number; qty: number; cumQty: number; }
export interface OrderBookView {
  symbol: string;
  spreadPct: number;
  bidLiquidityUSDT: number;
  askLiquidityUSDT: number;
  imbalancePct: number;        // +ve = bid-heavy
  bids: DepthLevel[];
  asks: DepthLevel[];
  midPrice: number;
  capturedAt: number;
}

export async function fetchOrderBook(client: BinanceClient, symbol: string, limit = 20): Promise<OrderBookView> {
  const raw = await client.publicRequest<{ bids: [string, string][]; asks: [string, string][] }>(
    "/api/v3/depth", { symbol, limit },
  );
  const parse = (rows: [string, string][]) => {
    let cum = 0;
    return rows.map(([p, q]) => {
      const price = Number(p); const qty = Number(q); cum += qty;
      return { price, qty, cumQty: cum };
    });
  };
  const bids = parse(raw.bids);
  const asks = parse(raw.asks);
  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;
  const mid = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0;
  const spreadPct = mid > 0 ? ((bestAsk - bestBid) / mid) * 100 : 0;
  const bidLiq = bids.reduce((s, l) => s + l.price * l.qty, 0);
  const askLiq = asks.reduce((s, l) => s + l.price * l.qty, 0);
  const total = bidLiq + askLiq;
  const imbalance = total > 0 ? ((bidLiq - askLiq) / total) * 100 : 0;
  return {
    symbol, spreadPct, bidLiquidityUSDT: bidLiq, askLiquidityUSDT: askLiq,
    imbalancePct: imbalance, bids, asks, midPrice: mid, capturedAt: Date.now(),
  };
}
