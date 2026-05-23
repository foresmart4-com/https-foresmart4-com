import { routeQuote, resolveAsset, type AssetClass, type RouterQuote } from "@/lib/market/router";

export type GenesisStatus = "draft" | "active_analysis" | "paper_trading" | "execution_ready" | "paused";
export type GenesisRiskProfile = "conservative" | "balanced" | "growth";
export type GenesisRecommendation = "include" | "hold" | "reduce" | "remove" | "watch";
export type GenesisExecutionMode = "analysis_only" | "paper" | "live_blocked" | "live";
export type GenesisReportPeriod = "hourly" | "daily" | "weekly" | "monthly" | "quarterly" | "semiannual" | "annual";
export type GenesisAIMode = "off" | "semi_ai" | "full_ai";

export interface GenesisWallet {
  id: string;
  name: "ForeSmart Genesis 100";
  capital: number;
  cashBalance: number;
  investedBalance: number;
  targetMonthlyReturn: number;
  maxDrawdown: number;
  riskProfile: GenesisRiskProfile;
  status: GenesisStatus;
  liveExecutionEnabled: false;
  brokerConnected: false;
  isolated: true;
  mainWalletAccess: false;
  updatedAt: string;
}

export interface GenesisEntitlement {
  allowed: boolean;
  reason: string | null;
  planRequired: "pro";
  proPlanRequired: true;
  planActive: boolean;
  featureLocked: boolean;
}

export interface GenesisSafetyProfile {
  externalTransfersAllowed: false;
  aiCanTransferOutsidePlatform: false;
  manualWithdrawalOnly: true;
  forbiddenActions: ["external_transfer", "withdrawal", "send_funds_outside_platform"];
}

export interface GenesisNotificationPreferences {
  emailReportsEnabled: boolean;
  smsReportsEnabled: boolean;
  emailAlertsEnabled: boolean;
  smsAlertsEnabled: boolean;
  reportFrequencies: GenesisReportPeriod[];
  smsAvailable: boolean;
  smsUnavailableReason: string | null;
}

export interface GenesisCapabilityProfile {
  marketDataAnalysis: true;
  macroAnalysis: true;
  newsAnalysis: true;
  sentimentAnalysis: true;
  riskManagement: true;
  capitalAllocation: true;
  stopLossPlanning: true;
  takeProfitPlanning: true;
  portfolioRebalancing: true;
  decisionJournal: true;
  liveBrokerExecution: boolean;
}

export interface GenesisControls {
  aiMode: GenesisAIMode;
  explicitFullAIApproval: boolean;
  riskLimitsPass: boolean;
  executionAdapterConfigured: boolean;
}

export interface GenesisUniverseAsset {
  symbol: string;
  name: string;
  bucket: "us_stock" | "saudi_stock" | "etf" | "commodity" | "forex" | "crypto" | "macro";
  seed: boolean;
}

export interface GenesisScore {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  bucket: GenesisUniverseAsset["bucket"];
  price: number | null;
  changePercent: number | null;
  provider: string | null;
  quoteSuccess: boolean;
  dataMode: string;
  momentumScore: number;
  trendScore: number;
  volatilityRisk: number;
  liquidityScore: number;
  macroScore: number;
  newsSentimentScore: number;
  confidenceScore: number;
  finalGenesisScore: number;
  recommendation: GenesisRecommendation;
  quoteSnapshot: Partial<RouterQuote>;
  dataSources: string[];
  riskNotes: string[];
}

export interface GenesisAllocation {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  bucket: GenesisUniverseAsset["bucket"];
  targetWeight: number;
  targetValue: number;
  finalGenesisScore: number;
  recommendation: GenesisRecommendation;
}

export interface GenesisOrder {
  symbol: string;
  side: "buy" | "sell";
  targetWeight: number;
  oldWeight: number;
  notional: number;
  executionMode: GenesisExecutionMode;
  status: "proposed" | "paper_ready" | "blocked";
  reason: string;
}

export interface GenesisDecision {
  id: string;
  timestamp: string;
  symbol: string;
  action: GenesisRecommendation | "increase" | "decrease";
  oldWeight: number;
  newWeight: number;
  reason: string;
  confidence: number;
  dataSources: string[];
  quoteSnapshot: Partial<RouterQuote>;
  riskNotes: string[];
  executionMode: GenesisExecutionMode;
}

export interface GenesisCycleResult {
  timestamp: string;
  wallet: GenesisWallet;
  liveExecutionEnabled: false;
  aiMode: GenesisAIMode;
  entitlement: GenesisEntitlement;
  safety: GenesisSafetyProfile;
  mode: "analysis_only" | "paper_simulation";
  universeSize: number;
  analyzedCount: number;
  selectedCount: number;
  scores: GenesisScore[];
  allocations: GenesisAllocation[];
  proposedOrders: GenesisOrder[];
  paperOrders: GenesisOrder[];
  realOrders: GenesisOrder[];
  decisions: GenesisDecision[];
  riskWarnings: string[];
  rebalancePolicy: {
    lightReview: "daily";
    formalRebalance: "monthly";
    emergencyTriggers: string[];
    quarterlyReviewSupported: true;
  };
}

export interface GenesisReport {
  period: GenesisReportPeriod;
  generatedAt: string;
  portfolioValue: number;
  pnl: number;
  pnlPercent: number;
  allocation: GenesisAllocation[];
  topWinners: GenesisScore[];
  topLosers: GenesisScore[];
  removedAssets: string[];
  addedAssets: string[];
  aiReasoningSummary: string;
  riskStatus: "normal" | "watch" | "breach";
  riskWarnings: string[];
  progressTowardMonthlyTarget: number;
  liveExecutionEnabled: false;
  aiMode: GenesisAIMode;
  entitlement: GenesisEntitlement;
  safety: GenesisSafetyProfile;
}

const GENESIS_VERSION = "genesis100-v1";
const MAX_SINGLE_ASSET_WEIGHT = 0.08;
const MIN_CASH_RESERVE = 0.05;
const REPORT_FREQUENCIES: GenesisReportPeriod[] = ["hourly", "daily", "weekly", "monthly", "quarterly", "semiannual", "annual"];
const SAFETY_PROFILE: GenesisSafetyProfile = {
  externalTransfersAllowed: false,
  aiCanTransferOutsidePlatform: false,
  manualWithdrawalOnly: true,
  forbiddenActions: ["external_transfer", "withdrawal", "send_funds_outside_platform"],
};
const GROUP_CAPS: Partial<Record<GenesisUniverseAsset["bucket"], number>> = {
  crypto: 0.15,
  commodity: 0.20,
  forex: 0.10,
  saudi_stock: 0.20,
};

export const GENESIS_UNIVERSE: GenesisUniverseAsset[] = [
  { symbol: "AAPL", name: "Apple", bucket: "us_stock", seed: true },
  { symbol: "MSFT", name: "Microsoft", bucket: "us_stock", seed: true },
  { symbol: "NVDA", name: "NVIDIA", bucket: "us_stock", seed: true },
  { symbol: "AMZN", name: "Amazon", bucket: "us_stock", seed: true },
  { symbol: "GOOGL", name: "Alphabet", bucket: "us_stock", seed: true },
  { symbol: "META", name: "Meta Platforms", bucket: "us_stock", seed: true },
  { symbol: "TSLA", name: "Tesla", bucket: "us_stock", seed: true },
  { symbol: "JPM", name: "JPMorgan Chase", bucket: "us_stock", seed: true },
  { symbol: "BRK.B", name: "Berkshire Hathaway", bucket: "us_stock", seed: true },
  { symbol: "XOM", name: "Exxon Mobil", bucket: "us_stock", seed: true },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", bucket: "etf", seed: true },
  { symbol: "QQQ", name: "Invesco QQQ ETF", bucket: "etf", seed: true },
  { symbol: "2222.SR", name: "Saudi Aramco", bucket: "saudi_stock", seed: true },
  { symbol: "1120.SR", name: "Al Rajhi Bank", bucket: "saudi_stock", seed: true },
  { symbol: "2010.SR", name: "SABIC", bucket: "saudi_stock", seed: true },
  { symbol: "BTCUSDT", name: "Bitcoin", bucket: "crypto", seed: true },
  { symbol: "ETHUSDT", name: "Ethereum", bucket: "crypto", seed: true },
  { symbol: "XAUUSD", name: "Gold", bucket: "commodity", seed: true },
  { symbol: "XAGUSD", name: "Silver", bucket: "commodity", seed: true },
  { symbol: "WTI", name: "WTI Crude Oil", bucket: "commodity", seed: true },
  { symbol: "BRENT", name: "Brent Crude Oil", bucket: "commodity", seed: true },
  { symbol: "EURUSD", name: "Euro / US Dollar", bucket: "forex", seed: true },
  { symbol: "GBPUSD", name: "British Pound / US Dollar", bucket: "forex", seed: true },
  { symbol: "DXY", name: "US Dollar Index", bucket: "macro", seed: true },
  { symbol: "US10Y", name: "US 10Y Treasury Yield", bucket: "macro", seed: true },
];

const STATE: {
  wallet: GenesisWallet;
  controls: GenesisControls;
  notifications: GenesisNotificationPreferences;
  currentWeights: Record<string, number>;
  lastScores: GenesisScore[];
  lastAllocations: GenesisAllocation[];
  decisions: GenesisDecision[];
  lastCycle: GenesisCycleResult | null;
} = {
  wallet: {
    id: "genesis-100-isolated-wallet",
    name: "ForeSmart Genesis 100",
    capital: 100_000,
    cashBalance: 100_000,
    investedBalance: 0,
    targetMonthlyReturn: 0.025,
    maxDrawdown: 0.12,
    riskProfile: "balanced",
    status: "active_analysis",
    liveExecutionEnabled: false,
    brokerConnected: false,
    isolated: true,
    mainWalletAccess: false,
    updatedAt: new Date().toISOString(),
  },
  controls: {
    aiMode: "full_ai",
    explicitFullAIApproval: false,
    riskLimitsPass: true,
    executionAdapterConfigured: false,
  },
  notifications: {
    emailReportsEnabled: true,
    smsReportsEnabled: false,
    emailAlertsEnabled: true,
    smsAlertsEnabled: false,
    reportFrequencies: REPORT_FREQUENCIES,
    smsAvailable: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    smsUnavailableReason: process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
      ? null
      : "SMS provider is not configured",
  },
  currentWeights: {},
  lastScores: [],
  lastAllocations: [],
  decisions: [],
  lastCycle: null,
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function round(n: number, digits = 4): number {
  const m = 10 ** digits;
  return Math.round(n * m) / m;
}

export function getGenesisEntitlement(input?: Request | URLSearchParams | null): GenesisEntitlement {
  let requestedPlan: string | null = null;
  if (input instanceof Request) {
    const url = new URL(input.url);
    requestedPlan = url.searchParams.get("plan") ?? input.headers.get("x-foresmart-plan");
  } else if (input instanceof URLSearchParams) {
    requestedPlan = input.get("plan");
  }

  // Public demo mode remains enabled until an auth/plan context is wired in.
  // Passing ?plan=free or x-foresmart-plan: free exercises the locked response.
  const planActive = requestedPlan
    ? requestedPlan.toLowerCase() === "pro"
    : process.env.GENESIS100_PLAN_ACTIVE !== "false";

  return {
    allowed: planActive,
    reason: planActive ? null : "Genesis 100 requires Pro plan",
    planRequired: "pro",
    proPlanRequired: true,
    planActive,
    featureLocked: !planActive,
  };
}

function liveBrokerExecutionAllowed(): boolean {
  return Boolean(
    STATE.wallet.brokerConnected &&
    STATE.controls.aiMode === "full_ai" &&
    STATE.controls.explicitFullAIApproval &&
    STATE.controls.riskLimitsPass &&
    STATE.controls.executionAdapterConfigured,
  );
}

export function getGenesisCapabilityProfile(): GenesisCapabilityProfile {
  return {
    marketDataAnalysis: true,
    macroAnalysis: true,
    newsAnalysis: true,
    sentimentAnalysis: true,
    riskManagement: true,
    capitalAllocation: true,
    stopLossPlanning: true,
    takeProfitPlanning: true,
    portfolioRebalancing: true,
    decisionJournal: true,
    liveBrokerExecution: liveBrokerExecutionAllowed(),
  };
}

export function getAllowedCapabilities(): string[] {
  const profile = getGenesisCapabilityProfile();
  return Object.entries(profile).filter(([, enabled]) => enabled).map(([key]) => key);
}

export function getBlockedCapabilities(): string[] {
  const profile = getGenesisCapabilityProfile();
  return Object.entries(profile).filter(([, enabled]) => !enabled).map(([key]) => key);
}

export function getGenesisSafety() {
  return {
    product: "ForeSmart Genesis 100",
    liveExecutionEnabled: false,
    brokerConnected: STATE.wallet.brokerConnected,
    controls: STATE.controls,
    entitlement: getGenesisEntitlement(),
    safety: SAFETY_PROFILE,
    externalTransfersAllowed: SAFETY_PROFILE.externalTransfersAllowed,
    aiCanTransferOutsidePlatform: SAFETY_PROFILE.aiCanTransferOutsidePlatform,
    manualWithdrawalOnly: SAFETY_PROFILE.manualWithdrawalOnly,
    forbiddenActions: SAFETY_PROFILE.forbiddenActions,
    capabilityProfile: getGenesisCapabilityProfile(),
    allowedCapabilities: getAllowedCapabilities(),
    blockedCapabilities: getBlockedCapabilities(),
  };
}

export function getGenesisNotifications() {
  STATE.notifications.smsAvailable = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  STATE.notifications.smsUnavailableReason = STATE.notifications.smsAvailable ? null : "SMS provider is not configured";
  return {
    product: "ForeSmart Genesis 100",
    entitlement: getGenesisEntitlement(),
    notifications: STATE.notifications,
    smsAvailable: STATE.notifications.smsAvailable,
    smsUnavailableReason: STATE.notifications.smsUnavailableReason,
    liveExecutionEnabled: false,
    safety: SAFETY_PROFILE,
  };
}

export function getGenesisControls(input?: Request | URLSearchParams | null) {
  const entitlement = getGenesisEntitlement(input ?? null);
  return {
    product: "ForeSmart Genesis 100",
    aiMode: STATE.controls.aiMode,
    controls: STATE.controls,
    entitlement,
    planRequired: entitlement.planRequired,
    proPlanRequired: entitlement.proPlanRequired,
    planActive: entitlement.planActive,
    featureLocked: entitlement.featureLocked,
    allowed: entitlement.allowed,
    reason: entitlement.reason,
    liveExecutionEnabled: false,
    liveBrokerExecutionAllowed: liveBrokerExecutionAllowed(),
    capabilityProfile: getGenesisCapabilityProfile(),
    allowedCapabilities: getAllowedCapabilities(),
    blockedCapabilities: getBlockedCapabilities(),
    safety: SAFETY_PROFILE,
    notifications: STATE.notifications,
  };
}

export async function updateGenesisControls(request: Request) {
  const entitlement = getGenesisEntitlement(request);
  let payload: Partial<GenesisControls & GenesisNotificationPreferences> = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  if (!entitlement.allowed) {
    return {
      ...getGenesisControls(request),
      updated: false,
    };
  }

  if (payload.aiMode && ["off", "semi_ai", "full_ai"].includes(payload.aiMode)) {
    STATE.controls.aiMode = payload.aiMode;
  }
  if (typeof payload.explicitFullAIApproval === "boolean") {
    STATE.controls.explicitFullAIApproval = payload.explicitFullAIApproval;
  }
  if (typeof payload.emailReportsEnabled === "boolean") STATE.notifications.emailReportsEnabled = payload.emailReportsEnabled;
  if (typeof payload.emailAlertsEnabled === "boolean") STATE.notifications.emailAlertsEnabled = payload.emailAlertsEnabled;
  if (typeof payload.smsReportsEnabled === "boolean") STATE.notifications.smsReportsEnabled = payload.smsReportsEnabled && STATE.notifications.smsAvailable;
  if (typeof payload.smsAlertsEnabled === "boolean") STATE.notifications.smsAlertsEnabled = payload.smsAlertsEnabled && STATE.notifications.smsAvailable;

  return {
    ...getGenesisControls(request),
    updated: true,
  };
}

function bucketFor(symbol: string, assetClass: AssetClass): GenesisUniverseAsset["bucket"] {
  const seeded = GENESIS_UNIVERSE.find((a) => a.symbol === symbol);
  if (seeded) return seeded.bucket;
  if (assetClass === "crypto") return "crypto";
  if (assetClass === "saudi_stock") return "saudi_stock";
  if (assetClass === "commodity" || assetClass === "metal") return "commodity";
  if (assetClass === "forex") return "forex";
  if (assetClass === "etf") return "etf";
  if (assetClass === "treasury" || assetClass === "index" || assetClass === "bond") return "macro";
  return "us_stock";
}

function genesisQuoteTimeoutMs(symbol: string): number {
  return ["EURUSD", "XAUUSD", "XAGUSD", "DXY"].includes(symbol.toUpperCase()) ? 2800 : 5500;
}

async function quoteWithTimeout(symbol: string, timeoutMs = genesisQuoteTimeoutMs(symbol)): Promise<RouterQuote> {
  const timeout = new Promise<RouterQuote>((resolve) => {
    setTimeout(() => {
      const resolved = resolveAsset(symbol);
      resolve({
        success: false,
        provider: null,
        mode: "synthetic",
        latency: timeoutMs,
        price: null,
        change: null,
        changePercent: null,
        volume: null,
        liquidity: null,
        timestamp: Date.now(),
        delayed: true,
        fallbackUsed: true,
        symbol: resolved.normalized || symbol,
        assetClass: resolved.assetClass,
        error: "genesis quote timeout",
      });
    }, timeoutMs);
  });

  return Promise.race([routeQuote(symbol), timeout]);
}

function scoreAsset(asset: GenesisUniverseAsset, quote: RouterQuote): GenesisScore {
  const assetClass = quote.assetClass || resolveAsset(asset.symbol).assetClass;
  const bucket = bucketFor(asset.symbol, assetClass);
  const changePercent = typeof quote.changePercent === "number" ? quote.changePercent : 0;
  const absChange = Math.abs(changePercent);

  const momentumScore = clamp(50 + changePercent * 6);
  const trendScore = clamp(50 + changePercent * 4 + (quote.success ? 8 : -12));
  const bucketRisk = bucket === "crypto" ? 30 : bucket === "commodity" ? 22 : bucket === "forex" ? 14 : bucket === "saudi_stock" ? 18 : 12;
  const volatilityRisk = clamp(bucketRisk + absChange * 3);
  const liquidityScore = quote.volume && quote.volume > 0
    ? clamp(55 + Math.log10(Number(quote.volume) + 1) * 6)
    : quote.success ? 58 : 25;
  const macroScore = bucket === "macro" ? 62 : bucket === "etf" ? 64 : bucket === "forex" ? 55 : 58;
  const newsSentimentScore = 50;
  const confidenceScore = clamp(
    (quote.success ? 68 : 25) +
    (quote.provider ? 12 : 0) +
    (quote.mode === "live" ? 10 : quote.mode === "delayed" ? 4 : 0) -
    (quote.fallbackUsed ? 5 : 0),
  );

  const finalGenesisScore = clamp(
    momentumScore * 0.20 +
    trendScore * 0.20 +
    (100 - volatilityRisk) * 0.15 +
    liquidityScore * 0.15 +
    macroScore * 0.10 +
    newsSentimentScore * 0.05 +
    confidenceScore * 0.15,
  );

  const recommendation: GenesisRecommendation =
    !quote.success ? "watch" :
    finalGenesisScore >= 72 ? "include" :
    finalGenesisScore >= 58 ? "hold" :
    finalGenesisScore >= 45 ? "reduce" :
    "remove";

  const riskNotes = [
    ...(!quote.success ? [`Quote unavailable: ${quote.error ?? "unknown provider failure"}`] : []),
    ...(volatilityRisk > 45 ? ["Elevated volatility risk"] : []),
    ...(bucket === "crypto" ? ["Crypto exposure capped at 15%"] : []),
    ...(bucket === "commodity" ? ["Commodity exposure capped at 20%"] : []),
  ];

  return {
    symbol: asset.symbol,
    name: asset.name,
    assetClass,
    bucket,
    price: quote.price,
    changePercent: quote.changePercent,
    provider: quote.provider,
    quoteSuccess: quote.success,
    dataMode: quote.mode,
    momentumScore: round(momentumScore, 2),
    trendScore: round(trendScore, 2),
    volatilityRisk: round(volatilityRisk, 2),
    liquidityScore: round(liquidityScore, 2),
    macroScore: round(macroScore, 2),
    newsSentimentScore,
    confidenceScore: round(confidenceScore, 2),
    finalGenesisScore: round(finalGenesisScore, 2),
    recommendation,
    quoteSnapshot: {
      success: quote.success,
      provider: quote.provider,
      mode: quote.mode,
      price: quote.price,
      changePercent: quote.changePercent,
      volume: quote.volume,
      timestamp: quote.timestamp,
      symbol: quote.symbol,
      assetClass: quote.assetClass,
      providerPriority: quote.providerPriority,
      attempted: quote.attempted,
      error: quote.error,
    },
    dataSources: [quote.provider, ...(quote.attempted ?? [])].filter(Boolean) as string[],
    riskNotes,
  };
}

export function getGenesisStatus(input?: Request | URLSearchParams | null) {
  const entitlement = getGenesisEntitlement(input ?? null);
  return {
    product: "ForeSmart Genesis 100",
    version: GENESIS_VERSION,
    wallet: STATE.wallet,
    aiMode: STATE.controls.aiMode,
    controls: STATE.controls,
    entitlement,
    planRequired: entitlement.planRequired,
    proPlanRequired: entitlement.proPlanRequired,
    planActive: entitlement.planActive,
    featureLocked: entitlement.featureLocked,
    liveExecutionEnabled: false,
    brokerConnected: false,
    externalTransfersAllowed: SAFETY_PROFILE.externalTransfersAllowed,
    aiCanTransferOutsidePlatform: SAFETY_PROFILE.aiCanTransferOutsidePlatform,
    manualWithdrawalOnly: SAFETY_PROFILE.manualWithdrawalOnly,
    forbiddenActions: SAFETY_PROFILE.forbiddenActions,
    allowedCapabilities: getAllowedCapabilities(),
    blockedCapabilities: getBlockedCapabilities(),
    capabilityProfile: getGenesisCapabilityProfile(),
    notifications: STATE.notifications,
    allowedOrderTypes: {
      proposedOrders: true,
      paperOrders: true,
      realOrders: false,
    },
    currentAIMode: STATE.wallet.status === "paper_trading" ? "paper_simulation" : "analysis_only",
    lastCycleAt: STATE.lastCycle?.timestamp ?? null,
    safeguards: [
      "Genesis 100 wallet is isolated from the main wallet.",
      "Real broker execution is blocked until brokerConnected, explicit confirmation, risk limits, and an execution adapter are present.",
      "Current module only produces analysis, target allocations, proposed orders, and paper orders.",
    ],
  };
}

export function getGenesisUniverse(input?: Request | URLSearchParams | null) {
  const entitlement = getGenesisEntitlement(input ?? null);
  return {
    product: "ForeSmart Genesis 100",
    maxAssets: 100,
    expansionSupported: true,
    entitlement,
    planRequired: entitlement.planRequired,
    planActive: entitlement.planActive,
    featureLocked: entitlement.featureLocked,
    safety: SAFETY_PROFILE,
    universe: GENESIS_UNIVERSE,
  };
}

export async function analyzeGenesisUniverse(): Promise<GenesisScore[]> {
  const quotes = await Promise.all(GENESIS_UNIVERSE.map(async (asset) => {
    try {
      return await quoteWithTimeout(asset.symbol);
    } catch (error) {
      const resolved = resolveAsset(asset.symbol);
      return {
        success: false,
        provider: null,
        mode: "synthetic",
        latency: 0,
        price: null,
        change: null,
        changePercent: null,
        volume: null,
        liquidity: null,
        timestamp: Date.now(),
        delayed: true,
        fallbackUsed: true,
        symbol: resolved.normalized || asset.symbol,
        assetClass: resolved.assetClass,
        error: error instanceof Error ? error.message : "quote failed",
      } satisfies RouterQuote;
    }
  }));

  const scores = GENESIS_UNIVERSE.map((asset, index) => scoreAsset(asset, quotes[index]))
    .sort((a, b) => b.finalGenesisScore - a.finalGenesisScore);

  STATE.lastScores = scores;
  return scores;
}

function applyGroupCaps(allocations: GenesisAllocation[]): GenesisAllocation[] {
  let capped = allocations.map((a) => ({ ...a, targetWeight: Math.min(a.targetWeight, MAX_SINGLE_ASSET_WEIGHT) }));

  for (const [bucket, cap] of Object.entries(GROUP_CAPS) as Array<[GenesisUniverseAsset["bucket"], number]>) {
    const group = capped.filter((a) => a.bucket === bucket);
    const total = group.reduce((sum, a) => sum + a.targetWeight, 0);
    if (total > cap && total > 0) {
      const factor = cap / total;
      capped = capped.map((a) => a.bucket === bucket ? { ...a, targetWeight: a.targetWeight * factor } : a);
    }
  }

  const capital = STATE.wallet.capital;
  return capped.map((a) => ({
    ...a,
    targetWeight: round(a.targetWeight, 4),
    targetValue: round(a.targetWeight * capital, 2),
  }));
}

export function allocateGenesis100(scores = STATE.lastScores): GenesisAllocation[] {
  const selected = scores
    .filter((s) => s.quoteSuccess && s.recommendation !== "remove")
    .slice(0, 100);

  if (selected.length === 0) {
    STATE.lastAllocations = [];
    return [];
  }

  const investableWeight = 1 - MIN_CASH_RESERVE;
  const totalScore = selected.reduce((sum, s) => sum + Math.max(1, s.finalGenesisScore), 0);
  const raw = selected.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    assetClass: s.assetClass,
    bucket: s.bucket,
    targetWeight: (Math.max(1, s.finalGenesisScore) / totalScore) * investableWeight,
    targetValue: 0,
    finalGenesisScore: s.finalGenesisScore,
    recommendation: s.recommendation,
  }));

  const allocations = applyGroupCaps(raw).sort((a, b) => b.targetWeight - a.targetWeight);
  STATE.lastAllocations = allocations;

  const investedWeight = allocations.reduce((sum, a) => sum + a.targetWeight, 0);
  STATE.wallet = {
    ...STATE.wallet,
    cashBalance: round(STATE.wallet.capital * Math.max(MIN_CASH_RESERVE, 1 - investedWeight), 2),
    investedBalance: round(STATE.wallet.capital * investedWeight, 2),
    updatedAt: new Date().toISOString(),
  };

  return allocations;
}

function buildOrders(allocations: GenesisAllocation[]): GenesisOrder[] {
  return allocations
    .map((a) => {
      const oldWeight = STATE.currentWeights[a.symbol] ?? 0;
      const delta = a.targetWeight - oldWeight;
      if (Math.abs(delta) < 0.002) return null;
      return {
        symbol: a.symbol,
        side: delta > 0 ? "buy" : "sell",
        targetWeight: a.targetWeight,
        oldWeight,
        notional: round(Math.abs(delta) * STATE.wallet.capital, 2),
        executionMode: "paper" as GenesisExecutionMode,
        status: "paper_ready" as const,
        reason: "Paper-only Genesis 100 rebalance proposal",
      };
    })
    .filter(Boolean) as GenesisOrder[];
}

function buildDecisions(scores: GenesisScore[], allocations: GenesisAllocation[]): GenesisDecision[] {
  const at = new Date().toISOString();
  const allocationBySymbol = new Map(allocations.map((a) => [a.symbol, a]));

  return scores.slice(0, 100).map((score) => {
    const allocation = allocationBySymbol.get(score.symbol);
    const oldWeight = STATE.currentWeights[score.symbol] ?? 0;
    const newWeight = allocation?.targetWeight ?? 0;
    const action: GenesisDecision["action"] =
      newWeight > oldWeight + 0.002 ? "increase" :
      newWeight < oldWeight - 0.002 ? "decrease" :
      score.recommendation;

    return {
      id: `${at}-${score.symbol}`,
      timestamp: at,
      symbol: score.symbol,
      action,
      oldWeight: round(oldWeight, 4),
      newWeight: round(newWeight, 4),
      reason: `${score.recommendation} with Genesis score ${score.finalGenesisScore}; confidence ${score.confidenceScore}.`,
      confidence: score.confidenceScore,
      dataSources: score.dataSources,
      quoteSnapshot: score.quoteSnapshot,
      riskNotes: score.riskNotes,
      executionMode: newWeight > 0 ? "paper" : "analysis_only",
    };
  });
}

function riskWarnings(scores: GenesisScore[], allocations: GenesisAllocation[]): string[] {
  const warnings = new Set<string>();
  const cashWeight = 1 - allocations.reduce((sum, a) => sum + a.targetWeight, 0);
  if (cashWeight < MIN_CASH_RESERVE) warnings.add("Cash reserve is below policy minimum.");
  for (const score of scores) {
    if (!score.quoteSuccess) warnings.add(`Quote unavailable for ${score.symbol}.`);
    if (score.volatilityRisk > 55) warnings.add(`High volatility risk for ${score.symbol}.`);
  }
  return [...warnings].slice(0, 20);
}

export async function runGenesisCycle(input?: Request | URLSearchParams | null): Promise<GenesisCycleResult> {
  const entitlement = getGenesisEntitlement(input ?? null);
  if (!entitlement.allowed || STATE.controls.aiMode === "off") {
    const cycle: GenesisCycleResult = {
      timestamp: new Date().toISOString(),
      wallet: STATE.wallet,
      liveExecutionEnabled: false,
      aiMode: STATE.controls.aiMode,
      entitlement,
      safety: SAFETY_PROFILE,
      mode: "analysis_only",
      universeSize: GENESIS_UNIVERSE.length,
      analyzedCount: 0,
      selectedCount: 0,
      scores: STATE.lastScores,
      allocations: STATE.lastAllocations,
      proposedOrders: [],
      paperOrders: [],
      realOrders: [],
      decisions: [],
      riskWarnings: [entitlement.reason ?? "AI mode is off; no trading decisions generated."],
      rebalancePolicy: {
        lightReview: "daily",
        formalRebalance: "monthly",
        emergencyTriggers: ["risk breach", "severe drawdown", "provider failure", "major signal change"],
        quarterlyReviewSupported: true,
      },
    };
    STATE.lastCycle = cycle;
    return cycle;
  }

  const scores = await analyzeGenesisUniverse();
  const allocations = allocateGenesis100(scores);
  const proposedOrders = buildOrders(allocations).map((o) => ({ ...o, executionMode: "analysis_only" as GenesisExecutionMode, status: "proposed" as const }));
  const paperOrders = STATE.controls.aiMode === "full_ai" ? buildOrders(allocations) : [];
  const decisions = buildDecisions(scores, allocations);
  const warnings = riskWarnings(scores, allocations);

  for (const allocation of allocations) {
    STATE.currentWeights[allocation.symbol] = allocation.targetWeight;
  }
  STATE.wallet = {
    ...STATE.wallet,
    status: "paper_trading",
    updatedAt: new Date().toISOString(),
  };
  STATE.decisions = [...decisions, ...STATE.decisions].slice(0, 500);

  const cycle: GenesisCycleResult = {
    timestamp: new Date().toISOString(),
    wallet: STATE.wallet,
    liveExecutionEnabled: false,
    aiMode: STATE.controls.aiMode,
    entitlement,
    safety: SAFETY_PROFILE,
    mode: "paper_simulation",
    universeSize: GENESIS_UNIVERSE.length,
    analyzedCount: scores.length,
    selectedCount: allocations.length,
    scores,
    allocations,
    proposedOrders,
    paperOrders,
    realOrders: [],
    decisions,
    riskWarnings: warnings,
    rebalancePolicy: {
      lightReview: "daily",
      formalRebalance: "monthly",
      emergencyTriggers: [
        "risk breach",
        "severe drawdown",
        "provider failure",
        "major signal change",
      ],
      quarterlyReviewSupported: true,
    },
  };

  STATE.lastCycle = cycle;
  return cycle;
}

export function getGenesisAllocations(input?: Request | URLSearchParams | null) {
  const entitlement = getGenesisEntitlement(input ?? null);
  return {
    product: "ForeSmart Genesis 100",
    wallet: STATE.wallet,
    aiMode: STATE.controls.aiMode,
    entitlement,
    planRequired: entitlement.planRequired,
    planActive: entitlement.planActive,
    featureLocked: entitlement.featureLocked,
    allocations: STATE.lastAllocations,
    cashReserveWeight: round(STATE.wallet.cashBalance / STATE.wallet.capital, 4),
    liveExecutionEnabled: false,
    safety: SAFETY_PROFILE,
  };
}

export function getGenesisDecisions(input?: Request | URLSearchParams | null) {
  const entitlement = getGenesisEntitlement(input ?? null);
  return {
    product: "ForeSmart Genesis 100",
    aiMode: STATE.controls.aiMode,
    entitlement,
    planRequired: entitlement.planRequired,
    planActive: entitlement.planActive,
    featureLocked: entitlement.featureLocked,
    count: STATE.decisions.length,
    decisions: STATE.decisions,
    liveExecutionEnabled: false,
    safety: SAFETY_PROFILE,
  };
}

export function buildGenesisReport(period: GenesisReportPeriod = "daily", input?: Request | URLSearchParams | null): GenesisReport {
  const entitlement = getGenesisEntitlement(input ?? null);
  const scores = STATE.lastScores;
  const allocations = STATE.lastAllocations;
  const weightedChange = allocations.reduce((sum, allocation) => {
    const score = scores.find((s) => s.symbol === allocation.symbol);
    return sum + allocation.targetWeight * ((score?.changePercent ?? 0) / 100);
  }, 0);
  const pnl = round(STATE.wallet.capital * weightedChange, 2);
  const topWinners = [...scores].filter((s) => s.changePercent != null).sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0)).slice(0, 5);
  const topLosers = [...scores].filter((s) => s.changePercent != null).sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0)).slice(0, 5);
  const removedAssets = scores.filter((s) => s.recommendation === "remove").map((s) => s.symbol);
  const addedAssets = allocations.filter((a) => (STATE.currentWeights[a.symbol] ?? 0) > 0).map((a) => a.symbol).slice(0, 20);
  const warnings = STATE.lastCycle?.riskWarnings ?? riskWarnings(scores, allocations);

  return {
    period,
    generatedAt: new Date().toISOString(),
    portfolioValue: round(STATE.wallet.capital + pnl, 2),
    pnl,
    pnlPercent: round(weightedChange * 100, 2),
    allocation: allocations,
    topWinners,
    topLosers,
    removedAssets,
    addedAssets,
    aiReasoningSummary: allocations.length
      ? `Genesis 100 selected ${allocations.length} assets using live router quotes, confidence scoring, and risk caps. Real execution remains disabled.`
      : "Genesis 100 has not completed a cycle yet. Run a paper cycle to populate allocations.",
    riskStatus: warnings.length > 8 ? "breach" : warnings.length > 0 ? "watch" : "normal",
    riskWarnings: warnings,
    progressTowardMonthlyTarget: round((weightedChange / STATE.wallet.targetMonthlyReturn) * 100, 2),
    liveExecutionEnabled: false,
    aiMode: STATE.controls.aiMode,
    entitlement,
    safety: SAFETY_PROFILE,
  };
}

export function parseGenesisPeriod(value: string | null): GenesisReportPeriod {
  const allowed: GenesisReportPeriod[] = ["hourly", "daily", "weekly", "monthly", "quarterly", "semiannual", "annual"];
  return allowed.includes(value as GenesisReportPeriod) ? value as GenesisReportPeriod : "daily";
}
