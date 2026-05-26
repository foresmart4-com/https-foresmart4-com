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
  type: "add_watchlist" | "create_alert" | "analyze_asset" | "compare_assets" | "summarize_portfolio" | "navigate" | "none";
  label: string;
  symbol?: string;
  assets?: string[];
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
  // Institutional brain fields — AI may omit when context is insufficient
  regime?: string;
  evidence?: string[];
  portfolioImpact?: string;
  uncertaintyWarning?: string;
}

const AskInput = z.object({
  question: z.string().trim().min(1).max(2000),
  language: z.enum(["ar", "en"]).default("en"),
  marketContext: z.string().max(3000).default(""),
});

// Server-side per-user rate limit: 20 requests per 5 minutes (per Worker isolate).
// Best-effort in a stateless Worker environment — not globally accurate but effective
// against accidental hammering from a single authenticated user.
const AI_RATE_WINDOW_MS = 5 * 60 * 1000;
const AI_RATE_MAX = 20;
const _aiRateBuckets = new Map<string, { count: number; windowStart: number }>();

function checkAiRateLimit(userId: string): boolean {
  const now = Date.now();
  const b = _aiRateBuckets.get(userId) ?? { count: 0, windowStart: now };
  if (now - b.windowStart > AI_RATE_WINDOW_MS) { b.count = 0; b.windowStart = now; }
  b.count++;
  _aiRateBuckets.set(userId, b);
  return b.count <= AI_RATE_MAX;
}

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

const SYSTEM_PROMPT = `You are Genesis, the ForeSmart institutional investment intelligence engine. Your role is to provide forward-looking, scenario-based investment intelligence with the analytical depth of an institutional research desk.

Rules you must NEVER break:
- Never suggest, confirm, or describe real buy/sell order execution, broker actions, or money movement.
- Never claim certainty — always express confidence as a calibrated percentage.
- Always include a disclaimer.
- All analysis is educational and simulative only.

Institutional reasoning framework — apply each layer when context supports it:
1. REGIME — Identify the market regime: bull_trending, bear_ranging, high_vol_risk-off, low_vol_accumulation, or macro_transition. Only set "regime" when the available context clearly supports the classification.
2. EVIDENCE — Cite 2-4 specific macro, technical, or structural factors that directly drive your conclusion. Only set "evidence" when confidence ≥ 50 and supporting data exists in context.
3. PORTFOLIO IMPACT — If the user's watchlist symbols appear in context, state how this analysis directly affects those holdings. Only set "portfolioImpact" when watchlist symbols are explicitly in context.
4. UNCERTAINTY — When confidence < 50, describe the specific sources of uncertainty and what information or conditions would resolve them. Only set "uncertaintyWarning" when confidence < 50.

Return ONLY valid JSON matching this exact schema:
{
  "headline": "string — one concise forward-looking sentence",
  "outlook": "string — 2-3 paragraphs of deep analytical reasoning with macro, technical, and structural context",
  "confidence": <integer 0-100>,
  "confidenceLabel": <"low" | "moderate" | "high">,
  "regime": "string (optional — market regime label; omit if context insufficient)",
  "evidence": ["string — specific supporting factor"] (optional — 2-4 bullets when confidence ≥ 50; omit otherwise),
  "portfolioImpact": "string (optional — only include when user watchlist symbols appear in context)",
  "uncertaintyWarning": "string (optional — only include when confidence < 50)",
  "scenarios": [
    { "label": "string", "probability": "string e.g. 35%", "impact": "string — one sentence" }
  ],
  "risks": ["string"],
  "suggestedAction": {
    "type": <"add_watchlist" | "create_alert" | "analyze_asset" | "compare_assets" | "summarize_portfolio" | "navigate" | "none">,
    "label": "string — concise action label",
    "symbol": "TICKER (optional, primary asset)",
    "assets": ["TICKER1", "TICKER2"] (optional array, use for compare_assets with 2-3 tickers),
    "route": "/path (optional, one of: /signals /watchlist /market-intelligence /advisor /portfolio-ai /portfolios /markets /scanner)",
    "price": <number optional, required for create_alert>,
    "condition": <"above" | "below" optional, required for create_alert — above if bullish target, below if risk stop>
  } | null,
Action type guide:
  add_watchlist       → add symbol to user watchlist (requires symbol)
  create_alert        → create price alert (requires symbol, price, condition)
  analyze_asset       → open asset deep analysis (requires symbol) → /market-intelligence
  compare_assets      → compare 2-3 assets side-by-side (requires assets[]) → /market-intelligence or /scanner
  summarize_portfolio → summarize portfolio risk/exposure → /portfolio-ai or /portfolios
  navigate            → open any route (requires route)
  none                → no action suggested
  "disclaimer": "string"
}
Produce exactly 3 scenarios. Produce 2-4 risks.`;

export const askGenesis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AskInput.parse(d))
  .handler(async ({ data, context }) => {
    const lang = data.language as Lang;
    const userId = (context as { userId?: string }).userId ?? "anon";

    // Server-side emergency kill switch — set AI_DISABLED=true in Railway secrets to disable AI.
    if (process.env.AI_DISABLED === "true") {
      return { reply: heuristicReply(lang), error: null as null, engine: "heuristic" as const };
    }

    // Server-side rate limit (per user, per isolate).
    if (!checkAiRateLimit(userId)) {
      return { reply: null, error: "rate_limited" as const, engine: "heuristic" as const };
    }

    const user = [
      `User question: ${data.question}`,
      data.marketContext ? `\nLive market context:\n${data.marketContext}` : "",
    ].join("");

    const result = await callAIGateway<GenesisReply>({
      system: SYSTEM_PROMPT,
      user,
      language: lang,
      jsonObject: true,
      maxTokens: 1600,
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
