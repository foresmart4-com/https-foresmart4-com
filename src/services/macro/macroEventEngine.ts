/**
 * Macro Event Intelligence — Phase 33
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Classifies macro event significance and derives transmission channels
 * from the current question and portfolio/regime context.
 *
 * Design rules:
 * - Deterministic: classification follows transparent keyword + context rules
 * - No live feeds required: operates on existing context only
 * - significance ≠ prediction: labels inform framing, never claim direction
 * - significance ≠ directional certainty: secondary/uncertain are honest states
 * - Preserve Firewall: this engine adds context, never overrides governance
 * - No fake urgency: "must react now" / "guaranteed impact" are forbidden
 * - No polling, no background jobs, no recursion
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventSignificance =
  | "critical"     // high transmission risk to portfolio; multiple channels
  | "meaningful"   // notable macro influence; one or two clear channels
  | "secondary"    // limited macro linkage; isolated or sector-specific
  | "uncertain";   // event detected but significance cannot be determined

export type MacroEventType =
  | "cpi_inflation"
  | "interest_rate_decision"
  | "central_bank_meeting"
  | "oil_price_move"
  | "labor_employment"
  | "growth_pmi"
  | "policy_regulatory"
  | "geopolitical_macro"
  | "liquidity_monetary"
  | "macro_stress";

export interface MacroEventResult {
  significance: EventSignificance;
  detectedEventTypes: MacroEventType[];
  primaryEvent: MacroEventType | null;
  transmissionChannels: string[];
  narrative: string;
  contextString: string;
  hasSignificantEvent: boolean;
  monitoringJustified: boolean;
}

// ─── Event type definitions ───────────────────────────────────────────────────

interface EventDef {
  type: MacroEventType;
  pattern: RegExp;
  baseSignificance: 3 | 2 | 1; // 3=critical, 2=meaningful, 1=secondary
  channels: string[];
  channelsAr: string[];
  portfolioSensitiveCategories: string[];
}

const EVENT_DEFS: EventDef[] = [
  {
    type: "cpi_inflation",
    pattern: /\b(cpi|inflation.*data|consumer price index|pce|core.*inflation|inflation.*report|headline inflation|التضخم|بيانات التضخم|مؤشر أسعار المستهلك)\b/i,
    baseSignificance: 3,
    channels: ["inflation→rate expectations", "real-rate compression→valuations"],
    channelsAr: ["التضخم → توقعات الفائدة", "ضغط الأسعار الحقيقية → التقييمات"],
    portfolioSensitiveCategories: ["equity", "macro", "us_stock", "saudi_stock", "commodity"],
  },
  {
    type: "interest_rate_decision",
    pattern: /\b(rate.*decision|rate.*hike|rate.*cut|rate.*change|interest rate.*announcement|fed.*decision|boe.*decision|ecb.*decision|قرار الفائدة|رفع الفائدة|خفض الفائدة)\b/i,
    baseSignificance: 3,
    channels: ["rates→equity discount rate", "rates→DXY", "rates→bond prices"],
    channelsAr: ["الفائدة → معدل الخصم", "الفائدة → الدولار", "الفائدة → أسعار السندات"],
    portfolioSensitiveCategories: ["equity", "forex", "macro", "us_stock", "saudi_stock"],
  },
  {
    type: "central_bank_meeting",
    pattern: /\b(fed.*meeting|fomc.*meeting|ecb.*meeting|central bank.*meeting|boe.*meeting|rate.*meeting|policy.*meeting|اجتماع الفيد|اجتماع البنك المركزي|اجتماع السياسة النقدية)\b/i,
    baseSignificance: 3,
    channels: ["CB decision→rate path expectations", "forward guidance→risk sentiment"],
    channelsAr: ["قرار البنك → توقعات مسار الفائدة", "التوجيه المستقبلي → شهية المخاطرة"],
    portfolioSensitiveCategories: ["equity", "forex", "macro", "us_stock", "saudi_stock"],
  },
  {
    type: "oil_price_move",
    pattern: /\b(oil.*price|crude.*price|oil.*fell|oil.*dropped|oil.*rally|oil.*spike|opec.*decision|opec.*cut|energy.*prices|النفط.*أسعار|أسعار النفط|قرار أوبك)\b/i,
    baseSignificance: 2,
    channels: ["oil→fiscal channel (Saudi breakeven ~$75-80)", "energy→inflation", "oil→global growth signal"],
    channelsAr: ["النفط → الإيرادات المالية السعودية (~75-80$)", "الطاقة → التضخم", "النفط → إشارة النمو العالمي"],
    portfolioSensitiveCategories: ["commodity", "saudi_stock"],
  },
  {
    type: "labor_employment",
    pattern: /\b(nfp|non-farm payroll|jobs report|employment report|unemployment.*data|payroll.*data|labor market.*data|وظائف|بيانات التوظيف|تقرير الوظائف|معدل البطالة)\b/i,
    baseSignificance: 2,
    channels: ["employment→growth expectations", "labor market→CB policy path"],
    channelsAr: ["التوظيف → توقعات النمو", "سوق العمل → مسار البنك المركزي"],
    portfolioSensitiveCategories: ["equity", "us_stock", "macro"],
  },
  {
    type: "growth_pmi",
    pattern: /\b(pmi.*data|manufacturing pmi|services pmi|gdp.*data|growth data|gdp.*report|preliminary gdp|مؤشر مديري المشتريات|بيانات الناتج|نمو الناتج المحلي)\b/i,
    baseSignificance: 2,
    channels: ["PMI/GDP→earnings expectations", "growth signal→risk sentiment"],
    channelsAr: ["مؤشرات النمو → توقعات الأرباح", "إشارة النمو → شهية المخاطرة"],
    portfolioSensitiveCategories: ["equity", "us_stock", "saudi_stock"],
  },
  {
    type: "policy_regulatory",
    pattern: /\b(policy change|fiscal policy|budget announcement|tariff.*change|sanction.*new|regulation.*change|سياسة مالية|إعلان الميزانية|رسوم جمركية جديدة|عقوبات جديدة)\b/i,
    baseSignificance: 2,
    channels: ["policy→sector valuations", "tariff/sanction→supply chain costs"],
    channelsAr: ["السياسة → تقييمات القطاع", "الرسوم الجمركية → تكاليف سلسلة الإمداد"],
    portfolioSensitiveCategories: ["equity", "us_stock", "saudi_stock"],
  },
  {
    type: "geopolitical_macro",
    pattern: /\b(geopolitical|trade war|military conflict|sanctions.*escalat|war.*escalat|supply.*disruption|geopolitical tension|جيوسياسي|حرب تجارية|صراع مسلح|توترات جيوسياسية)\b/i,
    baseSignificance: 2,
    channels: ["geopolitical risk→safe-haven demand", "conflict→commodity supply disruption"],
    channelsAr: ["المخاطر الجيوسياسية → الطلب على الملاذ الآمن", "النزاع → اضطراب إمدادات السلع"],
    portfolioSensitiveCategories: ["commodity", "forex", "macro", "saudi_stock"],
  },
  {
    type: "liquidity_monetary",
    pattern: /\b(quantitative easing|quantitative tightening|qe|qt|balance sheet.*reduction|balance sheet.*expansion|m2.*data|money supply.*data|تيسير كمي|تشديد كمي|ميزانية البنك المركزي)\b/i,
    baseSignificance: 3,
    channels: ["QE/QT→liquidity conditions", "balance sheet→risk asset pricing"],
    channelsAr: ["التيسير/التشديد الكمي → ظروف السيولة", "الميزانية → تسعير الأصول"],
    portfolioSensitiveCategories: ["equity", "crypto", "macro", "us_stock"],
  },
  {
    type: "macro_stress",
    pattern: /\b(credit.*spread.*widen|hy.*spread.*spike|financial.*stress|systemic risk|liquidity.*crisis|bank.*stress|contagion|اتساع فروقات الائتمان|أزمة سيولة|إجهاد مالي)\b/i,
    baseSignificance: 3,
    channels: ["credit stress→risk appetite", "spread widening→funding conditions", "stress→defensive rotation"],
    channelsAr: ["ضغط الائتمان → شهية المخاطرة", "اتساع الفروقات → ظروف التمويل", "الإجهاد → الدوران الدفاعي"],
    portfolioSensitiveCategories: ["equity", "crypto", "macro", "us_stock", "saudi_stock"],
  },
];

// ─── Regime sensitivity ───────────────────────────────────────────────────────

const REGIME_AMPLIFYING = new Set([
  "risk_off", "macro_transition", "high_vol_risk-off", "bear_ranging",
  "defensive", "mixed",
]);

function regimeAmplifies(regime: string): boolean {
  return REGIME_AMPLIFYING.has(regime);
}

// ─── Significance derivation ──────────────────────────────────────────────────

interface DetectedEvent {
  type: MacroEventType;
  rawSignificance: number; // 1-3
  hasPortfolioLink: boolean;
  channels: string[];
  channelsAr: string[];
}

function deriveSignificance(
  events: DetectedEvent[],
  regime: string,
): EventSignificance {
  if (!events.length) return "uncertain";

  const maxRaw = Math.max(...events.map((e) => e.rawSignificance));
  const hasPortfolioLink = events.some((e) => e.hasPortfolioLink);
  const regimeBoost = regimeAmplifies(regime);

  let score = maxRaw;
  if (hasPortfolioLink) score = Math.min(3, score + 1);
  if (regimeBoost && maxRaw >= 2) score = Math.min(3, score + 1);

  if (score >= 3) return "critical";
  if (score >= 2) return "meaningful";
  if (score >= 1) return "secondary";
  return "uncertain";
}

// ─── Narrative builders ────────────────────────────────────────────────────────

function buildNarrative(
  significance: EventSignificance,
  primaryEvent: MacroEventType | null,
  channels: string[],
  ar: boolean,
): string {
  const eventLabel = primaryEvent
    ? primaryEvent.replace(/_/g, " ")
    : (ar ? "حدث كلي" : "macro event");

  switch (significance) {
    case "critical":
      return ar
        ? `حدث ${eventLabel} يحمل أهمية كلية مرتفعة مع قنوات انتقال متعددة${channels.length ? `: ${channels.slice(0, 2).join("؛ ")}` : ""}. المراقبة مبررة، لكن دون ادعاءات اتجاهية مؤكدة.`
        : `${eventLabel} event carries elevated macro significance with multiple transmission channels${channels.length ? `: ${channels.slice(0, 2).join("; ")}` : ""}. Monitoring is justified; directional certainty is not warranted.`;
    case "meaningful":
      return ar
        ? `حدث ${eventLabel} قد يؤثر بشكل معقول على ظروف السوق${channels.length ? ` عبر: ${channels[0]}` : ""}. الأهمية ذات معنى لكنها غير حاسمة.`
        : `${eventLabel} event may reasonably influence market conditions${channels.length ? ` via ${channels[0]}` : ""}. Significance is meaningful but not deterministic.`;
    case "secondary":
      return ar
        ? `الأهمية الكلية للحدث تبدو ثانوية — الصلة بالأسواق الأوسع محدودة في غياب روابط كلية واضحة.`
        : "Macro significance appears secondary — broader market linkage is limited without clear macro channels.";
    case "uncertain":
    default:
      return ar
        ? "لم يُكتشف حدث كلي واضح؛ أو تتطلب أهميته سياقاً إضافياً لتحديدها."
        : "No clear macro event detected, or significance requires additional context to determine.";
  }
}

// ─── Context string builder ────────────────────────────────────────────────────

function buildContextString(
  significance: EventSignificance,
  detectedTypes: MacroEventType[],
  channels: string[],
): string {
  if (significance === "uncertain" || !detectedTypes.length) return "";
  const evtStr = detectedTypes.slice(0, 2).map((t) => t.replace(/_/g, " ")).join("/");
  const chanStr = channels.length > 0 ? `; channel: ${channels[0]}` : "";
  return `Macro event: ${evtStr} — ${significance}${chanStr}`.slice(0, 140);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeMacroEvent(
  question: string,
  regime: string,
  watchlistCategories: string[],
  ar: boolean,
): MacroEventResult {
  const detected: DetectedEvent[] = [];

  for (const def of EVENT_DEFS) {
    if (!def.pattern.test(question)) continue;
    const hasPortfolioLink = def.portfolioSensitiveCategories.some((cat) =>
      watchlistCategories.includes(cat),
    );
    detected.push({
      type: def.type,
      rawSignificance: def.baseSignificance,
      hasPortfolioLink,
      channels: ar ? def.channelsAr : def.channels,
      channelsAr: def.channelsAr,
    });
  }

  // Sort by raw significance descending
  detected.sort((a, b) => b.rawSignificance - a.rawSignificance);

  const significance = deriveSignificance(detected, regime);
  const detectedEventTypes = detected.map((e) => e.type);
  const primaryEvent = detected[0]?.type ?? null;

  // Merge channels (max 3 unique)
  const seenChannels = new Set<string>();
  const channels: string[] = [];
  for (const ev of detected) {
    for (const ch of ev.channels) {
      if (!seenChannels.has(ch) && channels.length < 3) {
        seenChannels.add(ch);
        channels.push(ch);
      }
    }
  }

  const narrative = buildNarrative(significance, primaryEvent, channels, ar);
  const contextString = buildContextString(significance, detectedEventTypes, ar ? [] : channels);

  const hasSignificantEvent = significance === "critical" || significance === "meaningful";
  const monitoringJustified = significance === "critical" || significance === "meaningful";

  return {
    significance,
    detectedEventTypes,
    primaryEvent,
    transmissionChannels: channels,
    narrative,
    contextString,
    hasSignificantEvent,
    monitoringJustified,
  };
}
