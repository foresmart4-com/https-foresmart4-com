// Genesis Intelligence Engine — Phase A+D
// Calls Gemini AI to produce institutional scores replacing placeholder math.
// Phase D adds structured economic algorithm layer underneath Gemini.
// Server-side only. Uses same callAIGateway pattern as genesis.functions.ts.

import { callAIGateway, safeParseJson } from "@/lib/ai-gateway.server";
import {
  buildMacroContextFromScores,
  buildAssetContextFromQuote,
  type MacroContext,
} from "@/lib/genesis100/algorithms/economicFramework";
import { analyzeAllSchools } from "@/lib/genesis100/algorithms/economicSchools";
import {
  getDynamicWeights,
  buildConsensus,
  type ConsensusWeights,
} from "@/lib/genesis100/algorithms/consensusEngine";
import { calculateOptimalPosition } from "@/lib/genesis100/algorithms/riskManagement";
import type { OptimalPositionOutput } from "@/lib/genesis100/algorithms/riskManagement";

export interface GenesisIntelligenceInput {
  symbol: string;
  assetClass: string;
  marketRegion: string;
  price: number | null;
  changePercent: number | null;
  provider: string | null;
  providerReliable: boolean;
  portfolioContext: {
    totalCapital: number;
    currentAllocation: number;
    riskBudgetRemaining: number;
  };
  // Phase E — optional real macro context and learned weights from previous cycles
  realMacroContext?: MacroContext;
  learnedWeightHints?: Partial<ConsensusWeights>;
}

export interface GenesisIntelligenceOutput {
  macroScore: number;           // 0-100, higher = better macro environment
  sentimentScore: number;       // 0-100, higher = more bullish
  fundamentalsScore: number;    // 0-100, higher = stronger fundamentals
  schoolsConsensus: number;     // 0-100, average across 6 schools
  geopoliticalRisk: number;     // 0-100, higher = more risk
  confidenceInAnalysis: number; // 0-100, AI confidence given available data
  arabicReasoning: string;      // Full Arabic institutional analysis
  keyRisks: string[];           // Arabic risk list (max 5)
  keyOpportunities: string[];   // Arabic opportunity list (max 5)
  schoolsBreakdown: {
    keynesian: number;
    monetarist: number;
    austrian: number;
    behavioral: number;
    valueinvesting: number;
    globalMacro: number;
  };
  dataQualityWarning: string | null;
  analysisTimestamp: number;
  geminiUsed: boolean;
  // Phase D — structured economic algorithm layer
  consensusAgreementLevel: "strong" | "moderate" | "weak" | "conflicted" | null;
  dominantSchool: string | null;
  conflictingSchools: string[];
  structuredConsensusScore: number | null;
  riskProfile: OptimalPositionOutput | null;
}

// 5-minute in-memory cache per symbol (keyed by symbol + 5-min bucket)
const _cache = new Map<string, GenesisIntelligenceOutput>();

function cacheKey(symbol: string): string {
  return `${symbol}-${Math.floor(Date.now() / 300_000)}`;
}

function clamp0100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function neutralFallback(
  warning?: string,
  symbol?: string,
  assetClass?: string,
  marketRegion?: string,
  price?: number | null,
  changePercent?: number | null,
  realMacroCtx?: MacroContext,
): GenesisIntelligenceOutput {
  // Phase D/E: run structured schools even when Gemini is unavailable
  const macroCtxFallback = realMacroCtx ?? buildMacroContextFromScores(50, 50, 50);
  const assetCtxFallback = buildAssetContextFromQuote(
    symbol ?? "UNKNOWN",
    assetClass ?? "us_stock",
    marketRegion ?? "Global",
    price ?? null,
    changePercent ?? null,
    null,
  );
  const schoolsFallback = analyzeAllSchools(assetCtxFallback, macroCtxFallback);

  return {
    macroScore: 50,
    sentimentScore: 50,
    fundamentalsScore: 50,
    schoolsConsensus: 50,
    geopoliticalRisk: 50,
    confidenceInAnalysis: 20,
    arabicReasoning:
      "تعذر الحصول على تحليل الذكاء الاصطناعي. يتم استخدام التقييم الاحترازي المحايد.",
    keyRisks: ["عدم توفر بيانات كافية للتحليل الكامل"],
    keyOpportunities: ["قد تظهر فرص عند استعادة الاتصال بنموذج الذكاء الاصطناعي"],
    schoolsBreakdown: {
      keynesian: schoolsFallback.keynesian.score,
      monetarist: schoolsFallback.monetarist.score,
      austrian: schoolsFallback.austrian.score,
      behavioral: schoolsFallback.behavioral.score,
      valueinvesting: schoolsFallback.valueInvesting.score,
      globalMacro: schoolsFallback.globalMacro.score,
    },
    dataQualityWarning:
      warning ?? "تحليل احترازي بسبب عدم توفر نموذج الذكاء الاصطناعي",
    analysisTimestamp: Date.now(),
    geminiUsed: false,
    consensusAgreementLevel: null,
    dominantSchool: null,
    conflictingSchools: [],
    structuredConsensusScore: null,
    riskProfile: null,
  };
}

function validateAndClamp(raw: unknown): GenesisIntelligenceOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const numericFields = [
    "macroScore",
    "sentimentScore",
    "fundamentalsScore",
    "schoolsConsensus",
    "geopoliticalRisk",
    "confidenceInAnalysis",
  ] as const;
  for (const f of numericFields) {
    if (typeof obj[f] !== "number") return null;
  }
  if (typeof obj.arabicReasoning !== "string" || !obj.arabicReasoning.trim()) return null;
  if (!Array.isArray(obj.keyRisks)) return null;
  if (!Array.isArray(obj.keyOpportunities)) return null;
  if (!obj.schoolsBreakdown || typeof obj.schoolsBreakdown !== "object") return null;

  const sb = obj.schoolsBreakdown as Record<string, unknown>;
  for (const k of ["keynesian", "monetarist", "austrian", "behavioral", "valueinvesting", "globalMacro"]) {
    if (typeof sb[k] !== "number") return null;
  }

  return {
    macroScore: clamp0100(obj.macroScore as number),
    sentimentScore: clamp0100(obj.sentimentScore as number),
    fundamentalsScore: clamp0100(obj.fundamentalsScore as number),
    schoolsConsensus: clamp0100(obj.schoolsConsensus as number),
    geopoliticalRisk: clamp0100(obj.geopoliticalRisk as number),
    confidenceInAnalysis: clamp0100(obj.confidenceInAnalysis as number),
    arabicReasoning: String(obj.arabicReasoning).slice(0, 2000),
    keyRisks: (obj.keyRisks as unknown[])
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .slice(0, 5),
    keyOpportunities: (obj.keyOpportunities as unknown[])
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .slice(0, 5),
    schoolsBreakdown: {
      keynesian: clamp0100(sb.keynesian as number),
      monetarist: clamp0100(sb.monetarist as number),
      austrian: clamp0100(sb.austrian as number),
      behavioral: clamp0100(sb.behavioral as number),
      valueinvesting: clamp0100(sb.valueinvesting as number),
      globalMacro: clamp0100(sb.globalMacro as number),
    },
    dataQualityWarning:
      typeof obj.dataQualityWarning === "string" && obj.dataQualityWarning.trim()
        ? obj.dataQualityWarning
        : null,
    analysisTimestamp: Date.now(),
    geminiUsed: true,
    // Phase D fields populated after Gemini parse in analyzeAssetWithGemini()
    consensusAgreementLevel: null,
    dominantSchool: null,
    conflictingSchools: [],
    structuredConsensusScore: null,
    riskProfile: null,
  };
}

function runAlgorithmLayer(
  parsed: GenesisIntelligenceOutput,
  input: GenesisIntelligenceInput,
): GenesisIntelligenceOutput {
  // Phase E: use real FRED macro context when available, else derive from Gemini scores
  const macroCtx = input.realMacroContext ?? buildMacroContextFromScores(
    parsed.macroScore,
    parsed.sentimentScore,
    parsed.geopoliticalRisk,
  );
  const assetCtx = buildAssetContextFromQuote(
    input.symbol,
    input.assetClass,
    input.marketRegion,
    input.price,
    input.changePercent,
    null,
  );
  const schools = analyzeAllSchools(assetCtx, macroCtx);
  // Phase E: blend in learned weight hints from previous cycles
  const weights = getDynamicWeights(macroCtx, assetCtx, input.learnedWeightHints);
  const consensus = buildConsensus(schools, weights, assetCtx);

  const riskProfile = input.price
    ? calculateOptimalPosition({
        symbol: input.symbol,
        assetClass: input.assetClass,
        entryPrice: input.price,
        confidence: parsed.confidenceInAnalysis,
        portfolioCapital: input.portfolioContext.totalCapital,
        currentExposurePercent: input.portfolioContext.currentAllocation,
        historicalVolatility: 0,
        agreementLevel: consensus.agreementLevel,
      })
    : null;

  return {
    ...parsed,
    schoolsBreakdown: {
      keynesian: schools.keynesian.score,
      monetarist: schools.monetarist.score,
      austrian: schools.austrian.score,
      behavioral: schools.behavioral.score,
      valueinvesting: schools.valueInvesting.score,
      globalMacro: schools.globalMacro.score,
    },
    consensusAgreementLevel: consensus.agreementLevel,
    dominantSchool: consensus.dominantSchool,
    conflictingSchools: consensus.conflictingSchools,
    structuredConsensusScore: consensus.adjustedScore,
    riskProfile,
  };
}

export async function analyzeAssetWithGemini(
  input: GenesisIntelligenceInput,
): Promise<GenesisIntelligenceOutput> {
  const key = cacheKey(input.symbol);
  const cached = _cache.get(key);
  if (cached) return cached;

  const { symbol, assetClass, marketRegion, price, changePercent, provider, providerReliable, portfolioContext } = input;

  const priceStr = price != null ? `$${price.toFixed(4)}` : "غير متاح";
  const changeStr =
    changePercent != null
      ? `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`
      : "غير متاح";
  const dataWarning = !providerReliable
    ? "تحذير: بيانات السعر غير موثوقة أو مستخدم بديل. ارفع مستوى عدم اليقين."
    : "";

  const systemPrompt = `You are an institutional investment analyst for a corporate portfolio management system (Genesis 100, Raneem Capital Treasury). You analyze assets across multiple economic schools for paper trading analysis only. Return ONLY valid JSON — no markdown, no text outside the JSON object. The arabicReasoning, keyRisks, and keyOpportunities MUST be in formal institutional Arabic (فصحى). All numeric scores are integers 0-100.`;

  const userPrompt = `Analyze this asset for institutional portfolio management. Return ONLY a valid JSON object.

Asset: ${symbol}
Asset Class: ${assetClass}
Market Region: ${marketRegion}
Current Price: ${priceStr}
Price Change: ${changeStr}
Data Provider: ${provider ?? "none"} | Data Reliable: ${providerReliable}
${dataWarning}
Portfolio Context:
  Total Capital: $${portfolioContext.totalCapital.toLocaleString()}
  Current Allocation: ${portfolioContext.currentAllocation.toFixed(1)}%
  Risk Budget Remaining: ${portfolioContext.riskBudgetRemaining.toFixed(1)}%

Analyze from these institutional perspectives:
a) MACRO: interest rate environment, inflation trends, central bank stance (Fed/SAMA/ECB as relevant), liquidity conditions, risk-on vs risk-off regime for this asset class
b) SENTIMENT: price action interpretation, investor positioning, momentum signals
c) FUNDAMENTALS: sector structural strength, valuation context, earnings quality if equity, commodity supply/demand if commodity, yield dynamics if fixed income
d) SCHOOLS (score each 0-100 independently):
   - Keynesian: demand-side macro support for this asset now
   - Monetarist: money supply / rate dynamics favor or oppose
   - Austrian: capital structure / malinvestment / sound money lens
   - Behavioral: sentiment extremes, herd behavior, cognitive biases at play
   - Value Investing: margin of safety, intrinsic value relative to price
   - Global Macro: cross-asset regime, USD dynamics, commodity-equity rotation
e) GEOPOLITICAL: region-specific political risk, sanctions, trade tensions, regulatory changes
f) KEY RISKS and KEY OPPORTUNITIES (3 risks, 2 opportunities, all in Arabic)

REQUIRED: Include in arabicReasoning: "هذا تحليل استشاري وليس ضمانًا للأرباح — محاكاة ورقية فقط"

Return ONLY this exact JSON structure:
{
  "macroScore": <integer 0-100>,
  "sentimentScore": <integer 0-100>,
  "fundamentalsScore": <integer 0-100>,
  "schoolsConsensus": <integer 0-100, weighted average of 6 schools>,
  "geopoliticalRisk": <integer 0-100, higher = more risk>,
  "confidenceInAnalysis": <integer 0-100, your confidence given data quality>,
  "arabicReasoning": "<3-4 sentences comprehensive analysis in formal Arabic>",
  "keyRisks": ["<Arabic risk 1>", "<Arabic risk 2>", "<Arabic risk 3>"],
  "keyOpportunities": ["<Arabic opportunity 1>", "<Arabic opportunity 2>"],
  "schoolsBreakdown": {
    "keynesian": <integer 0-100>,
    "monetarist": <integer 0-100>,
    "austrian": <integer 0-100>,
    "behavioral": <integer 0-100>,
    "valueinvesting": <integer 0-100>,
    "globalMacro": <integer 0-100>
  },
  "dataQualityWarning": ${!providerReliable ? '"بيانات السعر غير موثوقة، التحليل احترازي"' : "null"},
  "analysisTimestamp": ${Date.now()},
  "geminiUsed": true
}`;

  try {
    const result = await callAIGateway<GenesisIntelligenceOutput>({
      system: systemPrompt,
      user: userPrompt,
      jsonObject: true,
      temperature: 0.3,
      maxTokens: 1400,
    });

    if (result.error || !result.data) {
      console.warn(`[genesis-intelligence] Gemini unavailable for ${symbol}: ${result.error}`);
      return neutralFallback(undefined, symbol, input.assetClass, input.marketRegion, input.price, input.changePercent, input.realMacroContext);
    }

    // Try parsed data first, then fallback to raw extraction
    const validated =
      validateAndClamp(result.data) ??
      (result.raw ? validateAndClamp(safeParseJson(result.raw)) : null);

    if (!validated) {
      console.warn(`[genesis-intelligence] Validation failed for ${symbol}`);
      return neutralFallback("تعذر استخراج التحليل المنظم من استجابة النموذج", symbol, input.assetClass, input.marketRegion, input.price, input.changePercent, input.realMacroContext);
    }

    // Phase D/E: run structured economic algorithm layer (with real macro + learned weights)
    const withAlgorithms = runAlgorithmLayer(validated, input);
    _cache.set(key, withAlgorithms);
    console.info(
      `[genesis-intelligence] ${symbol} → macro=${validated.macroScore} sentiment=${validated.sentimentScore} fundamentals=${validated.fundamentalsScore} consensus=${withAlgorithms.consensusAgreementLevel} dominant=${withAlgorithms.dominantSchool} gemini=true`,
    );
    return withAlgorithms;
  } catch (err) {
    console.error(`[genesis-intelligence] Unexpected error for ${symbol}:`, err);
    return neutralFallback(undefined, symbol, input.assetClass, input.marketRegion, input.price, input.changePercent, input.realMacroContext);
  }
}
