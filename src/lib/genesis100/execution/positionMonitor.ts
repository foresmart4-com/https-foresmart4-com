// Phase C: Position Monitor — checks open paper positions against stop loss and take profit levels.
// Advisory only. No automatic execution. Human must confirm any action.
// "محاكاة ورقية — لا تنفيذ حقيقي"

import { getPaperOrders } from "./paperOrders";
import { getRealFillPrice } from "./realPriceFill";
import { calculateRiskLevels } from "./riskManager";
import { resolveAsset } from "@/lib/market/router";

export interface PositionMonitorResult {
  orderId: string;
  symbol: string;
  action: "stop_loss_hit" | "take_profit_1" | "take_profit_2" | "take_profit_3" | "trailing_stop" | "hold" | "max_days_exceeded" | "no_price";
  currentPrice: number | null;
  entryPrice: number;
  pnlPercent: number;
  pnlAmount: number;
  stopLossPrice: number;
  takeProfitStage1: number;
  takeProfitStage2: number;
  takeProfitStage3: number;
  daysHeld: number;
  maxHoldingDays: number;
  riskRewardRatio: number;
  arabicAction: string;
  recommendation: string;
  alertLevel: "critical" | "warning" | "info" | "ok";
}

function daysAgo(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

const ACTION_ARABIC: Record<PositionMonitorResult["action"], string> = {
  stop_loss_hit: "وقف الخسارة — يُنصح بمراجعة إغلاق المركز",
  take_profit_1: "هدف الربح الأول تحقق — يُنصح بجني ثلث الربح",
  take_profit_2: "هدف الربح الثاني تحقق — يُنصح بجني ثلث آخر",
  take_profit_3: "هدف الربح الثالث تحقق — يُنصح بجني كامل المتبقي",
  trailing_stop: "تنبيه وقف الخسارة المتحرك — السعر تراجع عن الذروة",
  hold: "استمرار — لم تُفعّل أي مستويات بعد",
  max_days_exceeded: "تجاوز الحد الأقصى لأيام الاحتفاظ — يُنصح بمراجعة المركز",
  no_price: "تعذر الحصول على سعر السوق الحالي",
};

export async function checkOpenPositions(
  portfolioCapital = 100_000,
): Promise<PositionMonitorResult[]> {
  const orders = getPaperOrders(200);
  const filledOrders = orders.filter(
    (o) => o.status === "simulated_fill" && o.fillPrice !== null && o.fillTimestamp !== null,
  );

  if (!filledOrders.length) return [];

  const results = await Promise.all(
    filledOrders.map(async (o): Promise<PositionMonitorResult> => {
      const entryPrice = o.fillPrice!;
      const daysHeld = daysAgo(o.fillTimestamp!);

      const resolved = resolveAsset(o.symbol);
      const assetClass = resolved.assetClass;

      const risk = calculateRiskLevels({
        symbol: o.symbol,
        entryPrice,
        positionSizePercent: o.targetWeight * 100,
        assetClass,
        genesisConfidence: o.confidence,
        portfolioCapital,
      });

      const { price: currentPrice } = await getRealFillPrice(o.symbol);

      const pnlPercent =
        currentPrice !== null
          ? Math.round(((currentPrice - entryPrice) / entryPrice) * 10000) / 100
          : 0;
      const pnlAmount =
        currentPrice !== null
          ? Math.round((currentPrice - entryPrice) * o.notional * 100) / 100
          : 0;

      // Determine action
      let action: PositionMonitorResult["action"] = "hold";
      let alertLevel: PositionMonitorResult["alertLevel"] = "ok";

      if (currentPrice === null) {
        action = "no_price";
        alertLevel = "info";
      } else if (daysHeld >= risk.maxHoldingDays) {
        action = "max_days_exceeded";
        alertLevel = "warning";
      } else if (currentPrice <= risk.stopLossPrice) {
        action = "stop_loss_hit";
        alertLevel = "critical";
      } else if (currentPrice >= risk.takeProfitStage3) {
        action = "take_profit_3";
        alertLevel = "info";
      } else if (currentPrice >= risk.takeProfitStage2) {
        action = "take_profit_2";
        alertLevel = "info";
      } else if (currentPrice >= risk.takeProfitStage1) {
        // Check trailing stop: price retreated > 50% of move from entry
        const moveFromEntry = currentPrice - entryPrice;
        const trailingThreshold = risk.trailingStopActivation - entryPrice;
        if (moveFromEntry > 0 && moveFromEntry < trailingThreshold * 0.5) {
          action = "trailing_stop";
          alertLevel = "warning";
        } else {
          action = "take_profit_1";
          alertLevel = "info";
        }
      } else {
        // Check if approaching stop loss (within 1%)
        const distanceToStop = currentPrice !== null
          ? (currentPrice - risk.stopLossPrice) / entryPrice
          : 1;
        if (distanceToStop < 0.01) alertLevel = "warning";
      }

      return {
        orderId: o.id,
        symbol: o.symbol,
        action,
        currentPrice,
        entryPrice,
        pnlPercent,
        pnlAmount,
        stopLossPrice: risk.stopLossPrice,
        takeProfitStage1: risk.takeProfitStage1,
        takeProfitStage2: risk.takeProfitStage2,
        takeProfitStage3: risk.takeProfitStage3,
        daysHeld,
        maxHoldingDays: risk.maxHoldingDays,
        riskRewardRatio: risk.riskRewardRatio,
        arabicAction: ACTION_ARABIC[action],
        recommendation: action === "hold" ? "Monitor position" : `Action suggested: ${action.replace(/_/g, " ")}`,
        alertLevel,
      };
    }),
  );

  // Sort: critical first, then warning, then info
  const ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2, ok: 3 };
  return results.sort((a, b) => (ORDER[a.alertLevel] ?? 3) - (ORDER[b.alertLevel] ?? 3));
}
