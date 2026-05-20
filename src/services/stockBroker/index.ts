// Stock-broker factory + runtime descriptor.
// Selects the active provider from BROKER_PROVIDER and exposes its connector.
import { AlpacaBroker, readAlpacaConfig } from "./alpacaConnector";
import { IbkrBroker, readIbkrConfig } from "./ibkrConnector";
import type { StockBroker, StockBrokerProvider } from "./types";

export const STOCK_LIVE_TRADING_ENABLED = false; // hard guard — flip only when ready

export interface StockBrokerRuntime {
  provider: StockBrokerProvider;
  liveTradingEnabled: boolean;
  configured: boolean;
  reason?: string;
}

export function readStockBrokerProvider(): StockBrokerProvider {
  const raw = (process.env.BROKER_PROVIDER ?? "alpaca").trim().toLowerCase();
  return raw === "ibkr" ? "ibkr" : "alpaca";
}

export function getStockBrokerRuntime(): StockBrokerRuntime {
  const provider = readStockBrokerProvider();
  try {
    if (provider === "alpaca") readAlpacaConfig();
    else readIbkrConfig();
    return { provider, liveTradingEnabled: STOCK_LIVE_TRADING_ENABLED, configured: true };
  } catch (e) {
    return {
      provider, liveTradingEnabled: STOCK_LIVE_TRADING_ENABLED, configured: false,
      reason: (e as Error).message,
    };
  }
}

export function createStockBroker(): StockBroker {
  const provider = readStockBrokerProvider();
  if (provider === "ibkr") return new IbkrBroker(readIbkrConfig());
  return new AlpacaBroker(readAlpacaConfig());
}

export type { StockBroker, StockBrokerProvider };
export * from "./types";
