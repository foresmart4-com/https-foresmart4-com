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
  // Phase 6: multi-agent fusion fields
  consensusStrength?: "strong" | "moderate" | "weak" | "conflicted";
  disagreementNote?: string;   // surfaces when agents disagree significantly
  supportingCase?: string;     // strongest corroborating argument
  opposingCase?: string;       // devil's advocate counter-argument
  // Phase 7: scenario simulation fields
  simulatedScenario?: string;  // "If X occurs..." trigger condition being explored
  expectedImpact?: string;     // cross-asset directional impact under the scenario
  watchlistSensitivity?: string; // how user's watched assets respond
  thesisSensitivity?: string;  // whether scenario validates or conflicts with active theses
  // Phase 8: Institutional Research Terminal fields
  executiveSummary?: string;   // 2-3 sentence research conclusion (research mode only)
  keyDrivers?: string[];        // 3-5 key structural/macro/technical drivers
  watchItems?: string[];        // 2-4 specific items to monitor going forward
  comparisonTable?: Array<{    // 3-5 metric rows for asset vs asset / sector vs sector
    metric: string;
    a: string;
    b: string;
  }>;
  researchType?: "asset" | "comparison" | "sector" | "thesis" | "market";
  // Phase 10: Meta-reasoning / Strategic AI fields
  reasoningQuality?: "strong" | "adequate" | "weak";  // self-evaluated logic quality
  confidenceCalibration?: string;  // 1 sentence: why confidence is at this level
  uncertaintyLevel?: "likely" | "possible" | "uncertain" | "conflicting";
  caveats?: string[];  // 1-3 specific logical tensions or contradictions in own reasoning
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
  "consensusStrength": <"strong"|"moderate"|"weak"|"conflicted"> (optional — include when multi-agent synthesis is provided),
  "disagreementNote": "string — 1 sentence on what agents disagree about; set only when conflicted or weak consensus" (optional),
  "supportingCase": "string — 1 sentence: strongest corroborating argument from parallel agent analysis" (optional),
  "opposingCase": "string — 1 sentence: strongest counter-argument from devil's advocate" (optional),
  "simulatedScenario": "string (optional — 'If X occurs...' — include when question involves a hypothetical or scenario context is provided)",
  "expectedImpact": "string — 1-2 sentences on cross-asset directional effects under the simulated scenario" (optional),
  "watchlistSensitivity": "string — 1 sentence on how user's watched assets would respond; only when watchlist appears in context" (optional),
  "thesisSensitivity": "string — 1 sentence on whether scenario aligns or conflicts with active theses; only when thesis context appears" (optional),
  "executiveSummary": "string (optional — 2-3 sentence institutional research conclusion; include ONLY when research mode context appears in the prompt)",
  "keyDrivers": ["string — specific structural/macro/technical driver"] (optional — 3-5 items; include ONLY when research mode context appears),
  "watchItems": ["string — specific data point, event, or price level to monitor"] (optional — 2-4 items; include ONLY when research mode context appears),
  "comparisonTable": [{"metric": "string — dimension being compared", "a": "string — asset/sector A value", "b": "string — asset/sector B value"}] (optional — 3-5 rows; include ONLY when comparing two assets or sectors in research mode),
  "researchType": <"asset"|"comparison"|"sector"|"thesis"|"market"> (optional — set when research mode context appears),
  "reasoningQuality": <"strong"|"adequate"|"weak"> (optional — self-evaluated logic quality; always set for AI replies),
  "confidenceCalibration": "string — 1 sentence explaining why confidence is at this level" (optional — always set for AI replies),
  "uncertaintyLevel": <"likely"|"possible"|"uncertain"|"conflicting"> (optional — always set for AI replies),
  "caveats": ["string — specific logical tension, contradiction, or weak assumption in own reasoning"] (optional — 1-3 items; omit when reasoning is internally consistent),
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
10. تغيير الرأي — اضبط "viewChange" مع "thesis". جملة واحدة: التطور الذي يُحوّل التوقعات جوهرياً.
11. محاكاة السيناريو — عند توفّر سياق محاكاة أو عند طرح السؤال بصيغة افتراضية ("إذا حدث X"، "ماذا لو"، "أثر"):
    اضبط "simulatedScenario": صِغ شرط "إذا حدث..." المدروس.
    اضبط "expectedImpact": جملة أو جملتان على الآثار الاتجاهية متعددة الأصول. تعليمي فقط.
    اضبط "watchlistSensitivity": كيف تستجيب الأصول المراقبة. فقط عند ورود قائمة المراقبة في السياق.
    اضبط "thesisSensitivity": هل السيناريو يؤيد أم يتعارض مع الأطروحات النشطة. فقط عند ورود الأطروحات في السياق.
    جميع مخرجات السيناريو استشارية وتعليمية حصراً.
12. المحطة البحثية المؤسسية — عند ظهور "Research mode" في السياق:
    اضبط "researchType" حسب النوع الوارد في السياق (asset أو comparison أو sector أو thesis أو market).
    اضبط "executiveSummary": 2-3 جمل تلخّص الاستنتاج البحثي الجوهري. أسلوب مؤسسي مباشر.
    اضبط "keyDrivers": 3-5 عوامل هيكلية أو كلية أو تقنية محددة تقود الأصل أو الموقف. كل عنصر عبارة اسمية موجزة.
    اضبط "watchItems": 2-4 نقاط بيانات أو أحداث أو مستويات سعرية محددة يجب مراقبتها. كل عنصر محدد وقابل للقياس.
    للمقارنات: اضبط "comparisonTable" بـ 3-5 صفوف. كل صف: metric (مثل "التذبذب"، "السيولة")، a (قيمة الأصل A)، b (قيمة الأصل B).
    لا تختلق بيانات. استند فقط لما يدعمه السياق. صرّح بعدم اليقين في executiveSummary عند قصور البيانات.
    جميع مخرجات البحث تعليمية واستشارية حصراً — لا تنفيذ ولا وساطة مالية.
13. الاستدلال الميتا — قيّم تحليلك الخاص قبل إتمام الرد:
    اضبط "reasoningQuality": "strong" إذا كانت الأطروحة والأدلة والمحفزات وشرط الإلغاء متسقة وتدعم مستوى الثقة؛ "adequate" إذا كان التوجه الاتجاهي صحيحاً لكن ثمة ثغرات في الأدلة أو عناصر تخمينية؛ "weak" إذا استند التحليل إلى افتراضات ضعيفة أو بيانات ناقصة أو توترات داخلية.
    اضبط "confidenceCalibration": جملة واحدة بالضبط توضّح ما يرفع مستوى الثقة وما يحدّ من ارتفاعه.
    اضبط "uncertaintyLevel": "likely" (ثقة ≥70% مع أدلة متسقة)، "possible" (40-69%)، "uncertain" (ثقة <40% أو تحذير عدم يقين موجود)، "conflicting" (عند تعارض consensusStrength أو تناقض الأطروحة مع النظام السوقي أو خلاف ملحوظ بين الوكلاء).
    اضبط "caveats": 1-3 توترات منطقية أو تناقضات أو افتراضات ضعيفة رصدتها في تحليلك. أدرج فقط التحفظات الجوهرية التي يلاحظها قارئ مؤسسي ناقد. أغفل الحقل تماماً عند الاتساق الداخلي.
    الاستدلال الميتا تقييم ذاتي فقط — استشاري وتعليمي. لا تستخدمه للادعاء باليقين.`
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
10. VIEW CHANGE — Set "viewChange" with thesis. One sentence: the development that would materially shift the outlook.
11. SCENARIO SIMULATION — When scenario simulation context is provided OR the question involves a hypothetical ("if X happens", "what if", "scenario", "impact of"):
    Set "simulatedScenario": state the 'If X occurs...' trigger being explored.
    Set "expectedImpact": 1-2 sentences on directional cross-asset effects. Educational only — no execution.
    Set "watchlistSensitivity": how user's watched assets respond. Only set when watchlist appears in context.
    Set "thesisSensitivity": whether scenario validates or conflicts with active theses. Only set when thesis context appears.
    All scenario output is advisory and simulative only.
12. RESEARCH TERMINAL — When "Research mode" appears in the context:
    Set "researchType" to the type stated in context (asset, comparison, sector, thesis, or market).
    Set "executiveSummary": 2-3 sentences with the core research conclusion. Direct, institutional tone. No hedging filler.
    Set "keyDrivers": 3-5 specific structural, macro, or technical forces driving the asset or situation. Each item is a crisp noun phrase.
    Set "watchItems": 2-4 specific data points, events, price levels, or policy decisions to monitor. Each item is a concrete watchable trigger.
    For comparisons: set "comparisonTable" with 3-5 rows. Each row: metric (e.g. "Volatility", "Liquidity", "Macro sensitivity"), a (value for asset A), b (value for asset B).
    Never fabricate data. Use only what the context supports. State uncertainty explicitly in executiveSummary when data is insufficient.
    All research output is educational and advisory only — no execution, no broker logic.
13. META-REASONING — Self-evaluate your own analysis before finalising the response:
    Set "reasoningQuality": "strong" if thesis, evidence, catalysts, and invalidation all align and confidence is well-supported by specific factors; "adequate" if the directional view holds but some evidence gaps or speculative elements exist; "weak" if the reasoning relies on thin assumptions, missing data, or internal tensions.
    Set "confidenceCalibration": exactly 1 sentence explaining what drives the confidence number — what pushes it upward and what limits it from being higher.
    Set "uncertaintyLevel": "likely" (confidence ≥70% with consistent evidence), "possible" (confidence 40-69%), "uncertain" (confidence <40% or uncertaintyWarning present), "conflicting" (when consensusStrength is "conflicted" or thesis contradicts the regime or agents significantly disagree).
    Set "caveats": 1-3 specific logical tensions, contradictions, or weak assumptions you have identified in your own analysis. Only include genuine, non-trivial caveats a critical institutional reader would flag. Omit entirely when the reasoning is internally consistent.
    Meta-reasoning is self-evaluation only — advisory and educational. Never use it to claim certainty.`;

  return buildLocaleSystemPrompt({ lang, surface: "genesis_copilot", schema: GENESIS_SCHEMA, extra });
}

// ─── Phase 4: Parallel Reasoning Tracks ───────────────────────────────────

interface TrackA {
  regime: string;
  macroSummary: string;
  regimeConf: number;
  macroBias?: "bullish" | "bearish" | "neutral"; // Phase 6: explicit bias for consensus engine
}

// Phase 6 specialist agents
interface TrackD {
  uncertaintyLevel: "low" | "moderate" | "high" | "extreme";
  primaryRisk: string;         // main downside risk — 1 sentence
  thesisWeakness: string;      // weakest link in the dominant case — 1 sentence
  confidenceChallenge: string; // what should lower confidence — 1 sentence
}

interface TrackE {
  counterThesis: string;  // opposing 1-sentence thesis
  missingEvidence: string; // what the dominant view ignores — 1 sentence
  opposingBias: "bullish" | "bearish" | "neutral";
}

// ─── Consensus engine (pure function — no AI call) ─────────────────────────

interface ConsensusResult {
  biasVotes: { bullish: number; bearish: number; neutral: number };
  dominantBias: "bullish" | "bearish" | "neutral";
  agreementScore: number;  // 0-100: how strongly the dominant bias wins
  strength: "strong" | "moderate" | "weak" | "conflicted";
  conflictNote: string;    // "" when not conflicted
}

function regimeToBias(regime: string): "bullish" | "bearish" | "neutral" {
  const r = regime.toLowerCase();
  if (r.includes("bull") || r.includes("risk_on") || r.includes("accumulation")) return "bullish";
  if (r.includes("bear") || r.includes("risk_off") || r.includes("risk-off") || r.includes("selloff") || r.includes("ranging")) return "bearish";
  return "neutral";
}

function computeConsensus(
  trackA: TrackA | null,
  trackB: TrackB | null,
  trackC: TrackC | null,
  trackE: TrackE | null,
): ConsensusResult {
  const EMPTY: ConsensusResult = {
    biasVotes: { bullish: 0, bearish: 0, neutral: 0 },
    dominantBias: "neutral", agreementScore: 0, strength: "weak", conflictNote: "",
  };

  const votes: { bias: "bullish" | "bearish" | "neutral"; weight: number }[] = [];
  if (trackA) votes.push({ bias: trackA.macroBias ?? regimeToBias(trackA.regime), weight: 0.35 });
  if (trackB) votes.push({ bias: trackB.technicalBias, weight: 0.30 });
  if (trackC) votes.push({ bias: trackC.sentimentBias, weight: 0.20 });
  // Devil's advocate casts an opposing vote at reduced weight
  if (trackE) votes.push({ bias: trackE.opposingBias, weight: 0.15 });

  if (!votes.length) return EMPTY;

  const biasVotes = { bullish: 0, bearish: 0, neutral: 0 };
  for (const v of votes) biasVotes[v.bias] += v.weight;

  const total = biasVotes.bullish + biasVotes.bearish + biasVotes.neutral || 1;
  const dominantBias: "bullish" | "bearish" | "neutral" =
    biasVotes.bullish >= biasVotes.bearish && biasVotes.bullish >= biasVotes.neutral ? "bullish" :
    biasVotes.bearish >= biasVotes.bullish && biasVotes.bearish >= biasVotes.neutral ? "bearish" : "neutral";

  const agreementScore = Math.round((biasVotes[dominantBias] / total) * 100);
  const bullBearGap = Math.abs(biasVotes.bullish - biasVotes.bearish);
  const isConflicted = bullBearGap < 0.15 && (biasVotes.bullish + biasVotes.bearish) > 0.35;

  let strength: ConsensusResult["strength"];
  let conflictNote = "";
  if (isConflicted) {
    strength = "conflicted";
    conflictNote = "Macro and technical agents diverge on directional bias";
  } else if (agreementScore >= 70) {
    strength = "strong";
  } else if (agreementScore >= 50) {
    strength = "moderate";
  } else {
    strength = "weak";
  }

  return { biasVotes, dominantBias, agreementScore, strength, conflictNote };
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
  const schema = `{"regime":"string","macroSummary":"string — 1-2 sentences","regimeConf":<integer 0-100>,"macroBias":"bullish"|"bearish"|"neutral"}`;
  const extra = lang === "ar"
    ? "حدّد نظام السوق والسياق الكلي فقط. أضف macroBias: bullish/bearish/neutral. جملة واحدة أو جملتان بحد أقصى."
    : "Identify the market regime and macro environment ONLY. Include macroBias as bullish, bearish, or neutral. One to two sentences max.";
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

// ─── Phase 6: Risk Officer (TrackD) ───────────────────────────────────────────

async function runTrackD(lang: Lang, question: string, ctx: string): Promise<TrackD | null> {
  const schema = `{"uncertaintyLevel":"low"|"moderate"|"high"|"extreme","primaryRisk":"string — 1 sentence","thesisWeakness":"string — 1 sentence","confidenceChallenge":"string — 1 sentence"}`;
  const extra = lang === "ar"
    ? "أنت مسؤول المخاطر المؤسسي. حدّد مستوى عدم اليقين والمخاطر الرئيسية وأوجه الضعف في الأطروحة. جملة واحدة لكل حقل فقط."
    : "You are the institutional risk officer. Identify uncertainty level, primary downside risk, thesis weakness, and what should challenge the confidence level. One sentence per field only.";
  const sys = buildLocaleSystemPrompt({ lang, surface: "decision_engine", schema, extra });
  const user = wrapUserContext(lang, `Question: ${question}\n\nContext:\n${ctx}`);
  const res = await withTimeout(
    callAIGateway<TrackD>({ system: sys, user, language: lang, jsonObject: true, maxTokens: 300, temperature: 0.3 }),
    8000,
  );
  return res?.data ?? null;
}

// ─── Phase 6: Devil's Advocate (TrackE) ───────────────────────────────────────

async function runTrackE(lang: Lang, question: string, ctx: string): Promise<TrackE | null> {
  const schema = `{"counterThesis":"string — 1 sentence opposing view","missingEvidence":"string — 1 sentence","opposingBias":"bullish"|"bearish"|"neutral"}`;
  const extra = lang === "ar"
    ? "أنت محامي الشيطان. قدّم الأطروحة المضادة وما يتجاهله التحليل السائد. جملة واحدة لكل حقل. خذ الجانب المعاكس للرأي الغالب."
    : "You are the devil's advocate. Present the strongest counter-thesis and what the dominant view ignores. One sentence per field. Deliberately take the opposing side.";
  const sys = buildLocaleSystemPrompt({ lang, surface: "market_analyst", schema, extra });
  const user = wrapUserContext(lang, `Question: ${question}\n\nContext:\n${ctx}`);
  const res = await withTimeout(
    callAIGateway<TrackE>({ system: sys, user, language: lang, jsonObject: true, maxTokens: 300, temperature: 0.45 }),
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
  trackD: TrackD | null,
  trackE: TrackE | null,
  consensus: ConsensusResult,
): Promise<GenesisReply | null> {
  const trackLines = [
    trackA ? `MACRO ANALYST: regime=${trackA.regime} (${trackA.regimeConf}% conf) bias=${trackA.macroBias ?? "?"} — ${trackA.macroSummary}` : null,
    trackB ? `TECHNICAL ANALYST: ${trackB.technicalBias} bias, momentum ${trackB.momentumStrength}/100 — ${trackB.technicalNote}` : null,
    trackC ? `SENTIMENT ANALYST: ${trackC.sentimentBias}, catalysts: ${trackC.catalysts.slice(0, 2).join("; ")} — near-term risk: ${trackC.nearTermRisk}` : null,
    trackD ? `RISK OFFICER: uncertainty=${trackD.uncertaintyLevel} | primary_risk: ${trackD.primaryRisk} | weakness: ${trackD.thesisWeakness}` : null,
    trackE ? `DEVIL'S ADVOCATE: counter="${trackE.counterThesis}" | missing: ${trackE.missingEvidence}` : null,
    `CONSENSUS (${[trackA, trackB, trackC, trackD, trackE].filter(Boolean).length} agents): dominant=${consensus.dominantBias}, agreement=${consensus.agreementScore}%, strength=${consensus.strength}${consensus.conflictNote ? ` — ${consensus.conflictNote}` : ""}`,
  ].filter(Boolean).join("\n");

  const fusionDirective = lang === "ar"
    ? `نتائج وكلاء التحليل المتخصصين (Phase 6 — خمسة وكلاء):\n${trackLines}\n\nادمج هذه المسارات في تحليل مؤسسي شامل. اضبط consensusStrength من نتيجة الإجماع. اضبط supportingCase من أقوى الحجج الداعمة. اضبط opposingCase من حجة محامي الشيطان. اضبط disagreementNote فقط عند التعارض أو ضعف الإجماع. جميع القواعد الإلزامية سارية.`
    : `Specialist agent analysis (Phase 6 — five agents):\n${trackLines}\n\nSynthesize into a unified institutional analysis. Set consensusStrength from the consensus result above. Set supportingCase from the strongest corroborating argument. Set opposingCase from the devil's advocate counter-thesis. Set disagreementNote only when conflicted or weak consensus. All mandatory rules remain in force.`;

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

    // ── Multi-agent parallel path (detailed mode) — Phase 6: 5 specialist agents ──
    if (data.responseStyle === "detailed") {
      const [settledA, settledB, settledC, settledD, settledE] = await Promise.allSettled([
        runTrackA(lang, data.question, data.marketContext),  // Macro Analyst
        runTrackB(lang, data.question, data.marketContext),  // Technical Analyst
        runTrackC(lang, data.question, data.marketContext),  // Sentiment Analyst
        runTrackD(lang, data.question, data.marketContext),  // Risk Officer
        runTrackE(lang, data.question, data.marketContext),  // Devil's Advocate
      ]);

      const trackA = settledA.status === "fulfilled" ? settledA.value : null;
      const trackB = settledB.status === "fulfilled" ? settledB.value : null;
      const trackC = settledC.status === "fulfilled" ? settledC.value : null;
      const trackD = settledD.status === "fulfilled" ? settledD.value : null;
      const trackE = settledE.status === "fulfilled" ? settledE.value : null;
      const tracksUsed = [trackA, trackB, trackC, trackD, trackE].filter(Boolean).length;

      // Pure consensus engine — no AI call, runs on track outputs only.
      const consensus = computeConsensus(trackA, trackB, trackC, trackE);

      // Attempt fusion when at least one track succeeded.
      if (tracksUsed >= 1) {
        const fused = await runFusion(lang, data.question, data.marketContext, trackA, trackB, trackC, trackD, trackE, consensus);
        if (fused?.headline) {
          return { reply: fused, error: null as null, engine: "ai" as const, tracksUsed };
        }
      }
      // Graceful fallback to single-call if all tracks failed or fusion failed.
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
