import type { MacroContext, AssetContext } from "./economicFramework";

export interface SchoolAnalysis {
  score: number;
  signal: "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";
  confidence: number;
  reasoning: string;
  keyFactors: string[];
}

export interface AllSchoolsAnalysis {
  keynesian: SchoolAnalysis;
  monetarist: SchoolAnalysis;
  austrian: SchoolAnalysis;
  behavioral: SchoolAnalysis;
  valueInvesting: SchoolAnalysis;
  globalMacro: SchoolAnalysis;
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function scoreToSignal(score: number): SchoolAnalysis["signal"] {
  if (score >= 78) return "strong_buy";
  if (score >= 62) return "buy";
  if (score >= 42) return "neutral";
  if (score >= 28) return "sell";
  return "strong_sell";
}

export function analyzeKeynesianSchool(
  asset: AssetContext,
  macro: MacroContext,
): SchoolAnalysis {
  let score = 50;
  const factors: string[] = [];

  if (macro.fiscalStance === "expansionary") {
    score += 15;
    factors.push("السياسة المالية التوسعية تدعم الطلب الكلي");
  } else if (macro.fiscalStance === "contractionary") {
    score -= 15;
    factors.push("التقشف المالي يضغط على الطلب");
  }

  if (macro.businessCycle === "expansion") {
    score += 12;
    factors.push("توسع اقتصادي يدعم الإيرادات والأرباح");
  } else if (macro.businessCycle === "contraction") {
    score -= 20;
    factors.push("الانكماش يضغط على الطلب والإيرادات");
  }

  if (macro.outputGap > 0) {
    score += 8;
    factors.push("اقتصاد يعمل فوق طاقته");
  } else if (macro.outputGap < -2) {
    score -= 8;
    factors.push("طاقة إنتاجية معطلة");
  }

  if (
    (asset.assetClass === "us_stock" ||
      asset.assetClass === "saudi_stock") &&
    macro.fiscalStance === "expansionary"
  ) {
    score += 10;
  }

  score = clamp(score);
  return {
    score,
    signal: scoreToSignal(score),
    confidence: 70,
    reasoning: `المدرسة الكينزية: ${score >= 55 ? "إيجابية" : score >= 45 ? "محايدة" : "سلبية"} — ${factors[0] ?? "لا بيانات كافية"}`,
    keyFactors: factors,
  };
}

export function analyzeMonetaristSchool(
  asset: AssetContext,
  macro: MacroContext,
): SchoolAnalysis {
  let score = 50;
  const factors: string[] = [];

  if (macro.interestRateTrend === "falling") {
    score += 20;
    factors.push("انخفاض أسعار الفائدة يرفع قيمة الأصول");
    if (asset.assetClass === "crypto") score += 5;
    if (asset.assetClass === "us_stock") score += 8;
  } else if (macro.interestRateTrend === "rising") {
    score -= 18;
    factors.push("ارتفاع أسعار الفائدة يضغط على التقييمات");
    if (asset.assetClass === "crypto") score -= 10;
  }

  if (macro.inflationLevel > 4) {
    score -= 12;
    factors.push(`التضخم المرتفع (${macro.inflationLevel}%) يأكل العوائد الحقيقية`);
    if (asset.assetClass === "metal") score += 25;
  } else if (
    macro.inflationLevel < 2 &&
    macro.inflationLevel > 0
  ) {
    score += 8;
    factors.push("تضخم معتدل — بيئة مثالية للنمو");
  }

  if (macro.m2Growth > 8) {
    score += 10;
    factors.push("توسع في عرض النقود يدعم أسعار الأصول");
  } else if (macro.m2Growth < 0) {
    score -= 12;
    factors.push("انكماش عرض النقود إشارة تحذير");
  }

  score = clamp(score);
  return {
    score,
    signal: scoreToSignal(score),
    confidence: 75,
    reasoning: `المدرسة النقدية: ${score >= 55 ? "إيجابية" : score >= 45 ? "محايدة" : "سلبية"} — ${factors[0] ?? "لا بيانات كافية"}`,
    keyFactors: factors,
  };
}

export function analyzeAustrianSchool(
  asset: AssetContext,
  macro: MacroContext,
): SchoolAnalysis {
  let score = 50;
  const factors: string[] = [];

  if (macro.qeActive && macro.yearsOfLowRates > 5) {
    score -= 15;
    factors.push("سنوات من الفائدة المنخفضة خلقت تشوهات في تسعير الأصول");
    if (asset.assetClass === "metal") score += 30;
    if (asset.assetClass === "crypto") score += 15;
  }

  if (macro.debtToGdpRatio > 100) {
    score -= 10;
    factors.push(`نسبة دين/ناتج ${macro.debtToGdpRatio}% — مخاطر إعادة هيكلة`);
  }

  if (macro.creditGrowth > 15) {
    score -= 8;
    factors.push("نمو ائتماني سريع يُنذر بدورة تصحيح");
  }

  if (
    asset.priceToBookValue !== undefined &&
    asset.priceToBookValue < 1.5
  ) {
    score += 15;
    factors.push("تسعير يقترب من القيمة الحقيقية");
  } else if (
    asset.priceToBookValue !== undefined &&
    asset.priceToBookValue > 5
  ) {
    score -= 15;
    factors.push("تسعير مبالغ فيه — فقاعة محتملة");
  }

  score = clamp(score);
  return {
    score,
    signal: scoreToSignal(score),
    confidence: 60,
    reasoning: `المدرسة النمساوية: ${score >= 55 ? "إيجابية" : score >= 45 ? "محايدة" : "سلبية"} — ${factors[0] ?? "لا بيانات كافية"}`,
    keyFactors: factors,
  };
}

export function analyzeBehavioralSchool(
  asset: AssetContext,
  macro: MacroContext,
): SchoolAnalysis {
  let score = 50;
  const factors: string[] = [];

  if (macro.fearGreedIndex !== undefined) {
    if (macro.fearGreedIndex < 20) {
      score += 20;
      factors.push(`خوف شديد (${macro.fearGreedIndex}) — الشراء في الذعر تاريخيًا مربح`);
    } else if (macro.fearGreedIndex > 80) {
      score -= 20;
      factors.push(`جشع شديد (${macro.fearGreedIndex}) — السوق في منطقة الإفراط`);
    }
  }

  if (asset.changePercent30d !== undefined) {
    if (asset.changePercent30d > 30) {
      score -= 12;
      factors.push("ارتفاع حاد خلال 30 يوم — انحياز الحداثة");
    } else if (asset.changePercent30d < -30) {
      score += 12;
      factors.push("انخفاض حاد خلال 30 يوم — فرصة عكسية");
    }
  }

  if (asset.socialSentiment === "extreme_positive") {
    score -= 15;
    factors.push("معنويات إيجابية متطرفة — خطر سلوك القطيع");
  } else if (asset.socialSentiment === "extreme_negative") {
    score += 15;
    factors.push("معنويات سلبية متطرفة — فرصة عكسية");
  }

  score = clamp(score);
  return {
    score,
    signal: scoreToSignal(score),
    confidence: 65,
    reasoning: `التمويل السلوكي: ${score >= 55 ? "إيجابي" : score >= 45 ? "محايد" : "سلبي"} — ${factors[0] ?? "لا بيانات سلوكية كافية"}`,
    keyFactors: factors,
  };
}

export function analyzeValueInvestingSchool(
  asset: AssetContext,
  _macro: MacroContext,
): SchoolAnalysis {
  if (
    asset.assetClass !== "us_stock" &&
    asset.assetClass !== "saudi_stock"
  ) {
    return {
      score: 50,
      signal: "neutral",
      confidence: 20,
      reasoning: "الاستثمار في القيمة ينطبق أساسًا على الأسهم",
      keyFactors: ["غير قابل للتطبيق على هذا النوع من الأصول"],
    };
  }

  let score = 50;
  const factors: string[] = [];

  if (asset.discountToIntrinsicValue !== undefined) {
    if (asset.discountToIntrinsicValue > 30) {
      score += 25;
      factors.push(`خصم ${asset.discountToIntrinsicValue}% من القيمة الجوهرية`);
    } else if (asset.discountToIntrinsicValue < -20) {
      score -= 25;
      factors.push(`علاوة فوق القيمة الجوهرية — لا هامش أمان`);
    }
  }

  if (asset.peRatio !== undefined) {
    if (asset.peRatio < 12) {
      score += 20;
      factors.push(`مضاعف ربحية منخفض (${asset.peRatio}x)`);
    } else if (asset.peRatio > 35) {
      score -= 20;
      factors.push(`مضاعف ربحية مرتفع جدًا (${asset.peRatio}x)`);
    }
  }

  if (asset.economicMoat === "wide") {
    score += 15;
    factors.push("خندق تنافسي واسع — ميزة دائمة");
  } else if (asset.economicMoat === "none") {
    score -= 10;
    factors.push("لا توجد ميزة تنافسية واضحة");
  }

  if (
    asset.debtToEquity !== undefined &&
    asset.debtToEquity < 0.5
  ) {
    score += 10;
    factors.push("ميزانية قوية — ديون منخفضة");
  } else if (
    asset.debtToEquity !== undefined &&
    asset.debtToEquity > 3
  ) {
    score -= 15;
    factors.push("ميزانية مثقلة بالديون");
  }

  score = clamp(score);
  return {
    score,
    signal: scoreToSignal(score),
    confidence: 70,
    reasoning: `الاستثمار في القيمة: ${score >= 55 ? "إيجابي" : score >= 45 ? "محايد" : "سلبي"} — ${factors[0] ?? "بيانات التقييم غير متاحة"}`,
    keyFactors: factors,
  };
}

export function analyzeGlobalMacroSchool(
  asset: AssetContext,
  macro: MacroContext,
): SchoolAnalysis {
  let score = 50;
  const factors: string[] = [];

  if (asset.assetClass === "forex") {
    if (macro.interestRateDifferential > 2) {
      score += 20;
      factors.push(`فارق فائدة ${macro.interestRateDifferential}% — فرصة carry trade`);
    } else if (macro.interestRateDifferential < -1) {
      score -= 15;
      factors.push("فارق فائدة سلبي — ضغط على العملة");
    }
  }

  if (
    macro.capitalFlowTrend === "inflow" &&
    asset.marketRegion.includes("saudi")
  ) {
    score += 15;
    factors.push("تدفقات رأس المال للأسواق الخليجية");
  }

  if (macro.geopoliticalRiskLevel === "high" || macro.geopoliticalRiskLevel === "extreme") {
    if (asset.assetClass === "metal") {
      score += 20;
      factors.push("توترات جيوسياسية تدفع للملاجئ الآمنة");
    } else {
      score -= 12;
      factors.push("مخاطر جيوسياسية عالية تضر بالأصول الخطرة");
    }
  }

  if (asset.momentumStrength > 0.7) {
    score += 10;
    factors.push("زخم قوي يغذي نفسه عبر الانعكاسية");
  }

  if (asset.assetClass === "commodity") {
    if (macro.globalGrowthTrend === "accelerating") {
      score += 15;
      factors.push("تسارع النمو العالمي يدعم الطلب على السلع");
    }
  }

  if (asset.marketRegion.includes("saudi")) {
    if (macro.oilPrice > 80) {
      score += 15;
      factors.push(`أسعار نفط مرتفعة (${macro.oilPrice}$) تدعم الاقتصاد السعودي`);
    } else if (macro.oilPrice < 60) {
      score -= 10;
      factors.push(`انخفاض النفط (${macro.oilPrice}$) يضغط على الخليج`);
    }
  }

  score = clamp(score);
  return {
    score,
    signal: scoreToSignal(score),
    confidence: 72,
    reasoning: `الماكرو العالمي: ${score >= 55 ? "إيجابي" : score >= 45 ? "محايد" : "سلبي"} — ${factors[0] ?? "لا بيانات ماكرو كافية"}`,
    keyFactors: factors,
  };
}

export function analyzeAllSchools(
  asset: AssetContext,
  macro: MacroContext,
): AllSchoolsAnalysis {
  return {
    keynesian: analyzeKeynesianSchool(asset, macro),
    monetarist: analyzeMonetaristSchool(asset, macro),
    austrian: analyzeAustrianSchool(asset, macro),
    behavioral: analyzeBehavioralSchool(asset, macro),
    valueInvesting: analyzeValueInvestingSchool(asset, macro),
    globalMacro: analyzeGlobalMacroSchool(asset, macro),
  };
}
