import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAIGateway, safeParseJson } from "@/lib/ai-gateway.server";
import type { Lang } from "@/lib/ai/locale";

export interface GenesisScenario {
  label: string;
  probability: string;
  impact: string;
}

export interface GenesisSuggestedAction {
  type: "add_watchlist" | "create_alert" | "analyze_asset" | "navigate" | "none";
  label: string;
  symbol?: string;
  route?: string;
  price?: number;
  condition?: "above" | "below";
}

export interface GenesisReply {
  headline: string;
  outlook: string;
  confidence: number;
  confidenceLabel: "low" | "moderate" | "high";
  scenarios: GenesisScenario[];
  risks: string[];
  suggestedAction: GenesisSuggestedAction | null;
  disclaimer: string;
}

const AskInput = z.object({
  question: z.string().trim().min(1).max(2000),
  language: z.enum(["ar", "en"]).default("en"),
  marketContext: z.string().max(3000).default(""),
});

function heuristicReply(lang: Lang): GenesisReply {
  const ar = lang === "ar";
  return {
    headline: ar
      ? "تحليل مبني على الأنماط التاريخية والبيانات المتاحة"
      : "Analysis based on historical patterns and available data",
    outlook: ar
      ? "الأسواق تمر بمرحلة تذبذب متوسطة. يُنصح بتوزيع رأس المال بين قطاعات متنوعة وتجنب المراكز المكثفة في أوقات عدم اليقين. الأصول الدفاعية كالذهب والسندات القصيرة الأجل تُشكّل ملاذاً مؤقتاً."
      : "Markets are moving through a period of moderate volatility. Distributing capital across diversified sectors and avoiding concentrated positions during uncertainty is prudent. Defensive assets such as gold and short-duration bonds offer a temporary buffer.",
    confidence: 38,
    confidenceLabel: "low",
    scenarios: ar
      ? [
          { label: "تعافٍ معتدل", probability: "35%", impact: "نمو تدريجي مع تراجع التذبذب وتحسن المشاعر" },
          { label: "استقرار جانبي", probability: "40%", impact: "حركة جانبية مع غياب محفزات واضحة" },
          { label: "تصحيح حاد", probability: "25%", impact: "ضغط واسع على الأصول عالية المخاطر" },
        ]
      : [
          { label: "Moderate recovery", probability: "35%", impact: "Gradual growth with declining volatility and improved sentiment" },
          { label: "Range-bound consolidation", probability: "40%", impact: "Sideways movement absent clear macro catalysts" },
          { label: "Sharp correction", probability: "25%", impact: "Broad pressure on high-risk assets" },
        ],
    risks: ar
      ? ["تحليل بدقة منخفضة — مفتاح AI غير مُهيّأ", "يعتمد على أنماط محلية فقط دون تحليل نصي أو إخباري"]
      : ["Low-fidelity analysis — AI key not configured", "Relies on local heuristics only without news or text analysis"],
    suggestedAction: null,
    disclaimer: ar
      ? "للأغراض التعليمية فقط — لا يُعتبر توصية استثمارية مرخصة."
      : "Educational only — not licensed investment advice.",
  };
}

const SYSTEM_PROMPT = `You are Genesis, the ForeSmart AI investment copilot. Your role is to provide forward-looking, scenario-based investment intelligence in an institutional analytical style.

Rules you must NEVER break:
- Never suggest, confirm, or describe real buy/sell order execution, broker actions, or money movement.
- Never claim certainty — always express confidence as a calibrated percentage.
- Always include a disclaimer.
- All analysis is educational and simulative only.

Return ONLY valid JSON matching this exact schema:
{
  "headline": "string — one concise forward-looking sentence",
  "outlook": "string — 2-3 paragraphs of analytical reasoning with macro context",
  "confidence": <integer 0-100>,
  "confidenceLabel": <"low" | "moderate" | "high">,
  "scenarios": [
    { "label": "string", "probability": "string e.g. 35%", "impact": "string — one sentence" }
  ],
  "risks": ["string"],
  "suggestedAction": {
    "type": <"add_watchlist" | "create_alert" | "analyze_asset" | "navigate" | "none">,
    "label": "string — concise action label",
    "symbol": "TICKER (optional)",
    "route": "/path (optional, one of: /signals /watchlist /market-intelligence /advisor /portfolio-ai /markets)",
    "price": <number optional, required for create_alert>,
    "condition": <"above" | "below" optional, required for create_alert — above if bullish target, below if risk stop>
  } | null,
  "disclaimer": "string"
}
Produce exactly 3 scenarios. Produce 2-4 risks.`;

export const askGenesis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AskInput.parse(d))
  .handler(async ({ data }) => {
    const lang = data.language as Lang;

    const user = [
      `User question: ${data.question}`,
      data.marketContext ? `\nLive market context:\n${data.marketContext}` : "",
    ].join("");

    const result = await callAIGateway<GenesisReply>({
      system: SYSTEM_PROMPT,
      user,
      language: lang,
      jsonObject: true,
      maxTokens: 1400,
      temperature: 0.4,
    });

    if (result.error === "rate_limited") return { reply: null, error: "rate_limited" as const, engine: "heuristic" as const };
    if (result.error === "payment_required") return { reply: null, error: "payment_required" as const, engine: "heuristic" as const };
    if (result.error === "missing_key" || result.error === "ai_error" || result.error === "network_error") {
      return { reply: heuristicReply(lang), error: null as null, engine: "heuristic" as const };
    }

    const parsed = result.data ?? safeParseJson<GenesisReply>(result.raw);
    if (!parsed?.headline) return { reply: heuristicReply(lang), error: null as null, engine: "heuristic" as const };

    return { reply: parsed, error: null as null, engine: "ai" as const };
  });
