// Shared AI Gateway helper — server-only.
// Provider priority: GEMINI_API_KEY (direct Gemini API) → LOVABLE_API_KEY (Lovable gateway).
// Centralizes model calls, JSON parsing, and error mapping so individual
// AI server functions stay thin.

// ─── Provider resolution ───────────────────────────────────────────────────

export type AIProvider = "gemini" | "lovable" | "openai";

export interface ProviderConfig {
  provider: AIProvider;
  key: string;
  gatewayUrl: string;
  /** Normalize model name for the target API surface. */
  normalizeModel: (model: string) => string;
}

/** Shared OpenAI provider config. Key is resolved at call time, never cached. */
function buildOpenAIConfig(key: string): ProviderConfig {
  return {
    provider: "openai",
    key,
    gatewayUrl: "https://api.openai.com/v1/chat/completions",
    // Map any google/* or gemini-* model name to gpt-4o for the OpenAI surface.
    normalizeModel: (m: string) =>
      m.startsWith("google/") || m.startsWith("gemini-") ? "gpt-4o" : m.startsWith("gpt-") ? m : "gpt-4o",
  };
}

/**
 * Resolves the active AI provider from environment variables.
 * Priority: GEMINI_API_KEY (direct Gemini API) > LOVABLE_API_KEY (Lovable gateway) > OPENAI_API_KEY.
 * Returns null when no key is present — callers must handle gracefully.
 */
export function resolveAIProvider(): ProviderConfig | null {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const lovableKey = process.env.LOVABLE_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  console.info("[ai-gateway] resolveAIProvider hasGeminiKey=%s hasLovableKey=%s hasOpenAIKey=%s", Boolean(geminiKey), Boolean(lovableKey), Boolean(openaiKey));
  if (geminiKey) {
    return {
      provider: "gemini",
      key: geminiKey,
      // Gemini OpenAI-compatible endpoint — uses same chat/completions contract.
      gatewayUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      // Gemini native uses "gemini-2.5-flash", not the "google/gemini-2.5-flash" OpenRouter prefix.
      normalizeModel: (m: string) => m.replace(/^google\//, ""),
    };
  }
  if (lovableKey) {
    return {
      provider: "lovable",
      key: lovableKey,
      gatewayUrl: "https://ai.gateway.lovable.dev/v1/chat/completions",
      normalizeModel: (m: string) => m, // Lovable gateway uses "google/gemini-*" prefixed names
    };
  }
  if (openaiKey) {
    return buildOpenAIConfig(openaiKey);
  }
  return null;
}

/**
 * Resolves a provider by routing identity.
 * Used by callAIGateway when a specific provider is requested by the router.
 * Falls back to resolveAIProvider() when the identity does not map to a specific key.
 */
function resolveProviderByIdentity(identity: string): ProviderConfig | null {
  if (identity === "openai_deep") {
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (openaiKey) return buildOpenAIConfig(openaiKey);
    // OpenAI requested but key missing — fall through to auto-resolution
    console.warn("[ai-gateway] openai_deep requested but OPENAI_API_KEY not configured; falling back");
    return resolveAIProvider();
  }
  // gemini_fast, gemini_deep, heuristic_fallback, unavailable → auto-resolve
  return resolveAIProvider();
}

// ─── Types ─────────────────────────────────────────────────────────────────

export type AIError = "missing_key" | "rate_limited" | "payment_required" | "ai_error" | "network_error" | "parse_error";

export interface AICallResult<T> {
  data: T | null;
  raw: string;
  error: AIError | null;
  /** Which AI provider handled this call. Set on success; undefined on missing_key. */
  provider?: AIProvider;
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
  /**
   * Provider routing identity from providerRouter.ts.
   * When set to "openai_deep", routes this call to the OpenAI provider.
   * When absent or set to any other identity, auto-resolves via GEMINI_API_KEY priority.
   */
  providerIdentity?: string;
}

export async function callAIGateway<T>(opts: AICallOptions): Promise<AICallResult<T>> {
  const providerCfg = opts.providerIdentity
    ? resolveProviderByIdentity(opts.providerIdentity)
    : resolveAIProvider();
  if (!providerCfg) {
    console.warn(
      "[ai-gateway] No AI provider configured — set GEMINI_API_KEY (primary) or LOVABLE_API_KEY (fallback). hasGeminiKey=%s hasLovableKey=%s",
      Boolean(process.env.GEMINI_API_KEY?.trim()),
      Boolean(process.env.LOVABLE_API_KEY?.trim()),
    );
    return { data: null, raw: "", error: "missing_key" };
  }

  const { provider, key, gatewayUrl, normalizeModel } = providerCfg;
  const model = normalizeModel(opts.model ?? "google/gemini-2.5-flash");

  const lang: Lang = opts.language ?? "en";
  const guardrails = localeGuardrails(lang);
  const userDirective = lang === "ar"
    ? "أنتج الجواب بالعربية الفصحى المؤسسية حصراً، 100% عربي.\n\n"
    : "Reply in native institutional English ONLY, 100% English.\n\n";

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: `${opts.system}\n\n${guardrails}` },
      { role: "user", content: `${userDirective}${opts.user}` },
    ],
  };
  if (opts.jsonObject) body.response_format = { type: "json_object" };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;

  console.info(`[ai-gateway] provider=${provider} model=${model}`);

  try {
    const r = await fetch(gatewayUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.status === 429) {
      void import("./observability/log.server").then((m) =>
        m.logEvent({ source: "ai", severity: "warn", eventType: "ai_rate_limited", context: { status: 429, provider } }),
      );
      return { data: null, raw: "", error: "rate_limited", provider };
    }
    if (r.status === 402) return { data: null, raw: "", error: "payment_required", provider };
    if (!r.ok) {
      const t = await r.text();
      console.error(`[ai-gateway] provider=${provider} error`, r.status, t);
      void import("./observability/log.server").then((m) =>
        m.logEvent({
          source: "ai", severity: "error", eventType: "ai_error",
          message: `provider=${provider} status=${r.status}`, context: { body: t.slice(0, 500) },
        }),
      );
      return { data: null, raw: "", error: "ai_error", provider };
    }
    const d = await r.json();
    const raw: string = d.choices?.[0]?.message?.content ?? "";

    // Cross-language leakage guard — only run when caller specified language
    // and we have something to inspect. Logs but does not fail JSON parsing
    // because schema fields may legitimately contain ticker symbols.
    if (opts.language && raw) {
      try {
        const { detectLanguageLeakage } = await import("@/lib/ai/locale");
        const leak = detectLanguageLeakage(raw, opts.language);
        if (!leak.ok) {
          void import("./observability/log.server").then((m) =>
            m.logEvent({
              source: "ai", severity: "warn", eventType: "ai_language_leakage",
              message: `provider=${provider} lang=${opts.language} ratio=${leak.ratio.toFixed(3)}`,
              context: { offenders: leak.offendingTokens },
            }),
          );
        }
      } catch { /* leakage detection is best-effort */ }
    }

    if (!opts.jsonObject) return { data: raw as unknown as T, raw, error: null, provider };
    const parsed = safeParseJson<T>(raw);
    if (!parsed) {
      console.warn(`[ai-gateway] parse_error provider=${provider} raw_preview="${raw.slice(0, 400)}"`);
    }
    return parsed
      ? { data: parsed, raw, error: null, provider }
      : { data: null, raw, error: "parse_error", provider };
  } catch (e) {
    console.error(`[ai-gateway] provider=${provider} network error`, e);
    void import("./observability/log.server").then((m) =>
      m.logEvent({ source: "ai", severity: "error", eventType: "ai_network_error", message: (e as Error).message, context: { provider } }),
    );
    return { data: null, raw: "", error: "network_error", provider };
  }
}
