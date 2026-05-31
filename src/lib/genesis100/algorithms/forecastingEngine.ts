import type { MacroContext } from "@/lib/genesis100/algorithms/economicFramework";

export interface EconomicForecast {
  gdpOutlook: "expansion" | "slowdown" | "recession";
  inflationOutlook: "rising" | "stable" | "falling";
  rateOutlook: "hiking" | "holding" | "cutting";
  marketRegimeOutlook: "risk_on" | "transitioning" | "risk_off";
  probabilityScores: {
    bullCase: number;
    baseCase: number;
    bearCase: number;
  };
  arabicForecastSummary: string;
}

export function buildEconomicForecast(
  macro: MacroContext,
  horizon: "3month" | "6month" | "12month",
): EconomicForecast {
  const gdpOutlook: EconomicForecast["gdpOutlook"] =
    macro.businessCycle === "contraction"
      ? "recession"
      : macro.businessCycle === "peak"
        ? "slowdown"
        : "expansion";

  const inflationOutlook: EconomicForecast["inflationOutlook"] =
    macro.inflationLevel > 4 &&
    (macro.monetaryEnvironment === "tight" ||
      macro.monetaryEnvironment === "ultra_tight")
      ? "falling"
      : macro.inflationLevel < 2 &&
          (macro.monetaryEnvironment === "loose" ||
            macro.monetaryEnvironment === "ultra_loose")
        ? "rising"
        : "stable";

  const rateOutlook: EconomicForecast["rateOutlook"] =
    macro.inflationLevel > 3 &&
    macro.monetaryEnvironment !== "tight" &&
    macro.monetaryEnvironment !== "ultra_tight"
      ? "hiking"
      : macro.inflationLevel < 2 && macro.businessCycle === "contraction"
        ? "cutting"
        : "holding";

  const marketRegimeOutlook: EconomicForecast["marketRegimeOutlook"] =
    macro.riskRegime === "risk_on" && gdpOutlook === "expansion"
      ? "risk_on"
      : macro.riskRegime === "risk_off" || gdpOutlook === "recession"
        ? "risk_off"
        : "transitioning";

  const bullProb =
    gdpOutlook === "expansion" ? 45 : gdpOutlook === "slowdown" ? 25 : 15;
  const bearProb =
    gdpOutlook === "recession" ? 45 : gdpOutlook === "slowdown" ? 30 : 15;
  const baseProb = 100 - bullProb - bearProb;

  const horizonAr =
    horizon === "3month" ? "3 أشهر" : horizon === "6month" ? "6 أشهر" : "12 شهراً";

  const arabicForecastSummary = `=== توقعات الـ ${horizonAr} القادمة ===
النمو الاقتصادي: ${
    gdpOutlook === "expansion"
      ? "توسع مستمر"
      : gdpOutlook === "slowdown"
        ? "تباطؤ محتمل"
        : "ركود محتمل"
  }
التضخم: ${
    inflationOutlook === "falling"
      ? "انخفاض متوقع"
      : inflationOutlook === "rising"
        ? "ارتفاع محتمل"
        : "استقرار نسبي"
  }
الفائدة: ${
    rateOutlook === "hiking"
      ? "رفع محتمل"
      : rateOutlook === "cutting"
        ? "خفض محتمل"
        : "تثبيت مرجح"
  }
بيئة السوق: ${
    marketRegimeOutlook === "risk_on"
      ? "شهية مخاطرة إيجابية"
      : marketRegimeOutlook === "risk_off"
        ? "هروب للأمان"
        : "انتقالية"
  }
السيناريوهات:
- متفائل (${bullProb}%): استمرار النمو وتراجع التضخم
- أساسي (${baseProb}%): استقرار مع تباطؤ تدريجي
- متشائم (${bearProb}%): ركود وضغوط مالية`.trim();

  return {
    gdpOutlook,
    inflationOutlook,
    rateOutlook,
    marketRegimeOutlook,
    probabilityScores: { bullCase: bullProb, baseCase: baseProb, bearCase: bearProb },
    arabicForecastSummary,
  };
}
