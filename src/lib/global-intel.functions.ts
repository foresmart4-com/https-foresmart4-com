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
    const lang = resolveLang(data);
    const schema = `{
  "headline": string,
  "regime": "risk-on" | "risk-off" | "rotation" | "uncertain",
  "narrative": string,
  "topBias": [ { "asset": string, "bias": string, "confidence": number, "why": string } ],
  "watchlist": [ string ],
  "riskFactors": [ string ]
}`;
    const system = buildLocaleSystemPrompt({
      lang, surface: "global_macro", schema,
      extra: lang === "ar"
        ? "حقل narrative من 4-6 جمل. watchlist من 3-5 عناصر يجب مراقبتها خلال 24-72 ساعة."
        : "The 'narrative' field is 4-6 sentences. 'watchlist' is 3-5 items to monitor in the next 24-72h.",
    });

    const user = `Snapshot:\n${JSON.stringify({
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
      language: lang,
    });

    return { result: res.data, error: res.error };
  });
