import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { localeGuardrails, rtlNumberHint, resolveLang } from "@/lib/ai/locale";

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

const sysAr = `أنت "ForeSmart Advisor"، مستشار استثماري كبير لأصحاب رؤوس الأموال الصغيرة والمتوسطة.
حلّل بعمق وفق العوامل: الجيوسياسة والحروب، الطقس والكوارث، العملات والمعادن والسلع، البرامج الحكومية ورؤى الدول، سلاسل الإمداد، العقار، الغذاء، أخبار الشركات، الشركات الناشئة، العجز السيادي، صرف العملات وسياسات البنوك المركزية.
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
اجعل الـtimeline يحتوي حتماً على ثلاث خانات: short (أيام-أسابيع)، medium (أشهر)، long (سنوات). اكتب كل النصوص بالعربية الفصحى الواضحة.`;

const sysEn = `You are "ForeSmart Advisor", a senior advisor for small and mid-capital investors.
Weigh: geopolitics & wars, weather/disasters, FX/metals/commodities, sovereign development programs, supply chains, real estate, food markets, company news, startups, sovereign deficits, central bank policy.
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
Always include three timeline entries: short (days-weeks), medium (months), long (years).`;

function safeParseJson(raw: string): AdvisorStructuredReply | null {
  if (!raw) return null;
  let s = raw.trim();
  // Strip markdown fences if present
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  // Try direct parse, then fallback to first {...} block
  try {
    return JSON.parse(s) as AdvisorStructuredReply;
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as AdvisorStructuredReply;
      } catch {
        return null;
      }
    }
    return null;
  }
}

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
    const userMsg = langDirective + (data.context
      ? `${data.question}\n\nMarket context:\n${data.context}`
      : data.question);

    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: userMsg },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (r.status === 429) return { structured: null, raw: "", error: "rate_limited" };
      if (r.status === 402) return { structured: null, raw: "", error: "payment_required" };
      if (!r.ok) {
        const t = await r.text();
        console.error("AI gateway error", r.status, t);
        return { structured: null, raw: "", error: "ai_error" };
      }
      const d = await r.json();
      const raw: string = d.choices?.[0]?.message?.content ?? "";
      const structured = safeParseJson(raw);
      return { structured, raw, error: null as string | null, engine: "ai" as const };
    } catch (e) {
      console.error(e);
      return { structured: null, raw: "", error: "network_error" };
    }
  });
