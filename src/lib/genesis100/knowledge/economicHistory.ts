import type { MacroContext } from "@/lib/genesis100/algorithms/economicFramework";

export const ECONOMIC_CRISES = [
  {
    name: "الكساد الكبير 1929-1933",
    trigger: "انهيار سوق الأسهم وفشل البنوك",
    debtPhase: "depression" as const,
    monetaryEnv: "ultra_tight" as const,
    duration: "4 سنوات",
    recovery: "New Deal والإنفاق الحكومي",
    lessons: [
      "التشديد النقدي في الركود يُعمّق الأزمة",
      "الدفاع عن العملة بتكلفة الاقتصاد كارثي",
      "التحفيز المالي ضروري في الكساد",
    ],
    bestAssets: ["ذهب", "سندات حكومية", "نقد"],
    worstAssets: ["أسهم", "عقارات", "سلع"],
  },
  {
    name: "أزمة النفط 1973",
    trigger: "حظر نفطي عربي — ارتفاع النفط 400%",
    debtPhase: "slowdown" as const,
    monetaryEnv: "tight" as const,
    duration: "18 شهراً",
    recovery: "تنويع مصادر الطاقة",
    lessons: [
      "النفط سلاح جيوسياسي يغير موازين الاقتصاد",
      "الركود التضخمي أصعب معالجة من الركود العادي",
      "الدول المنتجة للنفط تستفيد بشكل غير متناسب",
    ],
    bestAssets: ["نفط", "ذهب", "أسهم طاقة", "عقارات"],
    worstAssets: ["أسهم صناعية", "سندات", "طيران"],
  },
  {
    name: "الأزمة الآسيوية 1997-1998",
    trigger: "انهيار عملات آسيوية وديون قصيرة الأجل",
    debtPhase: "recession" as const,
    monetaryEnv: "tight" as const,
    duration: "18 شهراً",
    recovery: "IMF وإصلاحات هيكلية",
    lessons: [
      "الديون بالعملة الأجنبية خطرة على الاقتصادات الناشئة",
      "ربط العملة يخلق هشاشة عند الضغط",
      "الأسواق الناشئة أكثر هشاشة من المتقدمة",
    ],
    bestAssets: ["دولار أمريكي", "سندات أمريكية", "ذهب"],
    worstAssets: ["أسهم آسيوية", "عملات ناشئة", "عقارات آسيا"],
  },
  {
    name: "فقاعة الدوت كوم 2000-2002",
    trigger: "مبالغة في تقييم شركات الإنترنت",
    debtPhase: "recession" as const,
    monetaryEnv: "loose" as const,
    duration: "30 شهراً",
    recovery: "فائدة منخفضة وفقاعة العقارات",
    lessons: [
      "التقييم المرتفع P/E يسبق الانهيار دائماً",
      "التكنولوجيا الجيدة لا تعني شركة جيدة",
      "الزخم يخفي المشاكل حتى ينتهي",
    ],
    bestAssets: ["ذهب", "طاقة", "قيمة", "سندات"],
    worstAssets: ["تكنولوجيا", "اتصالات", "إعلام"],
  },
  {
    name: "الأزمة المالية العالمية 2008-2009",
    trigger: "انهيار سوق الرهن العقاري والمشتقات",
    debtPhase: "depression" as const,
    monetaryEnv: "ultra_loose" as const,
    duration: "18 شهراً",
    recovery: "QE وإنقاذ البنوك",
    lessons: [
      "الرافعة المالية المفرطة تُضاعف الأزمة",
      "التيسير الكمي يمنع الكساد لكن يخلق تشوهات",
      "الترابط المالي العالمي يُعدي الأزمات",
      "الذهب ملجأ في كل الأحوال",
    ],
    bestAssets: ["ذهب", "سندات حكومية", "دولار"],
    worstAssets: ["أسهم مصارف", "عقارات", "سلع"],
  },
  {
    name: "كوفيد-19 2020",
    trigger: "إغلاق اقتصادي عالمي مفاجئ",
    debtPhase: "recession" as const,
    monetaryEnv: "ultra_loose" as const,
    duration: "6 أشهر انهيار + 18 شهر تعافٍ",
    recovery: "تحفيز مالي غير مسبوق + لقاحات",
    lessons: [
      "الأزمات الخارجية تخلق فرصاً للشراء السريع",
      "التحفيز المفرط يولّد تضخم لاحقاً",
      "التكنولوجيا والصحة أكثر القطاعات مرونة",
      "السلاسل الأمدادية هشة أكثر مما نظن",
    ],
    bestAssets: ["تكنولوجيا", "صحة", "ذهب", "كريبتو"],
    worstAssets: ["طيران", "فنادق", "تجزئة", "نفط"],
  },
  {
    name: "أزمة التضخم 2021-2023",
    trigger: "تحفيز كوفيد + اختناقات سلاسل الأمداد",
    debtPhase: "late_expansion" as const,
    monetaryEnv: "ultra_tight" as const,
    duration: "24 شهراً",
    recovery: "رفع فائدة حاد من الفيدرالي",
    lessons: [
      "التحفيز المفرط له ثمن مؤجل",
      "رفع الفائدة السريع يضر بالتقييمات",
      "السلع تحمي من التضخم أفضل من السندات",
    ],
    bestAssets: ["نفط", "ذهب", "سلع", "أسهم طاقة"],
    worstAssets: ["سندات", "تكنولوجيا", "نمو", "كريبتو"],
  },
] as const;

export function getHistoricalParallel(macro: MacroContext): string {
  const similar = ECONOMIC_CRISES.filter(
    (c) =>
      c.debtPhase === macro.debtCyclePhase ||
      c.monetaryEnv === macro.monetaryEnvironment,
  );

  if (similar.length === 0) return "";

  const crisis = similar[0];

  return `=== السياق التاريخي المشابه ===
أقرب حدث تاريخي للوضع الحالي:
"${crisis.name}"
السبب: ${crisis.trigger}
المدة: ${crisis.duration}
كيف انتهى: ${crisis.recovery}

الدروس المستفادة:
${crisis.lessons.map((l) => `• ${l}`).join("\n")}

الأصول الأفضل أداءً في تلك الفترة:
${[...crisis.bestAssets].join("، ")}

الأصول الأسوأ أداءً:
${[...crisis.worstAssets].join("، ")}`.trim();
}
