// Aggregator: pulls quotes → news → sentiment → signals → AI summary + brain + quant layers.
import { fetchAllQuotes, type AssetKey, type MarketQuote } from "@/services/market/marketData";
import { generateSignals, type Signal } from "@/services/signals/signalEngine";
import { buildSummary, type MarketSummary } from "@/services/ai/marketSummary";
import { fetchNews, type NewsItem } from "@/services/news/newsImpact";
import { calculateMarketSentiment, type MarketSentimentScore } from "@/services/analysis/marketSentiment";
import { generateMarketInsight, type AIInsight } from "@/services/ai/openaiAnalysis";
import { classifyEvents, type MarketEvent } from "@/services/events/eventImpactEngine";
import { computeCorrelations, type CorrelationPair } from "@/services/correlation/correlationEngine";
import { scanOpportunities, type Opportunity } from "@/services/opportunities/opportunityScanner";
import { generateReasoning, type ReasoningNote } from "@/services/reasoning/reasoningEngine";
import { generateAlerts, type SmartAlert } from "@/services/brain/alertEngine";
import { analyzeAll, type TimeframeReport } from "@/services/quant/multiTimeframeEngine";
import { detectRegime, type RegimeReport } from "@/services/quant/regimeDetection";
import { calibrateSignals, summarizeConfidence, type CalibratedSignal, type ConfidenceSummary } from "@/services/quant/confidenceEngine";
import { buildPortfolio, type PortfolioReport } from "@/services/portfolio/portfolioEngine";
import { runBacktest, type BacktestReport } from "@/services/backtest/backtestEngine";
import { analyzeAllEarlyMomentum, type EarlyMomentumReport } from "@/services/edge/earlyMomentumEngine";
import { predictAllBreakouts, type BreakoutReport } from "@/services/edge/breakoutPrediction";
import { analyzeLiquidityFlow, type LiquidityFlowReport } from "@/services/edge/liquidityFlow";
import { trackWhaleActivity, type WhaleReport } from "@/services/edge/whaleTracker";
import { rankOpportunities, type RankedOpportunity } from "@/services/edge/opportunityRanking";
import { calculateAllEntryZones, type EntryZone } from "@/services/execution/entryZoneEngine";
import { buildAllExitPlans, type ExitPlan } from "@/services/execution/exitEngine";
import { calculateAllPositionSizes, type PositionSizing } from "@/services/execution/positionSizing";
import { evaluateAllTiming, type TimingReport } from "@/services/execution/timingEngine";
import { buildAllTradePlans, type TradePlan } from "@/services/execution/tradePlanner";

export interface MarketIntel {
  quotes: MarketQuote[];
  signals: Signal[];
  summary: MarketSummary;
  sentiment: MarketSentimentScore;
  insight: AIInsight;
  news: NewsItem[];
  // Brain layer
  events: MarketEvent[];
  correlations: CorrelationPair[];
  opportunities: Opportunity[];
  reasoning: ReasoningNote[];
  alerts: SmartAlert[];
  // Quant layer
  timeframes: TimeframeReport[];
  regime: RegimeReport;
  calibratedSignals: CalibratedSignal[];
  confidence: ConfidenceSummary;
  portfolio: PortfolioReport;
  backtest: BacktestReport;
  // Edge discovery layer
  earlyMomentum: EarlyMomentumReport[];
  breakouts: BreakoutReport[];
  liquidity: LiquidityFlowReport;
  whales: WhaleReport;
  rankedOpportunities: RankedOpportunity[];
  // Tactical execution layer
  entryZones: EntryZone[];
  exitPlans: ExitPlan[];
  positionSizing: PositionSizing[];
  timingReports: TimingReport[];
  tradePlans: TradePlan[];
  generatedAt: number;
}

export async function getMarketIntel(keys?: AssetKey[]): Promise<MarketIntel> {
  const [quotes, news] = await Promise.all([fetchAllQuotes(keys), fetchNews(6)]);
  const sentiment = calculateMarketSentiment(quotes, news);
  const signals = generateSignals(quotes, news, sentiment);
  const summary = buildSummary(quotes, signals);
  const insight = await generateMarketInsight(quotes, signals, news, sentiment);

  const events = classifyEvents(news);
  const correlations = computeCorrelations(quotes);
  const opportunities = scanOpportunities(quotes, signals, sentiment);
  const reasoning = generateReasoning(quotes, signals, sentiment);
  const alerts = generateAlerts(quotes, signals, events, opportunities, sentiment);

  // Quant layer
  const timeframes = analyzeAll(quotes);
  const regime = detectRegime(quotes, sentiment, news, correlations);
  const calibratedSignals = calibrateSignals(signals, timeframes, regime, sentiment);
  const confidence = summarizeConfidence(calibratedSignals);
  const portfolio = buildPortfolio(quotes, signals, correlations);
  const backtest = runBacktest(quotes, signals, regime);


  // Edge discovery layer
  const earlyMomentum = analyzeAllEarlyMomentum(quotes, sentiment);
  const breakouts = predictAllBreakouts(quotes);
  const liquidity = analyzeLiquidityFlow(quotes);
  const whales = trackWhaleActivity(quotes);
  const rankedOpportunities = rankOpportunities(
    quotes, signals, calibratedSignals, regime, earlyMomentum, breakouts, liquidity, whales,
  );

  // Tactical execution layer
  const entryZones = calculateAllEntryZones(quotes, calibratedSignals, timeframes, breakouts);
  const exitPlans = buildAllExitPlans(quotes, calibratedSignals, sentiment);
  const positionSizing = calculateAllPositionSizes(quotes, calibratedSignals, regime, portfolio);
  const timingReports = evaluateAllTiming(quotes, regime, breakouts, liquidity, events);
  const tradePlans = buildAllTradePlans(quotes, calibratedSignals, regime, entryZones, exitPlans, positionSizing, timingReports);

  return {
    quotes, signals, summary, sentiment, insight, news,
    events, correlations, opportunities, reasoning, alerts,
    timeframes, regime, calibratedSignals, confidence, portfolio, backtest,
    earlyMomentum, breakouts, liquidity, whales, rankedOpportunities,
    entryZones, exitPlans, positionSizing, timingReports, tradePlans,
    generatedAt: Date.now(),
  };
}

