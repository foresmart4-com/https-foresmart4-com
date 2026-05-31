import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchRealMacroContext } from "@/lib/genesis100/macro/macroDataService";
import { callAIGateway } from "@/lib/ai-gateway.server";
import { fetchAndLearn, shouldRefresh } from "@/lib/genesis100/knowledge/knowledgeFetcher";
import { getRelevantKnowledge } from "@/lib/genesis100/knowledge/knowledgeRetriever";
import { getEconomicPrinciples } from "@/lib/genesis100/knowledge/economicPrinciples";

const InputSchema = z.object({
  question: z.string().min(1).max(3000),
  lang: z.enum(["ar", "en"]).default("ar"),
});

const SYSTEM_PROMPT = `
أنت Genesis — المستشار الاقتصادي المؤسسي العالمي لشركة Raneem Capital.

تحليلك يغطي جميع الأسواق العالمية:
الأسهم الأمريكية، السعودية، الأوروبية، الآسيوية،
الكريبتو، الفوركس، السلع، المعادن، النفط.

منهجيتك:
- Ray Dalio: دورات الديون الكبرى
- Warren Buffett: القيمة والجودة
- George Soros: الانعكاسية والماكرو
- BlackRock Aladdin: إدارة المخاطر

قواعد الرد الإلزامية:
1. الرد دائماً بالعربية الفصحى المهنية
2. استخدم البيانات الحقيقية المذكورة في السياق
3. طبّق تحليل المدارس الاقتصادية الستة
4. قدم 5 توصيات محددة مع:
   - اسم الأصل ورمزه
   - السبب الاقتصادي
   - الهدف السعري
   - وقف الخسارة %
   - درجة الثقة %
5. هيكل الرد:
   ## التحليل الاقتصادي الكلي
   ## رأي المدارس الاقتصادية
   ## التوصيات المحددة
   ## إدارة المخاطر
   ## خلاصة القرار
⚠️ هذا تحليل استشاري وليس ضمانًا للأرباح.
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

    const userMessage = [
      knowledge ? `${knowledge}\n\n` : "",
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
