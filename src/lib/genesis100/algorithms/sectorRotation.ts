import type { MacroContext } from "@/lib/genesis100/algorithms/economicFramework";

export interface SectorRotationSignal {
  preferredSectors: string[];
  avoidSectors: string[];
  rotationSignal: "early_cycle" | "mid_cycle" | "late_cycle" | "recession";
  arabicAnalysis: string;
}

export function getSectorRotation(macro: MacroContext): SectorRotationSignal {
  if (
    macro.businessCycle === "trough" ||
    macro.debtCyclePhase === "reflation"
  ) {
    return {
      preferredSectors: [
        "البنوك والمصارف",
        "العقارات",
        "المواد الأساسية",
        "الصناعة",
        "التكنولوجيا",
      ],
      avoidSectors: ["الدفاعية", "المرافق", "السلع الاستهلاكية الأساسية"],
      rotationSignal: "early_cycle",
      arabicAnalysis:
        "مرحلة مبكرة: البنوك والصناعة تقود. الفائدة المنخفضة تدعم التقييمات. تجنب الدفاعية والمرافق.",
    };
  }

  if (macro.businessCycle === "expansion" && macro.inflationLevel < 3) {
    return {
      preferredSectors: [
        "التكنولوجيا",
        "الرعاية الصحية",
        "السلع الاستهلاكية التقديرية",
        "الاتصالات",
      ],
      avoidSectors: ["الطاقة", "المواد الأولية", "المرافق"],
      rotationSignal: "mid_cycle",
      arabicAnalysis:
        "مرحلة التوسع: التكنولوجيا والصحة تتفوق. الأرباح تنمو وتدعم التقييمات.",
    };
  }

  if (macro.businessCycle === "peak" || macro.inflationLevel > 3) {
    return {
      preferredSectors: [
        "الطاقة والنفط",
        "المواد الخام",
        "الزراعة والغذاء",
        "المعادن الثمينة",
      ],
      avoidSectors: ["التكنولوجيا", "العقارات", "السلع التقديرية"],
      rotationSignal: "late_cycle",
      arabicAnalysis:
        "مرحلة متأخرة: الطاقة والسلع تحمي من التضخم. الذهب ملاذ آمن. تجنب التقييمات المرتفعة.",
    };
  }

  return {
    preferredSectors: [
      "المرافق",
      "الرعاية الصحية",
      "السلع الاستهلاكية الأساسية",
      "الدفاعية",
      "الذهب",
    ],
    avoidSectors: ["البنوك", "الصناعة", "الطاقة", "التكنولوجيا"],
    rotationSignal: "recession",
    arabicAnalysis:
      "مرحلة الركود: الدفاعية والصحة والمرافق تتفوق. الذهب والسندات ملاجئ آمنة. تجنب الدورية والبنوك.",
  };
}
