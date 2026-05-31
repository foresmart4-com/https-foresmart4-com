export interface TechnicalSignals {
  trend: "bullish" | "bearish" | "neutral";
  momentum: "strong" | "moderate" | "weak";
  rsiSignal: "overbought" | "neutral" | "oversold";
  volumeSignal: "high" | "normal" | "low";
  arabicSummary: string;
}

export function analyzeTechnical(
  _prices: number[],
  _volumes: number[],
  changePercent: number,
): TechnicalSignals {
  const trend =
    changePercent > 2 ? "bullish" : changePercent < -2 ? "bearish" : "neutral";

  const absChange = Math.abs(changePercent);
  const momentum =
    absChange > 3 ? "strong" : absChange > 1 ? "moderate" : "weak";

  const avgGain = changePercent > 0 ? changePercent : 0;
  const avgLoss = changePercent < 0 ? Math.abs(changePercent) : 0;
  const rs = avgGain / (avgLoss || 1);
  const rsi = 100 - 100 / (1 + rs);

  const rsiSignal: TechnicalSignals["rsiSignal"] =
    rsi > 70 ? "overbought" : rsi < 30 ? "oversold" : "neutral";

  const arabicSummary = [
    `الاتجاه: ${trend === "bullish" ? "صاعد" : trend === "bearish" ? "هابط" : "محايد"}`,
    `الزخم: ${momentum === "strong" ? "قوي" : momentum === "moderate" ? "معتدل" : "ضعيف"}`,
    `RSI: ${
      rsiSignal === "overbought"
        ? "منطقة تشبع شراء — تحذير"
        : rsiSignal === "oversold"
          ? "منطقة تشبع بيع — فرصة"
          : "منطقة محايدة"
    }`,
  ].join("\n");

  return { trend, momentum, rsiSignal, volumeSignal: "normal", arabicSummary };
}
