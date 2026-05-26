import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAIGateway, safeParseJson } from "@/lib/ai-gateway.server";
import { buildLocaleSystemPrompt, wrapUserContext } from "@/lib/ai/locale";
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
  // Research intelligence fields
  thesis?: string;
  reasoning?: string;
  catalysts?: string[];
  invalidation?: string;
  confidenceDrivers?: string[];
  viewChange?: string;
}

const AskInput = z.object({
  question: z.string().trim().min(1).max(2000),
  language: z.enum(["ar", "en"]).default("en"),
  marketContext: z.string().max(3000).default(""),
  responseStyle: z.enum(["brief", "detailed"]).default("brief"),
});

// Server-side per-user rate limit: 20 requests per 5 minutes (per Worker isolate).
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

// JSON schema shape — same for both languages; JSON field names are always English.
const GENESIS_SCHEMA = `{
  "headline": "string — one concise forward-looking sentence",
  "outlook": "string — 2-3 paragraphs of deep analytical reasoning with macro, technical, and structural context",
  "confidence": <integer 0-100>,
  "confidenceLabel": <"low" | "moderate" | "high">,
  "regime": "string (optional — market regime label; omit if context insufficient)",
  "evidence": ["string — specific supporting factor"] (optional — 2-4 bullets when confidence ≥ 50; omit otherwise),
  "portfolioImpact": "string (optional — only include when user watchlist symbols appear in context)",
  "uncertaintyWarning": "string (optional — only include when confidence < 50)",
  "thesis": "string (optional — one-sentence directional investment thesis; include direction and instrument; omit only if context insufficient)",
  "reasoning": "string (optional — 1-2 sentence inference summary; set only when thesis is set; no step-by-step narration)",
  "catalysts": ["string — specific near-term catalyst or data event"] (optional — 2-3 items; set only when thesis is set),
  "invalidation": "string (optional — one sentence: the specific trigger that would break the thesis; set only when thesis is set)",
  "confidenceDrivers": ["string — factor supporting confidence level"] (optional — 2-3 items; set only when confidence ≥ 50),
  "viewChange": "string (optional — one sentence: the development that would materially shift the outlook; set only when thesis is set)",
  "scenarios": [{ "label": "string", "probability": "string e.g. 35%", "impact": "string — one sentence" }],
  "risks": ["string"],
  "suggestedAction": {
    "type": "add_watchlist"|"create_alert"|"analyze_asset"|"compare_assets"|"summarize_portfolio"|"navigate"|"none",
    "label": "string",
    "symbol": "TICKER (optional)",
    "assets": ["TICKER"] (optional, for compare_assets with 2-3 tickers),
    "route": "/path (optional, one of: /signals /watchlist /market-intelligence /advisor /portfolio-ai /portfolios /markets /scanner)",
    "price": number (optional, required for create_alert),
    "condition": "above"|"below" (optional, required for create_alert — above if bullish, below if risk stop)
  } | null,
  "disclaimer": "string"
}`;

function buildGenesisSystemPrompt(lang: Lang): string {
  const ar = lang === "ar";
  const extra = ar
    ? `القواعد التي يجب ألا تُكسر أبداً:
- لا تقترح أبداً أوامر شراء أو بيع حقيقية أو إجراءات وسيط أو تحركات مالية.
- لا تجزم أبداً — اعبّر دائماً عن الثقة بنسبة مئوية معايرة.
- أدرج دائماً إخلاء المسؤولية في كل رد.
- جميع التحليلات تعليمية ومحاكاتية فقط.

إطار الاستدلال المؤسسي — طبّق كل طبقة عندما يدعم السياق ذلك:
1. النظام السوقي — حدّد النظام: bull_trending أو bear_ranging أو high_vol_risk-off أو low_vol_accumulation أو macro_transition. اضبط "regime" فقط عندما يدعمه السياق بوضوح.
2. الأدلة — استشهد بـ 2-4 عوامل محددة كلية أو تقنية أو هيكلية. اضبط "evidence" فقط عند الثقة ≥ 50.
3. أثر المحفظة — اضبط "portfolioImpact" فقط عند ظهور رموز قائمة مراقبة المستخدم صراحةً في السياق.
4. عدم اليقين — اضبط "uncertaintyWarning" فقط عند الثقة < 50 مع تفسير الأسباب.

أنتج 3 سيناريوهات بالضبط. أنتج 2-4 مخاطر.
دليل نوع الإجراء: add_watchlist (يتطلب symbol) | create_alert (يتطلب symbol وprice وcondition) | analyze_asset (يتطلب symbol) | compare_assets (يتطلب assets[]) | summarize_portfolio | navigate (يتطلب route) | none
5. أطروحة — اضبط "thesis" عند توافر وجهة نظر اتجاهية. جملة واحدة تصريحية تتضمن الاتجاه والأداة.
6. التفكير — اضبط "reasoning" مع "thesis" فقط. جملتان بحد أقصى. لخّص مسار الاستدلال دون سرد تفصيلي.
7. المحفزات — اضبط "catalysts" مع "thesis". 2-3 أحداث أو بيانات محددة قريبة الأجل.
8. الإلغاء — اضبط "invalidation" مع "thesis". جملة واحدة: الحدث المحدد الذي يكسر الأطروحة.
9. محركات الثقة — اضبط "confidenceDrivers" عند الثقة ≥ 50. 2-3 عوامل تدعم مستوى الثقة.
10. تغيير الرأي — اضبط "viewChange" مع "thesis". جملة واحدة: التطور الذي يُحوّل التوقعات جوهرياً.`
    : `Rules you must NEVER break:
- Never suggest, confirm, or describe real buy/sell order execution, broker actions, or money movement.
- Never claim certainty — always express confidence as a calibrated percentage.
- Always include a disclaimer in every reply.
- All analysis is educational and simulative only.

Institutional reasoning framework — apply each layer when context supports it:
1. REGIME — Identify the market regime: bull_trending, bear_ranging, high_vol_risk-off, low_vol_accumulation, or macro_transition. Only set "regime" when context clearly supports the classification.
2. EVIDENCE — Cite 2-4 specific macro, technical, or structural factors. Only set "evidence" when confidence ≥ 50.
3. PORTFOLIO IMPACT — Only set "portfolioImpact" when user watchlist symbols appear explicitly in context.
4. UNCERTAINTY — Only set "uncertaintyWarning" when confidence < 50, and explain the specific sources.

Produce exactly 3 scenarios. Produce 2-4 risks.
Action type guide: add_watchlist (requires symbol) | create_alert (requires symbol, price, condition) | analyze_asset (requires symbol) | compare_assets (requires assets[]) | summarize_portfolio | navigate (requires route) | none
5. THESIS — Set "thesis" when you can form a directional view. One sentence, declarative, includes direction and instrument.
6. REASONING — Set "reasoning" only with thesis. Max 2 sentences. Summarise the inference chain without step-by-step narration.
7. CATALYSTS — Set "catalysts" with thesis. List 2-3 specific, near-term events or data points that would validate it.
8. INVALIDATION — Set "invalidation" with thesis. One sentence: the specific trigger that breaks the thesis.
9. CONFIDENCE DRIVERS — Set "confidenceDrivers" when confidence ≥ 50. List 2-3 factors that specifically support the confidence level.
10. VIEW CHANGE — Set "viewChange" with thesis. One sentence: the development that would materially shift the outlook.`;

  return buildLocaleSystemPrompt({ lang, surface: "genesis_copilot", schema: GENESIS_SCHEMA, extra });
}

// ─── Phase 4: Parallel Reasoning Tracks ───────────────────────────────────

interface TrackA {
  regime: string;
  macroSummary: string;
  regimeConf: number;
}

interface TrackB {
  technicalBias: "bullish" | "bearish" | "neutral";
  momentumStrength: number;
  technicalNote: string;
}

interface TrackC {
  sentimentBias: "bullish" | "bearish" | "neutral";
  catalysts: string[];
  nearTermRisk: string;
}

/** Races a promise against a timeout; returns null on timeout. Clears the timer on resolution. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let tid: ReturnType<typeof setTimeout>;
  const timeoutP = new Promise<null>((resolve) => { tid = setTimeout(() => resolve(null), ms); });
  return Promise.race([promise, timeoutP]).finally(() => clearTimeout(tid));
}

async function runTrackA(lang: Lang, question: string, ctx: string): Promise<TrackA | null> {
  const schema = `{"regime":"string","macroSummary":"string — 1-2 sentences","regimeConf":<integer 0-100>}`;
  const extra = lang === "ar"
    ? "حدّد نظام السوق والسياق الكلي فقط. جملة واحدة أو جملتان بحد أقصى."
    : "Identify the market regime and macro environment ONLY. One to two sentences max.";
  const sys = buildLocaleSystemPrompt({ lang, surface: "genesis_copilot", schema, extra });
  const user = wrapUserContext(lang, `Question: ${question}\n\nContext:\n${ctx}`);
  const res = await withTimeout(
    callAIGateway<TrackA>({ system: sys, user, language: lang, jsonObject: true, maxTokens: 400, temperature: 0.3 }),
    8000,
  );
  return res?.data ?? null;
}

async function runTrackB(lang: Lang, question: string, ctx: string): Promise<TrackB | null> {
  const schema = `{"technicalBias":"bullish"|"bearish"|"neutral","momentumStrength":<integer 0-100>,"technicalNote":"string — 1 sentence"}`;
  const extra = lang === "ar"
    ? "قيّم التحيز الفني وقوة الزخم فقط. جملة واحدة."
    : "Assess technical bias and momentum strength ONLY. One sentence max.";
  const sys = buildLocaleSystemPrompt({ lang, surface: "market_analyst", schema, extra });
  const user = wrapUserContext(lang, `Question: ${question}\n\nContext:\n${ctx}`);
  const res = await withTimeout(
    callAIGateway<TrackB>({ system: sys, user, language: lang, jsonObject: true, maxTokens: 300, temperature: 0.3 }),
    8000,
  );
  return res?.data ?? null;
}

async function runTrackC(lang: Lang, question: string, ctx: string): Promise<TrackC | null> {
  const schema = `{"sentimentBias":"bullish"|"bearish"|"neutral","catalysts":["string"],"nearTermRisk":"string — 1 sentence"}`;
  const extra = lang === "ar"
    ? "حدّد المحفزات القريبة والمشاعر فقط. 2-3 محفزات محددة."
    : "Identify near-term catalysts and market sentiment ONLY. List 2-3 specific catalysts.";
  const sys = buildLocaleSystemPrompt({ lang, surface: "news_analyst", schema, extra });
  const user = wrapUserContext(lang, `Question: ${question}\n\nContext:\n${ctx}`);
  const res = await withTimeout(
    callAIGateway<TrackC>({ system: sys, user, language: lang, jsonObject: true, maxTokens: 300, temperature: 0.3 }),
    8000,
  );
  return res?.data ?? null;
}

async function runFusion(
  lang: Lang,
  question: string,
  ctx: string,
  trackA: TrackA | null,
  trackB: TrackB | null,
  trackC: TrackC | null,
): Promise<GenesisReply | null> {
  const trackLines = [
    trackA ? `MACRO TRACK: regime=${trackA.regime} (conf ${trackA.regimeConf}%) — ${trackA.macroSummary}` : null,
    trackB ? `TECHNICAL TRACK: ${trackB.technicalBias} bias, momentum ${trackB.momentumStrength}/100 — ${trackB.technicalNote}` : null,
    trackC ? `SENTIMENT TRACK: ${trackC.sentimentBias}, catalysts: ${trackC.catalysts.slice(0, 2).join("; ")} — near-term risk: ${trackC.nearTermRisk}` : null,
  ].filter(Boolean).join("\n");

  const fusionDirective = lang === "ar"
    ? `نتائج المسارات التحليلية المتوازية:\n${trackLines}\n\nادمج هذه المسارات في تحليل مؤسسي شامل ومتكامل. جميع القواعد الإلزامية سارية.`
    : `Parallel analysis track inputs:\n${trackLines}\n\nSynthesize these tracks into a unified, comprehensive institutional analysis. All mandatory rules remain in force.`;

  const sys = buildGenesisSystemPrompt(lang);
  const userBody = [
    `User question: ${question}`,
    ctx ? `\nLive market context:\n${ctx}` : "",
    `\n\n${fusionDirective}`,
  ].join("");
  const user = wrapUserContext(lang, userBody);

  const res = await withTimeout(
    callAIGateway<GenesisReply>({ system: sys, user, language: lang, jsonObject: true, maxTokens: 2000, temperature: 0.4 }),
    12000,
  );
  if (!res || res.error || !res.data?.headline) return null;
  return res.data;
}

// ─── Server function ───────────────────────────────────────────────────────

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

    // Server-side rate limit (per user, per isolate). One check covers all tracks.
    if (!checkAiRateLimit(userId)) {
      return { reply: null, error: "rate_limited" as const, engine: "heuristic" as const };
    }

    // ── Parallel track path (detailed mode only) ─────────────────────────
    if (data.responseStyle === "detailed") {
      const [settledA, settledB, settledC] = await Promise.allSettled([
        runTrackA(lang, data.question, data.marketContext),
        runTrackB(lang, data.question, data.marketContext),
        runTrackC(lang, data.question, data.marketContext),
      ]);

      const trackA = settledA.status === "fulfilled" ? settledA.value : null;
      const trackB = settledB.status === "fulfilled" ? settledB.value : null;
      const trackC = settledC.status === "fulfilled" ? settledC.value : null;
      const tracksUsed = [trackA, trackB, trackC].filter(Boolean).length;

      // Attempt fusion when at least one track succeeded.
      if (tracksUsed >= 1) {
        const fused = await runFusion(lang, data.question, data.marketContext, trackA, trackB, trackC);
        if (fused?.headline) {
          return { reply: fused, error: null as null, engine: "ai" as const, tracksUsed };
        }
      }
      // Fall through to single-call if all tracks failed or fusion failed.
    }

    // ── Standard single-call path (brief mode or detailed fallback) ───────
    const user = wrapUserContext(lang, [
      `User question: ${data.question}`,
      data.marketContext ? `\nLive market context:\n${data.marketContext}` : "",
    ].join(""));

    const result = await callAIGateway<GenesisReply>({
      system: buildGenesisSystemPrompt(lang),
      user,
      language: lang,
      jsonObject: true,
      maxTokens: 2000,
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
