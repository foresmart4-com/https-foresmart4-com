import type { MacroContext } from "@/lib/genesis100/algorithms/economicFramework";

export interface ConfidenceAssessment {
  overallConfidence: number;
  dataQuality: "high" | "medium" | "low";
  uncertaintyFactors: string[];
  arabicConfidenceStatement: string;
}

export function calibrateConfidence(
  macro: MacroContext,
  knowledgeCount: number,
  lastRefreshHours: number,
): ConfidenceAssessment {
  let confidence = 50;

  if (lastRefreshHours < 6)       confidence += 15;
  else if (lastRefreshHours < 24) confidence += 5;
  else                            confidence -= 10;

  if (knowledgeCount > 50)       confidence += 10;
  else if (knowledgeCount > 20)  confidence += 5;
  else                           confidence -= 5;

  confidence += (macro.dataConfidence - 50) * 0.3;

  const uncertaintyFactors: string[] = [];

  if (macro.riskRegime === "uncertain") {
    confidence -= 10;
    uncertaintyFactors.push("نظام المخاطر غير محدد");
  }
  if (
    macro.geopoliticalRiskLevel === "high" ||
    macro.geopoliticalRiskLevel === "extreme"
  ) {
    confidence -= 8;
    uncertaintyFactors.push("مخاطر جيوسياسية مرتفعة");
  }
  if (macro.debtCyclePhase === "unknown") {
    confidence -= 5;
    uncertaintyFactors.push("مرحلة دورة الديون غير محددة");
  }

  confidence = Math.max(20, Math.min(85, confidence));

  const dataQuality: ConfidenceAssessment["dataQuality"] =
    confidence > 65 ? "high" : confidence > 45 ? "medium" : "low";

  const arabicConfidenceStatement =
    confidence > 70
      ? `درجة الثقة: ${confidence}% — مرتفعة. البيانات حديثة وشاملة.`
      : confidence > 50
        ? `درجة الثقة: ${confidence}% — متوسطة. ${
            uncertaintyFactors.length > 0
              ? "عوامل عدم اليقين: " + uncertaintyFactors.join("، ")
              : "بيانات كافية للتحليل."
          }`
        : `درجة الثقة: ${confidence}% — منخفضة. تحفظات: ${
            uncertaintyFactors.join("، ")
          }. يُنصح بمراجعة إضافية.`;

  return {
    overallConfidence: Math.round(confidence),
    dataQuality,
    uncertaintyFactors,
    arabicConfidenceStatement,
  };
}
