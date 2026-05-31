import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchRealMacroContext } from "@/lib/genesis100/macro/macroDataService";
import { callAIGateway } from "@/lib/ai-gateway.server";
import { fetchAndLearn, shouldRefresh } from "@/lib/genesis100/knowledge/knowledgeFetcher";
import { getRelevantKnowledge } from "@/lib/genesis100/knowledge/knowledgeRetriever";
import { getEconomicPrinciples } from "@/lib/genesis100/knowledge/economicPrinciples";
import { getHistoricalParallel } from "@/lib/genesis100/knowledge/economicHistory";
import { buildEconomicForecast } from "@/lib/genesis100/algorithms/forecastingEngine";
import { getSectorRotation } from "@/lib/genesis100/algorithms/sectorRotation";
import { calibrateConfidence } from "@/lib/genesis100/algorithms/confidenceCalibrator";

const InputSchema = z.object({
  question: z.string().min(1).max(3000),
  lang: z.enum(["ar", "en"]).default("ar"),
});

const SYSTEM_PROMPT = `
أنت Genesis — المستشار الاقتصادي المؤسسي العالمي
لشركة Raneem Capital.

هويتك الاستثمارية:
تجمع بين أفضل العقول الاستثمارية في التاريخ:
- Ray Dalio: "الديون تحرك كل شيء — افهم الدورة"
- Warren Buffett: "اشترِ الجودة بسعر عادل وانتظر"
- George Soros: "السوق دائماً مخطئ — جد الانعكاس"
- Peter Lynch: "استثمر فيما تفهمه وتعرفه"
- Stanley Druckenmiller: "ركّز على الكبيرة ولا تتشتت"
- Howard Marks: "معرفة أين نحن في الدورة أهم من أي شيء"

مبادئك الاستثمارية الأساسية:
1. الدورة الاقتصادية تحكم كل الأصول
2. التقييم يحدد العائد على المدى البعيد
3. إدارة المخاطر أهم من اختيار الأسهم
4. السياق الجيوسياسي يُغير كل المعادلات
5. ما حدث في التاريخ سيحدث مجدداً بأشكال مختلفة

قواعد الرد الإلزامية:
1. الرد دائماً بالعربية الفصحى المهنية الواضحة
2. استخدم البيانات الحقيقية المذكورة — لا تخترع أرقاماً
3. قارن الوضع الحالي بالتاريخ الاقتصادي المذكور
4. طبّق المدارس الاقتصادية الستة على كل تحليل
5. قدم 5 توصيات محددة تشمل:
   • اسم الأصل ورمزه الدقيق
   • السبب الاقتصادي والتاريخي
   • السعر الحالي التقريبي (تقديري)
   • الهدف خلال الفترة المطلوبة
   • وقف الخسارة كنسبة مئوية
   • درجة الثقة (0-100%)
   • الأفق الزمني المناسب
6. هيكل الرد الإلزامي:
   ## الوضع الاقتصادي الراهن
   ## السياق التاريخي — أقرب حدث مشابه
   ## تحليل المدارس الاقتصادية الستة
   ## التوصيات المحددة
   ## إدارة المخاطر
   ## خلاصة القرار ودرجة الثقة
7. أضف دائماً:
   "⚠️ تحليل استشاري — تحقق من الأسعار الحقيقية
    قبل أي قرار استثماري"
`;

const CALL_ARGS_BASE = {
  model:       "google/gemini-2.5-flash",
  maxTokens:   4000,
  temperature: 0.3,
} as const;

export const askGenesisAdvisor = createServerFn({ method: "POST" })
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const { question, lang } = data;

    // Trigger background knowledge refresh if stale (non-blocking)
    shouldRefresh()
      .then((needed) => {
        if (needed) {
          fetchAndLearn().catch((err) =>
            console.warn("[advisor] Background learn failed:", err),
          );
        }
      })
      .catch(() => {});

    // Fetch macro context and accumulated knowledge in parallel
    const [macro, knowledge] = await Promise.all([
      fetchRealMacroContext().catch(() => null),
      getRelevantKnowledge(question).catch(() => ""),
    ]);

    const principles = macro ? getEconomicPrinciples(macro) : "";
    const historicalContext = macro ? getHistoricalParallel(macro) : "";
    const forecast = macro ? buildEconomicForecast(macro, "3month") : null;
    const sectorRotation = macro ? getSectorRotation(macro) : null;
    const confidence = macro ? calibrateConfidence(macro, 0, 6) : null;

    const userMessage = [
      knowledge ? `${knowledge}\n\n` : "",
      historicalContext ? `${historicalContext}\n\n` : "",
      forecast ? `${forecast.arabicForecastSummary}\n\n` : "",
      sectorRotation
        ? `=== دوران القطاعات الموصى به ===\nالقطاعات المفضلة: ${sectorRotation.preferredSectors.join("، ")}\nتجنب: ${sectorRotation.avoidSectors.join("، ")}\n${sectorRotation.arabicAnalysis}\n\n`
        : "",
      confidence ? `${confidence.arabicConfidenceStatement}\n\n` : "",
      macro
        ? `=== البيانات الاقتصادية الحقيقية (Federal Reserve) ===
بيئة الفائدة: ${macro.monetaryEnvironment}
التضخم: ${macro.inflationLevel.toFixed(1)}% — ${macro.inflationEnvironment}
دورة الأعمال: ${macro.businessCycle}
النمو العالمي: ${macro.globalGrowthTrend}
نظام المخاطر: ${macro.riskRegime}
مرحلة دورة الديون: ${macro.debtCyclePhase}
سعر النفط: ${macro.oilPrice}$
فارق الفائدة: ${macro.interestRateDifferential.toFixed(2)}%
مؤشر الدولار: ${macro.dollarStrength}
ثقة البيانات: ${macro.dataConfidence}%\n\n`
        : "",
      principles ? `${principles}\n\n` : "",
      `السؤال: ${question}`,
    ].join("");

    let result = await callAIGateway({
      system:   SYSTEM_PROMPT,
      user:     userMessage,
      language: lang,
      ...CALL_ARGS_BASE,
    });

    if (result.error?.includes("rate_limit")) {
      await new Promise((r) => setTimeout(r, 4000));
      result = await callAIGateway({
        system:   SYSTEM_PROMPT,
        user:     userMessage,
        language: lang,
        ...CALL_ARGS_BASE,
      });
    }

    if (result.error) {
      return { text: "", error: `خطأ في الذكاء الاصطناعي: ${result.error}` };
    }

    return { text: result.raw ?? "", error: null };
  });
