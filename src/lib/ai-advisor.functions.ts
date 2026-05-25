import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { localeGuardrails, rtlNumberHint, resolveLang } from "@/lib/ai/locale";
import { safeParseJson } from "@/lib/ai-gateway.server";

const InputSchema = z.object({
  question: z.string().min(1).max(2000),
  language: z.enum(["ar", "en"]).default("en"),
  context: z.string().max(8000).optional(),
});

export interface TimelineRecommendation {
  action: "buy" | "sell" | "hold" | "watch";
  asset: string;
  entry?: string;
  stopLoss?: string;
  targets?: string[];
  riskPct?: string;
  rationale: string;
}

export interface TimelineSection {
  horizon: "short" | "medium" | "long";
  title: string;
  summary: string;
  keyDrivers: string[];
  recommendations: TimelineRecommendation[];
}

export interface AdvisorStructuredReply {
  headline: string;
  marketSnapshot: string;
  factors: { name: string; impact: string }[];
  timeline: TimelineSection[];
  smallCapitalPlan: string;
  midCapitalPlan: string;
  risks: string[];
  disclaimer: string;
}

const sysAr = `أنت "ForeSmart Advisor"، مستشار استثماري كبير متخصص في أصحاب رؤوس الأموال الصغيرة والمتوسطة في السوق السعودي والخليجي.
حلّل بعمق وفق العوامل: سياسة الفيدرالي وساما، التضخم، DXY، أسعار النفط وقرارات أوبك+، الجيوسياسة والحروب، الطقس والكوارث، العملات والمعادن والسلع، البرامج الحكومية ورؤى الدول، سلاسل الإمداد، العقار، الغذاء، أخبار الشركات، الشركات الناشئة، العجز السيادي، صرف العملات وسياسات البنوك المركزية.
يجب أن يكون ردك **JSON صحيحاً فقط** يطابق هذا المخطط — بدون أي نص خارج الـJSON ولا أكواد markdown:
{
  "headline": string,
  "marketSnapshot": string,
  "factors": [{ "name": string, "impact": string }],
  "timeline": [
    {
      "horizon": "short" | "medium" | "long",
      "title": string,
      "summary": string,
      "keyDrivers": string[],
      "recommendations": [
        { "action": "buy"|"sell"|"hold"|"watch", "asset": string, "entry": string, "stopLoss": string, "targets": string[], "riskPct": string, "rationale": string }
      ]
    }
  ],
  "smallCapitalPlan": string,
  "midCapitalPlan": string,
  "risks": string[],
  "disclaimer": string
}
قواعد الجودة:
- اجعل الـtimeline يحتوي حتماً على ثلاث خانات: short (أيام-أسابيع)، medium (أشهر)، long (سنوات).
- في قائمة factors: أدرج 5-7 عوامل مرتبة بأهميتها الراهنة. كل حقل impact يبدأ بـ "صاعد" أو "هابط" أو "محايد" ثم شرح مختصر بجملة واحدة.
- entry وstopLoss وtargets: مستويات سعرية محددة، ليس نسباً.
- risks: 4-5 مخاطر مرتبة من الأخطر للأقل.
- اكتب كل النصوص بالعربية الفصحى الواضحة.`;

const sysEn = `You are "ForeSmart Advisor", a senior advisor specialising in small and mid-capital investors in Saudi Arabia and the Gulf.
Weigh: Fed and SAMA policy, inflation, DXY, oil prices and OPEC+ decisions, geopolitics & wars, weather/disasters, FX/metals/commodities, sovereign development programs, supply chains, real estate, food markets, company news, startups, sovereign deficits, central bank policy.
Reply with **valid JSON ONLY** matching this schema (no prose outside, no markdown fences):
{
  "headline": string,
  "marketSnapshot": string,
  "factors": [{ "name": string, "impact": string }],
  "timeline": [
    {
      "horizon": "short" | "medium" | "long",
      "title": string,
      "summary": string,
      "keyDrivers": string[],
      "recommendations": [
        { "action": "buy"|"sell"|"hold"|"watch", "asset": string, "entry": string, "stopLoss": string, "targets": string[], "riskPct": string, "rationale": string }
      ]
    }
  ],
  "smallCapitalPlan": string,
  "midCapitalPlan": string,
  "risks": string[],
  "disclaimer": string
}
Quality rules:
- Always include three timeline entries: short (days-weeks), medium (months), long (years).
- In factors: list 5-7 items ordered by current relevance. Each impact field must start with "Bullish", "Bearish", or "Neutral" followed by a one-sentence explanation.
- entry, stopLoss, targets: concrete price levels, never percentages.
- risks: 4-5 items ordered from highest to lowest severity.`;

export const askAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { structured: null, raw: "", error: "ai_not_configured", engine: "heuristic" as const };
    }
    const lang = resolveLang(data);
    const baseSys = lang === "ar" ? sysAr : sysEn;
    const sys = `${baseSys}\n\n${localeGuardrails(lang)}\n\n${rtlNumberHint(lang)}`;
    const langDirective = lang === "ar"
      ? "أنتج الجواب بالعربية الفصحى المؤسسية حصراً، 100% عربي.\n\n"
      : "Reply in native institutional English ONLY, 100% English.\n\n";
    const today = new Date().toISOString().slice(0, 10);
    const dateLine = lang === "ar" ? `التاريخ: ${today}` : `Date: ${today}`;
    const userMsg = langDirective + (data.context
      ? `${data.question}\n\nMarket context:\n${data.context}\n\n${dateLine}`
      : `${data.question}\n\n${dateLine}`);

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 22000);
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: userMsg },
          ],
          response_format: { type: "json_object" },
        }),
      }).finally(() => clearTimeout(timeout));
      if (r.status === 429) return { structured: null, raw: "", error: "rate_limited", engine: "heuristic" as const };
      if (r.status === 402) return { structured: null, raw: "", error: "payment_required", engine: "heuristic" as const };
      if (!r.ok) {
        const t = await r.text();
        console.error("AI gateway error", r.status, t);
        return { structured: null, raw: "", error: "ai_error", engine: "heuristic" as const };
      }
      const d = await r.json();
      const raw: string = d.choices?.[0]?.message?.content ?? "";
      const structured = safeParseJson<AdvisorStructuredReply>(raw);
      return { structured, raw, error: null as string | null, engine: "ai" as const };
    } catch (e) {
      console.error(e);
      return { structured: null, raw: "", error: "network_error", engine: "heuristic" as const };
    }
  });
