import { routeQuote, resolveAsset, type AssetClass, type RouterQuote } from "@/lib/market/router";
import { analyzeAssetWithGemini, type GenesisIntelligenceOutput } from "@/lib/genesis100/intelligence/genesisIntelligenceEngine";
import { loadLatestState, saveDecisionCycle } from "@/lib/genesis100/persistence/genesisStore";
import { checkOpenPositions } from "@/lib/genesis100/execution/positionMonitor";
import type { ConsensusWeights } from "@/lib/genesis100/algorithms/consensusEngine";
import { analyzeLearningOutcomes, type LearningInsights } from "@/lib/genesis100/algorithms/learningEngine";
import { evaluateArchiveOutcomes, type LearningDecisionInput } from "@/lib/genesis100/learning/outcomeTracker";
import { applyLearningToWeights } from "@/lib/genesis100/learning/weightAdjuster";
import { fetchRealMacroContext } from "@/lib/genesis100/macro/macroDataService";
import { analyzeTechnical } from "@/lib/genesis100/algorithms/technicalAnalysis";
import { sendEmail } from "@/lib/email.service";

export type GenesisStatus = "draft" | "active_analysis" | "paper_trading" | "execution_ready" | "paused";
export type GenesisRiskProfile = "conservative" | "balanced" | "growth";
export type GenesisRecommendation = "strong_buy" | "buy" | "accumulate" | "hold" | "reduce" | "exit" | "watch" | "blocked";
export type GenesisPositionAction = GenesisRecommendation | "increase" | "decrease" | "stop_loss" | "take_profit" | "rebalance" | "blocked_low_credibility";
export type GenesisExecutionMode = "analysis_only" | "paper" | "live_blocked" | "live";
export type GenesisReportPeriod = "hourly" | "daily" | "weekly" | "monthly" | "quarterly" | "semiannual" | "annual";
export type GenesisAIMode = "off" | "semi_ai" | "full_ai";
export type GenesisRiskMode = "blocked" | "very_cautious" | "cautious" | "balanced" | "confident" | "high_confidence" | "maximum_confidence";
export type GenesisCredibilityTier = "below_51" | "51_60" | "61_65" | "66_75" | "76_85" | "86_95" | "96_100";
export type GenesisStopLossUrgency = "low" | "medium" | "high" | "critical";
export type GenesisSourceStatus = "connected" | "partial" | "framework_ready_provider_missing";

export const GENESIS_INTELLIGENCE_VERSION = "genesis-intelligence-v2";
export const MINIMUM_DECISION_CREDIBILITY_PERCENT = 51;

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

export interface GenesisPositionSizing {
  decisionCredibilityPercent: number;
  credibilityTier: GenesisCredibilityTier;
  allocationMultiplier: number;
  riskMode: GenesisRiskMode;
  maxSingleDecisionCapitalPercent: number;
  allowedCapitalForDecision: number;
  positionSizingReasonAr: string;
  positionSizingReasonEn: string;
  stopLossUrgency: GenesisStopLossUrgency;
  actionAllowed: boolean;
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
  priceMomentumScore: number;
  trendStrengthScore: number;
  volatilityScore: number;
  macroSensitivityScore: number;
  riskAdjustedReturnScore: number;
  drawdownRiskScore: number;
  correlationRiskScore: number;
  newsImpactScore: number;
  sentimentScore: number;
  fundamentalsScore: number;
  sectorStrengthScore: number;
  technicalStructureScore: number;
  capitalEfficiencyScore: number;
  stopLossScore: number;
  takeProfitScore: number;
  timingScore: number;
  finalDecisionScore: number;
  decisionConfidencePercent: number;
  sourceCredibilityPercent: number;
  dataCredibilityPercent: number;
  marketConfirmationPercent: number;
  riskApprovalPercent: number;
  finalApprovalPercent: number;
  minimumDecisionCredibilityPercent: 51;
  decisionStrengthPercent: number;
  expectedUpsidePercent: number | null;
  expectedDownsidePercent: number | null;
  riskPercent: number;
  allocationConfidencePercent: number;
  decisionCredibilityPercent: number;
  credibilityTier: GenesisCredibilityTier;
  allocationMultiplier: number;
  riskMode: GenesisRiskMode;
  maxSingleDecisionCapitalPercent: number;
  allowedCapitalForDecision: number;
  positionSizingReasonAr: string;
  positionSizingReasonEn: string;
  stopLossUrgency: GenesisStopLossUrgency;
  actionAllowed: boolean;
  action: GenesisPositionAction;
  blockedReason: string | null;
  positionSizing: GenesisPositionSizing;
  recommendation: GenesisRecommendation;
  primaryReason: string;
  supportingReasons: string[];
  riskWarnings: string[];
  dataQuality: "high" | "medium" | "low";
  dataFreshness: "live" | "delayed" | "stale";
  providerReliability: number;
  aiDecisionSummaryAr: string;
  aiDecisionSummaryEn: string;
  quoteSnapshot: Partial<RouterQuote>;
  dataSources: string[];
  riskNotes: string[];
  // Phase A — Gemini intelligence layer
  arabicReasoning: string;
  keyRisks: string[];
  keyOpportunities: string[];
  geminiAnalysisUsed: boolean;
  schoolsBreakdown: {
    keynesian: number;
    monetarist: number;
    austrian: number;
    behavioral: number;
    valueinvesting: number;
    globalMacro: number;
  } | null;
  // Phase D/E — structured consensus fields carried into archive
  dominantSchool: string | null;
  consensusAgreementLevel: string | null;
  structuredConsensusScore: number | null;
  // Technical analysis signals
  technicalSignal: {
    trend: string;
    momentum: string;
    rsiSignal: string;
    arabicSummary: string;
  };
}

export interface GenesisAllocation {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  bucket: GenesisUniverseAsset["bucket"];
  targetWeight: number;
  targetValue: number;
  finalGenesisScore: number;
  allocationConfidencePercent: number;
  decisionConfidencePercent: number;
  decisionCredibilityPercent: number;
  sourceCredibilityPercent: number;
  dataCredibilityPercent: number;
  marketConfirmationPercent: number;
  riskApprovalPercent: number;
  finalApprovalPercent: number;
  blockedReason: string | null;
  riskPercent: number;
  action: GenesisPositionAction;
  decisionCredibilityPercent: number;
  sourceCredibilityPercent: number;
  dataCredibilityPercent: number;
  marketConfirmationPercent: number;
  riskApprovalPercent: number;
  finalApprovalPercent: number;
  credibilityTier: GenesisCredibilityTier;
  allocationMultiplier: number;
  riskMode: GenesisRiskMode;
  maxSingleDecisionCapitalPercent: number;
  allowedCapitalForDecision: number;
  positionSizingReasonAr: string;
  positionSizingReasonEn: string;
  stopLossUrgency: GenesisStopLossUrgency;
  actionAllowed: boolean;
  blockedReason: string | null;
  reason: string;
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
  action: GenesisPositionAction;
  oldWeight: number;
  newWeight: number;
  reason: string;
  confidence: number;
  dataSources: string[];
  quoteSnapshot: Partial<RouterQuote>;
  riskNotes: string[];
  executionMode: GenesisExecutionMode;
}

export interface GenesisPortfolioDecision {
  marketRegime: "risk_on" | "risk_off" | "mixed" | "defensive";
  portfolioRiskLevel: "low" | "medium" | "high";
  recommendedCashReserve: number;
  topOpportunities: string[];
  topRisks: string[];
  assetsToIncrease: string[];
  assetsToReduce: string[];
  assetsToRemove: string[];
  assetsToWatch: string[];
  rebalanceUrgency: "low" | "medium" | "high" | "emergency";
  nextReviewAt: string;
  aiPortfolioSummaryAr: string;
  aiPortfolioSummaryEn: string;
}

export interface GenesisArchivedDecision {
  id: string;
  timestamp: string;
  cycleId: string;
  symbol: string;
  assetName: string;
  assetClass: AssetClass;
  previousRecommendation: GenesisRecommendation | null;
  newRecommendation: GenesisRecommendation;
  decisionConfidencePercent: number;
  finalDecisionScore: number;
  targetWeight: number;
  previousWeight: number;
  action: GenesisPositionAction;
  decisionCredibilityPercent: number;
  sourceCredibilityPercent: number;
  finalApprovalPercent: number;
  credibilityTier: GenesisCredibilityTier;
  allocationMultiplier: number;
  riskMode: GenesisRiskMode;
  maxSingleDecisionCapitalPercent: number;
  allowedCapitalForDecision: number;
  positionSizingReasonAr: string;
  positionSizingReasonEn: string;
  stopLossUrgency: GenesisStopLossUrgency;
  actionAllowed: boolean;
  blockedReason: string | null;
  reasonAr: string;
  reasonEn: string;
  dataSources: string[];
  quoteSnapshot: Partial<RouterQuote>;
  riskWarnings: string[];
  aiMode: GenesisAIMode;
  executionMode: GenesisExecutionMode;
  intelligenceVersion: typeof GENESIS_INTELLIGENCE_VERSION;
  createdBy: "genesis100-ai";
  // Phase E — learning loop fields
  schoolScoresAtDecision?: Record<string, number>;
  dominantSchoolAtDecision?: string;
  consensusAgreementLevel?: string | null;
  structuredConsensusScore?: number | null;
  geminiAnalysisUsed?: boolean;
}

export interface GenesisIntelligenceV2 {
  intelligenceVersion: typeof GENESIS_INTELLIGENCE_VERSION;
  marketRegime: GenesisPortfolioDecision["marketRegime"];
  overallMarketSentiment: number;
  equitySentiment: number;
  cryptoSentiment: number;
  oilSentiment: number;
  metalsSentiment: number;
  forexSentiment: number;
  saudiMarketSentiment: number;
  riskOnRiskOff: "risk_on" | "risk_off" | "neutral";
  confidencePercent: number;
  sourceStatus: GenesisSourceStatus;
  enabledSourceCategories: string[];
  aiPortfolioSummaryAr: string;
  aiPortfolioSummaryEn: string;
}

export interface GenesisPositionSizingSummary {
  totalAllowedCapital: number;
  blockedLowCredibilityCapital: number;
  capitalByCredibilityTier: Record<GenesisCredibilityTier, number>;
  averageDecisionCredibilityPercent: number;
  highConfidenceCount: number;
  blockedCount: number;
  tierExamples: Record<GenesisCredibilityTier, GenesisPositionSizing>;
}

export interface GenesisCycleResult {
  cycleId: string;
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
  portfolioDecision: GenesisPortfolioDecision;
  decisionArchiveCount: number;
  approvedDecisionCount: number;
  blockedDecisionCount: number;
  topApprovedDecisions: GenesisArchivedDecision[];
  topBlockedDecisions: GenesisArchivedDecision[];
  topDecisions: GenesisArchivedDecision[];
  positionSizingSummary: GenesisPositionSizingSummary;
  capitalByCredibilityTier: Record<GenesisCredibilityTier, number>;
  blockedLowCredibilityCapital: number;
  topHighConfidenceAllocations: GenesisAllocation[];
  topLowConfidenceWatchlist: GenesisScore[];
  riskWarnings: string[];
  rebalancePolicy: {
    lightReview: "daily";
    formalRebalance: "monthly";
    emergencyTriggers: string[];
    quarterlyReviewSupported: true;
  };
  // Phase C — position monitor (advisory only)
  positionMonitor?: import("@/lib/genesis100/execution/positionMonitor").PositionMonitorResult[];
  // Phase E — learning loop
  learningInsights?: LearningInsights;
  learnedWeightsApplied?: boolean;
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
const CREDIBILITY_TIERS: Array<{
  min: number;
  max: number;
  credibilityTier: GenesisCredibilityTier;
  allocationMultiplier: number;
  riskMode: GenesisRiskMode;
  maxSingleDecisionCapitalPercent: number;
}> = [
  { min: 0, max: 50.999, credibilityTier: "below_51", allocationMultiplier: 0, riskMode: "blocked", maxSingleDecisionCapitalPercent: 0 },
  { min: 51, max: 60, credibilityTier: "51_60", allocationMultiplier: 0.25, riskMode: "very_cautious", maxSingleDecisionCapitalPercent: 1 },
  { min: 61, max: 65, credibilityTier: "61_65", allocationMultiplier: 0.40, riskMode: "cautious", maxSingleDecisionCapitalPercent: 2 },
  { min: 66, max: 75, credibilityTier: "66_75", allocationMultiplier: 0.60, riskMode: "balanced", maxSingleDecisionCapitalPercent: 4 },
  { min: 76, max: 85, credibilityTier: "76_85", allocationMultiplier: 0.80, riskMode: "confident", maxSingleDecisionCapitalPercent: 6 },
  { min: 86, max: 95, credibilityTier: "86_95", allocationMultiplier: 1.00, riskMode: "high_confidence", maxSingleDecisionCapitalPercent: 8 },
  { min: 96, max: 100, credibilityTier: "96_100", allocationMultiplier: 1.15, riskMode: "maximum_confidence", maxSingleDecisionCapitalPercent: 8 },
];
const SOURCE_CATEGORIES = [
  "official_economic_sources",
  "central_banks",
  "financial_news_channels",
  "market_news",
  "company_news",
  "commodity_news",
  "oil_news",
  "metals_news",
  "crypto_news",
  "economic_influencers",
  "analyst_commentary",
];
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
  previousRecommendations: Record<string, GenesisRecommendation>;
  lastScores: GenesisScore[];
  lastAllocations: GenesisAllocation[];
  decisions: GenesisDecision[];
  decisionArchive: GenesisArchivedDecision[];
  lastPortfolioDecision: GenesisPortfolioDecision | null;
  lastCycle: GenesisCycleResult | null;
  // Phase E — learning loop state
  learnedConsensusWeights: ConsensusWeights | null;
  lastLearningInsights: LearningInsights | null;
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
  previousRecommendations: {},
  lastScores: [],
  lastAllocations: [],
  decisions: [],
  decisionArchive: [],
  lastPortfolioDecision: null,
  lastCycle: null,
  learnedConsensusWeights: null,
  lastLearningInsights: null,
};

// Auto-cycle: runs every 6 hours automatically
let _autoCycleTimer: ReturnType<typeof setInterval> | null = null;

function startAutoCycle(): void {
  if (_autoCycleTimer) return; // already running
  // Run immediately 30 seconds after server start
  setTimeout(() => {
    runGenesisCycle().catch(err =>
      console.warn("[genesis] Auto-cycle failed:", err)
    );
  }, 30000);

  // Then every 6 hours
  _autoCycleTimer = setInterval(() => {
    runGenesisCycle().catch(err =>
      console.warn("[genesis] Auto-cycle failed:", err)
    );
  }, 6 * 60 * 60 * 1000);
}

// Start auto-cycle when module loads
startAutoCycle();

// Phase B — lazy Supabase hydration (runs once on first runGenesisCycle call)
let _stateHydrated = false;
let _hydratePromise: Promise<void> | null = null;

async function hydrateStateFromDB(): Promise<void> {
  if (_stateHydrated) return;
  if (_hydratePromise) { await _hydratePromise; return; }
  _hydratePromise = (async () => {
    try {
      const saved = await loadLatestState();
      if (saved?.decisionArchive.length) {
        STATE.decisionArchive = saved.decisionArchive;
        STATE.previousRecommendations = saved.previousRecommendations;
        STATE.currentWeights = saved.currentWeights;
        console.info(`[genesis] Hydrated state from DB: ${saved.decisionArchive.length} archived decisions`);
      }
    } catch (err) {
      console.warn("[genesis] State hydration failed, using in-memory defaults:", err);
    } finally {
      _stateHydrated = true;
    }
  })();
  await _hydratePromise;
}

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

function recommendationFor(score: number, riskPercent: number, quoteSuccess: boolean): GenesisRecommendation {
  if (!quoteSuccess) return "watch";
  if (riskPercent >= 78) return "blocked";
  if (score >= 82) return "strong_buy";
  if (score >= 72) return "buy";
  if (score >= 63) return "accumulate";
  if (score >= 50) return "hold";
  if (score >= 40) return "reduce";
  return "exit";
}

function actionFor(recommendation: GenesisRecommendation, oldWeight: number, newWeight: number): GenesisAllocation["action"] {
  if (recommendation === "blocked") return "blocked_low_credibility";
  if (newWeight > oldWeight + 0.002) return "increase";
  if (newWeight < oldWeight - 0.002) return "decrease";
  return recommendation;
}

function nextReviewDate(urgency: GenesisPortfolioDecision["rebalanceUrgency"]): string {
  const hours = urgency === "emergency" ? 1 : urgency === "high" ? 6 : urgency === "medium" ? 24 : 72;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function stopLossUrgency(credibility: number, riskPercent: number): GenesisStopLossUrgency {
  if (riskPercent >= 80 && credibility >= 76) return "critical";
  if (riskPercent >= 65 && credibility >= 66) return "high";
  if (riskPercent >= 45 || credibility >= 61) return "medium";
  return "low";
}

function positionSizingFor(credibility: number, riskPercent: number): GenesisPositionSizing {
  const tier = CREDIBILITY_TIERS.find((t) => credibility >= t.min && credibility <= t.max) ?? CREDIBILITY_TIERS[0];
  const actionAllowed = credibility >= 51;
  const allowedCapitalForDecision = round(STATE.wallet.capital * (tier.maxSingleDecisionCapitalPercent / 100), 2);
  return {
    decisionCredibilityPercent: round(credibility, 2),
    credibilityTier: tier.credibilityTier,
    allocationMultiplier: tier.allocationMultiplier,
    riskMode: tier.riskMode,
    maxSingleDecisionCapitalPercent: tier.maxSingleDecisionCapitalPercent,
    allowedCapitalForDecision,
    positionSizingReasonAr: actionAllowed
      ? `مصداقية القرار ${round(credibility, 1)}% تطبق معامل تخصيص ${tier.allocationMultiplier} وحد أقصى ${tier.maxSingleDecisionCapitalPercent}% من رأس المال.`
      : "مصداقية القرار أقل من 51%، لذلك يتم حظر الإجراء والاكتفاء بالمراقبة.",
    positionSizingReasonEn: actionAllowed
      ? `Decision credibility ${round(credibility, 1)}% applies ${tier.allocationMultiplier}x sizing with a ${tier.maxSingleDecisionCapitalPercent}% capital cap.`
      : "Decision credibility is below 51%, so action is blocked and the asset remains watch-only.",
    stopLossUrgency: stopLossUrgency(credibility, riskPercent),
    actionAllowed,
  };
}

function tierExample(credibility: number, riskPercent = 35): GenesisPositionSizing {
  return positionSizingFor(credibility, riskPercent);
}

function emptyCapitalByTier(): Record<GenesisCredibilityTier, number> {
  return {
    below_51: 0,
    "51_60": 0,
    "61_65": 0,
    "66_75": 0,
    "76_85": 0,
    "86_95": 0,
    "96_100": 0,
  };
}

function tierExamples(): Record<GenesisCredibilityTier, GenesisPositionSizing> {
  return {
    below_51: tierExample(50, 55),
    "51_60": tierExample(55, 35),
    "61_65": tierExample(63, 38),
    "66_75": tierExample(70, 42),
    "76_85": tierExample(80, 48),
    "86_95": tierExample(90, 52),
    "96_100": tierExample(98, 60),
  };
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

function marketRegionFor(asset: GenesisUniverseAsset): string {
  if (asset.bucket === "saudi_stock") return "GCC/Saudi Arabia";
  if (asset.bucket === "crypto") return "Global/Digital Assets";
  if (asset.bucket === "forex") return "Global/FX";
  if (asset.bucket === "commodity") return "Global/Commodities";
  if (asset.bucket === "macro") return "Global/Macro";
  return "US/North America";
}

function scoreAsset(asset: GenesisUniverseAsset, quote: RouterQuote, intelligenceData?: GenesisIntelligenceOutput): GenesisScore {
  const assetClass = quote.assetClass || resolveAsset(asset.symbol).assetClass;
  const bucket = bucketFor(asset.symbol, assetClass);
  const changePercent = typeof quote.changePercent === "number" ? quote.changePercent : 0;
  const absChange = Math.abs(changePercent);
  const technical = analyzeTechnical([], [], changePercent);

  const priceMomentumScore = clamp(50 + changePercent * 6);
  const trendStrengthScore = clamp(50 + changePercent * 4 + (quote.success ? 8 : -12));
  const bucketRisk = bucket === "crypto" ? 30 : bucket === "commodity" ? 22 : bucket === "forex" ? 14 : bucket === "saudi_stock" ? 18 : 12;
  const volatilityRisk = clamp(bucketRisk + absChange * 3);
  const volatilityScore = clamp(100 - volatilityRisk);
  const liquidityScore = quote.volume && quote.volume > 0
    ? clamp(55 + Math.log10(Number(quote.volume) + 1) * 6)
    : quote.success ? 58 : 25;
  // Phase A: Gemini overrides placeholder math when available
  const ai = intelligenceData?.geminiUsed ? intelligenceData : null;
  const macroScore = ai ? ai.macroScore : (bucket === "macro" ? 62 : bucket === "etf" ? 64 : bucket === "forex" ? 55 : 58);
  const macroSensitivityScore = clamp(ai ? ai.schoolsConsensus : (bucket === "macro" ? 82 : bucket === "commodity" || bucket === "forex" ? 68 : bucket === "crypto" ? 61 : 54));
  const newsImpactScore = clamp(ai ? ai.sentimentScore : (bucket === "us_stock" || bucket === "saudi_stock" ? 58 : 50));
  const sentimentScore = clamp(ai ? ai.sentimentScore : 50 + changePercent * 2);
  const newsSentimentScore = sentimentScore;
  const fundamentalsScore = clamp(ai ? ai.fundamentalsScore : (bucket === "crypto" || bucket === "forex" ? 50 : bucket === "etf" ? 68 : quote.success ? 62 : 40));
  const sectorStrengthScore = clamp(ai ? ai.schoolsConsensus : (bucket === "etf" ? 66 : bucket === "commodity" ? 60 : bucket === "crypto" ? 58 : 57 + changePercent));
  const technicalStructureScore = clamp((priceMomentumScore + trendStrengthScore + volatilityScore) / 3);
  const capitalEfficiencyScore = clamp((liquidityScore + fundamentalsScore + technicalStructureScore) / 3);
  const riskAdjustedReturnScore = clamp((priceMomentumScore * 0.45) + (trendStrengthScore * 0.25) + (volatilityScore * 0.30));
  const drawdownRiskScore = clamp(100 - volatilityRisk - Math.max(0, -changePercent) * 4);
  const correlationRiskScore = clamp(bucket === "crypto" ? 58 : bucket === "commodity" ? 64 : bucket === "forex" ? 68 : bucket === "etf" ? 72 : 70);
  const stopLossScore = clamp(drawdownRiskScore * 0.7 + volatilityScore * 0.3);
  const takeProfitScore = clamp(priceMomentumScore * 0.5 + trendStrengthScore * 0.3 + sentimentScore * 0.2);
  const timingScore = clamp(priceMomentumScore * 0.35 + trendStrengthScore * 0.35 + volatilityScore * 0.15 + liquidityScore * 0.15);
  const confidenceScore = clamp(
    (quote.success ? 68 : 25) +
    (quote.provider ? 12 : 0) +
    (quote.mode === "live" ? 10 : quote.mode === "delayed" ? 4 : 0) -
    (quote.fallbackUsed ? 5 : 0),
  );

  const finalDecisionScore = clamp(
    priceMomentumScore * 0.10 +
    trendStrengthScore * 0.10 +
    volatilityScore * 0.08 +
    liquidityScore * 0.08 +
    macroSensitivityScore * 0.06 +
    riskAdjustedReturnScore * 0.12 +
    drawdownRiskScore * 0.07 +
    correlationRiskScore * 0.05 +
    newsImpactScore * 0.04 +
    sentimentScore * 0.05 +
    fundamentalsScore * 0.06 +
    sectorStrengthScore * 0.04 +
    technicalStructureScore * 0.06 +
    capitalEfficiencyScore * 0.04 +
    stopLossScore * 0.03 +
    takeProfitScore * 0.03 +
    timingScore * 0.05 +
    confidenceScore * 0.04,
  );
  const riskPercent = clamp(100 - ((volatilityScore * 0.35) + (drawdownRiskScore * 0.35) + (correlationRiskScore * 0.30)));
  const decisionConfidencePercent = round(confidenceScore, 2);
  const dataQuality: GenesisScore["dataQuality"] = quote.success && confidenceScore >= 75 ? "high" : quote.success ? "medium" : "low";
  const dataFreshness: GenesisScore["dataFreshness"] = quote.mode === "live" ? "live" : quote.mode === "delayed" ? "delayed" : "stale";
  const providerReliability = round(clamp((quote.provider ? 70 : 25) + (quote.success ? 15 : -10) - (quote.fallbackUsed ? 8 : 0)), 2);
  const sourceCredibilityPercent = round(providerReliability, 2);
  const dataCredibilityPercent = round(clamp((dataQuality === "high" ? 86 : dataQuality === "medium" ? 66 : 38) + (dataFreshness === "live" ? 8 : dataFreshness === "delayed" ? 2 : -10)), 2);
  const marketConfirmationPercent = round(clamp((trendStrengthScore * 0.35) + (sentimentScore * 0.25) + (macroSensitivityScore * 0.20) + (technicalStructureScore * 0.20)), 2);
  const riskApprovalPercent = round(clamp(100 - riskPercent), 2);
  const finalApprovalPercent = round(clamp(
    decisionConfidencePercent * 0.25 +
    sourceCredibilityPercent * 0.20 +
    dataCredibilityPercent * 0.20 +
    marketConfirmationPercent * 0.20 +
    riskApprovalPercent * 0.15,
  ), 2);
  const decisionStrengthPercent = round(clamp(Math.abs(finalDecisionScore - 50) * 2), 2);
  const expectedUpsidePercent = quote.success ? round(Math.max(1, (takeProfitScore - 50) / 2.5), 2) : null;
  const expectedDownsidePercent = quote.success ? round(Math.max(1, riskPercent / 3), 2) : null;
  const allocationConfidencePercent = round(clamp((finalDecisionScore * 0.55) + (confidenceScore * 0.35) + (liquidityScore * 0.10)), 2);
  const positionSizing = positionSizingFor(finalApprovalPercent, riskPercent);
  const lowCredibilityBlocked = finalApprovalPercent < MINIMUM_DECISION_CREDIBILITY_PERCENT;
  const blockedReason = lowCredibilityBlocked
    ? `Decision credibility ${finalApprovalPercent}% is below minimum ${MINIMUM_DECISION_CREDIBILITY_PERCENT}%.`
    : null;
  const recommendation = lowCredibilityBlocked ? "watch" : recommendationFor(finalDecisionScore, riskPercent, quote.success);
  const actionAllowed = !lowCredibilityBlocked && positionSizing.actionAllowed;

  const riskNotes = [
    ...(!quote.success ? [`Quote unavailable: ${quote.error ?? "unknown provider failure"}`] : []),
    ...(volatilityRisk > 45 ? ["Elevated volatility risk"] : []),
    ...(bucket === "crypto" ? ["Crypto exposure capped at 15%"] : []),
    ...(bucket === "commodity" ? ["Commodity exposure capped at 20%"] : []),
  ];
  const primaryReason = quote.success
    ? `${recommendation} because final decision score is ${round(finalDecisionScore, 1)} with ${decisionConfidencePercent}% confidence.`
    : `watch because live quote quality is low: ${quote.error ?? "provider unavailable"}.`;
  const supportingReasons = [
    `Momentum ${round(priceMomentumScore, 1)}/100 and trend ${round(trendStrengthScore, 1)}/100.`,
    `Risk-adjusted return ${round(riskAdjustedReturnScore, 1)}/100 with drawdown control ${round(drawdownRiskScore, 1)}/100.`,
    `Liquidity ${round(liquidityScore, 1)}/100 and provider reliability ${providerReliability}/100.`,
  ];
  const aiDecisionSummaryEn = `${asset.symbol}: ${recommendation} at ${round(finalDecisionScore, 1)}/100; risk ${round(riskPercent, 1)}%; execution remains analysis/paper only.`;
  const aiDecisionSummaryAr = `${asset.symbol}: قرار ${recommendation} بدرجة ${round(finalDecisionScore, 1)} من 100 ومخاطر ${round(riskPercent, 1)}%. التنفيذ الحقيقي معطل.`;

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
    momentumScore: round(priceMomentumScore, 2),
    trendScore: round(trendStrengthScore, 2),
    volatilityRisk: round(volatilityRisk, 2),
    liquidityScore: round(liquidityScore, 2),
    macroScore: round(macroScore, 2),
    newsSentimentScore: round(newsSentimentScore, 2),
    confidenceScore: decisionConfidencePercent,
    finalGenesisScore: round(finalDecisionScore, 2),
    priceMomentumScore: round(priceMomentumScore, 2),
    trendStrengthScore: round(trendStrengthScore, 2),
    volatilityScore: round(volatilityScore, 2),
    macroSensitivityScore: round(macroSensitivityScore, 2),
    riskAdjustedReturnScore: round(riskAdjustedReturnScore, 2),
    drawdownRiskScore: round(drawdownRiskScore, 2),
    correlationRiskScore: round(correlationRiskScore, 2),
    newsImpactScore: round(newsImpactScore, 2),
    sentimentScore: round(sentimentScore, 2),
    fundamentalsScore: round(fundamentalsScore, 2),
    sectorStrengthScore: round(sectorStrengthScore, 2),
    technicalStructureScore: round(technicalStructureScore, 2),
    capitalEfficiencyScore: round(capitalEfficiencyScore, 2),
    stopLossScore: round(stopLossScore, 2),
    takeProfitScore: round(takeProfitScore, 2),
    timingScore: round(timingScore, 2),
    finalDecisionScore: round(finalDecisionScore, 2),
    decisionConfidencePercent,
    sourceCredibilityPercent,
    dataCredibilityPercent,
    marketConfirmationPercent,
    riskApprovalPercent,
    finalApprovalPercent,
    minimumDecisionCredibilityPercent: MINIMUM_DECISION_CREDIBILITY_PERCENT,
    decisionStrengthPercent,
    expectedUpsidePercent,
    expectedDownsidePercent,
    riskPercent: round(riskPercent, 2),
    allocationConfidencePercent,
    decisionCredibilityPercent: positionSizing.decisionCredibilityPercent,
    credibilityTier: positionSizing.credibilityTier,
    allocationMultiplier: positionSizing.allocationMultiplier,
    riskMode: positionSizing.riskMode,
    maxSingleDecisionCapitalPercent: positionSizing.maxSingleDecisionCapitalPercent,
    allowedCapitalForDecision: positionSizing.allowedCapitalForDecision,
    positionSizingReasonAr: positionSizing.positionSizingReasonAr,
    positionSizingReasonEn: positionSizing.positionSizingReasonEn,
    stopLossUrgency: positionSizing.stopLossUrgency,
    actionAllowed,
    action: actionAllowed ? recommendation : "blocked_low_credibility",
    blockedReason,
    positionSizing: { ...positionSizing, actionAllowed },
    recommendation,
    primaryReason,
    supportingReasons,
    riskWarnings: riskNotes,
    dataQuality,
    dataFreshness,
    providerReliability,
    aiDecisionSummaryAr,
    aiDecisionSummaryEn,
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
    technicalSignal: {
      trend:         technical.trend,
      momentum:      technical.momentum,
      rsiSignal:     technical.rsiSignal,
      arabicSummary: technical.arabicSummary,
    },
    // Phase A — Gemini intelligence fields
    arabicReasoning: ai?.arabicReasoning ?? aiDecisionSummaryAr,
    keyRisks: ai?.keyRisks ?? riskNotes,
    keyOpportunities: ai?.keyOpportunities ?? [],
    geminiAnalysisUsed: Boolean(ai),
    schoolsBreakdown: ai?.schoolsBreakdown ?? null,
    // Phase D/E — consensus fields carried into archive
    dominantSchool: intelligenceData?.dominantSchool ?? null,
    consensusAgreementLevel: intelligenceData?.consensusAgreementLevel ?? null,
    structuredConsensusScore: intelligenceData?.structuredConsensusScore ?? null,
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

// Phase A: run Gemini intelligence calls in batches of 3 to respect rate limits
// Phase E: passes real macro context and learned weights into each call
async function fetchIntelligenceBatch(
  assets: GenesisUniverseAsset[],
  quotes: RouterQuote[],
): Promise<(GenesisIntelligenceOutput | undefined)[]> {
  const BATCH_SIZE = 3;
  const results: (GenesisIntelligenceOutput | undefined)[] = new Array(assets.length);
  const riskBudgetRemaining = round(
    Math.max(0, (1 - Object.values(STATE.currentWeights).reduce((a, b) => a + b, 0)) * 100),
    2,
  );

  // Phase E: fetch real macro context once per batch run (6h cached)
  const realMacroContext = await fetchRealMacroContext().catch(() => undefined);

  for (let i = 0; i < assets.length; i += BATCH_SIZE) {
    const batch = assets.slice(i, i + BATCH_SIZE);
    const batchQuotes = quotes.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((asset, j) => {
        const q = batchQuotes[j];
        return analyzeAssetWithGemini({
          symbol: asset.symbol,
          assetClass: q.assetClass || resolveAsset(asset.symbol).assetClass,
          marketRegion: marketRegionFor(asset),
          price: q.price,
          changePercent: q.changePercent,
          provider: q.provider,
          providerReliable: q.success && !q.fallbackUsed,
          portfolioContext: {
            totalCapital: STATE.wallet.capital,
            currentAllocation: round((STATE.currentWeights[asset.symbol] ?? 0) * 100, 2),
            riskBudgetRemaining,
          },
          // Phase E: real macro and learned weights from previous cycle
          realMacroContext,
          learnedWeightHints: STATE.learnedConsensusWeights ?? undefined,
        }).catch(() => undefined);
      }),
    );
    for (let j = 0; j < batch.length; j++) {
      results[i + j] = batchResults[j];
    }
  }
  return results;
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

  // Phase A: fetch Gemini analysis in parallel batches of 3
  const intelligenceResults = await fetchIntelligenceBatch(GENESIS_UNIVERSE, quotes);

  const scores = GENESIS_UNIVERSE.map((asset, index) => scoreAsset(asset, quotes[index], intelligenceResults[index]))
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
    action: actionFor(a.recommendation, STATE.currentWeights[a.symbol] ?? 0, a.targetWeight),
  }));
}

export function allocateGenesis100(scores = STATE.lastScores): GenesisAllocation[] {
  const selected = scores
    .filter((s) => s.quoteSuccess && s.actionAllowed && s.recommendation !== "exit" && s.recommendation !== "blocked")
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
    targetWeight: Math.min(
      (Math.max(1, s.finalGenesisScore) / totalScore) * investableWeight * s.allocationMultiplier,
      s.maxSingleDecisionCapitalPercent / 100,
    ),
    targetValue: 0,
    finalGenesisScore: s.finalGenesisScore,
    allocationConfidencePercent: s.allocationConfidencePercent,
    decisionConfidencePercent: s.decisionConfidencePercent,
    decisionCredibilityPercent: s.decisionCredibilityPercent,
    credibilityTier: s.credibilityTier,
    allocationMultiplier: s.allocationMultiplier,
    riskMode: s.riskMode,
    maxSingleDecisionCapitalPercent: s.maxSingleDecisionCapitalPercent,
    allowedCapitalForDecision: s.allowedCapitalForDecision,
    positionSizingReasonAr: s.positionSizingReasonAr,
    positionSizingReasonEn: s.positionSizingReasonEn,
    stopLossUrgency: s.stopLossUrgency,
    actionAllowed: s.actionAllowed,
    riskPercent: s.riskPercent,
    action: actionFor(s.recommendation, STATE.currentWeights[s.symbol] ?? 0, 0),
    reason: s.primaryReason,
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
      !score.actionAllowed ? "blocked_low_credibility" :
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
      reason: score.blockedReason ?? `${score.recommendation} with Genesis score ${score.finalGenesisScore}; confidence ${score.confidenceScore}.`,
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

function buildPortfolioDecision(scores: GenesisScore[], allocations: GenesisAllocation[]): GenesisPortfolioDecision {
  const avgScore = scores.length ? scores.reduce((sum, s) => sum + s.finalDecisionScore, 0) / scores.length : 50;
  const avgRisk = scores.length ? scores.reduce((sum, s) => sum + s.riskPercent, 0) / scores.length : 50;
  const failures = scores.filter((s) => !s.quoteSuccess).length;
  const marketRegime: GenesisPortfolioDecision["marketRegime"] =
    avgRisk > 62 || failures > 8 ? "risk_off" :
    avgScore > 66 && avgRisk < 45 ? "risk_on" :
    avgRisk > 52 ? "defensive" :
    "mixed";
  const portfolioRiskLevel: GenesisPortfolioDecision["portfolioRiskLevel"] =
    avgRisk > 65 ? "high" : avgRisk > 42 ? "medium" : "low";
  const rebalanceUrgency: GenesisPortfolioDecision["rebalanceUrgency"] =
    failures > 10 || avgRisk > 75 ? "emergency" :
    avgRisk > 60 ? "high" :
    avgScore > 62 ? "medium" :
    "low";
  const topOpportunities = scores.filter((s) => ["strong_buy", "buy", "accumulate"].includes(s.recommendation)).slice(0, 8).map((s) => s.symbol);
  const topRisks = [...scores].sort((a, b) => b.riskPercent - a.riskPercent).slice(0, 8).map((s) => `${s.symbol}: ${s.riskPercent}% risk`);

  return {
    marketRegime,
    portfolioRiskLevel,
    recommendedCashReserve: round(Math.max(MIN_CASH_RESERVE, avgRisk > 60 ? 0.18 : avgRisk > 45 ? 0.10 : 0.05), 4),
    topOpportunities,
    topRisks,
    assetsToIncrease: allocations.filter((a) => a.action === "increase").slice(0, 10).map((a) => a.symbol),
    assetsToReduce: allocations.filter((a) => a.action === "decrease").slice(0, 10).map((a) => a.symbol),
    assetsToRemove: scores.filter((s) => s.recommendation === "exit" || s.recommendation === "blocked").map((s) => s.symbol),
    assetsToWatch: scores.filter((s) => s.recommendation === "watch").slice(0, 15).map((s) => s.symbol),
    rebalanceUrgency,
    nextReviewAt: nextReviewDate(rebalanceUrgency),
    aiPortfolioSummaryAr: `نظام السوق ${marketRegime} ومخاطر المحفظة ${portfolioRiskLevel}. التنفيذ الحقيقي معطل والتحويلات الخارجية ممنوعة.`,
    aiPortfolioSummaryEn: `Market regime is ${marketRegime} with ${portfolioRiskLevel} portfolio risk. Live execution is disabled and external transfers are forbidden.`,
  };
}

function archiveDecisions(cycleId: string, scores: GenesisScore[], allocations: GenesisAllocation[]): GenesisArchivedDecision[] {
  const at = new Date().toISOString();
  const allocationBySymbol = new Map(allocations.map((a) => [a.symbol, a]));
  const archived = scores.slice(0, 100).map((score) => {
    const allocation = allocationBySymbol.get(score.symbol);
    const previousWeight = STATE.currentWeights[score.symbol] ?? 0;
    const targetWeight = allocation?.targetWeight ?? 0;
    const action = !score.actionAllowed ? "blocked_low_credibility" : allocation?.action ?? actionFor(score.recommendation, previousWeight, targetWeight);
    const previousRecommendation = STATE.previousRecommendations[score.symbol] ?? null;

    return {
      id: `${cycleId}-${score.symbol}`,
      timestamp: at,
      cycleId,
      symbol: score.symbol,
      assetName: score.name,
      assetClass: score.assetClass,
      previousRecommendation,
      newRecommendation: score.recommendation,
      decisionConfidencePercent: score.decisionConfidencePercent,
      decisionCredibilityPercent: score.decisionCredibilityPercent,
      credibilityTier: score.credibilityTier,
      sourceCredibilityPercent: score.sourceCredibilityPercent,
      finalApprovalPercent: score.finalApprovalPercent,
      allocationMultiplier: score.allocationMultiplier,
      riskMode: score.riskMode,
      maxSingleDecisionCapitalPercent: score.maxSingleDecisionCapitalPercent,
      allowedCapitalForDecision: score.allowedCapitalForDecision,
      positionSizingReasonAr: score.positionSizingReasonAr,
      positionSizingReasonEn: score.positionSizingReasonEn,
      stopLossUrgency: score.stopLossUrgency,
      actionAllowed: score.actionAllowed,
      blockedReason: score.blockedReason,
      finalDecisionScore: score.finalDecisionScore,
      targetWeight: round(targetWeight, 4),
      previousWeight: round(previousWeight, 4),
      action,
      reasonAr: score.aiDecisionSummaryAr,
      reasonEn: score.aiDecisionSummaryEn,
      dataSources: score.dataSources,
      quoteSnapshot: score.quoteSnapshot,
      riskWarnings: score.riskWarnings,
      aiMode: STATE.controls.aiMode,
      executionMode: targetWeight > 0 && STATE.controls.aiMode === "full_ai" ? "paper" : "analysis_only",
      intelligenceVersion: GENESIS_INTELLIGENCE_VERSION,
      createdBy: "genesis100-ai" as const,
      // Phase E: learning loop — school scores and consensus metadata
      schoolScoresAtDecision: score.schoolsBreakdown
        ? {
            keynesian: score.schoolsBreakdown.keynesian,
            monetarist: score.schoolsBreakdown.monetarist,
            austrian: score.schoolsBreakdown.austrian,
            behavioral: score.schoolsBreakdown.behavioral,
            valueinvesting: score.schoolsBreakdown.valueinvesting,
            globalMacro: score.schoolsBreakdown.globalMacro,
          }
        : {},
      dominantSchoolAtDecision: score.dominantSchool ?? "unknown",
      consensusAgreementLevel: score.consensusAgreementLevel ?? null,
      structuredConsensusScore: score.structuredConsensusScore ?? null,
      geminiAnalysisUsed: score.geminiAnalysisUsed,
    };
  });

  for (const item of archived) {
    STATE.previousRecommendations[item.symbol] = item.newRecommendation;
  }
  STATE.decisionArchive = [...archived, ...STATE.decisionArchive].slice(0, 1000);
  return archived;
}

function buildPositionSizingSummary(scores: GenesisScore[], allocations: GenesisAllocation[]): GenesisPositionSizingSummary {
  const capitalByCredibilityTier = emptyCapitalByTier();
  for (const allocation of allocations) {
    capitalByCredibilityTier[allocation.credibilityTier] += allocation.targetValue;
  }
  const blockedLowCredibilityCapital = scores
    .filter((s) => !s.actionAllowed)
    .reduce((sum, s) => sum + s.allowedCapitalForDecision, 0);
  const avgCredibility = scores.length
    ? scores.reduce((sum, s) => sum + s.decisionCredibilityPercent, 0) / scores.length
    : 0;

  return {
    totalAllowedCapital: round(allocations.reduce((sum, a) => sum + a.allowedCapitalForDecision, 0), 2),
    blockedLowCredibilityCapital: round(blockedLowCredibilityCapital, 2),
    capitalByCredibilityTier: Object.fromEntries(
      Object.entries(capitalByCredibilityTier).map(([tier, value]) => [tier, round(value, 2)]),
    ) as Record<GenesisCredibilityTier, number>,
    averageDecisionCredibilityPercent: round(avgCredibility, 2),
    highConfidenceCount: scores.filter((s) => s.decisionCredibilityPercent >= 76).length,
    blockedCount: scores.filter((s) => !s.actionAllowed).length,
    tierExamples: tierExamples(),
  };
}

export async function runGenesisCycle(input?: Request | URLSearchParams | null): Promise<GenesisCycleResult> {
  // Phase B: hydrate state from Supabase on first call (no-op after that)
  await hydrateStateFromDB();

  const entitlement = getGenesisEntitlement(input ?? null);
  const cycleId = `genesis-${Date.now()}`;
  if (!entitlement.allowed || STATE.controls.aiMode === "off") {
    const portfolioDecision = buildPortfolioDecision(STATE.lastScores, STATE.lastAllocations);
    const positionSizingSummary = buildPositionSizingSummary(STATE.lastScores, STATE.lastAllocations);
    const cycle: GenesisCycleResult = {
      cycleId,
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
      portfolioDecision,
      decisionArchiveCount: STATE.decisionArchive.length,
      approvedDecisionCount: STATE.decisionArchive.filter((d) => d.actionAllowed).length,
      blockedDecisionCount: STATE.decisionArchive.filter((d) => !d.actionAllowed).length,
      topApprovedDecisions: STATE.decisionArchive.filter((d) => d.actionAllowed).slice(0, 10),
      topBlockedDecisions: STATE.decisionArchive.filter((d) => !d.actionAllowed).slice(0, 10),
      topDecisions: STATE.decisionArchive.slice(0, 10),
      positionSizingSummary,
      capitalByCredibilityTier: positionSizingSummary.capitalByCredibilityTier,
      blockedLowCredibilityCapital: positionSizingSummary.blockedLowCredibilityCapital,
      topHighConfidenceAllocations: STATE.lastAllocations.filter((a) => a.decisionCredibilityPercent >= 76).slice(0, 10),
      topLowConfidenceWatchlist: STATE.lastScores.filter((s) => !s.actionAllowed).slice(0, 10),
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
  const portfolioDecision = buildPortfolioDecision(scores, allocations);
  const archived = archiveDecisions(cycleId, scores, allocations);
  const positionSizingSummary = buildPositionSizingSummary(scores, allocations);

  for (const allocation of allocations) {
    STATE.currentWeights[allocation.symbol] = allocation.targetWeight;
  }
  STATE.wallet = {
    ...STATE.wallet,
    status: "paper_trading",
    updatedAt: new Date().toISOString(),
  };
  STATE.decisions = [...decisions, ...STATE.decisions].slice(0, 500);

  // Phase C: check existing open positions for stop loss / take profit alerts (advisory)
  const positionMonitor = await checkOpenPositions(STATE.wallet.capital).catch(() => undefined);

  // Phase E: learning loop — evaluate past decisions, update school weights
  let learningInsights: LearningInsights | undefined;
  let learnedWeightsApplied = false;
  try {
    // Build current price map from freshly-fetched scores (avoids redundant quote calls)
    const currentPriceMap = new Map<string, number>(
      scores
        .filter((s): s is GenesisScore & { price: number } => s.price != null)
        .map((s) => [s.symbol, s.price]),
    );

    // Cast archive to the slim type outcomeTracker expects (structural subtype)
    const archiveForLearning: LearningDecisionInput[] = STATE.decisionArchive.map((d) => ({
      id: d.id,
      symbol: d.symbol,
      timestamp: d.timestamp,
      newRecommendation: d.newRecommendation,
      finalApprovalPercent: d.finalApprovalPercent,
      quoteSnapshot: { price: d.quoteSnapshot.price },
      schoolScoresAtDecision: d.schoolScoresAtDecision ?? {},
      dominantSchoolAtDecision: d.dominantSchoolAtDecision ?? "unknown",
      assetClass: d.assetClass,
    }));

    const outcomes = await evaluateArchiveOutcomes(archiveForLearning, currentPriceMap);
    learningInsights = analyzeLearningOutcomes(outcomes);
    STATE.lastLearningInsights = learningInsights;

    if (!learningInsights.dataInsufficient) {
      const currentWeights: ConsensusWeights = STATE.learnedConsensusWeights ?? {
        keynesian: 0.15, monetarist: 0.20, austrian: 0.10,
        behavioral: 0.15, valueInvesting: 0.20, globalMacro: 0.20,
      };
      STATE.learnedConsensusWeights = applyLearningToWeights(learningInsights, currentWeights);
      learnedWeightsApplied = true;
      console.info(
        `[genesis] Learning applied: accuracy=${(learningInsights.overallAccuracy * 100).toFixed(1)}% evaluated=${learningInsights.totalEvaluated}`,
      );
    }
  } catch (err) {
    console.warn("[genesis] Learning loop failed (non-blocking):", err);
  }

  const cycle: GenesisCycleResult = {
    cycleId,
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
    portfolioDecision,
    decisionArchiveCount: STATE.decisionArchive.length,
    approvedDecisionCount: archived.filter((d) => d.actionAllowed).length,
    blockedDecisionCount: archived.filter((d) => !d.actionAllowed).length,
    topApprovedDecisions: archived
      .filter((d) => d.actionAllowed)
      .sort((a, b) => b.decisionCredibilityPercent - a.decisionCredibilityPercent)
      .slice(0, 10),
    topBlockedDecisions: archived
      .filter((d) => !d.actionAllowed)
      .sort((a, b) => a.decisionCredibilityPercent - b.decisionCredibilityPercent)
      .slice(0, 10),
    topDecisions: archived
      .sort((a, b) => b.decisionConfidencePercent - a.decisionConfidencePercent)
      .slice(0, 10),
    positionSizingSummary,
    capitalByCredibilityTier: positionSizingSummary.capitalByCredibilityTier,
    blockedLowCredibilityCapital: positionSizingSummary.blockedLowCredibilityCapital,
    topHighConfidenceAllocations: allocations.filter((a) => a.decisionCredibilityPercent >= 76).slice(0, 10),
    topLowConfidenceWatchlist: scores.filter((s) => !s.actionAllowed).slice(0, 10),
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
    positionMonitor,
    // Phase E — learning loop results
    learningInsights,
    learnedWeightsApplied,
  };

  STATE.lastCycle = cycle;
  STATE.lastPortfolioDecision = portfolioDecision;

  // Phase B: persist cycle to Supabase (fire and forget — never blocks the response)
  saveDecisionCycle(cycle).catch((err) =>
    console.warn("[genesis] Cycle persistence failed:", err),
  );

  // Fire-and-forget: notify owner of Genesis cycle results
  void (async () => {
    const top = cycle.topApprovedDecisions.slice(0, 5);
    if (top.length === 0) return;
    const actionColor = (action: string) =>
      ["strong_buy", "buy", "accumulate", "increase"].includes(action) ? "#00ff88" :
      ["exit", "decrease"].includes(action) ? "#ff4444" : "#ffaa00";
    const actionAr: Record<string, string> = {
      strong_buy: "شراء قوي", buy: "شراء", accumulate: "تراكم", hold: "انتظار",
      reduce: "تقليص", exit: "خروج", watch: "مراقبة", increase: "زيادة",
      decrease: "تخفيض", blocked_low_credibility: "محجوب",
    };
    const rows = top.map((d) => `
      <tr style="border-bottom:1px solid #222;">
        <td style="padding:8px;color:#fff;">${d.symbol}</td>
        <td style="padding:8px;color:${actionColor(d.action)};font-weight:bold;">${actionAr[d.action] ?? d.action}</td>
        <td style="padding:8px;color:#aaa;">${d.decisionConfidencePercent}%</td>
        <td style="padding:8px;color:#aaa;">$${d.quoteSnapshot?.price ?? "—"}</td>
      </tr>`).join("");
    sendEmail({
      to: "Ayyaf08@hotmail.com",
      subject: `Genesis — دورة تحليل جديدة | ${cycle.approvedDecisionCount} موافق`,
      html: `<div dir="rtl" style="font-family:Arial;padding:20px;background:#0a0a0a;color:#ffffff;">
        <h2 style="color:#d4a017;">Genesis 100 — دورة تحليل جديدة</h2>
        <p style="color:#aaa;">نظام السوق: <strong style="color:#fff;">${cycle.portfolioDecision.marketRegime}</strong> | المخاطر: <strong>${cycle.portfolioDecision.portfolioRiskLevel}</strong></p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <thead><tr style="background:#1a1a1a;">
            <th style="padding:8px;color:#888;text-align:right;">الأصل</th>
            <th style="padding:8px;color:#888;text-align:right;">القرار</th>
            <th style="padding:8px;color:#888;text-align:right;">الثقة</th>
            <th style="padding:8px;color:#888;text-align:right;">السعر</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#888;font-size:12px;">هذا تحليل استشاري — ليس توصية مالية مرخصة</p>
      </div>`,
    }).catch((err) => console.warn("[genesis] Email notification failed:", err));
  })();

  return cycle;
}

export function getGenesisLearningState() {
  return {
    lastLearningInsights: STATE.lastLearningInsights,
    learnedConsensusWeights: STATE.learnedConsensusWeights,
  };
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

export function getGenesisArchive(input?: Request | URLSearchParams | null) {
  const params = input instanceof Request
    ? new URL(input.url).searchParams
    : input instanceof URLSearchParams ? input : new URLSearchParams();
  const symbol = params.get("symbol")?.trim().toUpperCase();
  const archive = symbol
    ? STATE.decisionArchive.filter((d) => d.symbol.toUpperCase() === symbol)
    : STATE.decisionArchive;

  return {
    product: "ForeSmart Genesis 100",
    count: archive.length,
    symbol: symbol ?? null,
    archive,
    liveExecutionEnabled: false,
    safety: SAFETY_PROFILE,
  };
}

export function getLatestGenesisArchiveDecision() {
  return {
    product: "ForeSmart Genesis 100",
    decision: STATE.decisionArchive[0] ?? null,
    count: STATE.decisionArchive.length,
    liveExecutionEnabled: false,
    safety: SAFETY_PROFILE,
  };
}

export function getGenesisArchiveSummary() {
  const byRecommendation = STATE.decisionArchive.reduce<Record<string, number>>((acc, d) => {
    acc[d.newRecommendation] = (acc[d.newRecommendation] ?? 0) + 1;
    return acc;
  }, {});
  const avgConfidence = STATE.decisionArchive.length
    ? STATE.decisionArchive.reduce((sum, d) => sum + d.decisionConfidencePercent, 0) / STATE.decisionArchive.length
    : 0;

  return {
    product: "ForeSmart Genesis 100",
    count: STATE.decisionArchive.length,
    latestCycleId: STATE.decisionArchive[0]?.cycleId ?? null,
    averageDecisionConfidencePercent: round(avgConfidence, 2),
    byRecommendation,
    lastPortfolioDecision: STATE.lastPortfolioDecision,
    liveExecutionEnabled: false,
    safety: SAFETY_PROFILE,
  };
}

export function getGenesisPositionSizing(input?: Request | URLSearchParams | null) {
  const params = input instanceof Request
    ? new URL(input.url).searchParams
    : input instanceof URLSearchParams ? input : new URLSearchParams();
  const symbol = params.get("symbol")?.trim().toUpperCase();
  const scores = symbol
    ? STATE.lastScores.filter((s) => s.symbol.toUpperCase() === symbol)
    : STATE.lastScores;
  const allocations = symbol
    ? STATE.lastAllocations.filter((a) => a.symbol.toUpperCase() === symbol)
    : STATE.lastAllocations;

  return {
    product: "ForeSmart Genesis 100",
    symbol: symbol ?? null,
    count: scores.length,
    positionSizing: scores.map((s) => ({
      symbol: s.symbol,
      recommendation: s.recommendation,
      decisionCredibilityPercent: s.decisionCredibilityPercent,
      credibilityTier: s.credibilityTier,
      allocationMultiplier: s.allocationMultiplier,
      riskMode: s.riskMode,
      maxSingleDecisionCapitalPercent: s.maxSingleDecisionCapitalPercent,
      allowedCapitalForDecision: s.allowedCapitalForDecision,
      positionSizingReasonAr: s.positionSizingReasonAr,
      positionSizingReasonEn: s.positionSizingReasonEn,
      stopLossUrgency: s.stopLossUrgency,
      actionAllowed: s.actionAllowed,
      action: s.actionAllowed ? s.recommendation : "blocked_low_credibility",
      riskPercent: s.riskPercent,
    })),
    allocations,
    summary: buildPositionSizingSummary(STATE.lastScores, STATE.lastAllocations),
    liveExecutionEnabled: false,
    safety: SAFETY_PROFILE,
  };
}

export function getGenesisSourceRegistry() {
  return {
    product: "ForeSmart Genesis 100",
    intelligenceVersion: GENESIS_INTELLIGENCE_VERSION,
    sourceStatus: "framework_ready_provider_missing" as GenesisSourceStatus,
    enabledSourceCategories: SOURCE_CATEGORIES,
    categories: SOURCE_CATEGORIES.map((category) => ({
      category,
      enabled: true,
      liveProviderConnected: false,
      sourceStatus: "framework_ready_provider_missing" as GenesisSourceStatus,
    })),
    note: "Source framework is ready; dedicated live news/sentiment providers are not wired for Genesis 100 yet.",
    liveExecutionEnabled: false,
    safety: SAFETY_PROFILE,
  };
}

export function getGenesisMarketSentiment(scores = STATE.lastScores) {
  const avg = (bucket: GenesisUniverseAsset["bucket"]) => {
    const items = scores.filter((s) => s.bucket === bucket);
    return round(items.length ? items.reduce((sum, s) => sum + s.sentimentScore, 0) / items.length : 50, 2);
  };
  const overall = round(scores.length ? scores.reduce((sum, s) => sum + s.sentimentScore, 0) / scores.length : 50, 2);
  return {
    overallMarketSentiment: overall,
    equitySentiment: avg("us_stock"),
    cryptoSentiment: avg("crypto"),
    oilSentiment: round(scores.filter((s) => ["WTI", "BRENT"].includes(s.symbol)).reduce((sum, s, _, arr) => sum + s.sentimentScore / Math.max(1, arr.length), 0) || 50, 2),
    metalsSentiment: round(scores.filter((s) => ["XAUUSD", "XAGUSD"].includes(s.symbol)).reduce((sum, s, _, arr) => sum + s.sentimentScore / Math.max(1, arr.length), 0) || 50, 2),
    forexSentiment: avg("forex"),
    saudiMarketSentiment: avg("saudi_stock"),
    riskOnRiskOff: overall >= 58 ? "risk_on" : overall <= 43 ? "risk_off" : "neutral",
  };
}

export function getGenesisIntelligence(input?: Request | URLSearchParams | null): GenesisIntelligenceV2 {
  const scores = STATE.lastScores;
  const portfolioDecision = STATE.lastPortfolioDecision ?? buildPortfolioDecision(scores, STATE.lastAllocations);
  const sentiment = getGenesisMarketSentiment(scores);
  const sourceRegistry = getGenesisSourceRegistry();
  const confidencePercent = round(scores.length ? scores.reduce((sum, s) => sum + s.finalApprovalPercent, 0) / scores.length : 50, 2);
  return {
    intelligenceVersion: GENESIS_INTELLIGENCE_VERSION,
    marketRegime: portfolioDecision.marketRegime,
    overallMarketSentiment: sentiment.overallMarketSentiment,
    equitySentiment: sentiment.equitySentiment,
    cryptoSentiment: sentiment.cryptoSentiment,
    oilSentiment: sentiment.oilSentiment,
    metalsSentiment: sentiment.metalsSentiment,
    forexSentiment: sentiment.forexSentiment,
    saudiMarketSentiment: sentiment.saudiMarketSentiment,
    riskOnRiskOff: sentiment.riskOnRiskOff,
    confidencePercent,
    sourceStatus: sourceRegistry.sourceStatus,
    enabledSourceCategories: sourceRegistry.enabledSourceCategories,
    aiPortfolioSummaryAr: portfolioDecision.aiPortfolioSummaryAr,
    aiPortfolioSummaryEn: portfolioDecision.aiPortfolioSummaryEn,
  };
}

export function getGenesisDecisionFirewall(input?: Request | URLSearchParams | null) {
  const scores = STATE.lastScores;
  const blocked = scores.filter((s) => !s.actionAllowed);
  const approved = scores.filter((s) => s.actionAllowed);
  return {
    product: "ForeSmart Genesis 100",
    intelligenceVersion: GENESIS_INTELLIGENCE_VERSION,
    minimumDecisionCredibilityPercent: MINIMUM_DECISION_CREDIBILITY_PERCENT,
    approvedDecisionCount: approved.length,
    blockedDecisionCount: blocked.length,
    blockedDecisions: blocked.map((s) => ({
      symbol: s.symbol,
      action: "blocked_low_credibility",
      recommendation: "watch",
      decisionCredibilityPercent: s.decisionCredibilityPercent,
      blockedReason: s.blockedReason,
    })),
    rules: [
      "If decisionCredibilityPercent < 51, actionAllowed=false.",
      "Blocked decisions create no proposed buy/sell orders.",
      "Real broker execution remains disabled.",
      "External transfers are permanently forbidden.",
    ],
    liveExecutionEnabled: false,
    safety: SAFETY_PROFILE,
  };
}

export function getGenesisCredibility(input?: Request | URLSearchParams | null) {
  const params = input instanceof Request
    ? new URL(input.url).searchParams
    : input instanceof URLSearchParams ? input : new URLSearchParams();
  const symbol = params.get("symbol")?.trim().toUpperCase();
  const scores = symbol
    ? STATE.lastScores.filter((s) => s.symbol.toUpperCase() === symbol)
    : STATE.lastScores;
  return {
    product: "ForeSmart Genesis 100",
    intelligenceVersion: GENESIS_INTELLIGENCE_VERSION,
    symbol: symbol ?? null,
    minimumDecisionCredibilityPercent: MINIMUM_DECISION_CREDIBILITY_PERCENT,
    count: scores.length,
    credibility: scores.map((s) => ({
      symbol: s.symbol,
      recommendation: s.recommendation,
      action: s.actionAllowed ? s.recommendation : "blocked_low_credibility",
      actionAllowed: s.actionAllowed,
      blockedReason: s.blockedReason,
      decisionCredibilityPercent: s.decisionCredibilityPercent,
      sourceCredibilityPercent: s.sourceCredibilityPercent,
      dataCredibilityPercent: s.dataCredibilityPercent,
      marketConfirmationPercent: s.marketConfirmationPercent,
      riskApprovalPercent: s.riskApprovalPercent,
      finalApprovalPercent: s.finalApprovalPercent,
      credibilityTier: s.credibilityTier,
      riskMode: s.riskMode,
      allocationMultiplier: s.allocationMultiplier,
    })),
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
  const removedAssets = scores.filter((s) => s.recommendation === "exit" || s.recommendation === "blocked").map((s) => s.symbol);
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
