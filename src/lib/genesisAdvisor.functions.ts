import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchRealMacroContext } from "@/lib/genesis100/macro/macroDataService";
import { callAIGateway } from "@/lib/ai-gateway.server";

const InputSchema = z.object({
  question: z.string().min(1).max(3000),
  lang: z.enum(["ar", "en"]).default("ar"),
});

const SYSTEM_PROMPT = `
أنت Genesis — المستشار الاقتصادي المؤسسي لشركة Raneem Capital.

هويتك:
تفكر بمنهجية مزيج من:
- Ray Dalio: دورات الديون والماكرو العالمي
- Warren Buffett: القيمة الجوهرية وهامش الأمان
- George Soros: الانعكاسية والماكرو
- BlackRock: إدارة المخاطر المؤسسية

قواعد الرد غير القابلة للكسر:
1. ردودك دائماً بالعربية الفصحى المهنية
2. عند أي سؤال عن سوق أو استثمار أو شركة،
   يجب أن يحتوي ردك على هذه الأقسام بالترتيب:

## التحليل الاقتصادي الكلي
[حلل البيئة الاقتصادية باستخدام البيانات الحقيقية المذكورة]

## رأي المدارس الاقتصادية الستة
**الكينزية:** [رأي في جملتين]
**النقدية:** [رأي في جملتين]
**النمساوية:** [رأي في جملتين]
**السلوكية:** [رأي في جملتين]
**استثمار القيمة:** [رأي في جملتين]
**الماكرو العالمي:** [رأي في جملتين]

## الأصول أو الشركات الموصى بها
[قدم 5 شركات أو أصول محددة في جدول]
لكل شركة:
- الاسم ورمز السوق
- السبب الاقتصادي للتوصية
- نطاق السعر التقريبي الحالي
- الهدف السعري خلال الفترة
- وقف الخسارة المقترح (كنسبة %)
- درجة الثقة (0-100%)
- الأفق الزمني

## إدارة المخاطر
- الحد الأقصى للتخصيص في هذا السوق: X%
- المخاطر الرئيسية الثلاث
- مستويات إلغاء الأطروحة

## خلاصة القرار
[قرار واضح: شراء انتقائي / مراقبة / تجنب]
[درجة الثقة الكلية: X%]

3. للسوق السعودي تحديداً:
   - اربط دائماً بأسعار النفط ونقطة التعادل المالي
   - اذكر تأثير رؤية 2030 على القطاعات
   - اذكر تأثير ساما والربط بالفيدرالي
   - قدم شركات من قطاعات متنوعة

4. كل سعر مذكور هو تقدير تعليمي
   يجب التحقق من منصات مرخصة

5. أضف دائماً في النهاية:
   "⚠️ هذا تحليل استشاري وليس ضمانًا للأرباح"
`;

export const askGenesisAdvisor = createServerFn({ method: "POST" })
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const { question, lang } = data;

    const macro = await fetchRealMacroContext().catch(() => null);

    const userMessage = `
=== البيانات الاقتصادية الحقيقية الآن (Federal Reserve) ===
بيئة الفائدة: ${macro?.monetaryEnvironment ?? "غير متاح"}
التضخم: ${macro?.inflationLevel ?? "غير متاح"}% — ${macro?.inflationEnvironment ?? "غير متاح"}
دورة الأعمال: ${macro?.businessCycle ?? "غير متاح"}
النمو العالمي: ${macro?.globalGrowthTrend ?? "غير متاح"}
نظام المخاطر: ${macro?.riskRegime ?? "غير متاح"}
مرحلة دورة الديون: ${macro?.debtCyclePhase ?? "غير متاح"}
سعر النفط المرجعي: ${macro?.oilPrice ?? "غير متاح"}$
فارق الفائدة: ${macro?.interestRateDifferential ?? "غير متاح"}%
ثقة البيانات: ${macro?.dataConfidence ?? "غير متاح"}%
==========================================================

سؤال المستخدم: ${question}
`;

    const result = await callAIGateway<string>({
      system: SYSTEM_PROMPT,
      user: userMessage,
      language: lang,
      model: "google/gemini-2.5-flash",
      maxTokens: 4000,
      temperature: 0.3,
    });

    if (result.error) {
      return { text: "", error: `AI error: ${result.error}` };
    }

    return { text: result.raw, error: null };
  });
