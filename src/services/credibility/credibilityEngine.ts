/**
 * Credibility Intelligence — Phase 34
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Evaluates the credibility profile of a question's source context:
 * source quality, institutional relevance, rumor/verified framing,
 * evidence strength, and headline noise risk.
 *
 * Design rules:
 * - Deterministic: keyword matching only, no randomness, no hidden scoring
 * - popularity ≠ credibility: viral / trending signals reduce credibility
 * - No fake citations: never fabricate sources or data references
 * - Honest default: uncertain_credibility when context is insufficient
 * - Advisory only: labels guide AI framing, never claim certainty
 * - No execution semantics: credibility labels affect narrative tone only
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type CredibilityLabel =
  | "high_credibility"       // official/verified institutional source + specific data
  | "medium_credibility"     // reputable institution or partially verified claim
  | "low_credibility"        // rumor/social/anonymous/speculative framing
  | "uncertain_credibility"; // no credibility signals detected; cannot classify

export interface CredibilitySignal {
  type: "institutional" | "reputable" | "verified" | "data_specific" | "rumor" | "social_noise" | "headline_noise";
  weight: number;   // positive = credibility boost, negative = credibility reduction
  matched: string;  // short description of what was matched
}

export interface CredibilityResult {
  label: CredibilityLabel;
  score: number;             // 0–100 internal score (not exposed as precise)
  signals: CredibilitySignal[];
  primarySignal: CredibilitySignal | null;
  confidenceNote: string;    // 1-sentence AI framing guidance (conditional, no urgency)
  narrative: string;         // advisory 1-sentence explanation
  contextString: string;     // compact ≤130 chars for AI injection
  shouldReduceConfidence: boolean; // low_credibility → AI should lower anchor
  hasLowCredibilityRisk: boolean;
}

// ─── Signal detectors ─────────────────────────────────────────────────────────

interface SignalDef {
  type: CredibilitySignal["type"];
  pattern: RegExp;
  weight: number;
  matched: string;
}

const SIGNAL_DEFS: SignalDef[] = [
  // ── Institutional / Official (strong boost) ────────────────────────────────
  {
    type: "institutional",
    pattern: /\b(federal reserve|fed chair|fomc|ecb|bank of england|boe|bank of japan|boj|imf|world bank|bis|us treasury|sec filing|cftc|central bank.*announc|official.*statement|البنك المركزي.*أعلن|الاحتياطي الفيدرالي)\b/i,
    weight: 30,
    matched: "official central bank / regulatory institution",
  },
  {
    type: "institutional",
    pattern: /\b(press release|official report|government.*data|bureau of labor statistics|bls|census bureau|eurostat|official.*announcement|رسمي|بيان رسمي)\b/i,
    weight: 25,
    matched: "official government or statistical body",
  },
  // ── Reputable institutions (moderate boost) ────────────────────────────────
  {
    type: "reputable",
    pattern: /\b(goldman sachs|jpmorgan|jp morgan|blackrock|vanguard|morgan stanley|citigroup|ubs|barclays|deutsche bank|credit suisse|pimco)\b/i,
    weight: 18,
    matched: "tier-1 institutional research",
  },
  {
    type: "reputable",
    pattern: /\b(bloomberg|reuters|wall street journal|wsj|financial times|ft\.com|barron's|economist|cnbc(?! influencer)|bloomberg terminal)\b/i,
    weight: 14,
    matched: "established financial media",
  },
  {
    type: "reputable",
    pattern: /\b(earnings report|10-k|10-q|sec filing|annual report|quarterly results|company filed|disclosed|regulatory filing)\b/i,
    weight: 16,
    matched: "official corporate disclosure",
  },
  // ── Verification language (boost) ─────────────────────────────────────────
  {
    type: "verified",
    pattern: /\b(confirmed|announced|released|official data shows|data shows|report shows|according to.*fed|according to.*ecb|published|تأكيد|أعلن)\b/i,
    weight: 12,
    matched: "verified language detected",
  },
  // ── Specific data (small boost) ───────────────────────────────────────────
  {
    type: "data_specific",
    pattern: /\b\d+(\.\d+)?%\b|\b\$\d+(\.\d+)?[kmbt]?\b|\b\d+(\.\d+)? (basis points?|bps)\b/i,
    weight: 8,
    matched: "specific numeric data cited",
  },
  // ── Rumor / speculation (strong penalty) ──────────────────────────────────
  {
    type: "rumor",
    pattern: /\b(rumor|reportedly|sources say|sources claim|whisper|leaked|insider says|anonymous source|unconfirmed|شائعة|مصادر تقول)\b/i,
    weight: -22,
    matched: "rumor or unconfirmed sources",
  },
  {
    type: "rumor",
    pattern: /\b(predicts|i heard|i read|someone said|crypto twitter|telegram channel|whale alert|influencer|محلل مجهول)\b/i,
    weight: -18,
    matched: "speculative / influencer framing",
  },
  // ── Social noise / viral signals (strong penalty) ─────────────────────────
  {
    type: "social_noise",
    pattern: /\b(twitter|x\.com|reddit|tiktok|youtube.*analysis|instagram|trending on|going viral|everyone is (saying|buying|selling)|social media|سوشيال ميديا)\b/i,
    weight: -22,
    matched: "social media / viral source",
  },
  {
    type: "social_noise",
    pattern: /\b(fomo|fud|to the moon|moon shot|diamond hands|apes|degens|yolo|pump|dump)\b/i,
    weight: -28,
    matched: "retail sentiment / meme language",
  },
  // ── Headline noise (moderate penalty) ─────────────────────────────────────
  {
    type: "headline_noise",
    pattern: /\b(crash|collapse|explode|skyrocket|guaranteed|100x|1000x|certain to|will definitely|breaking:)\b/i,
    weight: -16,
    matched: "sensational / extreme headline language",
  },
  {
    type: "headline_noise",
    pattern: /\b(market is panicking|fear is at|extreme greed|everyone knows|obvious that|no brainer)\b/i,
    weight: -12,
    matched: "headline reactive framing",
  },
];

// ─── Score → label mapping ────────────────────────────────────────────────────

const BASE_SCORE = 50;

function labelFromScore(score: number, hasAnySignal: boolean): CredibilityLabel {
  if (!hasAnySignal) return "uncertain_credibility";
  if (score >= 75) return "high_credibility";
  if (score >= 50) return "medium_credibility";
  return "low_credibility";
}

// ─── Narrative builders ────────────────────────────────────────────────────────

function buildNarrative(label: CredibilityLabel, primary: CredibilitySignal | null, ar: boolean): string {
  const sig = primary?.matched ?? "";
  switch (label) {
    case "high_credibility":
      return ar
        ? `مؤشرات مصداقية مرتفعة${sig ? ` (${sig})` : ""} — المعلومات تبدو مؤسسية وقابلة للتحقق.`
        : `High-credibility signals detected${sig ? ` (${sig})` : ""} — source appears institutional and verifiable.`;
    case "medium_credibility":
      return ar
        ? `مؤشرات مصداقية معقولة${sig ? ` (${sig})` : ""} — التحقق جزئي؛ اعترف بالقيود.`
        : `Moderate credibility signals${sig ? ` (${sig})` : ""} — source is partially verifiable; acknowledge limitations.`;
    case "low_credibility":
      return ar
        ? `مؤشرات مصداقية منخفضة${sig ? ` (${sig})` : ""} — الادعاءات قد تكون إشاعات أو مضخّمة؛ استخدم لغة محوطة.`
        : `Low-credibility signals detected${sig ? ` (${sig})` : ""} — claims may be rumor or amplified; use hedged framing.`;
    case "uncertain_credibility":
    default:
      return ar
        ? "لا يمكن تحديد مصداقية المصدر من السياق المتاح."
        : "Source credibility cannot be determined from available context.";
  }
}

function buildConfidenceNote(label: CredibilityLabel, ar: boolean): string {
  switch (label) {
    case "high_credibility":
      return ar
        ? "المصدر مؤسسي — يمكن الاستناد إليه كأدلة أولية."
        : "Source is institutional — may be treated as primary evidence.";
    case "medium_credibility":
      return ar
        ? "مصداقية جزئية — اذكر حدود التحقق في التحليل."
        : "Partial credibility — note verification limits in analysis.";
    case "low_credibility":
      return ar
        ? "مصداقية منخفضة — خفّض الثقة 5 نقاط وتجنب تأطير الأفعال."
        : "Low credibility — reduce confidence anchor by ~5 pts and avoid action framing.";
    case "uncertain_credibility":
    default:
      return ar
        ? "مصداقية غير محددة — اعترف بمحدودية الأدلة المتاحة."
        : "Credibility uncertain — acknowledge limited evidence quality.";
  }
}

function buildContextString(label: CredibilityLabel, primary: CredibilitySignal | null): string {
  if (label === "uncertain_credibility") return "";
  const sigStr = primary?.matched ? `; basis: ${primary.matched.slice(0, 40)}` : "";
  return `Credibility: ${label.replace(/_/g, " ")}${sigStr}`.slice(0, 130);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeCredibility(question: string, ar: boolean): CredibilityResult {
  const signals: CredibilitySignal[] = [];

  for (const def of SIGNAL_DEFS) {
    if (!def.pattern.test(question)) continue;
    signals.push({ type: def.type, weight: def.weight, matched: def.matched });
  }

  const hasAnySignal = signals.length > 0;
  const score = Math.max(0, Math.min(100,
    BASE_SCORE + signals.reduce((sum, s) => sum + s.weight, 0),
  ));

  const label = labelFromScore(score, hasAnySignal);

  // Primary signal: highest absolute weight (positive first for credibility, then negative for risk)
  const primarySignal =
    signals.filter((s) => s.weight > 0).sort((a, b) => b.weight - a.weight)[0] ??
    signals.filter((s) => s.weight < 0).sort((a, b) => a.weight - b.weight)[0] ??
    null;

  return {
    label,
    score,
    signals,
    primarySignal,
    confidenceNote: buildConfidenceNote(label, ar),
    narrative: buildNarrative(label, primarySignal, ar),
    contextString: buildContextString(label, primarySignal),
    shouldReduceConfidence: label === "low_credibility",
    hasLowCredibilityRisk: label === "low_credibility",
  };
}
