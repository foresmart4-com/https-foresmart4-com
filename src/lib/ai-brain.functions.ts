// AI server functions for the AI Investment Brain.
// Four endpoints — all run server-side, secrets stay in process.env:
//   - aiMarketAnalyst     → institutional market outlook
//   - aiNewsAnalysis      → deep per-news analysis
//   - aiSignalExplainer   → reasoning behind a trading signal
//   - aiMarketInsights    → rotating short-form insights
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callAIGateway } from "@/lib/ai-gateway.server";

// ---------- Schemas ----------
const AssetCtx = z.object({
  key: z.string(),
  name: z.string(),
  price: z.number(),
  changePct: z.number(),
  momentum: z.number(),
  volatility: z.number(),
  trend: z.string().optional(),
});

const NewsCtx = z.object({
  headline: z.string(),
  asset: z.string(),
  sentiment: z.string(),
  impact: z.string(),
  impactScore: z.number(),
});

const CorrelationCtx = z.object({
  a: z.string(), b: z.string(),
  coefficient: z.number(), kind: z.string(), strength: z.number(),
});

const OpportunityCtx = z.object({
  asset: z.string(), assetName: z.string(),
  kind: z.string(), score: z.number(), entryBias: z.string(),
});

const MarketContext = z.object({
  language: z.enum(["ar", "en"]).default("en"),
  quotes: z.array(AssetCtx).max(12),
  sentiment: z.object({ score: z.number(), zone: z.string() }),
  news: z.array(NewsCtx).max(8),
  correlations: z.array(CorrelationCtx).max(8),
  opportunities: z.array(OpportunityCtx).max(8),
});

const SignalInput = z.object({
  language: z.enum(["ar", "en"]).default("en"),
  asset: z.string(), assetName: z.string(),
  action: z.string(),
  rsi: z.number(), macd: z.number(),
  momentum: z.number(), volatility: z.number(),
  newsBias: z.number(), confidence: z.number(), risk: z.number(),
  sentimentZone: z.string().optional(),
});

const NewsAnalysisInput = z.object({
  language: z.enum(["ar", "en"]).default("en"),
  headline: z.string(),
  asset: z.string(),
  sentiment: z.string(),
  impactScore: z.number(),
});

// ---------- Output types ----------
export interface MarketAnalystOutput {
  outlook: string;
  bullishShifts: string[];
  bearishShifts: string[];
  macroInterpretation: string;
  riskAnalysis: string;
  capitalRotation: string;
  confidence: number; // 0-100
}

export interface NewsAnalysisOutput {
  whyItMatters: string;
  affectedAssets: string[];
  shortTermImpact: string;
  mediumTermImpact: string;
  uncertainty: string;
}

export interface SignalExplanationOutput {
  reasoning: string;
  confidenceExplanation: string;
  riskReward: string;
}

export interface MarketInsightItem {
  text: string;
  asset?: string;
  tone: "bullish" | "bearish" | "neutral";
}
export interface MarketInsightsOutput { insights: MarketInsightItem[] }

// ---------- Server functions ----------

export const aiMarketAnalyst = createServerFn({ method: "POST" })
  .inputValidator((input) => MarketContext.parse(input))
  .handler(async ({ data }) => {
    const ar = data.language === "ar";
    const sys = ar
      ? `أنت محلل سوق مالي مؤسسي. حلّل السياق الشامل وأرجع JSON صالحاً فقط بالمخطط:
{ "outlook": string, "bullishShifts": string[], "bearishShifts": string[], "macroInterpretation": string, "riskAnalysis": string, "capitalRotation": string, "confidence": number }
لا تستخدم لغة تأكيدية. استخدم لغة احتمالية، واذكر المخاطر دائماً.`
      : `You are an institutional market analyst. Analyse the full cross-asset context. Reply with valid JSON ONLY matching:
{ "outlook": string, "bullishShifts": string[], "bearishShifts": string[], "macroInterpretation": string, "riskAnalysis": string, "capitalRotation": string, "confidence": number }
Probabilistic language only. Frame risk vs. reward. No certainty.`;

    const user = JSON.stringify({
      sentiment: data.sentiment,
      quotes: data.quotes,
      topNews: data.news.slice(0, 5),
      correlations: data.correlations.slice(0, 5),
      opportunities: data.opportunities.slice(0, 5),
    });
    return callAIGateway<MarketAnalystOutput>({ system: sys, user, jsonObject: true, maxTokens: 900 });
  });

export const aiNewsAnalysis = createServerFn({ method: "POST" })
  .inputValidator((input) => NewsAnalysisInput.parse(input))
  .handler(async ({ data }) => {
    const ar = data.language === "ar";
    const sys = ar
      ? `أنت محلل أخبار مالية. حلّل الخبر التالي وأرجع JSON صالحاً فقط:
{ "whyItMatters": string, "affectedAssets": string[], "shortTermImpact": string, "mediumTermImpact": string, "uncertainty": string }`
      : `You are a financial news analyst. Analyse the headline below. Reply with valid JSON ONLY:
{ "whyItMatters": string, "affectedAssets": string[], "shortTermImpact": string, "mediumTermImpact": string, "uncertainty": string }`;
    const user = JSON.stringify(data);
    return callAIGateway<NewsAnalysisOutput>({ system: sys, user, jsonObject: true, maxTokens: 500 });
  });

export const aiSignalExplainer = createServerFn({ method: "POST" })
  .inputValidator((input) => SignalInput.parse(input))
  .handler(async ({ data }) => {
    const ar = data.language === "ar";
    const sys = ar
      ? `أنت متداول مؤسسي. اشرح سبب هذه الإشارة بناءً على البيانات وأرجع JSON صالحاً فقط:
{ "reasoning": string, "confidenceExplanation": string, "riskReward": string }`
      : `You are an institutional trader. Explain why this signal exists from the inputs. Reply with valid JSON ONLY:
{ "reasoning": string, "confidenceExplanation": string, "riskReward": string }`;
    const user = JSON.stringify(data);
    return callAIGateway<SignalExplanationOutput>({ system: sys, user, jsonObject: true, maxTokens: 450 });
  });

export const aiMarketInsights = createServerFn({ method: "POST" })
  .inputValidator((input) => MarketContext.parse(input))
  .handler(async ({ data }) => {
    const ar = data.language === "ar";
    const sys = ar
      ? `أنت محلل استثمار مؤسسي. أنتج 5 رؤى قصيرة دوّارة (جملة واحدة لكل رؤية) عن السوق الحالي. أرجع JSON صالحاً فقط:
{ "insights": [{ "text": string, "asset": string|null, "tone": "bullish"|"bearish"|"neutral" }] }
استخدم لغة احتمالية.`
      : `You are an institutional analyst. Produce 5 short rotating insights (one sentence each) about the current market. Reply with valid JSON ONLY:
{ "insights": [{ "text": string, "asset": string|null, "tone": "bullish"|"bearish"|"neutral" }] }
Probabilistic language only.`;
    const user = JSON.stringify({
      sentiment: data.sentiment,
      quotes: data.quotes.slice(0, 7),
      news: data.news.slice(0, 4),
    });
    return callAIGateway<MarketInsightsOutput>({ system: sys, user, jsonObject: true, maxTokens: 500 });
  });
