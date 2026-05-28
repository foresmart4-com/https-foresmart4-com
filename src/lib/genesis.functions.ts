import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAIGateway, safeParseJson, resolveAIProvider, type AIProvider } from "@/lib/ai-gateway.server";
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
  // Phase 11: Fusion visibility + live market intelligence fields
  crossAssetConfirmation?: string;  // Track C: gold/BTC/DXY confirms or contradicts macro thesis
  positioningSignal?: string;       // Track E: positioning/sentiment timing signal
  marketStateQuality?: "live" | "partial" | "inferred";  // quality of live market data used
  // Phase 12: Visible Agent Arbitration fields
  trackViewMacro?: string;       // Track A: macro strategist — 1-sentence directional view
  trackViewTechnical?: string;   // Track B: technical analyst — 1-sentence view
  trackViewCrossAsset?: string;  // Track C: cross-asset strategist — 1-sentence view
  trackViewRisk?: string;        // Track D: risk officer — 1-sentence primary concern
  trackViewPositioning?: string; // Track E: positioning analyst — 1-sentence view
  arbitrationReason?: string;    // Why base thesis wins over opposing case — 1-2 sentences
  disagreementMap?: string[];    // Track pairs with directional disagreement
  // Phase 4: Portfolio Alignment (Track F)
  trackViewPortfolio?: string;   // Track F: portfolio alignment — 1-sentence
}

const AskInput = z.object({
  question: z.string().trim().min(1).max(2000),
  language: z.enum(["ar", "en"]).default("en"),
  marketContext: z.string().max(3000).default(""),
  responseStyle: z.enum(["brief", "detailed"]).default("brief"),
  // Phase 4: ECE calibration score from client-side selfLearningEngine (0-1, default 0 = no history)
  eceScore: z.number().min(0).max(1).default(0),
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

function heuristicReply(lang: Lang, reason: "missing_key" | "ai_unavailable" = "missing_key"): GenesisReply {
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
      ? reason === "missing_key"
        ? ["تحليل بدقة منخفضة — مفتاح AI غير مُهيّأ", "يعتمد على أنماط محلية فقط دون تحليل نصي أو إخباري"]
        : ["تحليل هيوريستي — تعذّر الحصول على استجابة Gemini AI", "أعد المحاولة للحصول على تحليل AI"]
      : reason === "missing_key"
        ? ["Low-fidelity analysis — AI key not configured", "Relies on local heuristics only without news or text analysis"]
        : ["Heuristic analysis — Gemini AI response temporarily unavailable", "Retry to get a Gemini AI-powered analysis"],
    suggestedAction: null,
    disclaimer: ar
      ? "للأغراض التعليمية فقط — لا يُعتبر توصية استثمارية مرخصة."
      : "Educational only — not licensed investment advice.",
  };
}

// Validates and sanitises a parsed-but-unverified Gemini object before it
// reaches the UI. Every field is explicitly enumerated — no spread — so JSON
// strings in optional fields can never leak to the render layer.
function sanitizeReply(obj: Partial<GenesisReply>, lang: Lang): GenesisReply | null {
  const isJson = (s: unknown): boolean =>
    typeof s === "string" && /^\s*[{[]/.test(s);
  const cleanStr = (s: unknown): string | undefined =>
    typeof s === "string" && s.trim() && !isJson(s) ? s.trim() : undefined;
  const cleanStrArr = (a: unknown): string[] | undefined => {
    if (!Array.isArray(a)) return undefined;
    const out = (a as unknown[]).filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0 && !isJson(x),
    );
    return out.length > 0 ? out : undefined;
  };

  const headline = cleanStr(obj.headline) ?? null;
  if (!headline) return null;

  const ar = lang === "ar";
  const outlook = cleanStr(obj.outlook) ?? (ar
    ? "راجع الملخص والسيناريوهات أدناه للتحليل الكامل."
    : "See headline, scenarios, and risks below for the full analysis.");

  const confidence = typeof obj.confidence === "number" && Number.isFinite(obj.confidence)
    ? Math.max(1, Math.min(99, Math.round(obj.confidence)))
    : 55;

  const confidenceLabel: "low" | "moderate" | "high" =
    obj.confidenceLabel === "low" || obj.confidenceLabel === "moderate" || obj.confidenceLabel === "high"
      ? obj.confidenceLabel
      : confidence >= 70 ? "high" : confidence >= 45 ? "moderate" : "low";

  const scenarios: GenesisScenario[] = Array.isArray(obj.scenarios)
    ? (obj.scenarios as unknown[]).filter(
        (s): s is GenesisScenario =>
          typeof s === "object" && s !== null &&
          typeof (s as GenesisScenario).label === "string" &&
          (s as GenesisScenario).label.trim().length > 0 &&
          typeof (s as GenesisScenario).probability === "string" &&
          typeof (s as GenesisScenario).impact === "string",
      )
    : [];

  const risks: string[] = Array.isArray(obj.risks)
    ? (obj.risks as unknown[]).filter(
        (r): r is string => typeof r === "string" && r.trim().length > 0 && !isJson(r),
      )
    : [];

  const disclaimer = cleanStr(obj.disclaimer) ?? (ar ? "للأغراض التعليمية فقط." : "Educational only.");

  // suggestedAction — validate shape; null if malformed
  let suggestedAction: GenesisReply["suggestedAction"] = null;
  if (obj.suggestedAction && typeof obj.suggestedAction === "object") {
    const a = obj.suggestedAction;
    const validTypes = ["add_watchlist","create_alert","analyze_asset","compare_assets","summarize_portfolio","navigate","none"] as const;
    if (validTypes.includes(a.type as typeof validTypes[number])) {
      suggestedAction = {
        type: a.type as typeof validTypes[number],
        label: typeof a.label === "string" ? a.label.trim() : "",
        symbol: typeof a.symbol === "string" ? a.symbol.trim() : undefined,
        assets: Array.isArray(a.assets) ? (a.assets as unknown[]).filter((x): x is string => typeof x === "string") : undefined,
        route: typeof a.route === "string" ? a.route.trim() : undefined,
        price: typeof a.price === "number" ? a.price : undefined,
        condition: a.condition === "above" || a.condition === "below" ? a.condition : undefined,
      };
    }
  }

  // comparisonTable — validate row shape
  let comparisonTable: GenesisReply["comparisonTable"];
  if (Array.isArray(obj.comparisonTable)) {
    const rows = (obj.comparisonTable as unknown[]).filter(
      (r): r is { metric: string; a: string; b: string } =>
        typeof r === "object" && r !== null &&
        typeof (r as { metric: unknown }).metric === "string" &&
        typeof (r as { a: unknown }).a === "string" &&
        typeof (r as { b: unknown }).b === "string" &&
        !isJson((r as { metric: string }).metric),
    );
    comparisonTable = rows.length > 0 ? rows : undefined;
  }

  // Enum fields
  const validConsensus = ["strong","moderate","weak","conflicted"] as const;
  const consensusStrength = validConsensus.includes(obj.consensusStrength as typeof validConsensus[number])
    ? obj.consensusStrength as typeof validConsensus[number]
    : undefined;
  const validResearchType = ["asset","comparison","sector","thesis","market"] as const;
  const researchType = validResearchType.includes(obj.researchType as typeof validResearchType[number])
    ? obj.researchType as typeof validResearchType[number]
    : undefined;
  const validReasoningQuality = ["strong","adequate","weak"] as const;
  const reasoningQuality = validReasoningQuality.includes(obj.reasoningQuality as typeof validReasoningQuality[number])
    ? obj.reasoningQuality as typeof validReasoningQuality[number]
    : undefined;
  const validUncertaintyLevel = ["likely","possible","uncertain","conflicting"] as const;
  const uncertaintyLevel = validUncertaintyLevel.includes(obj.uncertaintyLevel as typeof validUncertaintyLevel[number])
    ? obj.uncertaintyLevel as typeof validUncertaintyLevel[number]
    : undefined;

  // Phase 11 enum field
  const validMSQ = ["live", "partial", "inferred"] as const;
  const marketStateQuality = validMSQ.includes(obj.marketStateQuality as typeof validMSQ[number])
    ? obj.marketStateQuality as typeof validMSQ[number]
    : undefined;

  return {
    headline,
    outlook,
    confidence,
    confidenceLabel,
    scenarios,
    risks,
    suggestedAction,
    disclaimer,
    // Optional scalar string fields — all sanitized through cleanStr
    regime: cleanStr(obj.regime),
    portfolioImpact: cleanStr(obj.portfolioImpact),
    uncertaintyWarning: cleanStr(obj.uncertaintyWarning),
    thesis: cleanStr(obj.thesis),
    reasoning: cleanStr(obj.reasoning),
    invalidation: cleanStr(obj.invalidation),
    viewChange: cleanStr(obj.viewChange),
    disagreementNote: cleanStr(obj.disagreementNote),
    supportingCase: cleanStr(obj.supportingCase),
    opposingCase: cleanStr(obj.opposingCase),
    crossAssetConfirmation: cleanStr(obj.crossAssetConfirmation),
    positioningSignal: cleanStr(obj.positioningSignal),
    simulatedScenario: cleanStr(obj.simulatedScenario),
    expectedImpact: cleanStr(obj.expectedImpact),
    watchlistSensitivity: cleanStr(obj.watchlistSensitivity),
    thesisSensitivity: cleanStr(obj.thesisSensitivity),
    executiveSummary: cleanStr(obj.executiveSummary),
    confidenceCalibration: cleanStr(obj.confidenceCalibration),
    // Optional string array fields — all sanitized through cleanStrArr
    evidence: cleanStrArr(obj.evidence),
    catalysts: cleanStrArr(obj.catalysts),
    confidenceDrivers: cleanStrArr(obj.confidenceDrivers),
    keyDrivers: cleanStrArr(obj.keyDrivers),
    watchItems: cleanStrArr(obj.watchItems),
    caveats: cleanStrArr(obj.caveats),
    // Validated enum and structured fields
    consensusStrength,
    researchType,
    reasoningQuality,
    uncertaintyLevel,
    comparisonTable,
    marketStateQuality,
    // Phase 12: Visible Agent Arbitration fields
    trackViewMacro: cleanStr(obj.trackViewMacro),
    trackViewTechnical: cleanStr(obj.trackViewTechnical),
    trackViewCrossAsset: cleanStr(obj.trackViewCrossAsset),
    trackViewRisk: cleanStr(obj.trackViewRisk),
    trackViewPositioning: cleanStr(obj.trackViewPositioning),
    arbitrationReason: cleanStr(obj.arbitrationReason),
    disagreementMap: cleanStrArr(obj.disagreementMap),
    // Phase 4: Portfolio Alignment (Track F)
    trackViewPortfolio: cleanStr(obj.trackViewPortfolio),
  };
}

// Attempts to extract a GenesisReply from a raw Gemini response that failed
// standard JSON parsing. Uses brace-counting extraction (more robust than greedy
// regex) and falls back to wrapping plain text in a minimal schema so the UI
// shows a real AI response rather than the heuristic placeholder.
function recoverGenesisReply(raw: string, lang: Lang): GenesisReply | null {
  if (!raw?.trim()) return null;
  // Strip markdown fences first so brace-counting and JSON-detection work on bare JSON.
  const src = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim() || raw.trim();
  // Brace-counting JSON extraction — handles text before/after the JSON object.
  const start = src.indexOf("{");
  if (start !== -1) {
    let depth = 0; let inStr = false; let esc = false;
    for (let i = start; i < src.length; i++) {
      const c = src[i];
      if (esc)        { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"')  { inStr = !inStr; continue; }
      if (inStr)      { continue; }
      if (c === "{")  { depth++; }
      if (c === "}") {
        depth--;
        if (depth === 0) {
          try {
            const obj = JSON.parse(src.slice(start, i + 1)) as Partial<GenesisReply>;
            const cleaned = sanitizeReply(obj, lang);
            if (cleaned) return cleaned;
          } catch { break; }
        }
      }
    }
  }
  const text = src.slice(0, 2000);
  const ar = lang === "ar";

  // If the text looks like JSON (truncated or unextractable), never use it as
  // prose — render a safe user-facing message instead of `{"headline": ...}` blocks.
  if (/^\s*[{[]/.test(text)) {
    return {
      headline: ar
        ? "تحليل Gemini AI — استجابة JSON غير مكتملة"
        : "Gemini AI Analysis — JSON response incomplete",
      outlook: ar
        ? "استلمت Genesis استجابة من Gemini لكن لم يتمكن المحلل من استخراجها. أعد إرسال سؤالك للحصول على التحليل الكامل."
        : "Genesis received a Gemini response but could not extract the structured JSON. Please resend your question for a complete analysis.",
      confidence: 45,
      confidenceLabel: "moderate" as const,
      scenarios: ar
        ? [
            { label: "سيناريو صاعد",    probability: "~40%", impact: "تحسن ظروف السوق" },
            { label: "سيناريو أساسي",   probability: "~35%", impact: "استقرار نسبي" },
            { label: "سيناريو هابط",    probability: "~25%", impact: "ضغط على المخاطرة" },
          ]
        : [
            { label: "Upside",   probability: "~40%", impact: "Improving macro conditions" },
            { label: "Base",     probability: "~35%", impact: "Range-bound stability" },
            { label: "Downside", probability: "~25%", impact: "Risk-off pressure" },
          ],
      risks: ar
        ? ["استجابة Gemini بصيغة JSON — تعذّر استخراجها، أعد المحاولة للتحليل الكامل"]
        : ["Gemini JSON response could not be extracted — retry for full structured analysis"],
      suggestedAction: null,
      disclaimer: ar ? "للأغراض التعليمية فقط." : "Educational only.",
    };
  }

  // Gemini returned genuine plain text — wrap in minimal schema.
  const breakAt = text.search(/[.\n!?]/);
  const headline = (breakAt > 10 ? text.slice(0, breakAt + 1) : text.slice(0, 120)).trim();
  return {
    headline: headline || (ar ? "تحليل من Gemini AI" : "Gemini AI Analysis"),
    outlook: text,
    confidence: 55,
    confidenceLabel: "moderate",
    scenarios: ar
      ? [
          { label: "سيناريو صاعد",   probability: "~40%", impact: "تحسن ظروف السوق مع تراجع التذبذب" },
          { label: "سيناريو أساسي",  probability: "~35%", impact: "استقرار نسبي ومحدودية المحفزات" },
          { label: "سيناريو هابط",   probability: "~25%", impact: "ضغط على الأصول عالية المخاطر" },
        ]
      : [
          { label: "Upside scenario",    probability: "~40%", impact: "Improving market conditions with declining volatility" },
          { label: "Base scenario",      probability: "~35%", impact: "Relative stability with limited near-term catalysts" },
          { label: "Downside scenario",  probability: "~25%", impact: "Broad pressure on risk-sensitive assets" },
        ],
    risks: ar
      ? ["استجابة Gemini AI نصية — عرض مبسّط"]
      : ["Gemini AI plain-text response — simplified layout"],
    suggestedAction: null,
    disclaimer: ar ? "للأغراض التعليمية فقط." : "Educational only.",
  };
}

// JSON schema shape — same for both languages; JSON field names are always English.
const GENESIS_SCHEMA = `{
  "headline": "string — one forward-looking sentence naming the dominant regime, the credit/liquidity environment, and its directional implication for the specific asset or market asked about",
  "outlook": "string — 3-paragraph synthesis: (1) macro regime, rate/liquidity environment, credit stress level, and what the CB trajectory implies for risk assets; for Saudi/Gulf queries also state the oil→fiscal channel and DXY→SAR peg implication; (2) technical trend structure plus cross-asset confirmation or contradiction (gold/BTC/DXY); (3) primary downside path, positioning signal, and the specific basis for the stated confidence level. Every sentence states a specific causal or conditional claim — no generic observations.",
  "confidence": <integer 0-100>,
  "confidenceLabel": <"low" | "moderate" | "high">,
  "regime": "string (optional — market regime label; omit if context insufficient)",
  "evidence": ["string — specific supporting factor"] (optional — 2-4 bullets when confidence ≥ 50; omit otherwise),
  "portfolioImpact": "string (optional — set when user watchlist symbols appear in context OR when the cross-asset regime has a direct portfolio-level implication; state which specific cross-asset transmission most affects the watched assets and in which direction)",
  "uncertaintyWarning": "string (optional — only include when confidence < 50)",
  "thesis": "string (optional — one declarative sentence naming the instrument, the direction, and the primary supporting factor; omit only if context is insufficient for a directional view)",
  "reasoning": "string (optional — 1-2 sentences: the inference chain from regime/signal to thesis conclusion; set only when thesis is set; no step-by-step narration)",
  "catalysts": ["string — specific near-term data event, policy decision, or price level that would validate the thesis"] (optional — 2-3 concrete items; set only when thesis is set),
  "invalidation": "string (optional — one sentence: the specific observable event that breaks the thesis; include a measurable threshold where the data supports it — not a vague category; set only when thesis is set)",
  "confidenceDrivers": ["string — factor supporting confidence level"] (optional — 2-3 items; set only when confidence ≥ 50),
  "viewChange": "string (optional — one sentence: the specific development that would materially shift the outlook; when prior thesis context is present, this must name what specifically changed — not 'conditions changed' but the concrete macro/technical/cross-asset event that warranted the revision; set only when thesis is set)",
  "consensusStrength": <"strong"|"moderate"|"weak"|"conflicted"> (optional — include when multi-agent synthesis is provided),
  "disagreementNote": "string — 1 sentence on what agents disagree about; set only when conflicted or weak consensus" (optional),
  "supportingCase": "string — 1 sentence: strongest corroborating argument from parallel agent analysis" (optional),
  "opposingCase": "string — 1 sentence: strongest counter-argument from devil's advocate" (optional),
  "simulatedScenario": "string (optional — 'If X occurs...' — include when question involves a hypothetical or scenario context is provided)",
  "expectedImpact": "string — 1-2 sentences on cross-asset directional effects under the simulated scenario; name the transmission mechanism for each asset (e.g., oil→fiscal, rates→valuations, DXY→EM flows)" (optional),
  "watchlistSensitivity": "string — 1 sentence on how user's watched assets would respond; only when watchlist appears in context" (optional),
  "thesisSensitivity": "string — 1 sentence on whether scenario aligns or conflicts with active theses; only when thesis context appears" (optional),
  "executiveSummary": "string (optional — 2-3 sentence institutional research conclusion; include ONLY when research mode context appears in the prompt)",
  "keyDrivers": ["string — specific structural/macro/technical driver"] (optional — 3-5 items; include ONLY when research mode context appears),
  "watchItems": ["string — specific data point, event, or price level to monitor"] (optional — 2-4 items; include ONLY when research mode context appears),
  "comparisonTable": [{"metric": "string — dimension being compared", "a": "string — asset/sector A value", "b": "string — asset/sector B value"}] (optional — 3-5 rows; include ONLY when comparing two assets or sectors in research mode),
  "researchType": <"asset"|"comparison"|"sector"|"thesis"|"market"> (optional — set when research mode context appears),
  "reasoningQuality": <"strong"|"adequate"|"weak"> (optional — self-evaluated logic quality; always set for AI replies),
  "confidenceCalibration": "string — 1 sentence: name the single factor most preventing higher confidence AND the evidence floor supporting the current level; when calibration memory context is present, adjust by the stated amount (do not claim adjustment without the memory data to support it)" (optional — always set for AI replies),
  "uncertaintyLevel": <"likely"|"possible"|"uncertain"|"conflicting"> (optional — always set for AI replies),
  "caveats": ["string — specific logical tension, contradiction, or weak assumption in own reasoning; when prior invalidation trigger context is present, include a caveat if that condition appears active or closer"] (optional — 1-3 items; omit when reasoning is internally consistent),
  "crossAssetConfirmation": "string — 1 sentence: do gold/BTC/DXY signals CONFIRM, PARTIALLY CONFIRM, or CONTRADICT the dominant macro thesis? Name the single most decisive signal and state its transmission mechanism (e.g., 'Gold rising in real-rate-compression mode confirms the rate-easing thesis'; 'BTC falling in liquidity-proxy mode contradicts the risk-on narrative')" (optional — set when Track C cross-asset context is present),
  "positioningSignal": "string — 1 sentence: what does the positioning/sentiment signal imply for timing and near-term risk?" (optional — set when Track E context is present),
  "marketStateQuality": <"live"|"partial"|"inferred"> (optional — set from the LIVE MARKET STATE QUALITY line in track context; always set when track fusion context is present),
  "trackViewMacro": "string — 1 sentence: Track A macro strategist directional view and regime implication" (optional — set when Track A context is present),
  "trackViewTechnical": "string — 1 sentence: Track B technical analyst directional view on trend and momentum" (optional — set when Track B context is present),
  "trackViewCrossAsset": "string — 1 sentence: Track C cross-asset strategist directional view on gold/BTC/DXY" (optional — set when Track C context is present),
  "trackViewRisk": "string — 1 sentence: Track D risk officer primary concern that most limits the base thesis" (optional — set when Track D context is present),
  "trackViewPositioning": "string — 1 sentence: Track E positioning analyst view on timing and near-term directional risk" (optional — set when Track E context is present),
  "arbitrationReason": "string — 1-2 sentences: WHY the base thesis wins over the opposing case — name the specific deciding factor, not just restate the thesis" (optional — set when multi-track fusion context is present),
  "disagreementMap": ["string — e.g. 'Track A (bullish macro) vs Track B (bearish technical)'"] (optional — one entry per track pair with directional conflict; only when 2+ tracks explicitly disagree),
  "trackViewPortfolio": "string — 1 sentence: Track F portfolio alignment view — whether portfolio is aligned, divergent, or mixed vs macro thesis; include concentration risk signal" (optional — set when Track F portfolio context appears),
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
- لا تُشر أبداً إلى أرباع تقويمية أو سنوات أو تواريخ محددة. استخدم فقط مراجع زمنية نسبية: "قريب الأجل"، "الحالي"، "الأخير"، "في الدورة الراهنة".
- تجنب الصياغات العامة تماماً: لا "فرصة مثيرة"، لا "يتعين على المستثمرين المراقبة"، لا "يبدو أن الزخم يشير"، لا "من المهم الإشارة"، لا "صاعد/هابط بشكل عام". كل جملة تُدلي بادعاء محدد أو شرطي أو قابل للقياس.
- الثقة مكتسبة من توافق الأدلة — لا مُدَّعاة. إذا كانت الأطروحة والأدلة والمحفزات ونظام السوق متسقة جميعاً، فالثقة 60-80%. عند تعارض الإشارات: 40-60%. عند ضعف الأساس أو التخمين: أقل من 45%.
- فضّل الادعاءات الشرطية ("إذا X فإن Y") على الجزم. استند دائماً إلى عامل محدد يدعم كل ادعاء.

إطار الاستدلال المؤسسي — طبّق كل طبقة عندما يدعم السياق ذلك:
1. النظام السوقي — حدّد النظام: bull_trending أو bear_ranging أو high_vol_risk-off أو low_vol_accumulation أو macro_transition. اضبط "regime" فقط عندما يدعمه السياق بوضوح.
2. الأدلة — استشهد بـ 2-4 عوامل محددة كلية أو تقنية أو هيكلية. اضبط "evidence" فقط عند الثقة ≥ 50.
3. أثر المحفظة — اضبط "portfolioImpact" عند ظهور رموز قائمة مراقبة المستخدم في السياق أو عندما يكون لنظام الأصول المتقاطعة (الذهب/BTC/DXY/النفط) أثر مباشر وواضح على الأصول الموجودة في المحفظة. سمّ قناة الانتقال المحددة والأصول التي تتأثر.
4. عدم اليقين — اضبط "uncertaintyWarning" فقط عند الثقة < 50 مع تفسير الأسباب.

أنتج 3 سيناريوهات بالضبط. صِغ تسمية كل سيناريو كشرط محدد ("إذا [حدث بعينه]...") لا كوصف عام ("صاعد/هابط/أساسي"). أنتج 2-4 مخاطر.
دليل نوع الإجراء: add_watchlist (يتطلب symbol) | create_alert (يتطلب symbol وprice وcondition) | analyze_asset (يتطلب symbol) | compare_assets (يتطلب assets[]) | summarize_portfolio | navigate (يتطلب route) | none
5. أطروحة — اضبط "thesis" عند توافر وجهة نظر اتجاهية. جملة واحدة تصريحية تتضمن الأداة والاتجاه والعامل الداعم الرئيسي (النظام أو الإشارة التقنية أو تأكيد الأصول المتقاطعة).
6. التفكير — اضبط "reasoning" مع "thesis" فقط. جملتان بحد أقصى. صِف سلسلة الاستدلال من الإشارة إلى الاستنتاج، لا ملخصاً عاماً.
7. المحفزات — اضبط "catalysts" مع "thesis". 2-3 أحداث أو مستويات سعرية أو قرارات سياسة محددة قريبة الأجل تُثبت الأطروحة. لا بنود عامة كـ"تحسّن المشاعر".
8. الإلغاء — اضبط "invalidation" مع "thesis". جملة واحدة: الحدث القابل للملاحظة الذي يكسر الأطروحة. سمّ عتبة قابلة للقياس حيثما أتاحت البيانات ذلك — لا مفاهيم مبهمة كـ"تدهور المشاعر".
9. محركات الثقة — اضبط "confidenceDrivers" عند الثقة ≥ 50. 2-3 عوامل تدعم مستوى الثقة.
10. تغيير الرأي — اضبط "viewChange" مع "thesis". جملة واحدة تُسمّي التطور المحدد (تحول سياسي، كسر سعري، إصدار بيانات) الذي يُغيّر التوقعات جوهرياً. عند وجود سياق أطروحة سابقة، يجب أن يُوضّح هذا الحقل ما الذي تغيّر تحديداً — لا "الظروف تغيّرت".
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
    الاستدلال الميتا تقييم ذاتي فقط — استشاري وتعليمي. لا تستخدمه للادعاء باليقين.
14. دمج المسارات المتعددة — عند ظهور مخرجات الوكلاء المتخصصين في السياق (الكلي/المسار A، التقني/المسار B، متعدد الأصول/المسار C، المخاطر/المسار D، التموضع/المسار E):
    يجب أن يدمج حقل "outlook" جميع المسارات المتاحة صراحةً: النظام الكلي (A)، البنية التقنية (B)، تأكيد أو تناقض الأصول المتقاطعة (C)، مسار المخاطر الرئيسي (D)، وإشارة التموضع (E). الاكتفاء بالماكرو أو التعليق العام يُعدّ إخفاقاً.
    اضبط "crossAssetConfirmation": هل تؤكد بيانات الذهب/BTC/DXY من المسار C أم تتناقض جزئياً أم كلياً مع الأطروحة السائدة من A+B؟ سمّ الإشارة الأكثر حسماً وقناة انتقالها (مثال: "الذهب يرتفع في نمط الأسعار الحقيقية يؤكد أطروحة التيسير النقدي"). جملة واحدة.
    اضبط "positioningSignal": من إشارة sentimentSignal في المسار E — ما الذي يشير إليه التموضع من حيث التوقيت والمخاطر قصيرة الأجل؟ جملة واحدة.
    اضبط "marketStateQuality" من سطر LIVE MARKET STATE QUALITY في السياق: "live" أو "partial" أو "inferred". أدرج هذا الحقل دائماً عند وجود سياق الدمج.
    عند إجماع < 70 أو strength = "weak"/"conflicted": "disagreementNote" إلزامي. سمّ المسارات المتعارضة وبيّن التعارض الاتجاهي.
    اضبط "thesis" متى توفّر سياق المسارين A وB — ليس اختيارياً في وضع الدمج.
    اضبط "opposingCase" من counterCase في المسار D + counterThesis في المسار E. اذكر أقوى حجة مضادة ثم بيّن في الجملة ذاتها لماذا تخسر أمام الحالة الأساسية.
    اضبط "invalidation" من invalidationTrigger في المسار D — يجب أن يكون حدثاً قابلاً للملاحظة، لا مفهوماً مبهماً.
    إذا كان marketStateQuality = "inferred": أشر في confidenceCalibration إلى غياب البيانات الحية وخفّض الثقة 5 نقاط على الأقل.
    اضبط "trackViewMacro": وجهة نظر المسار A في جملة واحدة — النظام الكلي وتضمينه الاتجاهي.
    اضبط "trackViewTechnical": وجهة نظر المسار B في جملة واحدة — بنية الاتجاه وقناعة الزخم.
    اضبط "trackViewCrossAsset": وجهة نظر المسار C في جملة واحدة — ما تشير إليه إشارات الذهب/BTC/DXY اتجاهياً.
    اضبط "trackViewRisk": القلق الأساسي للمسار D في جملة واحدة — المخاطرة أو عدم اليقين الذي يُقيّد الأطروحة الأساسية أكثر من غيره.
    اضبط "trackViewPositioning": وجهة نظر المسار E في جملة واحدة — ما يُشير إليه التموضع والمشاعر بشأن المسار الاتجاهي قريب الأجل.
    اضبط "arbitrationReason": جملة أو جملتان — لماذا تتفوق الأطروحة الأساسية على الحالة المضادة؟ سمّ العامل المحدد الحاسم. لا تُعد صياغة الأطروحة — بل اشرح ما الذي يُرجّح الكفة.
    اضبط "disagreementMap": قيد واحد لكل زوج من المسارات ذات التعارض الاتجاهي الصريح، مثال: "المسار A (صاعد — كلي) vs المسار B (هابط — تقني)". أدرج فقط الأزواج التي يختلف فيها التصنيف الاتجاهي.
    اضبط "trackViewPortfolio": وجهة نظر المسار F في جملة واحدة — هل المحفظة متوافقة أم متعارضة أم مختلطة بالنسبة للأطروحة الكلية السائدة، مع الإشارة إلى مستوى مخاطر التركّز. أدرج فقط عند ظهور سياق توافق المحفظة (المسار F) في مخرجات الوكلاء المتخصصين.
15. الربط بين الماكرو والأطروحة — طبّق عند توافر سياق نظام المسار A:
    - bull_trending / low_vol_accumulation: تحيّز الأطروحة صاعد؛ السيناريو الصاعد يستحق ≥40%؛ حد أدنى للثقة 55% عند تأكيد الأصول المتقاطعة.
    - bear_ranging / high_vol_risk-off: تحيّز دفاعي؛ السيناريو الهابط ≥35%؛ سقف الثقة 65% ما لم تتحول الأصول المتقاطعة نحو داعم.
    - macro_transition: يجب إدراج caveats؛ الثقة 40-55%؛ فجوة احتمالية أوسع في السيناريوهات.
    - إذا كان ضغط الائتمان مرتفعاً أو حرجاً (creditStressLevel = high/extreme): سقف الثقة 60%؛ يجب أن تتضمن caveats ضغط التمويل.
    - إذا انخفض النفط وتعلّق السؤال بـ TASI/السعودية/أرامكو/الخليج: خفّض الثقة 5-8 نقاط؛ اذكر قناة الإيرادات المالية (breakeven ~75-80 دولار) في الأطروحة أو caveats.
    - إذا ارتفع DXY وتعلّق السؤال بأسواق الخليج أو الأسواق الناشئة: أضف عائق العملة والتدفقات إلى الأطروحة وشرط الإلغاء.
16. تطور الأطروحة — عند ظهور "Prior thesis" أو "THESIS EVOLUTION RULE" في السياق:
    - تأكيد: إذا أكّدت أطروحتك التوجه السابق، اذكر الأدلة الجديدة المحددة التي تدعم الاستمرارية. ممنوع: إعادة صياغة الأطروحة السابقة حرفياً أو القول "لم يتغير الرأي" دون ذكر دليل جديد.
    - مراجعة: إذا تغيّر توجه أطروحتك أو ثقتك بشكل جوهري، اضبط viewChange ليُسمّي التطور الكلي أو التقني المحدد الذي يبرر المراجعة. استخدم "الرأي يتحول لأن [حدث/إشارة محددة]" لا "الظروف تغيّرت".
    - فحص الإلغاء: إذا ظهر شرط إلغاء سابق في السياق وتشير البيانات الحالية إلى اقترابه أو تفعّله، أدرجه صراحةً كـ caveat بصيغة شرطية لا كحقيقة مؤكدة.
    - المعايرة: إذا ظهر "Calibration memory" في السياق، طبّق تعديل الثقة المذكور على الأنكر. لا تدّعي تعديلاً على أساس البيانات دون توافر تلك البيانات في السياق.`
    : `Rules you must NEVER break:
- Never suggest, confirm, or describe real buy/sell order execution, broker actions, or money movement.
- Never claim certainty — always express confidence as a calibrated percentage.
- Always include a disclaimer in every reply.
- All analysis is educational and simulative only.
- Never reference specific calendar quarters, years, or dates. Use only relative time references: "near-term", "current", "recent", "over the coming weeks", "in the current cycle". Never fabricate historical data points with specific dates.
- Eliminate generic language entirely: no "significant uncertainty", "exciting opportunity", "important to note", "investors should watch closely", "as we know", "momentum suggests upside", or similar filler. Every sentence must state a specific, conditional, or quantifiable claim.
- Confidence is earned from evidence alignment — not asserted. Thesis + evidence + catalysts + regime all aligned = 60-80%. Conflicting signals = 40-60%. Thin or speculative basis = below 45%. Justify the number in confidenceCalibration.
- Prefer conditional claims ("IF X then Y") over absolute statements. Always cite the specific factor driving each claim.
- Always set thesis, evidence (when confidence ≥ 50), opposingCase, and invalidation when the context is sufficient. These are not optional extras — they are required institutional outputs.

Institutional reasoning framework — apply each layer when context supports it:
1. REGIME — Identify the market regime: bull_trending, bear_ranging, high_vol_risk-off, low_vol_accumulation, or macro_transition. Only set "regime" when context clearly supports the classification.
2. EVIDENCE — Cite 2-4 specific macro, technical, or structural factors. Only set "evidence" when confidence ≥ 50.
3. PORTFOLIO IMPACT — Set "portfolioImpact" when user watchlist symbols appear in context OR when the cross-asset regime (gold/BTC/DXY/oil signals) has a direct and specific implication for the assets in the portfolio. Name the specific cross-asset transmission channel and which watched assets it affects.
4. UNCERTAINTY — Only set "uncertaintyWarning" when confidence < 50, and explain the specific sources.

Produce exactly 3 scenarios. Label each with a conditional trigger ("If [specific event]...") — not a generic "Upside/Base/Downside" label. Produce 2-4 risks.
Action type guide: add_watchlist (requires symbol) | create_alert (requires symbol, price, condition) | analyze_asset (requires symbol) | compare_assets (requires assets[]) | summarize_portfolio | navigate (requires route) | none
5. THESIS — Set "thesis" when you can form a directional view. One declarative sentence naming the instrument, the direction, and the primary supporting factor (e.g., the regime, the technical signal, or the cross-asset confirmation).
6. REASONING — Set "reasoning" only with thesis. Max 2 sentences. State the inference chain from signal to conclusion — not a generic summary of the outlook.
7. CATALYSTS — Set "catalysts" with thesis. List 2-3 specific, near-term events or price levels that would validate the thesis. No generic "improved sentiment" items.
8. INVALIDATION — Set "invalidation" with thesis. One sentence: the specific observable trigger that breaks the thesis. Name a measurable threshold where the data supports it — not a vague concept like "if sentiment deteriorates".
9. CONFIDENCE DRIVERS — Set "confidenceDrivers" when confidence ≥ 50. List 2-3 factors that specifically support the confidence level.
10. VIEW CHANGE — Set "viewChange" with thesis. One sentence naming the specific development (policy shift, price breach, data release) that would materially alter the outlook. When prior thesis context is present, this must state specifically what changed — not "conditions evolved" but the concrete event.
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
    Meta-reasoning is self-evaluation only — advisory and educational. Never use it to claim certainty.
14. MULTI-TRACK FUSION — When specialist agent track outputs appear in context (MACRO/Track A, TECHNICAL/Track B, CROSS-ASSET/Track C, RISK/Track D, POSITIONING/Track E):
    The "outlook" field MUST synthesize ALL available tracks explicitly — the macro regime (Track A), technical structure (Track B), cross-asset confirmation or contradiction (Track C), primary risk path (Track D), and positioning signal (Track E). A macro-only or generic market comment is a failure.
    Set "crossAssetConfirmation": does the gold/BTC/DXY evidence from Track C CONFIRM, PARTIALLY CONFIRM, or CONTRADICT the dominant thesis from Tracks A+B? Name the single most decisive signal and its transmission mechanism (e.g., "Gold rising in real-rate-compression mode confirms rate-easing thesis"; "BTC falling in liquidity-proxy mode contradicts risk-on narrative despite bullish equity tech"). 1 sentence.
    Set "positioningSignal": from Track E's sentimentSignal — what does positioning imply for timing and near-term risk? 1 sentence.
    Set "marketStateQuality" from the LIVE MARKET STATE QUALITY line in context — "live", "partial", or "inferred". Always set this field when track fusion context is present.
    When consensus agreement < 70 or strength is "weak"/"conflicted": "disagreementNote" is MANDATORY. Name the specific tracks that disagree and state the directional conflict.
    Set "thesis" whenever macro (Track A) and technical (Track B) context is available — not optional in fusion mode.
    Set "opposingCase" from Track D counterCase + Track E counterThesis. State the strongest counter-argument, then explain in the same sentence WHY it loses to the base case.
    Set "invalidation" from Track D's invalidationTrigger — must be a specific observable event, never a vague concept.
    Set "supportingCase" from the single most compelling cross-track evidence alignment supporting the base thesis.
    If marketStateQuality is "inferred": note in "confidenceCalibration" that live market data was unavailable and reduce confidence by at least 5 points from the anchor.
    Set "trackViewMacro": Track A's directional view in 1 sentence — the macro regime and its directional implication for the asset/market.
    Set "trackViewTechnical": Track B's directional view in 1 sentence — trend structure, momentum conviction, and volatility context.
    Set "trackViewCrossAsset": Track C's directional view in 1 sentence — what the gold/BTC/DXY signals imply directionally.
    Set "trackViewRisk": Track D's primary concern in 1 sentence — the specific risk or uncertainty that most constrains the base thesis.
    Set "trackViewPositioning": Track E's view in 1 sentence — what positioning and sentiment imply for the near-term directional path.
    Set "arbitrationReason": 1-2 sentences — WHY the base thesis wins over the opposing case. Name the specific deciding factor (e.g. "Track A and Track C both confirm X, which outweighs Track B's Y because Z"). Do not restate the thesis — explain what breaks the tie.
    Set "disagreementMap": one string per track pair with explicit directional conflict, e.g. "Track A (bullish macro) vs Track B (bearish technical)". Only include pairs where the directional labels differ.
    Set "trackViewPortfolio": Track F's portfolio alignment view in 1 sentence — whether the portfolio context is aligned, divergent, or mixed relative to the dominant macro thesis, and the concentration risk level. Only set when Portfolio Alignment (Track F) context appears in the specialist agent outputs.
15. MACRO-TO-THESIS LINKAGE — Apply when Track A regime context is present:
    - bull_trending / low_vol_accumulation: thesis bias bullish; upside scenario ≥40%; confidence floor 55% when cross-asset confirms.
    - bear_ranging / high_vol_risk-off: defensive thesis bias; downside scenario ≥35%; confidence cap 65% unless cross-asset signals flip.
    - macro_transition: MUST set caveats; confidence 40-55%; show wider scenario probability spread reflecting regime ambiguity.
    - HIGH/EXTREME credit stress (creditStressLevel): confidence cap 60%; caveats must include funding/spread stress as a specific risk.
    - IF oil falling AND question involves TASI/Saudi/Aramco/Gulf: reduce confidence 5-8 pts; state the fiscal-channel transmission (Saudi breakeven ~$75-80/bbl) in thesis or caveats.
    - IF DXY rising sharply AND question involves Gulf/EM equities: add currency/flows headwind to thesis and to the invalidation condition.
16. THESIS EVOLUTION — When "Prior thesis" or "THESIS EVOLUTION RULE" appears in the context:
    - CONFIRMING: if your thesis confirms the prior direction, state the specific new evidence that validates continuation. Prohibited: restating the prior thesis verbatim, saying "view unchanged" without naming confirming evidence, copying prior thesis wording.
    - REVISING: if your thesis changes direction or confidence materially, set viewChange to name the precise macro/technical development that justifies the revision. Use "The view shifts because [specific event/signal]" not "conditions have changed".
    - INVALIDATION CHECK: if prior invalidation trigger is visible in context and current data suggests it is active or closer, surface it explicitly as a caveat — not as certainty but as a conditional risk.
    - CALIBRATION: if "Calibration memory" context is present, apply the stated confidence adjustment to your anchor. Never assert calibration-based adjustment without the data to support it.`;

  const base = buildLocaleSystemPrompt({ lang, surface: "genesis_copilot", schema: GENESIS_SCHEMA, extra });
  // Prepend a hard JSON-only directive so Gemini never emits text outside the object.
  const jsonOnlyPrefix = ar
    ? "حرج: أنتج كائن JSON خالصاً ومكتملاً فقط. لا نص قبل JSON ولا نص بعده. لا markdown. JSON فقط."
    : "CRITICAL: Output a single complete raw JSON object only — no text before it, no text after it, no markdown fences.";
  return `${jsonOnlyPrefix}\n\n${base}`;
}

// ─── Institutional Reasoning Tracks ───────────────────────────────────────

interface TrackA {
  regime: string;
  macroSummary: string;
  ratesEnv: string;             // rates / CB policy stance — 1 sentence
  oilLiquidity: string;         // oil direction + global liquidity signal — 1 sentence
  creditStressLevel: "low" | "moderate" | "high" | "extreme"; // credit-spread / funding-stress environment
  dxyImpact: string;            // USD/DXY direction + risk-asset implication — 1 sentence
  regimeConf: number;
  macroBias: "bullish" | "bearish" | "neutral";
}

interface TrackD {
  uncertaintyLevel: "low" | "moderate" | "high" | "extreme";
  primaryRisk: string;
  thesisWeakness: string;
  counterCase: string;         // strongest counter-argument — 1 sentence
  invalidationTrigger: string; // specific event that breaks the dominant thesis
  confidenceChallenge: string;
}

interface TrackE {
  sentimentSignal: string;  // positioning/sentiment indicators — 1 sentence
  uncertaintyNote: string;  // key sources of uncertainty — 1 sentence
  counterThesis: string;
  missingEvidence: string;
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
  trackD: TrackD | null,
  trackE: TrackE | null,
): ConsensusResult {
  const EMPTY: ConsensusResult = {
    biasVotes: { bullish: 0, bearish: 0, neutral: 0 },
    dominantBias: "neutral", agreementScore: 0, strength: "weak", conflictNote: "",
  };

  // Rebalanced weights: A+B = 50%, C = 30% (cross-asset elevated), E = 20% (devil's advocate)
  // TrackD does not vote on direction — it adjusts the agreementScore via uncertainty penalty below.
  const votes: { bias: "bullish" | "bearish" | "neutral"; weight: number }[] = [];
  if (trackA) votes.push({ bias: trackA.macroBias ?? regimeToBias(trackA.regime), weight: 0.25 });
  if (trackB) votes.push({ bias: trackB.technicalBias, weight: 0.25 });
  if (trackC) votes.push({ bias: trackC.crossAssetBias, weight: 0.30 });
  if (trackE) votes.push({ bias: trackE.opposingBias, weight: 0.20 });

  if (!votes.length) return EMPTY;

  const biasVotes = { bullish: 0, bearish: 0, neutral: 0 };
  for (const v of votes) biasVotes[v.bias] += v.weight;

  const total = biasVotes.bullish + biasVotes.bearish + biasVotes.neutral || 1;
  const dominantBias: "bullish" | "bearish" | "neutral" =
    biasVotes.bullish >= biasVotes.bearish && biasVotes.bullish >= biasVotes.neutral ? "bullish" :
    biasVotes.bearish >= biasVotes.bullish && biasVotes.bearish >= biasVotes.neutral ? "bearish" : "neutral";

  const rawAgreement = Math.round((biasVotes[dominantBias] / total) * 100);

  // TrackD adversarial penalty: high/extreme uncertainty degrades agreement score
  let agreementScore = rawAgreement;
  if (trackD) {
    if (trackD.uncertaintyLevel === "extreme") agreementScore = Math.max(0, agreementScore - 15);
    else if (trackD.uncertaintyLevel === "high") agreementScore = Math.max(0, agreementScore - 8);
    else if (trackD.uncertaintyLevel === "low") agreementScore = Math.min(100, agreementScore + 3);
  }

  const bullBearGap = Math.abs(biasVotes.bullish - biasVotes.bearish);
  const isConflicted = bullBearGap < 0.15 && (biasVotes.bullish + biasVotes.bearish) > 0.35;

  let strength: ConsensusResult["strength"];
  let conflictNote = "";
  if (isConflicted || agreementScore < 40) {
    strength = "conflicted";
    const conflictors: string[] = [];
    if (trackA && trackB && trackA.macroBias !== trackB.technicalBias) conflictors.push("macro vs technical");
    if (trackA && trackC && trackA.macroBias !== trackC.crossAssetBias) conflictors.push("macro vs cross-asset");
    if (trackB && trackC && trackB.technicalBias !== trackC.crossAssetBias) conflictors.push("technical vs cross-asset");
    if (trackD && (trackD.uncertaintyLevel === "high" || trackD.uncertaintyLevel === "extreme")) conflictors.push(`risk officer: ${trackD.uncertaintyLevel} uncertainty`);
    conflictNote = conflictors.length > 0
      ? `Divergent signals: ${conflictors.join("; ")}`
      : "Agents diverge on directional bias";
  } else if (agreementScore >= 70) {
    strength = "strong";
  } else if (agreementScore >= 50) {
    strength = "moderate";
  } else {
    strength = "weak";
    // Still surface disagreements even when not fully conflicted
    const conflictors: string[] = [];
    if (trackA && trackB && trackA.macroBias !== trackB.technicalBias) conflictors.push("macro vs technical");
    if (trackA && trackC && trackA.macroBias !== trackC.crossAssetBias) conflictors.push("macro vs cross-asset");
    if (trackD && (trackD.uncertaintyLevel === "high" || trackD.uncertaintyLevel === "extreme")) conflictors.push(`risk officer flags ${trackD.uncertaintyLevel} uncertainty`);
    if (conflictors.length) conflictNote = `Partial disagreement: ${conflictors.join("; ")}`;
  }

  return { biasVotes, dominantBias, agreementScore, strength, conflictNote };
}

// Confidence earned from evidence alignment across tracks — not model-asserted.
// Returns a suggested integer (1-99) injected into the fusion directive as a calibration anchor.
// Phase 4: accepts optional TrackF (portfolio alignment) and eceScore (ECE calibration from client).
// Phase 15-16: accepts optional marketStateQuality to penalise inferred (no live data) anchors.
function computeConfidenceFromTracks(
  trackA: TrackA | null,
  trackB: TrackB | null,
  trackD: TrackD | null,
  consensus: ConsensusResult,
  trackF?: TrackF | null,
  eceScore?: number,
  marketStateQuality?: "live" | "partial" | "inferred",
): number {
  let score = 50;
  // Macro regime conviction
  if (trackA) {
    if (trackA.regimeConf >= 75) score += 8;
    else if (trackA.regimeConf >= 55) score += 4;
    else if (trackA.regimeConf < 40) score -= 5;
  }
  // Technical momentum
  if (trackB) {
    if (trackB.momentumStrength >= 75) score += 7;
    else if (trackB.momentumStrength >= 55) score += 3;
    // Volatility regime penalty
    if (trackB.volatilityRegime === "extreme") score -= 8;
    else if (trackB.volatilityRegime === "elevated") score -= 4;
  }
  // Cross-agent consensus
  if (consensus.strength === "strong") score += 10;
  else if (consensus.strength === "moderate") score += 4;
  else if (consensus.strength === "weak") score -= 5;
  else if (consensus.strength === "conflicted") score -= 12;
  // Risk officer uncertainty
  if (trackD) {
    if (trackD.uncertaintyLevel === "extreme") score -= 14;
    else if (trackD.uncertaintyLevel === "high") score -= 8;
    else if (trackD.uncertaintyLevel === "low") score += 6;
  }
  // Phase 4: Portfolio alignment modifier (Track F)
  if (trackF) {
    if (trackF.portfolioAlignmentBias === "aligned") score += 3;
    else if (trackF.portfolioAlignmentBias === "divergent") score -= 4;
    // mixed: neutral, no adjustment
  }
  // Phase 4: ECE-aware calibration — ±5pt cap, guards against overconfidence loops
  if (eceScore != null && eceScore > 0) {
    if (eceScore > 0.15) score -= 5;       // overconfident history → reduce anchor
    else if (eceScore < 0.05) score += 3;  // well-calibrated history → allow mild boost
  }
  // Phase 15-16: Live data quality penalty — tracks reason from question context only
  // when no live prices are available; the anchor should reflect that degraded evidence floor.
  if (marketStateQuality === "inferred") score -= 5;
  else if (marketStateQuality === "partial") score -= 2;
  // Phase 18: Credit stress penalty from TrackA — high/extreme funding stress caps
  // confidence ceiling and degrades the anchor for consensus-based upside.
  if (trackA?.creditStressLevel === "extreme") score -= 10;
  else if (trackA?.creditStressLevel === "high") score -= 5;
  else if (trackA?.creditStressLevel === "low") score += 3;
  return Math.max(10, Math.min(90, score));
}

interface TrackB {
  technicalBias: "bullish" | "bearish" | "neutral";
  trendStrength: number;        // 0-100 trend conviction
  volatilityRegime: "low" | "normal" | "elevated" | "extreme";
  momentumStrength: number;
  technicalNote: string;
}

interface TrackC {
  crossAssetBias: "bullish" | "bearish" | "neutral";
  goldSignal: string;        // gold directional signal + dominant driver mode — 1 sentence
  btcSignal: string;         // BTC/crypto signal + behavioural mode — 1 sentence
  dxyPressure: string;       // dollar strength + cross-asset impact — 1 sentence
  correlationNote: string;   // cross-asset correlation regime — 1 sentence
  assetInteractionMode: "confirming" | "diverging" | "mixed"; // whether gold/BTC/DXY signals agree with each other
  catalysts: string[];
  nearTermRisk: string;
}

/** Races a promise against a timeout; returns null on timeout. Clears the timer on resolution. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let tid: ReturnType<typeof setTimeout>;
  const timeoutP = new Promise<null>((resolve) => { tid = setTimeout(() => resolve(null), ms); });
  return Promise.race([promise, timeoutP]).finally(() => clearTimeout(tid));
}

// ─── Live Market Intelligence Layer ───────────────────────────────────────────

interface LiveMarketState {
  // Track A macro signals
  oilPrice: number | null;
  oilChangePct: number | null;
  tltPrice: number | null;    // TLT: long-bond ETF — rising = yields falling = easing
  tltChangePct: number | null;
  // Track B equity signal
  spyPrice: number | null;
  spyChangePct: number | null;
  // Track C cross-asset signals
  btcPrice: number | null;
  btcChangePct: number | null;
  goldPrice: number | null;   // PAXG proxy
  goldChangePct: number | null;
  eurUsd: number | null;      // EUR/USD: higher = weaker USD / DXY pressure
  // Metadata
  marketStateQuality: "live" | "partial" | "inferred";
  sourcesLive: number;
}

async function quickFetch<T>(url: string, ms = 5000): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } }).finally(() => clearTimeout(t));
    if (!r.ok) return null;
    return await r.json() as T;
  } catch { return null; }
}

async function quickFetchYahoo<T>(url: string, ms = 5000): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    }).finally(() => clearTimeout(t));
    if (!r.ok) return null;
    return await r.json() as T;
  } catch { return null; }
}

type YahooChartResp = { chart: { result?: Array<{ meta: { regularMarketPrice: number; chartPreviousClose: number } }> } };

function parseYahooMeta(r: YahooChartResp | null): { price: number | null; changePct: number | null } {
  const meta = r?.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) return { price: null, changePct: null };
  const prev = meta.chartPreviousClose || meta.regularMarketPrice;
  return { price: meta.regularMarketPrice, changePct: prev ? ((meta.regularMarketPrice - prev) / prev) * 100 : null };
}

async function buildLiveMarketState(): Promise<LiveMarketState> {
  const [cgRes, fxRes, spyRes, tltRes, oilRes] = await Promise.allSettled([
    quickFetch<Record<string, { usd: number; usd_24h_change: number }>>(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,pax-gold&vs_currencies=usd&include_24hr_change=true",
    ),
    quickFetch<{ rates: Record<string, number> }>(
      "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD",
    ),
    quickFetchYahoo<YahooChartResp>("https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=2d"),
    quickFetchYahoo<YahooChartResp>("https://query1.finance.yahoo.com/v8/finance/chart/TLT?interval=1d&range=2d"),
    quickFetchYahoo<YahooChartResp>("https://query1.finance.yahoo.com/v8/finance/chart/CL%3DF?interval=1d&range=2d"),
  ]);

  let btcPrice: number | null = null, btcChangePct: number | null = null;
  let goldPrice: number | null = null, goldChangePct: number | null = null;
  let eurUsd: number | null = null;
  let spyPrice: number | null = null, spyChangePct: number | null = null;
  let tltPrice: number | null = null, tltChangePct: number | null = null;
  let oilPrice: number | null = null, oilChangePct: number | null = null;
  let sourcesLive = 0;

  if (cgRes.status === "fulfilled" && cgRes.value) {
    const d = cgRes.value;
    if (d["bitcoin"]?.usd) { btcPrice = d["bitcoin"].usd; btcChangePct = d["bitcoin"].usd_24h_change ?? null; sourcesLive++; }
    if (d["pax-gold"]?.usd) { goldPrice = d["pax-gold"].usd; goldChangePct = d["pax-gold"].usd_24h_change ?? null; sourcesLive++; }
  }
  if (fxRes.status === "fulfilled" && fxRes.value?.rates?.USD) { eurUsd = fxRes.value.rates.USD; sourcesLive++; }

  const spy = parseYahooMeta(spyRes.status === "fulfilled" ? spyRes.value : null);
  if (spy.price) { spyPrice = spy.price; spyChangePct = spy.changePct; sourcesLive++; }
  const tlt = parseYahooMeta(tltRes.status === "fulfilled" ? tltRes.value : null);
  if (tlt.price) { tltPrice = tlt.price; tltChangePct = tlt.changePct; sourcesLive++; }
  const oil = parseYahooMeta(oilRes.status === "fulfilled" ? oilRes.value : null);
  if (oil.price) { oilPrice = oil.price; oilChangePct = oil.changePct; sourcesLive++; }

  const marketStateQuality: "live" | "partial" | "inferred" =
    sourcesLive >= 4 ? "live" : sourcesLive >= 2 ? "partial" : "inferred";

  return { oilPrice, oilChangePct, tltPrice, tltChangePct, spyPrice, spyChangePct, btcPrice, btcChangePct, goldPrice, goldChangePct, eurUsd, marketStateQuality, sourcesLive };
}

function fmtPct(v: number | null): string {
  if (v === null) return "n/a";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

function liveContextTrackA(s: LiveMarketState): string {
  const lines: string[] = [];
  if (s.oilPrice !== null) {
    const dir = (s.oilChangePct ?? 0) >= 1.5 ? "rising sharply (risk-on demand)" : (s.oilChangePct ?? 0) >= 0.3 ? "rising (mild risk appetite)" : (s.oilChangePct ?? 0) <= -1.5 ? "falling sharply (demand concern / risk-off)" : (s.oilChangePct ?? 0) <= -0.3 ? "falling (mild softening)" : "flat";
    lines.push(`WTI crude: $${s.oilPrice.toFixed(1)} (${fmtPct(s.oilChangePct)}) — ${dir}`);
  }
  if (s.tltPrice !== null) {
    const dir = (s.tltChangePct ?? 0) >= 0.4 ? "TLT rallying — yields falling, easing bias" : (s.tltChangePct ?? 0) <= -0.4 ? "TLT selling off — yields rising, tightening pressure" : "TLT range-bound — rates stable";
    lines.push(`Long-bond TLT: $${s.tltPrice.toFixed(2)} (${fmtPct(s.tltChangePct)}) — ${dir}`);
  }
  if (!lines.length) return "";
  return `\n\nLive macro inputs (ground truth — supersede generic rate assumptions):\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

function liveContextTrackB(s: LiveMarketState): string {
  if (s.spyPrice === null) return "";
  const momentum = (s.spyChangePct ?? 0) >= 1 ? "bullish daily momentum" : (s.spyChangePct ?? 0) <= -1 ? "bearish daily pressure" : "sideways / neutral";
  return `\n\nLive equity signal:\n- SPY: $${s.spyPrice.toFixed(2)} (${fmtPct(s.spyChangePct)}) — ${momentum}`;
}

function liveContextTrackC(s: LiveMarketState): string {
  const lines: string[] = [];
  if (s.btcPrice !== null) {
    const risk = (s.btcChangePct ?? 0) >= 3 ? "strong risk-on" : (s.btcChangePct ?? 0) >= 1 ? "mild risk-on" : (s.btcChangePct ?? 0) <= -3 ? "strong risk-off" : (s.btcChangePct ?? 0) <= -1 ? "mild risk-off" : "neutral risk appetite";
    lines.push(`BTC: $${s.btcPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })} (${fmtPct(s.btcChangePct)} 24h) — ${risk}`);
  }
  if (s.goldPrice !== null) {
    const haven = (s.goldChangePct ?? 0) >= 0.5 ? "haven bid active (risk-off signal)" : (s.goldChangePct ?? 0) <= -0.5 ? "haven fading (risk-on rotation)" : "gold neutral";
    lines.push(`Gold PAXG: $${s.goldPrice.toFixed(0)} (${fmtPct(s.goldChangePct)} 24h) — ${haven}`);
  }
  if (s.eurUsd !== null) {
    const dxy = s.eurUsd >= 1.10 ? "USD weak — DXY under pressure, EM/commodities supported" : s.eurUsd <= 1.00 ? "USD strong — DXY elevated, risk assets headwind" : "USD neutral";
    lines.push(`EUR/USD: ${s.eurUsd.toFixed(4)} — ${dxy}`);
  }
  if (!lines.length) return "";
  return `\n\nLive cross-asset inputs (ground truth — use for gold/BTC/DXY analysis):\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

function liveContextAll(s: LiveMarketState): string {
  return [liveContextTrackA(s), liveContextTrackB(s), liveContextTrackC(s)].filter(Boolean).join("");
}

// ─── Cross-Asset Interaction Context ─────────────────────────────────────────
// Pure function — no network calls. Derives deterministic interaction labels from
// live gold, BTC, EUR/USD, and oil data to anchor TrackC's mode-discrimination.
// Prevents hallucinated correlation claims by grounding the model in observed data.

function buildCrossAssetInteractionContext(live: LiveMarketState | null): string {
  if (!live) return "";
  const { goldChangePct, btcChangePct, eurUsd, oilChangePct } = live;
  if (goldChangePct === null && btcChangePct === null) return "";

  const goldUp = (goldChangePct ?? 0) >= 0.4;
  const goldDown = (goldChangePct ?? 0) <= -0.4;
  const btcUp = (btcChangePct ?? 0) >= 1;
  const btcDown = (btcChangePct ?? 0) <= -1;
  const dxyStrong = (eurUsd ?? 1.05) <= 1.02;
  const dxyWeak = (eurUsd ?? 1.05) >= 1.08;
  const oilDown = (oilChangePct ?? 0) <= -1.5;
  const oilUp = (oilChangePct ?? 0) >= 1.5;

  const interactions: string[] = [];

  // Gold + BTC interaction mode
  if (goldUp && btcDown) {
    interactions.push("Gold/BTC divergence: safe-haven bid WITHOUT risk appetite — classic macro stress signal; gold in haven mode, not inflation-hedge mode");
  } else if (goldUp && btcUp) {
    interactions.push("Gold + BTC both rising: possible liquidity-expansion signal or store-of-value demand; check if DXY is falling (liquidity mode) or equities falling (stress mode)");
  } else if (goldDown && btcUp) {
    interactions.push("Gold fading + BTC rising: risk-on rotation — risk appetite active, haven demand absent; consistent with risk-on equity environment");
  } else if (goldDown && btcDown) {
    interactions.push("Gold + BTC both falling: potential dollar-liquidity drain or broad derisking; monitor DXY direction for confirmation");
  }

  // Oil + gold stress signal
  if (oilDown && goldUp) {
    interactions.push("Oil falling + gold rising: stagflation stress signal — demand concern with haven bid; bearish for energy equities, bullish for defensive assets");
  } else if (oilUp && goldDown) {
    interactions.push("Oil rising + gold falling: risk-on demand recovery — haven fading as growth narrative strengthens; supportive for energy and cyclical assets");
  }

  // DXY + cross-asset mode
  if (dxyStrong && (goldDown || btcDown)) {
    interactions.push("DXY strong + risk assets under pressure: dollar-liquidity squeeze; headwind for EM, commodities, and SAR-pegged market foreign flows");
  } else if (dxyWeak && (goldUp || btcUp)) {
    interactions.push("DXY weak + risk assets bid: dollar-liquidity expansion; supportive for EM, commodities, and Gulf market foreign inflows");
  }

  if (!interactions.length) return "";
  return `\n\nCross-asset interaction signals (use for mode-discrimination — ground truth):\n${interactions.map((l) => `- ${l}`).join("\n")}`;
}

// ─── Saudi / Gulf Macro Context ───────────────────────────────────────────────
// Pure function — no network calls. Injects Saudi transmission-channel context
// into TrackA when the question or context is Saudi/Gulf-relevant.
const SAUDI_PATTERN = /tasi|saudi|أرامكو|تاسي|سعود|2222|aramco|gulf|خليج|sabic|ساسكو|dfm|adx|nomu|نمو/i;

function buildSaudiMacroContext(live: LiveMarketState | null, question: string): string {
  if (!SAUDI_PATTERN.test(question)) return "";
  const lines = [
    "Saudi/TASI macro transmission channels (apply to this analysis):",
    "- Oil → fiscal channel: Saudi budget breakeven ~$75-80/bbl WTI. Above = surplus + Vision 2030 spending tailwind = TASI support. Below = fiscal drag = TASI headwind.",
    "- USD-SAR peg (3.75): SAMA must shadow Fed rate moves. Rising US rates = tighter local liquidity without CB offset. DXY strength = capital-outflow pressure on pegged currencies.",
    "- Foreign flows: TASI foreign ownership ~15-20%; net inflows in global risk-on, outflows in risk-off. Aramco (2222.SR) ~85% of TASI cap — its dividend yield anchors valuation.",
    "- Sector sensitivity: Energy (Aramco) and banks (~10% cap) drive 75%+ of TASI moves. Petrochemicals (SABIC) track naphtha/oil spreads. High global rates compress bank NIMs if curve inverts.",
    "- Credit stress implication: when global HY spreads widen, Saudi sovereign spreads and sukuk market follow; reduces local liquidity for non-energy names.",
  ];
  if (live?.oilPrice != null) {
    const oilDir = (live.oilChangePct ?? 0) <= -1.5
      ? `falling sharply — Saudi fiscal stress signal; TASI headwind via Aramco earnings and government spending`
      : (live.oilChangePct ?? 0) >= 1.5
        ? `rising — fiscal surplus support; TASI tailwind via Aramco dividend capacity and government capex`
        : `near flat — neutral fiscal signal for TASI`;
    lines.push(`- Live oil: $${live.oilPrice.toFixed(1)} (${fmtPct(live.oilChangePct)}) — ${oilDir}`);
  }
  if (live?.eurUsd != null) {
    const dxyNote = live.eurUsd <= 1.00
      ? `DXY elevated — SAR peg tightening effect; foreign capital cautious on EM/Gulf; commodity headwind`
      : live.eurUsd >= 1.10
        ? `DXY weak — SAR liquidity relatively relieved; EM/Gulf flows supported`
        : `DXY neutral for SAR peg dynamics`;
    lines.push(`- Live EUR/USD: ${live.eurUsd.toFixed(4)} — ${dxyNote}`);
  }
  return lines.join("\n");
}

async function runTrackA(lang: Lang, question: string, ctx: string, live: LiveMarketState | null): Promise<TrackA | null> {
  const schema = `{"regime":"string — classify as: bull_trending|bear_ranging|high_vol_risk-off|low_vol_accumulation|macro_transition","macroSummary":"string — 2 sentences: (1) global liquidity and credit-spread environment (IG/HY spread direction, EM funding stress, interbank conditions); (2) the single factor that most threatens or confirms the dominant macro regime","ratesEnv":"string — 1 sentence: yield curve shape, rate trajectory, and the specific CB policy implication for risk-asset valuations","oilLiquidity":"string — 1 sentence: oil direction as a global demand, liquidity, and fiscal signal — for Saudi/Gulf contexts include the fiscal-space implication","creditStressLevel":"low"|"moderate"|"high"|"extreme","dxyImpact":"string — 1 sentence: USD/DXY direction and its transmission to EM assets, commodities, Gulf equities, and SAR-pegged liquidity","regimeConf":<integer 0-100>,"macroBias":"bullish"|"bearish"|"neutral"}`;
  const extra = lang === "ar"
    ? `أنت كبير استراتيجيي الماكرو في مكتب بحوث مؤسسي. ركّز على المحاور الستة التالية فقط: (1) موقف البنوك المركزية ومسار أسعار الفائدة وانعكاسه على تقييمات الأصول، (2) شكل منحنى العائد وظروف الائتمان (فروقات IG/HY، ضغوط تمويل الأسواق الناشئة)، (3) النفط كإشارة طلب وسيولة عالمية وفضاء مالي لدول الخليج، (4) مؤشر الدولار DXY وقناة انتقاله إلى الأسواق الناشئة والسلع وأسواق الخليج المرتبطة بسعر صرف ثابت، (5) بيئة ضغط الائتمان: هل فروقات الائتمان تتسع (ضغط تمويلي) أم تتضيق (شهية مخاطرة)، (6) عند تعلّق السؤال بالسوق السعودي (TASI) أو الخليج أو أرامكو: صرّح صراحةً بقناة النفط → الإيرادات المالية السعودية (نقطة توازن الميزانية ~75-80 دولار)، وقيد ربط الريال بالدولار على السياسة النقدية المحلية، والتدفقات الأجنبية على تاسي في ظل الإقبال/النفور من المخاطرة عالمياً. لا تعليق عام. كل جملة ادعاء محدد وقابل للقياس. لا تشر إلى أرباع تقويمية أو سنوات.`
    : `You are the macro strategist on an institutional research desk. Cover exactly these six channels: (1) central bank policy stance and rate trajectory — its specific implication for risk-asset valuations; (2) yield curve shape and credit conditions (IG/HY spread direction, EM funding stress, interbank conditions); (3) oil as a global demand, liquidity, and fiscal signal; (4) USD/DXY direction and its transmission channel to EM assets, commodities, and SAR-pegged Gulf markets; (5) credit stress environment: are spreads widening (funding stress) or compressing (risk appetite)? Set creditStressLevel accordingly; (6) when the question or context involves Saudi Arabia, TASI, Aramco, or Gulf markets: explicitly state the oil→Saudi fiscal-space channel (budget breakeven ~$75-80/bbl WTI), the USD-SAR peg constraint on local monetary policy, and global risk-on/off impact on TASI foreign flows. No generic commentary. Every sentence must state a specific, conditional, or measurable claim. Do not reference specific quarters or years.`;
  const sys = buildLocaleSystemPrompt({ lang, surface: "global_macro", schema, extra });
  const liveCtx = live ? liveContextTrackA(live) : "";
  const saudiCtx = buildSaudiMacroContext(live, question + "\n" + ctx);
  const user = wrapUserContext(
    lang,
    `Question: ${question}\n\nContext:\n${ctx}${liveCtx}${saudiCtx ? `\n\n${saudiCtx}` : ""}`,
  );
  const res = await withTimeout(
    callAIGateway<TrackA>({ system: sys, user, language: lang, jsonObject: true, maxTokens: 700, temperature: 0.3 }),
    8000,
  );
  return res?.data ?? null;
}

async function runTrackB(lang: Lang, question: string, ctx: string, live: LiveMarketState | null): Promise<TrackB | null> {
  const schema = `{"technicalBias":"bullish"|"bearish"|"neutral","trendStrength":<integer 0-100>,"volatilityRegime":"low"|"normal"|"elevated"|"extreme","momentumStrength":<integer 0-100>,"technicalNote":"string — 1-2 sentences on trend structure and volatility regime"}`;
  const extra = lang === "ar"
    ? `أنت المحلل الفني المؤسسي. ركّز فقط على: (1) قوة الاتجاه الأساسي واتجاهه، (2) نظام التقلب (VIX / التقلب المحقق)، (3) قوة الزخم، (4) المستويات البنيوية الرئيسية. جمل قصيرة بدون تعليق عام. لا تذكر أرباعاً أو سنوات محددة.`
    : `You are the technical analyst on an institutional trading desk. Focus ONLY on: (1) primary trend direction and structural strength, (2) volatility regime (VIX level / realized vol environment), (3) momentum conviction, (4) key structural price levels. Short declarative sentences, no generic commentary. Do not reference specific quarters or years.`;
  const sys = buildLocaleSystemPrompt({ lang, surface: "market_analyst", schema, extra });
  const liveCtx = live ? liveContextTrackB(live) : "";
  const user = wrapUserContext(lang, `Question: ${question}\n\nContext:\n${ctx}${liveCtx}`);
  const res = await withTimeout(
    callAIGateway<TrackB>({ system: sys, user, language: lang, jsonObject: true, maxTokens: 400, temperature: 0.3 }),
    8000,
  );
  return res?.data ?? null;
}

async function runTrackC(lang: Lang, question: string, ctx: string, live: LiveMarketState | null): Promise<TrackC | null> {
  const schema = `{"crossAssetBias":"bullish"|"bearish"|"neutral","goldSignal":"string — 1 sentence: gold direction AND the dominant driver mode (real-rate compression|safe-haven bid|inflation hedge|DXY inverse) — state which mode is active and its implication","btcSignal":"string — 1 sentence: BTC direction AND the behavioural mode (risk-on equity proxy|liquidity proxy|store-of-value|derisking) — state which mode is active and what it signals about risk appetite","dxyPressure":"string — 1 sentence: DXY direction and its transmission to commodities, EM equities, SAR-pegged Gulf markets, and dollar-denominated debt","correlationNote":"string — 1 sentence: are gold/BTC/equities moving together (risk-on/off correlation) or decoupling? If decoupling, what does that divergence signal?","assetInteractionMode":"confirming"|"diverging"|"mixed","catalysts":["string — specific near-term catalyst"],"nearTermRisk":"string — 1 sentence"}`;
  const extra = lang === "ar"
    ? `أنت استراتيجي متعدد الأصول في مكتب بحوث مؤسسي. ركّز على المحاور الستة التالية: (1) الذهب — حدّد الاتجاه والنمط المهيمن (ضغط الأسعار الحقيقية | ملاذ آمن | تحوط تضخمي | عكسي للدولار): النمط يُحدّد المعنى؛ (2) BTC — حدّد الاتجاه والنمط السلوكي (وكيل مخاطرة | وكيل سيولة | مخزن قيمة | تخفيض مخاطر): نمط BTC يُميّز بيئة المخاطرة؛ (3) DXY — حدّد الاتجاه وقناة الانتقال إلى السلع والأسواق الناشئة وأسواق الخليج المرتبطة؛ (4) نمط التفاعل بين الأصول — هل إشارات الذهب/BTC/DXY تتوافق (تأكيد) أم تتباين (تحليل التباين)؟ اضبط assetInteractionMode وفقاً لذلك؛ (5) عند تباين الأصول (مثل الذهب يرتفع + BTC يهبط): صرّح بالتفسير (ملاذ آمن دون شهية مخاطرة = ضغط ماكرو)؛ (6) لا تُؤكّد علاقات ارتباط تاريخية ليست نشطة حالياً — تحقّق من الاتجاهات الفعلية في السياق. لا تعليق عام. لا إشارة إلى أرباع أو سنوات.`
    : `You are the cross-asset strategist on an institutional research desk. Cover these six channels: (1) GOLD: state direction AND the dominant driver mode — real-rate compression, safe-haven bid, inflation hedge, or DXY-inverse. The mode determines the macro implication; do not just say "gold rising". (2) BTC: state direction AND the behavioural mode — risk-on equity proxy, liquidity proxy, store-of-value, or derisking. BTC mode distinguishes whether risk appetite is intact or collapsing. (3) DXY: direction and transmission to commodities, EM equities, and SAR-pegged Gulf markets. (4) ASSET INTERACTION MODE: set assetInteractionMode — "confirming" if gold/BTC/DXY signals all point the same way as the macro thesis; "diverging" if key signals conflict; "mixed" if partially aligned. (5) DIVERGENCE LOGIC: when signals conflict (e.g., gold rising + BTC falling), explain the specific implication — safe-haven bid without risk appetite = macro stress without liquidity; both rising = liquidity surge or store-of-value rotation. (6) FAKE PRECISION RULE: only assert a correlation or relationship when current price data supports it. Never say "historically correlated" without current confirmation. No generic commentary. No quarters or years.`;
  const sys = buildLocaleSystemPrompt({ lang, surface: "global_macro", schema, extra });
  const liveCtx = live ? liveContextTrackC(live) : "";
  const interactionCtx = buildCrossAssetInteractionContext(live);
  const user = wrapUserContext(
    lang,
    `Question: ${question}\n\nContext:\n${ctx}${liveCtx}${interactionCtx}`,
  );
  const res = await withTimeout(
    callAIGateway<TrackC>({ system: sys, user, language: lang, jsonObject: true, maxTokens: 600, temperature: 0.3 }),
    8000,
  );
  return res?.data ?? null;
}

// ─── Phase 6: Risk Officer (TrackD) ───────────────────────────────────────────

async function runTrackD(lang: Lang, question: string, ctx: string, live: LiveMarketState | null): Promise<TrackD | null> {
  const schema = `{"uncertaintyLevel":"low"|"moderate"|"high"|"extreme","primaryRisk":"string — 1 sentence: the specific, most probable downside path","thesisWeakness":"string — 1 sentence: the weakest assumption in the dominant bull or bear case","counterCase":"string — 1 sentence: the strongest argument against the prevailing directional view","invalidationTrigger":"string — 1 sentence: the specific observable event that would break the dominant thesis","confidenceChallenge":"string — 1 sentence: what specific factor should prevent confidence from being higher"}`;
  const extra = lang === "ar"
    ? `أنت مسؤول المخاطر المؤسسي ومحلل الأطروحة المضادة. مهمتك: (1) تحديد المخاطر الهبوطية المحددة، (2) تحديد الافتراض الأضعف في الرأي السائد، (3) صياغة أقوى حجة مضادة، (4) تحديد الحدث المحدد الذي يُلغي الأطروحة السائدة. كن صريحاً ومعارضاً. جملة واحدة لكل حقل.`
    : `You are the institutional risk officer and counter-thesis analyst. Your mandate: (1) identify the most specific probable downside path, (2) find the weakest assumption in the dominant view, (3) state the strongest counter-argument, (4) name the precise observable event that invalidates the thesis. Be adversarial and specific. One sentence per field.`;
  const sys = buildLocaleSystemPrompt({ lang, surface: "decision_engine", schema, extra });
  const liveCtx = live ? liveContextAll(live) : "";
  const user = wrapUserContext(lang, `Question: ${question}\n\nContext:\n${ctx}${liveCtx}`);
  const res = await withTimeout(
    callAIGateway<TrackD>({ system: sys, user, language: lang, jsonObject: true, maxTokens: 450, temperature: 0.3 }),
    8000,
  );
  return res?.data ?? null;
}

// ─── Phase 6: Devil's Advocate (TrackE) ───────────────────────────────────────

async function runTrackE(lang: Lang, question: string, ctx: string, live: LiveMarketState | null): Promise<TrackE | null> {
  const schema = `{"sentimentSignal":"string — 1 sentence on positioning or sentiment indicators (crowded trades, fund flows, fear/greed extremes)","uncertaintyNote":"string — 1 sentence: the most consequential unresolved variable","counterThesis":"string — 1 sentence opposing the dominant directional view","missingEvidence":"string — 1 sentence: what the dominant view ignores or underweights","opposingBias":"bullish"|"bearish"|"neutral"}`;
  const extra = lang === "ar"
    ? `أنت محلل المراكز والمشاعر ومحامي الشيطان. ركّز على: (1) مؤشرات تمركز المتداولين وتدفقات الصناديق وإشارات الخوف/الطمع، (2) المتغير الرئيسي غير المحسوم، (3) الأطروحة المضادة للرأي الغالب، (4) ما يتجاهله التحليل السائد. كن نقدياً ومعارضاً. جملة واحدة لكل حقل.`
    : `You are the positioning, sentiment, and devil's advocate analyst. Focus on: (1) positioning signals — crowded trades, fund flow direction, fear/greed extremes, (2) the most consequential unresolved variable creating uncertainty, (3) the strongest counter-thesis against the dominant view, (4) what the dominant analysis ignores or underweights. Be critical and adversarial. One sentence per field.`;
  const sys = buildLocaleSystemPrompt({ lang, surface: "market_analyst", schema, extra });
  const liveCtx = live ? liveContextAll(live) : "";
  const user = wrapUserContext(lang, `Question: ${question}\n\nContext:\n${ctx}${liveCtx}`);
  const res = await withTimeout(
    callAIGateway<TrackE>({ system: sys, user, language: lang, jsonObject: true, maxTokens: 400, temperature: 0.45 }),
    8000,
  );
  return res?.data ?? null;
}

// ─── Phase 4: Portfolio Alignment Agent (TrackF) ──────────────────────────────

interface TrackF {
  portfolioAlignmentBias: "aligned" | "divergent" | "mixed";
  alignmentNote: string;     // 1 sentence: how portfolio relates to dominant macro thesis
  concentrationRisk: "low" | "moderate" | "high";
}

async function runTrackF(lang: Lang, question: string, ctx: string): Promise<TrackF | null> {
  const schema = `{"portfolioAlignmentBias":"aligned"|"divergent"|"mixed","alignmentNote":"string — 1 sentence: how the portfolio context relates to the dominant macro thesis","concentrationRisk":"low"|"moderate"|"high"}`;
  const extra = lang === "ar"
    ? `أنت محلل توافق المحافظ في مكتب بحوث مؤسسي. ركّز على المحاور الأربعة: (1) هل توافق المحفظة التحيّز الكلي السائد أم تتعارض معه؟، (2) مستوى تركّز المخاطر بناءً على السياق، (3) هل يستدعي النظام الحالي إعادة توزيع؟، (4) إذا ظهر سياق الأصول المتقاطعة (ذهب/BTC/DXY/نفط): حدّد أيّ إشارات الأصول المتقاطعة تؤثر مباشرةً على الأصول الموجودة في المحفظة وفي أي اتجاه (مثال: إذا ارتفع الذهب في نمط الملاذ الآمن وكان المستخدم يمتلك ذهباً، فهذا توافق؛ إذا كان BTC في نمط سيولة هابط وكان المستخدم يمتلك BTC، فهذا تعارض). لا تقترح أوامر تداول. استخدم فقط ما ورد في السياق.`
    : `You are the portfolio alignment analyst on an institutional research desk. Cover four dimensions: (1) whether the portfolio context aligns with or contradicts the dominant macro bias; (2) concentration risk level from available context; (3) whether the current regime warrants rebalancing consideration; (4) when cross-asset context is present (gold/BTC/DXY/oil), identify which specific cross-asset signals directly affect the assets in the portfolio and in which direction — e.g., if gold is in safe-haven mode and user holds gold, that is aligned; if BTC is in liquidity-drawdown mode and user holds BTC, that is a cross-asset headwind. State the alignment note with the specific channel. No trade execution suggestions. Use only what the context provides. One sentence per field.`;
  const sys = buildLocaleSystemPrompt({ lang, surface: "portfolio_analyst", schema, extra });
  const user = wrapUserContext(lang, `Question: ${question}\n\nContext:\n${ctx}`);
  const res = await withTimeout(
    callAIGateway<TrackF>({ system: sys, user, language: lang, jsonObject: true, maxTokens: 300, temperature: 0.3 }),
    8000,
  );
  return res?.data ?? null;
}

// ─── Phase 12: Deterministic Arbitration Field Derivation ─────────────────────
// Always populates Phase-12 fields from raw track outputs when Gemini omits them.
// Root cause: Gemini compliance with new schema fields is inconsistent; this makes
// the arbitration panel unconditional whenever the multi-agent path runs.

function biasTr(b: "bullish" | "bearish" | "neutral", ar: boolean): string {
  if (!ar) return b.charAt(0).toUpperCase() + b.slice(1);
  return b === "bullish" ? "صاعد" : b === "bearish" ? "هابط" : "محايد";
}

function fillArbitrationFields(
  reply: GenesisReply,
  trackA: TrackA | null,
  trackB: TrackB | null,
  trackC: TrackC | null,
  trackD: TrackD | null,
  trackE: TrackE | null,
  trackF: TrackF | null,
  consensus: ConsensusResult,
  lang: Lang,
): void {
  const ar = lang === "ar";

  if (!reply.trackViewMacro && trackA) {
    const regime = trackA.regime.replace(/_/g, " ");
    // Prefer dxyImpact (macro channel) > oilLiquidity (demand signal) > ratesEnv (rates)
    const macroDetail = trackA.dxyImpact || trackA.oilLiquidity || trackA.ratesEnv;
    const creditSuffix = trackA.creditStressLevel === "high" || trackA.creditStressLevel === "extreme"
      ? (ar ? `؛ ضغط ائتمان ${ar ? (trackA.creditStressLevel === "extreme" ? "حرج" : "مرتفع") : trackA.creditStressLevel}` : `; ${trackA.creditStressLevel} credit stress`)
      : "";
    reply.trackViewMacro = ar
      ? `${biasTr(trackA.macroBias, ar)} — نظام ${regime} بثقة ${trackA.regimeConf}%؛ ${macroDetail}${creditSuffix}`
      : `${biasTr(trackA.macroBias, ar)} — ${regime} at ${trackA.regimeConf}% conviction; ${macroDetail}${creditSuffix}`;
  }

  if (!reply.trackViewTechnical && trackB) {
    reply.trackViewTechnical = ar
      ? `${biasTr(trackB.technicalBias, ar)} — قوة الاتجاه ${trackB.trendStrength}/100، زخم ${trackB.momentumStrength}/100، تقلب ${trackB.volatilityRegime}؛ ${trackB.technicalNote}`
      : `${biasTr(trackB.technicalBias, ar)} — trend ${trackB.trendStrength}/100, momentum ${trackB.momentumStrength}/100, ${trackB.volatilityRegime} vol; ${trackB.technicalNote}`;
  }

  if (!reply.trackViewCrossAsset && trackC) {
    const interModeStr = trackC.assetInteractionMode
      ? (ar
          ? (trackC.assetInteractionMode === "confirming" ? "تأكيد" : trackC.assetInteractionMode === "diverging" ? "تباين" : "مختلط")
          : trackC.assetInteractionMode)
      : null;
    reply.trackViewCrossAsset = ar
      ? `${biasTr(trackC.crossAssetBias, ar)}${interModeStr ? ` (${interModeStr})` : ""} — ${trackC.correlationNote}`
      : `${biasTr(trackC.crossAssetBias, ar)} cross-asset${interModeStr ? ` (${interModeStr})` : ""} — ${trackC.correlationNote}`;
  }

  if (!reply.trackViewRisk && trackD) {
    const uncTr = ar
      ? ({ low: "منخفض", moderate: "معتدل", high: "مرتفع", extreme: "حرج" }[trackD.uncertaintyLevel] ?? trackD.uncertaintyLevel)
      : (trackD.uncertaintyLevel.charAt(0).toUpperCase() + trackD.uncertaintyLevel.slice(1));
    reply.trackViewRisk = ar
      ? `عدم يقين ${uncTr} — ${trackD.primaryRisk}`
      : `${uncTr} uncertainty — ${trackD.primaryRisk}`;
  }

  if (!reply.trackViewPositioning && trackE) {
    reply.trackViewPositioning = trackE.sentimentSignal;
  }

  // Phase 4: Portfolio Alignment (Track F) — deterministic backfill
  if (!reply.trackViewPortfolio && trackF) {
    const alignTr = lang === "ar"
      ? ({ aligned: "متوافق", divergent: "متعارض", mixed: "مختلط" }[trackF.portfolioAlignmentBias] ?? trackF.portfolioAlignmentBias)
      : (trackF.portfolioAlignmentBias.charAt(0).toUpperCase() + trackF.portfolioAlignmentBias.slice(1));
    const concTr = lang === "ar"
      ? ({ low: "منخفض", moderate: "معتدل", high: "مرتفع" }[trackF.concentrationRisk] ?? trackF.concentrationRisk)
      : (trackF.concentrationRisk.charAt(0).toUpperCase() + trackF.concentrationRisk.slice(1));
    reply.trackViewPortfolio = lang === "ar"
      ? `توافق ${alignTr} — تركّز ${concTr}؛ ${trackF.alignmentNote}`
      : `${alignTr} portfolio alignment — ${concTr} concentration risk; ${trackF.alignmentNote}`;
  }

  // arbitrationReason: explain why dominant bias wins by naming the aligning tracks
  if (!reply.arbitrationReason) {
    const dom = consensus.dominantBias;
    const agreeing: string[] = [];
    if (trackA?.macroBias === dom) agreeing.push(ar ? "الكلي A" : "macro (A)");
    if (trackB?.technicalBias === dom) agreeing.push(ar ? "التقني B" : "technical (B)");
    if (trackC?.crossAssetBias === dom) agreeing.push(ar ? "متعدد الأصول C" : "cross-asset (C)");

    const dissenting: string[] = [];
    if (trackA && trackA.macroBias !== dom) dissenting.push(ar ? "الكلي A" : "macro (A)");
    if (trackB && trackB.technicalBias !== dom) dissenting.push(ar ? "التقني B" : "technical (B)");
    if (trackC && trackC.crossAssetBias !== dom) dissenting.push(ar ? "متعدد الأصول C" : "cross-asset (C)");

    const inv = trackD?.invalidationTrigger;
    const challenge = trackD?.confidenceChallenge ?? null;
    const weakness = trackD?.thesisWeakness ?? null;
    if (agreeing.length > 0) {
      if (ar) {
        const agreeStr = agreeing.join(" و");
        const disStr = dissenting.length > 0 ? `؛ ${dissenting.join(" و")} تختلف` : "";
        const limitAr = challenge
          ? ` القيد المتبقي: ${challenge.replace(/\.$/, "")}.`
          : weakness ? ` الافتراض الأضعف: ${weakness.replace(/\.$/, "")}.` : "";
        reply.arbitrationReason = `الأطروحة الأساسية تتفوق لأن ${agreeStr} تشير إلى توجه ${biasTr(dom, ar)}${disStr}؛ الحالة المضادة تُقلّل من وزن ${challenge ? "هذا التقاطع" : "الإجماع المرجّح"}.${inv ? ` محفز الإلغاء (${inv}) لم يُفعَّل بعد.` : ""}${limitAr}`.trim();
      } else {
        const agreeStr = agreeing.join(", ");
        const disStr = dissenting.length > 0 ? `; ${dissenting.join(", ")} dissent` : "";
        const limitEn = challenge
          ? ` Remaining constraint: ${challenge.replace(/\.$/, "").toLowerCase()}.`
          : weakness ? ` Key weakness acknowledged: ${weakness.replace(/\.$/, "").toLowerCase()}.` : "";
        reply.arbitrationReason = `The base case wins because ${agreeStr} all point ${dom}${disStr}; the opposing case underweights the cross-track alignment weight.${inv ? ` Invalidation trigger ("${inv}") has not been breached.` : ""}${limitEn}`.trim();
      }
    } else {
      const limitFallback = challenge ?? weakness;
      reply.arbitrationReason = ar
        ? `الأطروحة الأساسية تعتمد على الإجماع المرجّح (${consensus.agreementScore}%) رغم التباين؛${limitFallback ? ` القيد: ${limitFallback.replace(/\.$/, "")}.` : " وزن الأدلة يُرجّح الحالة الأساسية."}`
        : `The base case rests on weighted consensus (${consensus.agreementScore}% agreement);${limitFallback ? ` limiting factor: ${limitFallback.replace(/\.$/, "").toLowerCase()}.` : " evidence weight favours the base case."}`;
    }
  }

  // disagreementMap: one string per track pair with explicit directional conflict
  if (!reply.disagreementMap || reply.disagreementMap.length === 0) {
    const map: string[] = [];
    if (trackA && trackB && trackA.macroBias !== trackB.technicalBias) {
      map.push(ar
        ? `الكلي A (${biasTr(trackA.macroBias, ar)}) vs التقني B (${biasTr(trackB.technicalBias, ar)})`
        : `Track A (${trackA.macroBias} macro) vs Track B (${trackB.technicalBias} technical)`);
    }
    if (trackA && trackC && trackA.macroBias !== trackC.crossAssetBias) {
      map.push(ar
        ? `الكلي A (${biasTr(trackA.macroBias, ar)}) vs متعدد الأصول C (${biasTr(trackC.crossAssetBias, ar)})`
        : `Track A (${trackA.macroBias} macro) vs Track C (${trackC.crossAssetBias} cross-asset)`);
    }
    if (trackB && trackC && trackB.technicalBias !== trackC.crossAssetBias) {
      map.push(ar
        ? `التقني B (${biasTr(trackB.technicalBias, ar)}) vs متعدد الأصول C (${biasTr(trackC.crossAssetBias, ar)})`
        : `Track B (${trackB.technicalBias} technical) vs Track C (${trackC.crossAssetBias} cross-asset)`);
    }
    if (map.length > 0) reply.disagreementMap = map;
  }
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
  trackF: TrackF | null,
  consensus: ConsensusResult,
  live: LiveMarketState | null,
  eceScore?: number,
): Promise<GenesisReply | null> {
  const confAnchor = computeConfidenceFromTracks(trackA, trackB, trackD, consensus, trackF, eceScore, live?.marketStateQuality);
  const msq = live?.marketStateQuality ?? "inferred";
  const msqDetail = live
    ? `${msq} (${live.sourcesLive} data sources confirmed: ${[live.btcPrice ? "BTC" : null, live.goldPrice ? "Gold" : null, live.eurUsd ? "EUR/USD" : null, live.spyPrice ? "SPY" : null, live.tltPrice ? "TLT" : null, live.oilPrice ? "Oil" : null].filter(Boolean).join(", ")})`
    : "inferred (no live market data available — reason from question context only; downgrade confidence by ≥5 pts)";

  const trackLines = [
    trackA ? `MACRO (Track A): regime=${trackA.regime} conf=${trackA.regimeConf}% bias=${trackA.macroBias} | credit_stress=${trackA.creditStressLevel ?? "n/a"} | rates: ${trackA.ratesEnv} | oil/liquidity: ${trackA.oilLiquidity} | dxy: ${trackA.dxyImpact ?? "n/a"} | ${trackA.macroSummary}` : null,
    trackB ? `TECHNICAL (Track B): ${trackB.technicalBias} bias | trend_strength=${trackB.trendStrength}/100 | momentum=${trackB.momentumStrength}/100 | vol_regime=${trackB.volatilityRegime} | ${trackB.technicalNote}` : null,
    trackC ? `CROSS-ASSET (Track C): ${trackC.crossAssetBias} bias | interaction=${trackC.assetInteractionMode ?? "n/a"} | gold: ${trackC.goldSignal} | BTC: ${trackC.btcSignal} | DXY: ${trackC.dxyPressure} | correlation: ${trackC.correlationNote}` : null,
    trackD ? `RISK/COUNTER (Track D): uncertainty=${trackD.uncertaintyLevel} | primary_risk: ${trackD.primaryRisk} | weakness: ${trackD.thesisWeakness} | counter: ${trackD.counterCase} | invalidation: ${trackD.invalidationTrigger} | confidence_challenge: ${trackD.confidenceChallenge}` : null,
    trackE ? `POSITIONING/SENTIMENT (Track E): sentiment=${trackE.sentimentSignal} | uncertainty: ${trackE.uncertaintyNote} | counter_thesis: ${trackE.counterThesis} | missing: ${trackE.missingEvidence}` : null,
    trackF ? `PORTFOLIO ALIGNMENT (Track F): alignment=${trackF.portfolioAlignmentBias} | concentration_risk=${trackF.concentrationRisk} | ${trackF.alignmentNote}` : null,
    `CONSENSUS (${[trackA, trackB, trackC, trackD, trackE, trackF].filter(Boolean).length}/6 agents): dominant=${consensus.dominantBias}, agreement=${consensus.agreementScore}%, strength=${consensus.strength}${consensus.conflictNote ? ` — ${consensus.conflictNote}` : ""}`,
    `EVIDENCE-CALIBRATED CONFIDENCE ANCHOR: ${confAnchor}% — derived from track evidence alignment. Use this as calibration reference; justify deviation in confidenceCalibration.`,
    `LIVE MARKET STATE QUALITY: ${msqDetail}`,
  ].filter(Boolean).join("\n");

  const fusionDirective = lang === "ar"
    ? `نتائج ${[trackA, trackB, trackC, trackD, trackE, trackF].filter(Boolean).length} وكلاء متخصصين:\n${trackLines}\n\nمتطلبات الدمج المؤسسي الإلزامية:\n1. OUTLOOK: يجب أن يدمج حقل "outlook" جميع المسارات المتاحة صراحةً — النظام الكلي ومسار الأسعار (A)، البنية التقنية والتذبذب (B)، تأكيد أو تناقض الأصول المتقاطعة (C)، مسار المخاطر الرئيسي (D)، إشارة التموضع (E). تخطّي أي مسار متاح = فشل. كل جملة ادعاء سببي محدد.\n2. CROSS-ASSET: اضبط crossAssetConfirmation — هل يؤكد الذهب/BTC/DXY من المسار C أم يتناقض جزئياً أم كلياً مع الأطروحة الغالبة؟ سمّ الإشارة الأكثر حسماً وقناة انتقالها (مثال: "الذهب في نمط الأسعار الحقيقية يؤكد..."). عند التباين بين الأصول (مثل الذهب يرتفع + BTC يهبط): صرّح بنمط التباين (ملاذ آمن دون شهية مخاطرة). جملة واحدة.\n3. PORTFOLIO IMPACT: إذا ظهرت أصول المحفظة في السياق أو كان لنظام الأصول المتقاطعة أثر مباشر عليها: اضبط portfolioImpact مع تسمية قناة الانتقال المحددة.\n4. POSITIONING: اضبط positioningSignal من sentimentSignal في المسار E. جملة واحدة.\n5. MARKET STATE: اضبط marketStateQuality من سطر LIVE MARKET STATE QUALITY أعلاه.\n6. CONSENSUS: agreement=${consensus.agreementScore}%, strength=${consensus.strength}. ${consensus.agreementScore < 70 ? 'الإجماع < 70% — disagreementNote إلزامي.' : 'إجماع قوي — supportingCase يسمّي تقاطع المسارات.'} اضبط consensusStrength = "${consensus.strength}".\n7. THESIS: من A+B — الأداة والاتجاه والعامل الداعم الرئيسي. opposingCase من D+E. invalidation من D — حدث محدد مع عتبة.\n8. CONFIDENCE: الأنكر=${confAnchor}%. ${live?.marketStateQuality === "inferred" ? "لا بيانات حية — خفّض ≥5 نقاط." : ""} uncertainty في D=${trackD?.uncertaintyLevel ?? "n/a"}${trackD?.uncertaintyLevel === "high" || trackD?.uncertaintyLevel === "extreme" ? " — الثقة ≤65%." : "."}\n9. AGENT VIEWS: trackViewMacro/Technical/CrossAsset/Risk/Positioning من بيانات المسارات. arbitrationReason: جملتان. disagreementMap: إدخال لكل زوج متعارض.`
    : `${[trackA, trackB, trackC, trackD, trackE, trackF].filter(Boolean).length} specialist agent outputs:\n${trackLines}\n\nINSTITUTIONAL SYNTHESIS REQUIREMENTS — all mandatory:\n\n1. OUTLOOK: Must synthesize ALL available tracks — macro regime + rate/liquidity + credit stress (A), technical structure + volatility (B), cross-asset mode + interaction (C), primary downside path (D), positioning timing (E). Omitting any available track is a failure. Every sentence states a specific causal or conditional claim.\n\n2. CROSS-ASSET: Set "crossAssetConfirmation" — does gold/BTC/DXY from Track C CONFIRM, PARTIALLY CONFIRM, or CONTRADICT the dominant thesis from A+B? Name the most decisive signal and its transmission mechanism. If assetInteractionMode is "diverging": explicitly interpret what the divergence means (e.g., safe-haven bid without risk appetite = macro stress). 1 sentence.\n\n3. PORTFOLIO IMPACT: If portfolio/watchlist assets appear in context OR if the cross-asset regime has a direct implication for those assets: set "portfolioImpact" naming the specific transmission channel (e.g., "oil→fiscal headwind for TASI holdings", "DXY strength headwind for BTC position").\n\n4. POSITIONING: Set "positioningSignal" from Track E sentimentSignal. 1 sentence.\n\n5. MARKET STATE: Set "marketStateQuality" from LIVE MARKET STATE QUALITY line above.\n\n6. CONSENSUS: agreement=${consensus.agreementScore}%, strength=${consensus.strength}. ${consensus.agreementScore < 70 ? `Below 70% — "disagreementNote" MANDATORY.` : `Strong — "supportingCase" names the specific cross-track alignment.`} Set "consensusStrength" = "${consensus.strength}".\n\n7. THESIS: instrument + direction + primary supporting factor. "opposingCase" from D+E. "invalidation" from Track D — specific event + measurable threshold.\n\n8. CONFIDENCE: anchor=${confAnchor}%. ${live?.marketStateQuality === "inferred" ? "NO LIVE DATA — reduce ≥5 pts." : ""} Track D uncertainty=${trackD?.uncertaintyLevel ?? "n/a"}${trackD?.uncertaintyLevel === "high" || trackD?.uncertaintyLevel === "extreme" ? " — cap: 65%." : "."}\n\n9. AGENT ARBITRATION FIELDS: trackViewMacro/Technical/CrossAsset/Risk/Positioning from track data. "arbitrationReason": 1-2 sentences naming the decisive cross-track factor. "disagreementMap": one entry per conflicting track pair.`;

  const sys = buildGenesisSystemPrompt(lang);
  const userBody = [
    `User question: ${question}`,
    ctx ? `\nLive market context:\n${ctx}` : "",
    `\n\n${fusionDirective}`,
  ].join("");
  const user = wrapUserContext(lang, userBody);

  const res = await withTimeout(
    callAIGateway<GenesisReply>({ system: sys, user, language: lang, jsonObject: true, maxTokens: 4096, temperature: 0.4 }),
    12000,
  );
  if (!res || res.error || !res.data) return null;

  // Safe debug: log Phase-12 field coverage before and after sanitize (no secrets)
  const _p12 = ["trackViewMacro","trackViewTechnical","trackViewCrossAsset","trackViewRisk","trackViewPositioning","arbitrationReason","disagreementMap","marketStateQuality"] as const;
  const _preSet = _p12.filter(k => { const v = (res.data as Record<string,unknown>)[k]; return v != null && v !== "" && !(Array.isArray(v) && (v as unknown[]).length === 0); });
  console.log(`[genesis:p12] Gemini populated: ${_preSet.join(",")||"none"}`);

  const sanitized = sanitizeReply(res.data, lang);
  if (!sanitized) return null;

  const _postSet = _p12.filter(k => { const v = (sanitized as Record<string,unknown>)[k]; return v != null && v !== "" && !(Array.isArray(v) && (v as unknown[]).length === 0); });
  console.log(`[genesis:p12] post-sanitize: ${_postSet.join(",")||"none"}`);

  // Deterministic backfill — fills every missing Phase-12 field from raw track outputs
  fillArbitrationFields(sanitized, trackA, trackB, trackC, trackD, trackE, trackF, consensus, lang);

  const _finalSet = _p12.filter(k => { const v = (sanitized as Record<string,unknown>)[k]; return v != null && v !== "" && !(Array.isArray(v) && (v as unknown[]).length === 0); });
  console.log(`[genesis:p12] post-fill: ${_finalSet.join(",")||"none"}`);

  return sanitized;
}

// ─── Server function ───────────────────────────────────────────────────────

export const askGenesis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AskInput.parse(d))
  .handler(async ({ data, context }) => {
    const lang = data.language as Lang;
    const userId = (context as { userId?: string }).userId ?? "anon";
    // Resolve provider once so all return paths can surface it to the UI.
    const provider: AIProvider | undefined = resolveAIProvider()?.provider;

    // Server-side emergency kill switch — set AI_DISABLED=true in Railway secrets to disable AI.
    if (process.env.AI_DISABLED === "true") {
      return { reply: heuristicReply(lang), error: null as null, engine: "heuristic" as const };
    }

    // Server-side rate limit (per user, per isolate). One check covers all tracks.
    if (!checkAiRateLimit(userId)) {
      return { reply: null, error: "rate_limited" as const, engine: "heuristic" as const };
    }

    // ── Phase 4: Express vs Detailed mode ──────────────────────────────────────
    // brief → tracks A+C+D only (express, target <8s).
    // detailed → all 6 tracks A–F (full analysis).
    const isExpress = data.responseStyle === "brief";

    // ── Multi-agent parallel path ── live market + specialist agents ──────────
    // Always runs unconditionally: Phase-12 arbitration fields require track outputs.
    // Tracks skipped in express mode resolve to null via Promise.resolve(null).
    const [liveSettled, settledA, settledB, settledC, settledD, settledE, settledF] = await Promise.allSettled([
      withTimeout(buildLiveMarketState(), 6000),
      runTrackA(lang, data.question, data.marketContext, null),
      isExpress ? Promise.resolve(null) : runTrackB(lang, data.question, data.marketContext, null),
      runTrackC(lang, data.question, data.marketContext, null),
      runTrackD(lang, data.question, data.marketContext, null),
      isExpress ? Promise.resolve(null) : runTrackE(lang, data.question, data.marketContext, null),
      isExpress ? Promise.resolve(null) : runTrackF(lang, data.question, data.marketContext),
    ]);

    const live = (liveSettled.status === "fulfilled" ? liveSettled.value : null) ?? null;
    const trackA = settledA.status === "fulfilled" ? settledA.value : null;
    const trackB = settledB.status === "fulfilled" ? settledB.value : null;
    const trackC = settledC.status === "fulfilled" ? settledC.value : null;
    const trackD = settledD.status === "fulfilled" ? settledD.value : null;
    const trackE = settledE.status === "fulfilled" ? settledE.value : null;
    const trackF = settledF.status === "fulfilled" ? settledF.value : null;
    const tracksUsed = [trackA, trackB, trackC, trackD, trackE, trackF].filter(Boolean).length;

    // Pure consensus engine — no AI call, runs on track outputs only.
    const consensus = computeConsensus(trackA, trackB, trackC, trackD, trackE);

    // Attempt fusion when at least one track succeeded.
    if (tracksUsed >= 1) {
      const fused = await runFusion(lang, data.question, data.marketContext, trackA, trackB, trackC, trackD, trackE, trackF, consensus, live, data.eceScore);
      if (fused?.headline) {
        fused.marketStateQuality = live?.marketStateQuality ?? fused.marketStateQuality ?? "inferred";
        return { reply: fused, error: null as null, engine: "ai" as const, tracksUsed, provider, dominantBias: consensus.dominantBias };
      }
    }
    // Graceful fallback to single-call if all tracks failed or fusion failed.

    // ── Standard single-call path (fallback: all tracks timed out or fusion failed) ───────
    const user = wrapUserContext(lang, [
      `User question: ${data.question}`,
      data.marketContext ? `\nLive market context:\n${data.marketContext}` : "",
    ].join(""));

    const result = await callAIGateway<GenesisReply>({
      system: buildGenesisSystemPrompt(lang),
      user,
      language: lang,
      jsonObject: true,
      maxTokens: 4096,
      temperature: 0.4,
    });

    if (result.error === "rate_limited") return { reply: null, error: "rate_limited" as const, engine: "heuristic" as const };
    if (result.error === "payment_required") return { reply: null, error: "payment_required" as const, engine: "heuristic" as const };
    // missing_key → AI was never available; show the "key not configured" warning.
    if (result.error === "missing_key") {
      return { reply: heuristicReply(lang, "missing_key"), error: null as null, engine: "heuristic" as const };
    }
    // ai_error / network_error → Gemini is configured but the call failed; use a
    // heuristic labelled as a temporary outage, not "key not configured".
    if (result.error === "ai_error" || result.error === "network_error") {
      return { reply: heuristicReply(lang, "ai_unavailable"), error: null as null, engine: "heuristic" as const };
    }

    // error is null or parse_error — result.data is set on success, raw always carries
    // the original response string. Run sanitizeReply so JSON-looking string values
    // (empty headline, raw object in outlook) never reach the UI renderer.
    const rawParsed = result.data ?? (result.raw ? safeParseJson<GenesisReply>(result.raw) : null);
    const direct = rawParsed ? sanitizeReply(rawParsed, lang) : null;
    if (direct) {
      // Badge always visible: brief-mode has no live data so always "inferred"
      if (!direct.marketStateQuality) direct.marketStateQuality = "inferred";
      return { reply: direct, error: null as null, engine: "ai" as const, provider };
    }

    // Sanitize rejected the parsed object (headline missing / JSON-like) — log it
    // and try the brace-counting extractor + plain-text mapper before giving up.
    if (result.raw) {
      console.warn(`[genesis] provider=${provider} sanitize rejected or parse failed — raw_preview="${result.raw.slice(0, 400)}"`);
      const recovered = recoverGenesisReply(result.raw, lang);
      if (recovered) {
        if (!recovered.marketStateQuality) recovered.marketStateQuality = "inferred";
        return { reply: recovered, error: null as null, engine: "ai" as const, provider };
      }
    }

    // Full recovery failed — show heuristic labelled appropriately.
    return { reply: heuristicReply(lang, provider ? "ai_unavailable" : "missing_key"), error: null as null, engine: "heuristic" as const };
  });
