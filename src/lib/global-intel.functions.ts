// Server function: synthesizes a global macro narrative from a snapshot.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callAIGateway } from "@/lib/ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildLocaleSystemPrompt, resolveLang } from "@/lib/ai/locale";

const Input = z.object({
  language: z.enum(["ar", "en"]).default("en"),
  generatedAt: z.number(),
  geoEvents: z.array(z.object({
    kind: z.string(), headline: z.string(), severity: z.string(),
    region: z.string(), marketImpact: z.string(),
  })).max(8),
  econEvents: z.array(z.object({
    indicator: z.string(), region: z.string(), value: z.number(),
    surprise: z.number().optional(), marketImpact: z.string(),
  })).max(8),
  weatherEvents: z.array(z.object({
    kind: z.string(), region: z.string(), severity: z.string(),
    supplyChainRisk: z.number(),
  })).max(6),
  topOpportunities: z.array(z.object({
    asset: z.string(), assetName: z.string(), bias: z.string(),
    confidence: z.number(), expectedReturn: z.number(),
    kind: z.string(), drivers: z.array(z.string()).max(4),
  })).max(6),
});

export const aiGlobalNarrative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const langLabel = data.language === "ar" ? "Arabic" : "English";
    const system = `You are the chief strategist of an institutional macro desk. Produce a concise, calibrated global market briefing in ${langLabel}. Always frame as probabilistic bias, never certainty.`;

    const user = `Build a global briefing. Use the snapshot below. Return JSON:
{
  "headline": string,
  "regime": "risk-on" | "risk-off" | "rotation" | "uncertain",
  "narrative": string,                 // 4-6 sentences
  "topBias": [ { "asset": string, "bias": string, "confidence": number, "why": string } ],
  "watchlist": [ string ],             // 3-5 items investors should monitor next 24-72h
  "riskFactors": [ string ]
}

Snapshot:
${JSON.stringify({
  geo: data.geoEvents,
  econ: data.econEvents,
  weather: data.weatherEvents,
  opps: data.topOpportunities,
}, null, 2)}`;

    const res = await callAIGateway<{
      headline: string; regime: string; narrative: string;
      topBias: Array<{ asset: string; bias: string; confidence: number; why: string }>;
      watchlist: string[]; riskFactors: string[];
    }>({
      system, user,
      model: "google/gemini-2.5-flash",
      jsonObject: true, temperature: 0.4, maxTokens: 900,
    });

    return { result: res.data, error: res.error };
  });
