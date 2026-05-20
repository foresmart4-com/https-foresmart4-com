// Common stock broker abstraction shared by Alpaca / IBKR adapters.
// All values are normalized USD unless otherwise noted. No mock data.

export type StockBrokerProvider = "alpaca" | "ibkr";

export interface BrokerAccount {
  provider: StockBrokerProvider;
  accountId: string;
  status: string;
  currency: string;
  cash: number;
  equity: number;
  buyingPower: number;
  daytradingBuyingPower?: number;
  patternDayTrader?: boolean;
  tradingBlocked: boolean;
}

export interface BrokerPosition {
  symbol: string;
  qty: number;
  avgPrice: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  side: "long" | "short";
}

export interface BrokerOrder {
  id: string;
  clientOrderId?: string;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  qty: number;
  limitPrice?: number;
  status: string;
  filledQty: number;
  filledAvgPrice?: number;
  submittedAt: number;
  updatedAt: number;
}

export interface PlaceOrderInput {
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  qty: number;
  limitPrice?: number;
  timeInForce?: "day" | "gtc";
  clientOrderId?: string;
}

export interface BrokerQuote {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  ts: number;
}

export interface StockBroker {
  provider: StockBrokerProvider;
  getAccount(): Promise<BrokerAccount>;
  getPositions(): Promise<BrokerPosition[]>;
  getOpenOrders(): Promise<BrokerOrder[]>;
  placeOrder(input: PlaceOrderInput): Promise<BrokerOrder>;
  cancelOrder(id: string): Promise<{ ok: true }>;
  getQuote(symbol: string): Promise<BrokerQuote>;
}

export class BrokerConfigError extends Error {
  constructor(msg: string) { super(msg); this.name = "BrokerConfigError"; }
}

export class BrokerApiError extends Error {
  constructor(msg: string, public status?: number) { super(msg); this.name = "BrokerApiError"; }
}
