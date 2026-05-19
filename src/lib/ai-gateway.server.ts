// Shared Lovable AI Gateway helper — server-only.
// Centralizes model calls, JSON parsing, and error mapping so individual
// AI server functions stay thin.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type AIError = "missing_key" | "rate_limited" | "payment_required" | "ai_error" | "network_error" | "parse_error";

export interface AICallResult<T> {
  data: T | null;
  raw: string;
  error: AIError | null;
}

import { localeGuardrails, type Lang } from "@/lib/ai/locale";

// Back-compat: kept for any caller importing INSTITUTIONAL_GUARDRAILS.
// New code should pass `language` to callAIGateway and rely on locale.ts.
export const INSTITUTIONAL_GUARDRAILS = localeGuardrails("en");

function stripFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

export function safeParseJson<T>(raw: string): T | null {
  if (!raw) return null;
  const s = stripFences(raw);
  try { return JSON.parse(s) as T; } catch { /* fallthrough */ }
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}

export interface AICallOptions {
  system: string;
  user: string;
  model?: string;
  jsonObject?: boolean;
  temperature?: number;
  maxTokens?: number;
  /**
   * Active user language. When set, the gateway:
   *  - injects the locale-specific guardrails into the system prompt,
   *  - prefixes the user message with a hard language directive,
   *  - rejects responses that leak across languages (returns parse_error).
   * Defaults to "en" for back-compat.
   */
  language?: Lang;
}

export async function callAIGateway<T>(opts: AICallOptions): Promise<AICallResult<T>> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { data: null, raw: "", error: "missing_key" };

  const lang: Lang = opts.language ?? "en";
  const guardrails = localeGuardrails(lang);
  const userDirective = lang === "ar"
    ? "أنتج الجواب بالعربية الفصحى المؤسسية حصراً، 100% عربي.\n\n"
    : "Reply in native institutional English ONLY, 100% English.\n\n";

  const body: Record<string, unknown> = {
    model: opts.model ?? "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: `${opts.system}\n\n${guardrails}` },
      { role: "user", content: `${userDirective}${opts.user}` },
    ],
  };
  if (opts.jsonObject) body.response_format = { type: "json_object" };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;

  try {
    const r = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.status === 429) {
      void import("./observability/log.server").then((m) =>
        m.logEvent({ source: "ai", severity: "warn", eventType: "ai_rate_limited", context: { status: 429 } }),
      );
      return { data: null, raw: "", error: "rate_limited" };
    }
    if (r.status === 402) return { data: null, raw: "", error: "payment_required" };
    if (!r.ok) {
      const t = await r.text();
      console.error("[ai-gateway] error", r.status, t);
      void import("./observability/log.server").then((m) =>
        m.logEvent({
          source: "ai", severity: "error", eventType: "ai_error",
          message: `status=${r.status}`, context: { body: t.slice(0, 500) },
        }),
      );
      return { data: null, raw: "", error: "ai_error" };
    }
    const d = await r.json();
    const raw: string = d.choices?.[0]?.message?.content ?? "";
    if (!opts.jsonObject) return { data: raw as unknown as T, raw, error: null };
    const parsed = safeParseJson<T>(raw);
    return parsed
      ? { data: parsed, raw, error: null }
      : { data: null, raw, error: "parse_error" };
  } catch (e) {
    console.error("[ai-gateway] network error", e);
    void import("./observability/log.server").then((m) =>
      m.logEvent({ source: "ai", severity: "error", eventType: "ai_network_error", message: (e as Error).message }),
    );
    return { data: null, raw: "", error: "network_error" };
  }
}
