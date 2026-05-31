export interface OptimalPositionInput {
  symbol: string;
  assetClass: string;
  entryPrice: number;
  confidence: number;
  portfolioCapital: number;
  currentExposurePercent: number;
  historicalVolatility: number;
  agreementLevel: string;
}

export interface OptimalPositionOutput {
  stopLossPrice: number;
  stopLossPercent: number;
  takeProfitStage1: number;
  takeProfitStage2: number;
  takeProfitStage3: number;
  trailingStopActivation: number;
  recommendedPositionPercent: number;
  maxPositionPercent: number;
  kellyPercent: number;
  capitalToInvest: number;
  capitalAtRisk: number;
  riskRewardRatio: number;
  riskRewardAcceptable: boolean;
  maxHoldingDays: number;
  arabicRiskSummary: string;
}

export function calculateOptimalPosition(
  params: OptimalPositionInput,
): OptimalPositionOutput {
  const {
    symbol, assetClass, entryPrice, confidence,
    portfolioCapital, currentExposurePercent,
    historicalVolatility, agreementLevel,
  } = params;

  const baseStop: Record<string, number> = {
    crypto: 0.10,
    us_stock: 0.06,
    saudi_stock: 0.06,
    forex: 0.025,
    metal: 0.05,
    commodity: 0.07,
  };

  let stopPercent = baseStop[assetClass] ?? 0.07;

  if (historicalVolatility > 0) {
    stopPercent = Math.max(stopPercent, historicalVolatility * 0.5);
  }

  if (confidence > 80) stopPercent *= 0.85;
  else if (confidence < 60) stopPercent *= 1.20;

  if (agreementLevel === "conflicted") stopPercent *= 1.25;
  else if (agreementLevel === "strong") stopPercent *= 0.90;

  stopPercent = Math.min(stopPercent, 0.20);

  const stopLossPrice = entryPrice * (1 - stopPercent);
  const tp1 = stopPercent * 1.5;
  const tp2 = stopPercent * 2.5;
  const tp3 = stopPercent * (confidence > 75 ? 3.5 : 3.0);

  const maxByClass: Record<string, number> = {
    crypto: 0.08, us_stock: 0.15,
    saudi_stock: 0.15, forex: 0.10,
    metal: 0.12, commodity: 0.10,
  };
  const maxPositionPercent = maxByClass[assetClass] ?? 0.10;

  const winRate = confidence / 100;
  const avgWin = tp2;
  const avgLoss = stopPercent;
  const kelly = Math.max(
    0,
    ((winRate * avgWin - (1 - winRate) * avgLoss) / avgWin) * 0.5,
  );

  const remaining = Math.max(0, 1 - currentExposurePercent / 100);
  let recommended = Math.min(kelly, maxPositionPercent, remaining * 0.30);

  if (confidence < 65) recommended *= 0.70;
  if (agreementLevel === "conflicted") recommended *= 0.60;
  if (agreementLevel === "strong" && confidence > 80) recommended *= 1.10;

  recommended = Math.min(recommended, maxPositionPercent);

  const capitalToInvest = portfolioCapital * recommended;
  const capitalAtRisk = capitalToInvest * stopPercent;
  const rrRatio = tp2 / stopPercent;

  const maxDays: Record<string, number> = {
    crypto: 21, us_stock: 60, saudi_stock: 45,
    forex: 14, metal: 40, commodity: 30,
  };

  const arabicRiskSummary = [
    `📊 تحليل مخاطر ${symbol}`,
    `💰 حجم المركز: ${(recommended * 100).toFixed(1)}% (${capitalToInvest.toLocaleString("ar-SA")} ريال)`,
    `🛑 وقف الخسارة: ${stopLossPrice.toFixed(4)} (${(stopPercent * 100).toFixed(1)}%)`,
    `🎯 الهدف الأول: ${(entryPrice * (1 + tp1)).toFixed(4)} (+${(tp1 * 100).toFixed(1)}%) — أغلق 33%`,
    `🎯 الهدف الثاني: ${(entryPrice * (1 + tp2)).toFixed(4)} (+${(tp2 * 100).toFixed(1)}%) — أغلق 33%`,
    `🎯 الهدف الثالث: ${(entryPrice * (1 + tp3)).toFixed(4)} (+${(tp3 * 100).toFixed(1)}%) — أغلق الباقي`,
    `⚖️ نسبة المخاطرة/الربح: 1:${rrRatio.toFixed(1)} ${rrRatio >= 2 ? "✅" : "⚠️"}`,
    `⚠️ محاكاة ورقية — لا تنفيذ حقيقي`,
  ].join("\n");

  return {
    stopLossPrice,
    stopLossPercent: stopPercent * 100,
    takeProfitStage1: entryPrice * (1 + tp1),
    takeProfitStage2: entryPrice * (1 + tp2),
    takeProfitStage3: entryPrice * (1 + tp3),
    trailingStopActivation: entryPrice * (1 + tp1),
    recommendedPositionPercent: recommended * 100,
    maxPositionPercent: maxPositionPercent * 100,
    kellyPercent: kelly * 100,
    capitalToInvest,
    capitalAtRisk,
    riskRewardRatio: rrRatio,
    riskRewardAcceptable: rrRatio >= 2,
    maxHoldingDays: maxDays[assetClass] ?? 30,
    arabicRiskSummary,
  };
}
