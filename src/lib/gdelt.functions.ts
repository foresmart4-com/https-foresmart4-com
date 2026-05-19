// Server fn wrapper around the GDELT provider — keeps the upstream fetch
// server-side (avoids browser CORS / privacy concerns) and lets the panel
// consume a normalized snapshot. Auth-gated so anonymous prerender doesn't
// hammer GDELT and the response is scoped per-user.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runGdelt, type GdeltSnapshot } from "@/services/providers/gdelt";
import { callAIGateway } from "@/lib/ai-gateway.server";
import { buildLocaleSystemPrompt, resolveLang } from "@/lib/ai/locale";

const Input = z.object({
  query: z.string().min(1).max(400).optional(),
  timespan: z.enum(["1h", "6h", "12h", "24h", "3d", "7d"]).optional(),
  maxRecords: z.number().int().min(10).max(250).optional(),
  language: z.enum(["ar", "en"]).optional(),
});

export const getGdeltSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean; snapshot: GdeltSnapshot }> => {
    const snap = await runGdelt({
      query: data.query,
      timespan: data.timespan,
      maxRecords: data.maxRecords,
    });
    return { ok: snap.ok, snapshot: snap };
  });

const NarrativeInput = z.object({
  language: z.enum(["ar", "en"]).default("en"),
  topEvents: z.array(z.object({
    kind: z.string(), headline: z.string(), region: z.string(),
    severity: z.string(), marketImpact: z.string(),
    escalationScore: z.number(), confidence: z.number(),
  })).max(12),
  metrics: z.object({
    conflictSeverity: z.number(),
    macroRiskIndex: z.number(),
    oilRisk: z.number(),
    shippingRisk: z.number(),
    sanctionsCount: z.number(),
  }),
});

export const aiGdeltBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => NarrativeInput.parse(d))
  .handler(async ({ data }) => {
    const lang = resolveLang(data);
    const schema = `{
  "headline": string,
  "risk_level": "low" | "elevated" | "high" | "critical",
  "narrative": string,
  "macro_impact": [ string ],
  "watch": [ string ]
}`;
    const system = buildLocaleSystemPrompt({
      lang, surface: "global_macro", schema,
      extra: lang === "ar"
        ? "narrative من 3-5 جمل. ركّز على الأسواق (الطاقة، الذهب، الشحن، عملات الأسواق الناشئة)."
        : "'narrative' is 3-5 sentences. Focus on market impact (energy, gold, shipping, EM FX).",
    });
    const user = `GDELT snapshot:\n${JSON.stringify(data, null, 2)}`;
    const res = await callAIGateway<{
      headline: string;
      risk_level: "low" | "elevated" | "high" | "critical";
      narrative: string;
      macro_impact: string[];
      watch: string[];
    }>({
      system, user,
      model: "google/gemini-2.5-flash",
      jsonObject: true, temperature: 0.3, maxTokens: 600,
      language: lang,
    });
    return { result: res.data, error: res.error };
  });
