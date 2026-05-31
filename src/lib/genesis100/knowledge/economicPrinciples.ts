import type { MacroContext } from "@/lib/genesis100/algorithms/economicFramework";

export function getEconomicPrinciples(macro: MacroContext): string {
  const { businessCycle, monetaryEnvironment, debtCyclePhase, riskRegime,
          inflationLevel, oilPrice, fiscalStance, qeActive,
          capitalFlowTrend, peRatio } = macro;

  const fearGreed = macro.fearGreedIndex ?? 50;

  return `
=== تحليل المدارس الاقتصادية للوضع الراهن ===

1. الكينزية (Keynes/Samuelson/Krugman):
   الوضع: دورة ${businessCycle} | موقف مالي: ${fiscalStance}
   التحليل: في مرحلة ${businessCycle}، الطلب الكلي ${
     businessCycle === "expansion"   ? "في صعود يدعم الأرباح والتوظيف" :
     businessCycle === "peak"        ? "وصل ذروته وقد يتباطأ" :
     businessCycle === "contraction" ? "ينكمش مما يستدعي تحفيزاً" :
                                       "في الحضيض وفرصة للانتعاش"
   }.
   التوصية: ${
     fiscalStance === "expansionary"  ? "الإنفاق الحكومي يدعم السوق — إيجابي للأسهم" :
     fiscalStance === "contractionary" ? "التقشف يضغط على الطلب — تحفظ مطلوب" :
                                         "سياسة مالية محايدة — مراقبة مستمرة"
   }.

2. النقدية (Friedman/Bernanke/Taylor):
   الوضع: فائدة ${monetaryEnvironment} | تضخم ${inflationLevel.toFixed(1)}%
   التحليل: مع تضخم ${inflationLevel.toFixed(1)}% والبيئة النقدية ${monetaryEnvironment}،
   ${
     monetaryEnvironment === "tight" || monetaryEnvironment === "ultra_tight"
       ? "التشديد النقدي يضغط على التقييمات ويرفع تكلفة الاقتراض"
       : monetaryEnvironment === "loose" || monetaryEnvironment === "ultra_loose"
       ? "التيسير النقدي يدعم الأصول ويخفض تكلفة الاقتراض"
       : "البيئة النقدية المحايدة تعطي مرونة للسوق"
   }.
   التوصية: ${
     inflationLevel > 4 ? "تضخم مرتفع يأكل العوائد الحقيقية — ذهب وسلع" :
     inflationLevel < 2 ? "تضخم منخفض يدعم السندات والأسهم النامية" :
                          "تضخم معتدل — بيئة مثالية للأسهم"
   }.

3. النمساوية (Hayek/Mises/Rothbard):
   الوضع: دورة الديون ${debtCyclePhase} | QE: ${String(qeActive)}
   التحليل: ${
     debtCyclePhase === "early_expansion" || debtCyclePhase === "late_expansion"
       ? "التوسع الائتماني يخلق فقاعات محتملة في الأصول"
       : debtCyclePhase === "recession" || debtCyclePhase === "depression"
       ? "تصحيح طبيعي للتشوهات المتراكمة — فرصة في القيمة الحقيقية"
       : "مرحلة انتقالية — الحذر من الأصول المفرطة في التقييم"
   }.
   التوصية: ${
     qeActive
       ? "التيسير الكمي يشوه الأسعار — تفضيل الذهب والأصول الحقيقية"
       : "بدون QE — تسعير أكثر واقعية للأصول"
   }.

4. السلوكية (Kahneman/Thaler/Shiller):
   الوضع: نظام المخاطر ${riskRegime}
   التحليل: ${
     riskRegime === "risk_on"      ? "شهية المخاطرة عالية — خطر سلوك القطيع والمبالغة" :
     riskRegime === "risk_off"     ? "هروب للأمان — ذهب وسندات حكومية مطلوبة" :
                                     "مرحلة انتقالية — عدم يقين يسبب تذبذباً"
   }.
   مؤشر الخوف/الجشع: ${
     fearGreed < 30 ? "خوف شديد — فرصة عكسية تاريخياً" :
     fearGreed > 70 ? "جشع شديد — تحذير من انعكاس" :
                      "معتدل — لا إشارة قوية"
   }.

5. استثمار القيمة (Graham/Buffett/Munger):
   الوضع: P/E السوق ${peRatio.toFixed(1)}x
   التحليل: ${
     peRatio < 15 ? "تقييمات جذابة — فرصة شراء بهامش أمان" :
     peRatio > 25 ? "تقييمات مرتفعة — حذر من المضاربة" :
                    "تقييمات معتدلة — انتقائية مطلوبة"
   }.
   التوصية: ابحث عن شركات بخندق تنافسي واسع وديون منخفضة وأرباح متكررة.

6. الماكرو العالمي (Soros/Dalio/Druckenmiller):
   الوضع: النفط ${oilPrice}$ | تدفقات: ${capitalFlowTrend}
   دورة Dalio: ${debtCyclePhase}
   التحليل: ${
     oilPrice > 85 ? "نفط مرتفع يدعم السعودية والخليج ويضغط على المستوردين" :
     oilPrice < 65 ? "نفط منخفض يضر بالمنتجين ويدعم المستهلكين" :
                     "نفط متوازن — تأثير محايد على معظم الأسواق"
   }.
   التدفقات الرأسمالية: ${
     capitalFlowTrend === "inflow"  ? "تدفقات للداخل تدعم الأسواق الناشئة" :
     capitalFlowTrend === "outflow" ? "خروج رؤوس أموال يضغط على العملات والأسواق" :
                                      "تدفقات متوازنة"
   }.
`.trim();
}
