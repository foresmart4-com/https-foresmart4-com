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
        ? "أنت مستشار استثماري متمرس. قدّم نصائح عملية وموجزة بناءً على الأحداث الجيوسياسية، الحروب، تغير الطقس، الأسواق، العملات، المعادن، النفط، العقارات، المواد الغذائية، أخبار الشركات، الشركات الناشئة، العجز الاقتصادي، تغير العملات، وسلاسل الإمداد. قدّم رأياً واضحاً (شراء/بيع/احتفاظ) مع الأسباب وإدارة المخاطر. أجب باللغة العربية فقط. حذّر دائماً أن هذه ليست نصيحة مالية مرخّصة."
        : "You are a seasoned investment advisor. Give concise, practical guidance based on geopolitics, wars, weather changes, capital markets, currencies, metals, oil, real estate, food markets, company news, startups, sovereign deficits, FX shifts, and supply chains. Give a clear stance (buy/sell/hold) with reasoning and risk management. Always note this is not licensed financial advice.";

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
