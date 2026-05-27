import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rtlNumberHint, resolveLang } from "@/lib/ai/locale";
import { callAIGateway, safeParseJson } from "@/lib/ai-gateway.server";

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

// Heuristic fallback text shown when the AI gateway is unavailable.
// Keeps the advisor usable without blocking the user on a config error.
function heuristicAdvisorRaw(lang: "ar" | "en"): string {
  return lang === "ar"
    ? "⚠️ التحليل الذكي غير متاح مؤقتاً. يُنصح بمراجعة أسواق النفط والعملات والأسهم الخليجية ومتابعة قرارات الفيدرالي وأوبك+. (Heuristic — لا يُعدّ توصية مالية)"
    : "⚠️ AI analysis is temporarily unavailable. Consider reviewing oil markets, FX, Gulf equities, and tracking Fed/OPEC+ decisions. (Heuristic — not financial advice)";
}

export const askAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const lang = resolveLang(data);
    const baseSys = lang === "ar" ? sysAr : sysEn;
    // callAIGateway appends localeGuardrails automatically; include rtlNumberHint explicitly.
    const sys = `${baseSys}\n\n${rtlNumberHint(lang)}`;
    const today = new Date().toISOString().slice(0, 10);
    const dateLine = lang === "ar" ? `التاريخ: ${today}` : `Date: ${today}`;
    // callAIGateway prepends the language directive; pass only the content body.
    const userMsg = data.context
      ? `${data.question}\n\nMarket context:\n${data.context}\n\n${dateLine}`
      : `${data.question}\n\n${dateLine}`;

    const result = await callAIGateway<AdvisorStructuredReply>({
      system: sys,
      user: userMsg,
      language: lang,
      jsonObject: true,
      model: "google/gemini-2.5-flash",
      maxTokens: 2000,
      temperature: 0.4,
    });

    // Surface retriable/billing errors so the client can show a targeted message.
    if (result.error === "rate_limited") {
      return { structured: null, raw: "", error: "rate_limited", engine: "heuristic" as const };
    }
    if (result.error === "payment_required") {
      return { structured: null, raw: "", error: "payment_required", engine: "heuristic" as const };
    }
    // Any other failure (missing_key, ai_error, network_error, parse_error) → graceful
    // heuristic fallback; never block the user with ai_not_configured.
    if (result.error) {
      console.warn("[advisor] gateway error, using heuristic fallback:", result.error);
      return {
        structured: null,
        raw: heuristicAdvisorRaw(lang),
        error: null as string | null,
        engine: "heuristic" as const,
      };
    }

    const structured = result.data ?? safeParseJson<AdvisorStructuredReply>(result.raw);
    // If the gateway returned a response but JSON parsing failed, fall back gracefully.
    if (!structured) {
      return {
        structured: null,
        raw: result.raw || heuristicAdvisorRaw(lang),
        error: null as string | null,
        engine: result.raw ? "ai" as const : "heuristic" as const,
      };
    }
    return { structured, raw: result.raw, error: null as string | null, engine: "ai" as const };
  });
