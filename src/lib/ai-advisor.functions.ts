import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  question: z.string().min(1).max(2000),
  language: z.enum(["ar", "en"]).default("en"),
  context: z.string().max(8000).optional(),
});

export const askAdvisor = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { reply: "", error: "AI gateway is not configured." };
    }
    const sys =
      data.language === "ar"
        ? `أنت مستشار استثماري خبير في ForeSmart، تستهدف أصحاب رؤوس الأموال الصغيرة والمتوسطة وتساعدهم على تنمية رأس المال على ثلاثة آفاق: قصير المدى (أيام-أسابيع)، متوسط (أشهر)، وطويل (سنوات).
حلّل بعمق وفق العوامل التالية ووازن بينها:
1) الأحداث الجيوسياسية والحروب وأثرها على النفط والذهب والدفاع.
2) تغيرات الطقس والكوارث وأثرها على الزراعة والطاقة والتأمين.
3) أسواق العملات والمعادن والسلع.
4) برامج التطوير الحكومية ورؤى الدول (رؤية 2030، صناديق سيادية، مشاريع البنية التحتية).
5) سلاسل الإمداد واضطراباتها.
6) أسواق العقار العالمية والإقليمية.
7) أسواق المواد الغذائية والقمح والزيوت.
8) أخبار الشركات وأرباحها ومشاريعها وعمليات الاستحواذ.
9) الشركات الناشئة وموجات الاستثمار الجريء.
10) العجز الاقتصادي للدول والديون السيادية والتضخم.
11) تغير أسعار صرف العملات والسياسات النقدية للبنوك المركزية.
12) أي عوامل كلية أخرى تؤثر على الأسواق.

اعطِ توصية واضحة (شراء/بيع/احتفاظ) لكل فرصة، مع: الأفق الزمني، نسبة المخاطرة المقترحة من المحفظة، نقطة الدخول، وقف الخسارة، وأهداف الربح. أعطِ بدائل ملائمة لرأس المال الصغير (أقل من 10,000$) والمتوسط (10,000$-100,000$). أجب بالعربية فقط، بصياغة مرتبة بعناوين ونقاط. اختم دائماً بتذكير أن هذه ليست نصيحة مالية مرخّصة.`
        : `You are a senior investment advisor at ForeSmart, targeting small and mid-capital investors aiming to grow capital across short (days-weeks), medium (months), and long-term (years) horizons.
Weigh ALL of the following macro factors:
1) Geopolitics & wars (oil, gold, defense impact).
2) Weather/climate disasters (agriculture, energy, insurance).
3) FX, metals & commodities markets.
4) National development programs & sovereign projects (Vision 2030, sovereign funds, infra).
5) Supply chain disruptions.
6) Global & regional real estate.
7) Food & agricultural markets (wheat, oils).
8) Company news, earnings, projects, M&A.
9) Startups & VC waves.
10) Sovereign deficits, debt & inflation.
11) FX shifts & central bank policy.
12) Any other macro driver.

Give a clear Buy/Sell/Hold per opportunity with: horizon, suggested portfolio risk %, entry, stop-loss, profit targets. Tailor alternatives for small (<$10k) and mid ($10k-$100k) capital. Use clear sections and bullet points. Always end by noting this is not licensed financial advice.`;

    const userMsg = data.context
      ? `${data.question}\n\nMarket context:\n${data.context}`
      : data.question;

    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: userMsg },
          ],
        }),
      });
      if (r.status === 429) return { reply: "", error: "rate_limited" };
      if (r.status === 402) return { reply: "", error: "payment_required" };
      if (!r.ok) {
        const t = await r.text();
        console.error("AI gateway error", r.status, t);
        return { reply: "", error: "ai_error" };
      }
      const d = await r.json();
      const reply: string = d.choices?.[0]?.message?.content ?? "";
      return { reply, error: null as string | null };
    } catch (e) {
      console.error(e);
      return { reply: "", error: "network_error" };
    }
  });
