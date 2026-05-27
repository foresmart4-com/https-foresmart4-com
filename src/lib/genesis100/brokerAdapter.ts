export type BrokerProvider = "alpaca_paper" | "alpaca_live" | "ibkr";

export type AssetCapability = "equities" | "etfs" | "forex" | "crypto" | "commodities" | "options" | "futures";

export type MarketRegion = "us" | "europe" | "china" | "gcc" | "global";

export interface BrokerAdapterInterface {
  provider: BrokerProvider;
  name: string;
  mode: "paper" | "live";
  connected: boolean;
  apiConfigured: boolean;
  serverSideOnly: true;
  capabilities: AssetCapability[];
  supportedRegions: MarketRegion[];
  failoverPriority: number;
}

export interface BrokerFailoverConfig {
  primaryBroker: BrokerProvider;
  backupBroker: BrokerProvider;
  autoFailover: boolean;
  failoverConditions: string[];
}

export interface MarketMapping {
  region: MarketRegion;
  exchanges: Array<{
    code: string;
    name: string;
    country: string;
    currency: string;
    status: "framework_ready" | "live" | "not_supported";
    brokerSupport: BrokerProvider[];
  }>;
}

export interface BrokerCapabilityMatrix {
  provider: BrokerProvider;
  equities: boolean;
  etfs: boolean;
  forex: boolean;
  crypto: boolean;
  commodities: boolean;
  options: boolean;
  futures: boolean;
  regionalMarkets: MarketRegion[];
}

export interface BrokerAdapterStatus {
  adapters: Record<BrokerProvider, BrokerAdapterInterface>;
  activeBroker: BrokerProvider | null;
  failover: BrokerFailoverConfig;
  capabilityMatrix: BrokerCapabilityMatrix[];
  marketExpansion: MarketMapping[];
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

const ALPACA_ADAPTER: BrokerAdapterInterface = {
  provider: "alpaca_paper",
  name: "Alpaca Markets (Paper)",
  mode: "paper",
  connected: false,
  apiConfigured: false,
  serverSideOnly: true,
  capabilities: ["equities", "etfs", "crypto"],
  supportedRegions: ["us"],
  failoverPriority: 1,
};

const ALPACA_LIVE_ADAPTER: BrokerAdapterInterface = {
  provider: "alpaca_live",
  name: "Alpaca Markets (Live)",
  mode: "live",
  connected: false,
  apiConfigured: false,
  serverSideOnly: true,
  capabilities: ["equities", "etfs", "crypto"],
  supportedRegions: ["us"],
  failoverPriority: 2,
};

const IBKR_ADAPTER: BrokerAdapterInterface = {
  provider: "ibkr",
  name: "Interactive Brokers (IBKR)",
  mode: "live",
  connected: false,
  apiConfigured: false,
  serverSideOnly: true,
  capabilities: ["equities", "etfs", "forex", "crypto", "commodities", "options", "futures"],
  supportedRegions: ["us", "europe", "china", "gcc", "global"],
  failoverPriority: 3,
};

const FAILOVER_CONFIG: BrokerFailoverConfig = {
  primaryBroker: "alpaca_paper",
  backupBroker: "ibkr",
  autoFailover: false,
  failoverConditions: [
    "Primary broker API unreachable for > 30s",
    "Primary broker returns repeated 5xx errors",
    "Primary broker rate limit exceeded",
    "Admin-initiated manual failover",
  ],
};

const CAPABILITY_MATRIX: BrokerCapabilityMatrix[] = [
  {
    provider: "alpaca_paper",
    equities: true,
    etfs: true,
    forex: false,
    crypto: true,
    commodities: false,
    options: false,
    futures: false,
    regionalMarkets: ["us"],
  },
  {
    provider: "alpaca_live",
    equities: true,
    etfs: true,
    forex: false,
    crypto: true,
    commodities: false,
    options: false,
    futures: false,
    regionalMarkets: ["us"],
  },
  {
    provider: "ibkr",
    equities: true,
    etfs: true,
    forex: true,
    crypto: true,
    commodities: true,
    options: true,
    futures: true,
    regionalMarkets: ["us", "europe", "china", "gcc", "global"],
  },
];

const MARKET_EXPANSION: MarketMapping[] = [
  {
    region: "us",
    exchanges: [
      { code: "NYSE", name: "New York Stock Exchange", country: "US", currency: "USD", status: "framework_ready", brokerSupport: ["alpaca_paper", "alpaca_live", "ibkr"] },
      { code: "NASDAQ", name: "NASDAQ", country: "US", currency: "USD", status: "framework_ready", brokerSupport: ["alpaca_paper", "alpaca_live", "ibkr"] },
    ],
  },
  {
    region: "europe",
    exchanges: [
      { code: "LSE", name: "London Stock Exchange", country: "GB", currency: "GBP", status: "framework_ready", brokerSupport: ["ibkr"] },
      { code: "EURONEXT", name: "Euronext", country: "NL", currency: "EUR", status: "framework_ready", brokerSupport: ["ibkr"] },
      { code: "XETRA", name: "Xetra (Deutsche Börse)", country: "DE", currency: "EUR", status: "framework_ready", brokerSupport: ["ibkr"] },
    ],
  },
  {
    region: "china",
    exchanges: [
      { code: "HKEX", name: "Hong Kong Exchange", country: "HK", currency: "HKD", status: "framework_ready", brokerSupport: ["ibkr"] },
      { code: "SSE", name: "Shanghai Stock Exchange", country: "CN", currency: "CNY", status: "framework_ready", brokerSupport: ["ibkr"] },
    ],
  },
  {
    region: "gcc",
    exchanges: [
      { code: "TADAWUL", name: "Saudi Exchange (Tadawul)", country: "SA", currency: "SAR", status: "framework_ready", brokerSupport: ["ibkr"] },
      { code: "ADX", name: "Abu Dhabi Securities Exchange", country: "AE", currency: "AED", status: "framework_ready", brokerSupport: ["ibkr"] },
      { code: "DFM", name: "Dubai Financial Market", country: "AE", currency: "AED", status: "framework_ready", brokerSupport: ["ibkr"] },
      { code: "BK", name: "Boursa Kuwait", country: "KW", currency: "KWD", status: "framework_ready", brokerSupport: ["ibkr"] },
      { code: "QSE", name: "Qatar Stock Exchange", country: "QA", currency: "QAR", status: "framework_ready", brokerSupport: ["ibkr"] },
    ],
  },
];

export function getBrokerAdapterStatus(): BrokerAdapterStatus {
  const alpacaPaper = { ...ALPACA_ADAPTER, apiConfigured: hasEnvKey("ALPACA_API_KEY") && hasEnvKey("ALPACA_SECRET_KEY") };
  const alpacaLive = { ...ALPACA_LIVE_ADAPTER, apiConfigured: hasEnvKey("ALPACA_LIVE_API_KEY") && hasEnvKey("ALPACA_LIVE_SECRET_KEY") };
  const ibkr = { ...IBKR_ADAPTER, apiConfigured: hasEnvKey("IBKR_GATEWAY_HOST") && hasEnvKey("IBKR_GATEWAY_PORT") };

  return {
    adapters: { alpaca_paper: alpacaPaper, alpaca_live: alpacaLive, ibkr },
    activeBroker: null,
    failover: FAILOVER_CONFIG,
    capabilityMatrix: CAPABILITY_MATRIX,
    marketExpansion: MARKET_EXPANSION,
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
