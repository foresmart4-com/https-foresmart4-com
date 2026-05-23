export type BrokerProvider = "alpaca_paper" | "alpaca_live" | "ibkr";

export interface BrokerConfig {
  provider: BrokerProvider;
  connected: boolean;
  mode: "paper" | "live";
  apiConfigured: boolean;
  serverSideOnly: true;
}

export interface BrokerAdapterStatus {
  adapters: Record<BrokerProvider, BrokerConfig>;
  activeBroker: BrokerProvider | null;
  liveExecutionEnabled: false;
  serverSideOnly: true;
  secretsExposedToFrontend: false;
}

export interface BrokerOrder {
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  notional: number;
  type: "market" | "limit";
  timeInForce: "day" | "gtc";
  broker: BrokerProvider;
  status: "blocked" | "paper_ready" | "submitted" | "filled" | "rejected";
  blockedReason?: string;
}

function hasEnvKey(name: string): boolean {
  return typeof process !== "undefined" && Boolean(process.env[name]);
}

function alpacaPaperConfigured(): boolean {
  return hasEnvKey("ALPACA_API_KEY") && hasEnvKey("ALPACA_SECRET_KEY");
}

function alpacaLiveConfigured(): boolean {
  return hasEnvKey("ALPACA_LIVE_API_KEY") && hasEnvKey("ALPACA_LIVE_SECRET_KEY");
}

function ibkrConfigured(): boolean {
  return hasEnvKey("IBKR_GATEWAY_HOST") && hasEnvKey("IBKR_GATEWAY_PORT");
}

export function getBrokerAdapterStatus(): BrokerAdapterStatus {
  return {
    adapters: {
      alpaca_paper: {
        provider: "alpaca_paper",
        connected: false,
        mode: "paper",
        apiConfigured: alpacaPaperConfigured(),
        serverSideOnly: true,
      },
      alpaca_live: {
        provider: "alpaca_live",
        connected: false,
        mode: "live",
        apiConfigured: alpacaLiveConfigured(),
        serverSideOnly: true,
      },
      ibkr: {
        provider: "ibkr",
        connected: false,
        mode: "live",
        apiConfigured: ibkrConfigured(),
        serverSideOnly: true,
      },
    },
    activeBroker: null,
    liveExecutionEnabled: false,
    serverSideOnly: true,
    secretsExposedToFrontend: false,
  };
}

export function validateBrokerOrder(order: Omit<BrokerOrder, "status" | "blockedReason">): BrokerOrder {
  return {
    ...order,
    status: "blocked",
    blockedReason: "Live broker execution is disabled. Genesis 100 operates in paper trading mode only. Corporate internal mode — no external order routing.",
  };
}

export function getBrokerSafetyReport() {
  const status = getBrokerAdapterStatus();
  return {
    product: "ForeSmart Genesis 100",
    brokerStatus: status,
    safetyChecks: {
      liveExecutionBlocked: true,
      secretsServerSideOnly: true,
      noFrontendSecretExposure: true,
      corporateInternalMode: true,
      paperTradingOnly: true,
    },
    configuredAdapters: Object.values(status.adapters).filter((a) => a.apiConfigured).map((a) => a.provider),
    pendingAdapters: Object.values(status.adapters).filter((a) => !a.apiConfigured).map((a) => a.provider),
    notes: [
      "Broker API keys must be stored as server-side environment variables only.",
      "Keys must never be prefixed with VITE_ or exposed to client bundles.",
      "Live execution requires: broker connected + explicit admin approval + risk limits pass + execution adapter configured.",
      "Current mode: paper trading only — all orders are simulated.",
    ],
  };
}
