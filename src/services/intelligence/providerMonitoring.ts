/**
 * Provider Monitoring Intelligence — Phase 56
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Derives provider health from session exchange patterns.
 *
 * Health states:
 *   healthy              — primary AI provider succeeding consistently this session
 *   degraded             — elevated heuristic/fallback rate detected
 *   fallback_heavy       — majority of responses used fallback path
 *   parse_sensitive      — OpenAI recovery used, suggesting primary parse instability
 *   insufficient_signal  — too few exchanges to classify provider behaviour
 *
 * Design rules:
 * - Pure observation only — no autonomous provider switching
 * - Counts only; no raw API responses, no secrets, no keys
 * - Compressed output ≤120 chars; no context explosion
 * - Governance remains superior; this is informational only
 * - O(1) runtime — all counts pre-derived by caller
 *
 * Safety assertions:
 *   isAutonomousSwitching — always false; no routing changes
 *   isExecution           — always false; observation only
 *   exposesRawProvider    — always false; no API dump
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProviderHealth =
  | "healthy"             // primary AI consistently succeeding
  | "degraded"            // elevated fallback/heuristic rate
  | "fallback_heavy"      // majority of responses used fallback
  | "parse_sensitive"     // OpenAI recovery used for parse failures
  | "insufficient_signal";// too few exchanges to classify

export interface ProviderMonitoringInput {
  totalExchanges: number;
  heuristicCount: number;       // responses where engine === "heuristic"
  openAIFallbackCount: number;  // responses where providerIdentity === "openai_deep"
  aiSuccessCount: number;       // engine === "ai" with primary Gemini/Lovable provider
  ar: boolean;
}

export interface ProviderMonitoringResult {
  providerHealth: ProviderHealth;
  degradationNote: string | null;   // 1 sentence when health is non-healthy; null otherwise
  fallbackNote: string | null;      // 1 sentence on fallback pattern; null when healthy
  contextString: string;            // compact ≤120 chars for Genesis context injection
  // Safety assertions — always enforced; no exceptions
  readonly isAutonomousSwitching: false;
  readonly isExecution: false;
  readonly exposesRawProvider: false;
}

// ─── Health derivation ────────────────────────────────────────────────────────

function deriveHealth(input: ProviderMonitoringInput): ProviderHealth {
  const { totalExchanges, heuristicCount, openAIFallbackCount } = input;

  if (totalExchanges < 2) return "insufficient_signal";

  const heuristicRate = heuristicCount / totalExchanges;

  if (heuristicRate >= 0.5) return "fallback_heavy";

  // OpenAI recovery >= 2 in a session suggests primary parse instability
  if (openAIFallbackCount >= 2) return "parse_sensitive";
  // Single OpenAI recovery with short session also signals parse sensitivity
  if (openAIFallbackCount >= 1 && totalExchanges <= 4) return "parse_sensitive";

  if (heuristicRate >= 0.25) return "degraded";

  return "healthy";
}

// ─── Note builders ────────────────────────────────────────────────────────────

function buildDegradationNote(health: ProviderHealth, input: ProviderMonitoringInput, ar: boolean): string | null {
  if (health === "healthy" || health === "insufficient_signal") return null;

  const { totalExchanges, heuristicCount } = input;
  const pct = totalExchanges > 0 ? Math.round((heuristicCount / totalExchanges) * 100) : 0;

  if (ar) {
    switch (health) {
      case "fallback_heavy":
        return `أغلب الردود في هذه الجلسة استخدمت المسار الاحتياطي (${pct}%) — قد يعكس ذلك انقطاعاً مؤقتاً في المزوّد.`;
      case "parse_sensitive":
        return "التعافي عبر OpenAI استُخدم لاستخراج ردود المزوّد الأساسي — إشارة إلى عدم استقرار مؤقت في تنسيق JSON.";
      case "degraded":
        return `معدل متصاعد من الردود الاحتياطية في هذه الجلسة (${pct}%) — أداء المزوّد الأساسي قد يكون متذبذباً.`;
    }
  } else {
    switch (health) {
      case "fallback_heavy":
        return `Majority of responses this session used the fallback path (${pct}%) — may reflect a temporary primary provider interruption.`;
      case "parse_sensitive":
        return "OpenAI recovery was used to extract primary provider responses — signals temporary JSON formatting instability.";
      case "degraded":
        return `Elevated fallback rate this session (${pct}%) — primary provider performance may be intermittent.`;
    }
  }
  return null;
}

function buildFallbackNote(health: ProviderHealth, input: ProviderMonitoringInput, ar: boolean): string | null {
  if (health === "healthy" || health === "insufficient_signal") return null;

  const { openAIFallbackCount } = input;

  if (ar) {
    if (openAIFallbackCount > 0) {
      return `استُخدم OpenAI ${openAIFallbackCount === 1 ? "مرة" : `${openAIFallbackCount} مرات`} كمسار احتياطي — الحوكمة لم تتأثر.`;
    }
    return "الردود الاحتياطية الإرشادية نشطة — التحليل يعكس الأنماط المحلية، لا استجابة AI مباشرة.";
  } else {
    if (openAIFallbackCount > 0) {
      return `OpenAI used as recovery path ${openAIFallbackCount} ${openAIFallbackCount === 1 ? "time" : "times"} this session — governance unaffected.`;
    }
    return "Heuristic fallback responses active — analysis reflects local patterns, not direct AI response.";
  }
}

// ─── Context string builder ───────────────────────────────────────────────────

function buildContextString(health: ProviderHealth): string {
  if (health === "insufficient_signal") return "";
  const label = health.replace(/_/g, " ");
  return `Provider health: ${label}`.slice(0, 120);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeProviderMonitoring(input: ProviderMonitoringInput): ProviderMonitoringResult {
  const health = deriveHealth(input);
  const degradationNote = buildDegradationNote(health, input, input.ar);
  const fallbackNote = buildFallbackNote(health, input, input.ar);
  const contextString = buildContextString(health);

  return {
    providerHealth: health,
    degradationNote,
    fallbackNote,
    contextString,
    isAutonomousSwitching: false,
    isExecution: false,
    exposesRawProvider: false,
  };
}
