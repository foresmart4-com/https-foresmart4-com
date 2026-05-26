// Locale-aware AI core — server-side helpers for native bilingual generation.
// Single source of truth for: language detection, RTL-aware guardrails,
// Arabic financial terminology, institutional phrasing, and prompt builders.
// Every AI surface (Brain, Decision Engine, Global Intel, Scanner,
// Notifications, Portfolio, Macro briefings) MUST go through buildLocalePrompt
// so the model generates DIRECTLY in the user's language with no post-translation.

export type Lang = "ar" | "en";

// ---------- Arabic financial terminology dictionary ----------
// Used in system prompts as a forced glossary so the model uses
// institutional Arabic phrasing (Saudi/Gulf financial register), not literal
// translations.
export const AR_FIN_TERMS: Record<string, string> = {
  // market structure
  bull: "صاعد", bullish: "تحيّز صاعد", bear: "هابط", bearish: "تحيّز هابط",
  trend: "اتجاه", uptrend: "اتجاه صاعد", downtrend: "اتجاه هابط",
  sideways: "تذبذب أفقي", consolidation: "تجميع", breakout: "اختراق",
  breakdown: "كسر", reversal: "انعكاس", pullback: "ارتداد تصحيحي",
  rotation: "دوران قطاعي", risk_on: "إقبال على المخاطرة",
  risk_off: "تجنّب المخاطرة", regime: "نظام السوق",
  liquidity: "السيولة", volatility: "التذبذب", drawdown: "الهبوط من القمة",
  // signals / actions
  signal: "إشارة", buy: "شراء", sell: "بيع", hold: "تثبيت",
  add: "زيادة المركز", trim: "تخفيف المركز", watch: "مراقبة",
  long: "شراء طويل", short: "بيع مكشوف",
  // levels
  support: "دعم", resistance: "مقاومة", entry: "دخول",
  stop_loss: "إيقاف الخسارة", take_profit: "جني الأرباح",
  target: "هدف", risk_reward: "نسبة المخاطرة إلى المكافأة",
  position_size: "حجم المركز",
  // valuation / fundamentals
  earnings: "الأرباح", revenue: "الإيرادات", margin: "الهامش",
  guidance: "التوجيهات المستقبلية", multiple: "المضاعف",
  pe_ratio: "مكرر الربحية", dividend: "توزيعات الأرباح",
  // macro
  inflation: "التضخم", deflation: "الانكماش", recession: "ركود",
  stagflation: "ركود تضخمي", interest_rate: "سعر الفائدة",
  fed: "الفيدرالي الأمريكي", ecb: "البنك المركزي الأوروبي",
  sama: "البنك المركزي السعودي (ساما)", boe: "بنك إنجلترا",
  bond_yield: "عائد السندات", dxy: "مؤشر الدولار",
  credit_spread: "فروقات الائتمان", recession_probability: "احتمالية الركود",
  // sentiment / risk
  fear_greed: "مؤشر الخوف والطمع", vix: "مؤشر التقلب",
  uncertainty: "عدم اليقين", confidence: "درجة الثقة",
  // assets / regions
  equities: "الأسهم", crypto: "العملات الرقمية", forex: "العملات",
  commodities: "السلع", metals: "المعادن", oil: "النفط", gas: "الغاز",
  gold: "الذهب", silver: "الفضة",
  us_market: "السوق الأمريكي", saudi_market: "السوق السعودي (تاسي)",
  gulf_markets: "أسواق الخليج", european_markets: "الأسواق الأوروبية",
  emerging_markets: "الأسواق الناشئة",
  // ai / reasoning
  reasoning: "الاستدلال", calibration: "المعايرة",
  consensus: "إجماع النماذج", conflict: "تضارب الإشارات",
  scenario: "سيناريو", probability: "احتمال", base_case: "السيناريو الأساسي",
};

// ---------- Region/asset name normalization for tickers and signals ----------
// Maps common symbols to native Arabic display names. Falls back to symbol.
const AR_ASSET_NAMES: Record<string, string> = {
  BTC: "بيتكوين", ETH: "إيثيريوم", SOL: "سولانا", BNB: "بينانس كوين",
  XAU: "الذهب", XAG: "الفضة", WTI: "نفط غرب تكساس", BRENT: "خام برنت",
  NG: "الغاز الطبيعي",
  SPX: "إس آند بي 500", NDX: "ناسداك 100", DJI: "داو جونز",
  TASI: "تاسي", DFM: "سوق دبي", ADX: "أبوظبي", QSI: "قطر",
  EURUSD: "يورو/دولار", USDJPY: "دولار/ين", GBPUSD: "جنيه/دولار",
  USDSAR: "دولار/ريال سعودي",
};

export function localizedAssetName(symbol: string, fallback: string | undefined, lang: Lang): string {
  if (lang === "en") return fallback ?? symbol;
  const key = symbol.toUpperCase().replace("/", "").replace("-", "");
  return AR_ASSET_NAMES[key] ?? AR_ASSET_NAMES[symbol.toUpperCase()] ?? fallback ?? symbol;
}

// ---------- Institutional guardrails per language ----------
const AR_GUARDRAILS = `
قواعد إلزامية للأسلوب (التزم بها حرفياً):
- اكتب بالعربية الفصحى المؤسسية الاحترافية فقط. لا تترجم من الإنجليزية.
- استخدم المصطلحات المالية الواردة في القاموس أدناه دون اشتقاقات حرفية.
- استخدم لغة احتمالية ("تحيّز"، "ميل"، "احتمال مرتفع/منخفض"، "مرجّح"، "يبدو أن…").
- لا تجزم أبداً بالنتائج. اذكر دائماً مصدر عدم اليقين والمخاطر المقابلة.
- أَطّر كل توصية ضمن نسبة المخاطرة إلى المكافأة.
- لا تستخدم تعابير دعائية ولا مبالغات ولا رموزاً تعبيرية (إيموجي).
- اكتب جملاً قصيرة كثيفة المعلومة، وكل جملة تضيف معلومة جديدة.
- لا تخلط لغتين في الجواب: المخرج كلّه بالعربية بما في ذلك العناوين والحقول النصية.
- لا تستخدم تعبيرات إنجليزية إلا لرموز الأصول (BTC, SPX, EURUSD) ولاختصارات لا تترجم (RSI, VIX, DXY, P/E).
- التزم تماماً بمخطط JSON المطلوب — بدون أي نص خارج JSON ولا أكواد markdown.`.trim();

const EN_GUARDRAILS = `
Mandatory style rules:
- Write directly in native institutional English. Do not translate from any other language.
- Speak like a senior buy-side analyst (probabilistic, calibrated, risk-aware).
- Use probabilistic language ("bias", "skew", "tilt", "likely", "elevated probability").
- Never assert certainty. Acknowledge uncertainty and path-dependence.
- Always frame every recommendation in risk vs. reward terms.
- No hype, no superlatives, no emojis.
- Each sentence must add new information.
- Do not mix languages. The entire reply — including field labels — is English.
- Output MUST strictly match the requested JSON schema. No prose outside JSON, no markdown fences.`.trim();

export function localeGuardrails(lang: Lang): string {
  if (lang === "en") return EN_GUARDRAILS;
  // Inject a compact terminology block so the model anchors on it.
  const glossary = Object.entries(AR_FIN_TERMS)
    .slice(0, 60)
    .map(([k, v]) => `${k} → ${v}`)
    .join("، ");
  return `${AR_GUARDRAILS}\n\nقاموس المصطلحات (استخدمه حرفياً):\n${glossary}`;
}

// ---------- RTL-aware formatting hints injected into prompts ----------
// Numbers, percentages, and prices remain Latin digits per Gulf institutional
// convention. Direction marks are added around symbols so RTL renderers keep
// "BTC -3.2%" visually correct.
export function rtlNumberHint(lang: Lang): string {
  if (lang === "en") return "";
  return `
قواعد تنسيق إضافية لمحتوى RTL:
- أبقِ الأرقام والنسب والأسعار بالأرقام الغربية (1234.56، -3.2%) داخل النص العربي.
- اكتب رموز الأصول بالحروف اللاتينية (BTC, SPX) داخل علامتي اقتباس "" لتثبيت اتجاهها.
- لا تستخدم الأرقام العربية الهندية (١٢٣) في الحقول الرقمية.`.trim();
}

// ---------- Role labels per surface ----------
export type AISurface =
  | "market_analyst" | "news_analyst" | "signal_explainer"
  | "market_insights" | "decision_engine" | "global_macro"
  | "opportunity_scanner" | "notification" | "portfolio_analyst"
  | "economic_briefing" | "advisor" | "asset_verdict"
  | "genesis_copilot";

const ROLE_AR: Record<AISurface, string> = {
  market_analyst: "أنت كبير المحللين في مكتب تداول مؤسسي.",
  news_analyst: "أنت محلل أخبار مالية لمكتب بحوث مؤسسي.",
  signal_explainer: "أنت متداول كمّي مؤسسي يفسّر منطق الإشارات.",
  market_insights: "أنت محلل استراتيجي يقدّم رؤى سوقية قصيرة دوّارة.",
  decision_engine: "أنت رئيس لجنة الاستثمار في صندوق تحوّط مؤسسي.",
  global_macro: "أنت كبير الاستراتيجيين في مكتب الماكرو العالمي.",
  opportunity_scanner: "أنت مدير ماسح الفرص في صندوق متعدد الأصول.",
  notification: "أنت محرّر تنبيهات مؤسسي يكتب إشعاراً موجزاً قابلاً للتنفيذ.",
  portfolio_analyst: "أنت محلل محافظ مؤسسي يقيّم التوزيع والمخاطر.",
  economic_briefing: "أنت كبير الاقتصاديين تكتب موجزاً اقتصادياً يومياً.",
  advisor: 'أنت "ForeSmart Advisor" — مستشار استثماري كبير لأصحاب رؤوس الأموال الصغيرة والمتوسطة.',
  asset_verdict: "أنت محلل أسواق شامل يصدر حكماً مؤسسياً على أصل واحد.",
  genesis_copilot: 'أنت "Genesis" — محرّك الاستخبارات المؤسسية لمنصة ForeSmart. تُحلّل الأسواق بعمق، وتستدلّ على النظام السوقي، وتُنتج سيناريوهات موزونة باحتمالات معايرة بأسلوب مكتب بحوث مؤسسي متخصص.',
};

const ROLE_EN: Record<AISurface, string> = {
  market_analyst: "You are the head analyst on an institutional trading desk.",
  news_analyst: "You are a financial news analyst at an institutional research desk.",
  signal_explainer: "You are an institutional quant trader explaining signal logic.",
  market_insights: "You are a strategist producing short rotating market insights.",
  decision_engine: "You are the head of an institutional hedge fund investment committee.",
  global_macro: "You are the chief strategist on a global macro desk.",
  opportunity_scanner: "You are the head of opportunity scanning at a multi-asset fund.",
  notification: "You are an institutional alert editor writing a concise, actionable notification.",
  portfolio_analyst: "You are an institutional portfolio analyst assessing allocation and risk.",
  economic_briefing: "You are a chief economist writing the daily economic briefing.",
  advisor: "You are 'ForeSmart Advisor' — a senior advisor for small and mid-capital investors.",
  asset_verdict: "You are a comprehensive markets analyst issuing an institutional verdict on a single asset.",
  genesis_copilot: "You are \"Genesis\" — the ForeSmart institutional intelligence engine. You analyse markets in depth, detect the market regime, and produce probability-weighted scenarios with calibrated confidence at the level of a senior institutional research desk.",
};

// ---------- Prompt builder ----------
export interface BuildPromptArgs {
  lang: Lang;
  surface: AISurface;
  /** JSON schema description, e.g. `{ "headline": string, "narrative": string }`. */
  schema: string;
  /** Extra surface-specific instructions (already in the target language). */
  extra?: string;
}

export function buildLocaleSystemPrompt({ lang, surface, schema, extra }: BuildPromptArgs): string {
  const role = lang === "ar" ? ROLE_AR[surface] : ROLE_EN[surface];
  const schemaLine = lang === "ar"
    ? `أرجع كائن JSON صالحاً مطابقاً تماماً للمخطط التالي بدون أي نص آخر:\n${schema}`
    : `Reply with a valid JSON object that strictly matches this schema, with no other text:\n${schema}`;
  return [
    role,
    localeGuardrails(lang),
    rtlNumberHint(lang),
    extra ?? "",
    schemaLine,
  ].filter(Boolean).join("\n\n");
}

// ---------- Locale-aware user-message wrapper ----------
// Some surfaces inject raw context (snapshots, signals). We prefix with the
// language directive so the model NEVER drifts to the wrong locale even if
// the context is in another language.
export function wrapUserContext(lang: Lang, body: string): string {
  const directive = lang === "ar"
    ? "أنتج الجواب بالعربية الفصحى المؤسسية حصراً. السياق التالي قد يكون بأي لغة، لكن مخرجك يجب أن يكون عربياً 100%.\n\nالسياق:\n"
    : "Reply in native institutional English ONLY. The context below may be in any language; your output must be 100% English.\n\nContext:\n";
  return directive + body;
}

// ---------- Post-generation safety: cross-language leakage detector ----------
// If a model occasionally leaks an English sentence into an Arabic response
// (or vice-versa), surfaces can call this to flag the output and fall back.
const AR_CHAR_RE = /[\u0600-\u06FF]/;
const LATIN_WORD_RE = /\b[a-zA-Z]{4,}\b/g;
const SAFE_LATIN_TOKENS = new Set([
  "BTC","ETH","SOL","BNB","SPX","NDX","DJI","TASI","DFM","ADX","QSI","XAU","XAG",
  "WTI","BRENT","RSI","MACD","VIX","DXY","MOVE","ETF","VWRA","SGOV","GLD","IAU",
  "AAPL","MSFT","GOOG","AMZN","META","NVDA","TSLA","BABA",
  "EURUSD","USDJPY","GBPUSD","USDSAR","USDCNY","USDCHF","USDCAD",
  "FED","ECB","SAMA","BOE","BOJ","JSON",
]);

export interface LeakageReport {
  ok: boolean;
  ratio: number;
  offendingTokens: string[];
}

export function detectLanguageLeakage(text: string, lang: Lang): LeakageReport {
  if (!text) return { ok: true, ratio: 0, offendingTokens: [] };
  if (lang === "en") {
    // Reject if substantial Arabic block appears in an EN-only field.
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
    const ratio = arabicChars / Math.max(1, text.length);
    return { ok: ratio < 0.05, ratio, offendingTokens: ratio >= 0.05 ? ["arabic_block"] : [] };
  }
  // AR mode: any meaningful Latin word that isn't a whitelisted ticker is a leak.
  if (!AR_CHAR_RE.test(text)) {
    return { ok: false, ratio: 1, offendingTokens: ["no_arabic"] };
  }
  const matches = text.match(LATIN_WORD_RE) ?? [];
  const offenders = matches.filter((w) => !SAFE_LATIN_TOKENS.has(w.toUpperCase()));
  const ratio = offenders.join(" ").length / Math.max(1, text.length);
  return { ok: ratio < 0.08, ratio, offendingTokens: offenders.slice(0, 10) };
}

// ---------- Convenience: resolve language from a serverFn input ----------
export function resolveLang(input: { language?: string | null } | null | undefined): Lang {
  const l = input?.language;
  return l === "ar" ? "ar" : l === "en" ? "en" : "en";
}
