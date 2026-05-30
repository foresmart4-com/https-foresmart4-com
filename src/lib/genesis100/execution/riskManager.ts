// Phase C: Risk Manager — calculates stop loss, staged take profit, and trailing stop levels.
// Pure calculation — no network calls, no side effects. Advisory only.
// All trades are paper/simulation. Human must confirm any action.
// "محاكاة ورقية — لا تنفيذ حقيقي"

export interface RiskParameters {
  symbol: string;
  entryPrice: number;
  positionSizePercent: number; // 0-100
  assetClass: string;          // from resolveAsset or GENESIS_UNIVERSE bucket
  genesisConfidence: number;   // 0-100
  portfolioCapital: number;
}

export interface RiskLevels {
  stopLossPrice: number;
  stopLossPercent: number;
  takeProfitPrice: number;          // Stage 3 (maximum target)
  takeProfitPercent: number;        // Stage 3 %
  takeProfitStage1: number;         // Take 33% profit here
  takeProfitStage2: number;         // Take 33% profit here
  takeProfitStage3: number;         // Take 34% profit here
  trailingStopActivation: number;   // Price level where trailing stop activates
  trailingStopPercent: number;      // Trailing offset % from peak
  maxHoldingDays: number;
  riskRewardRatio: number;
  positionValue: number;            // $ value of the position
  maxLossAmount: number;            // $ max loss at stop
  stage1Amount: number;             // $ at stage 1 take profit
  arabicRiskSummary: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function baseStopLossPercent(assetClass: string): number {
  if (assetClass === "crypto") return 0.08;
  if (assetClass === "forex") return 0.02;
  if (assetClass === "metal" || assetClass === "commodity") return 0.04;
  // us_stock, saudi_stock, etf, macro — default 5%
  return 0.05;
}

function maxHoldingDaysFor(assetClass: string): number {
  if (assetClass === "crypto") return 14;
  if (assetClass === "forex") return 10;
  if (assetClass === "metal" || assetClass === "commodity") return 30;
  return 45; // stocks / etf / macro
}

export function calculateRiskLevels(params: RiskParameters): RiskLevels {
  const { entryPrice, positionSizePercent, assetClass, genesisConfidence, portfolioCapital } = params;

  // Base stop loss %
  let slPct = baseStopLossPercent(assetClass);

  // Confidence adjustment
  if (genesisConfidence > 80) slPct = Math.max(0.01, slPct - 0.01); // tighten 1%
  if (genesisConfidence < 65) slPct = slPct + 0.01;                 // widen 1%

  const stopLossPrice = round2(entryPrice * (1 - slPct));
  const stopLossPercent = round2(slPct * 100);

  // Staged take profit
  const tp1Pct = slPct * 1.5;
  const tp2Pct = slPct * 2.5;
  const tp3Pct = slPct * 4.0;

  const takeProfitStage1 = round2(entryPrice * (1 + tp1Pct));
  const takeProfitStage2 = round2(entryPrice * (1 + tp2Pct));
  const takeProfitStage3 = round2(entryPrice * (1 + tp3Pct));

  // Trailing stop: activates at Stage 1, trails at 50% of move from entry
  const trailingStopActivation = takeProfitStage1;
  const trailingStopPercent = round2(tp1Pct * 50); // 50% of stage-1 move

  // Risk/reward
  const riskRewardRatio = round2(tp3Pct / slPct);

  // Max holding
  const maxHoldingDays = maxHoldingDaysFor(assetClass);

  // Dollar values
  const positionValue = round2((positionSizePercent / 100) * portfolioCapital);
  const maxLossAmount = round2(positionValue * slPct);
  const stage1Amount = round2(positionValue * tp1Pct);

  // Arabic summary
  const arabicRiskSummary =
    `وقف الخسارة عند ${stopLossPrice.toFixed(4)} (نسبة ${stopLossPercent}%). ` +
    `هدف الربح الأول عند ${takeProfitStage1.toFixed(4)} (+${round2(tp1Pct * 100)}%). ` +
    `هدف الربح الثاني عند ${takeProfitStage2.toFixed(4)} (+${round2(tp2Pct * 100)}%). ` +
    `هدف الربح الثالث عند ${takeProfitStage3.toFixed(4)} (+${round2(tp3Pct * 100)}%). ` +
    `نسبة المخاطرة إلى الربح: ${riskRewardRatio}. ` +
    `الحد الأقصى لأيام الاحتفاظ: ${maxHoldingDays} يوم. ` +
    `هذا التحليل استشاري وليس أمراً تنفيذياً — محاكاة ورقية فقط.`;

  return {
    stopLossPrice,
    stopLossPercent,
    takeProfitPrice: takeProfitStage3,
    takeProfitPercent: round2(tp3Pct * 100),
    takeProfitStage1,
    takeProfitStage2,
    takeProfitStage3,
    trailingStopActivation,
    trailingStopPercent,
    maxHoldingDays,
    riskRewardRatio,
    positionValue,
    maxLossAmount,
    stage1Amount,
    arabicRiskSummary,
  };
}
