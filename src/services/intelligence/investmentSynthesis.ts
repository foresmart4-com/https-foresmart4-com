/**
 * Investment Synthesis Engine — Phase 62
 * Pure function — no network calls, no AI calls, no localStorage writes.
 * Generates a structured institutional synthesis layer that helps Genesis answer
 * investment questions with committee-style depth instead of generic summaries.
 *
 * Synthesis modes:
 *   committee_memo      — full investment committee structure: macro → sectors → stance
 *   sector_analysis     — sector-level dynamics and rotation logic
 *   company_framework   — selection criteria and factor screens (no hallucinated picks)
 *   market_outlook      — probability-weighted scenarios and confidence-limited view
 *   portfolio_allocation — allocation logic relative to macro regime
 *   insufficient        — no investment intent detected; no synthesis injected
 *
 * Investment stances:
 *   constructive_selective          — favorable environment; selectivity beats broad exposure
 *   neutral_wait_for_confirmation   — mixed signals; wait for a confirmation catalyst
 *   defensive_preservation          — elevated risk; capital protection priority
 *   opportunistic_on_pullbacks      — directional but entry conditions matter; not chasing
 *   avoid_high_beta_until_confirmation — speculative exposure premature until regime confirms
 *   insufficient_evidence           — no clear stance signal from available context
 *
 * Design rules:
 * - Pure educational and governance-safe investment reasoning — no execution
 * - No guaranteed recommendations — conditional language enforced throughout
 * - No "buy now" / "guaranteed gains" / "certain winner" framing
 * - Named companies require current valuation/fundamental confirmation — never hallucinated
 * - Sector lens is structural and analytical — never a sector allocation instruction
 * - Stance is analytical framing — never a portfolio action trigger
 * - All output defers to human judgment and real-time fundamental verification
 * - Saudi-specific analysis covers oil channel, SAR peg, Vision 2030, foreign flows
 * - Macro → sector → portfolio linkage is explicit and causal, never associative
 *
 * Context injection format (compact ≤250 chars):
 *   Investment synthesis: [mode] | Stance: [stance] | Sector lens: [s1], [s2], [s3] | [market]
 *
 * Safety assertions (always enforced):
 *   isTradeInstruction   — always false; no buy/sell instruction
 *   isExecution          — always false; no broker or order logic
 *   isCertaintyAmplified — always false; hedged language enforced
 */

import type { FirewallState } from "@/services/governance/decisionFirewall";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type InvestmentStance =
  | "constructive_selective"             // favorable; selectivity > broad exposure
  | "neutral_wait_for_confirmation"      // mixed; confirmation catalyst needed
  | "defensive_preservation"             // elevated risk; capital protection priority
  | "opportunistic_on_pullbacks"         // directional; entry conditions matter
  | "avoid_high_beta_until_confirmation" // speculative exposure premature
  | "insufficient_evidence";             // no clear stance signal

export type SynthesisMode =
  | "committee_memo"      // macro → sectors → stance (full committee structure)
  | "sector_analysis"     // sector dynamics and rotation
  | "company_framework"   // selection criteria, no hallucinated picks
  | "market_outlook"      // probability-weighted macro scenarios
  | "portfolio_allocation"// allocation logic vs regime
  | "insufficient";       // no investment intent detected

export interface InvestmentSynthesisInput {
  question: string;
  marketContext: string;
  firewallState?: FirewallState;
  ar?: boolean;
}

export interface InvestmentSynthesisResult {
  synthesisMode: SynthesisMode;
  stanceType: InvestmentStance;
  sectorLens: string[];          // 2-4 relevant sector labels
  isSaudiMarket: boolean;
  stanceNote: string;            // 1 sentence: what this stance means
  selectionNote: string | null;  // when company_framework mode is active
  stanceInvalidation: string | null; // what would change the view
  investorProfile: string | null;    // what investor type this suits
  contextString: string;         // compact ≤250 chars for Genesis injection
  // Safety assertions — always enforced; no exceptions
  readonly isTradeInstruction: false;
  readonly isExecution: false;
  readonly isCertaintyAmplified: false;
}

// ─── Detection patterns ────────────────────────────────────────────────────────

// Investment intent — broad signal that a synthesis layer is warranted
const INVEST_INTENT = /should.{0,5}i.{0,5}invest|invest.{0,5}in|investment.{0,5}(outlook|view|question)|market.{0,5}outlook|which.{0,5}(compan|stock|sector)|best.{0,5}(stock|gain|return|sector|compan)|highest.{0,5}(return|profit|gain)|portfolio.{0,5}(allocation|strategy)|where.{0,5}invest|sector.{0,5}(outlook|analysis|rotation|exposure)|is.{0,5}(good|right|bad).{0,5}time|can.{0,5}i.{0,5}invest|how.{0,5}(should|to).{0,5}invest|what.{0,5}(sectors|companies|stocks)|good.{0,5}time.{0,5}to.{0,5}invest|هل.{0,5}أستثمر|استثمار.{0,5}في|توقعات.{0,5}(السوق|الاستثمار|الأسهم)|أفضل.{0,5}(أسهم|شركات|قطاعات)|تخصيص.{0,5}(محفظة|رأس|المال)|أين.{0,5}أستثمر|ما.{0,5}(أفضل|القطاعات|الشركات|الأسهم)|كيف.{0,5}أستثمر|أسهم.{0,5}مربحة|هل.{0,5}الوقت.{0,5}مناسب/i;

// Mode-specific patterns
const OUTLOOK_PATTERN = /outlook|forecast|3.{0,3}month|6.{0,3}month|12.{0,3}month|next.{0,3}(quarter|year|half)|coming.{0,3}(month|quarter)|forward.{0,3}look|medium.?term|توقعات|أفق|ربع.{0,3}عام|نصف.{0,3}عام|المقبل|المدى/i;
const SECTOR_Q_PATTERN = /which.{0,5}sector|sector.{0,5}(to.{0,3}buy|exposure|analysis|look|rotation)|sector.{0,5}play|قطاع|أي.{0,5}قطاع|قطاعات/i;
const COMPANY_Q_PATTERN = /which.{0,5}(compan|stock)|specific.{0,5}(stock|compan)|top.{0,5}pick|name.{0,5}(stock|compan)|best.{0,5}compan|أي.{0,5}شركات|أسهم.{0,5}محددة|ما.{0,5}هي.{0,5}الشركات|أفضل.{0,5}شركات|شركات.{0,5}مقترحة/i;
const PORTFOLIO_Q_PATTERN = /portfolio|my.{0,5}(hold|position|invest|assets)|allocation|how.{0,5}(to.{0,5}allocate|much.{0,5}to)|محفظة|مراكزي|استثماراتي|كيف.{0,5}أوزع|توزيع.{0,5}(رأس|المال)/i;

// Market geography detection
const SAUDI_PATTERN = /\b(tasi|saudi|aramco|sabic|2222\.sr|nomu|dfm|adx)\b|أرامكو|تاسي|سعود|سابك|نمو|السوق.{0,5}السعودي|البورصة.{0,5}السعودية/i;

// Stance signal scoring
const DEFENSIVE_SIGNALS = /risk.?off|high.?(uncertain|volat)|bear.?(market|trend)|market.?(correction|crash)|falling.?market|credit.?stress|funding.?stress|headwind|tightening.?cycle|bear.?ranging|high.?vol.?risk|هابط|تصحيح|ضغط.?ائتمان|مخاطر.?مرتفعة|سوق.?هابط|تشديد/i;
const CONSTRUCTIVE_SIGNALS = /risk.?on|bull.?(market|trend)|recovery|upside|positive.?outlook|strong.?momentum|accumulation|easing.?cycle|bull.?trending|low.?vol.?accum|صاعد|انتعاش|إيجابي|زخم.?صاعد|تيسير/i;
const WAIT_SIGNALS = /wait.?for|mixed.?(signal|outlook)|unclear|uncertain.?(outlook|signal)|transition|range.?bound|no.?clear|stable.?cycle|macro.?transition|conflicting.?regime|انتظر|مختلط|غير.?واضح|ترقب|ترسيخ|انتقال/i;
const PULLBACK_SIGNALS = /pullback|buy.?the.?dip|buy.?on.?weakness|oversold|entry.?point|on.?weakness|عند.?الانخفاض|شراء.?على.?الضعف|نقطة.?دخول/i;
const HIGH_BETA_SIGNALS = /speculative|leveraged|high.?beta|small.?cap|momentum.?play|growth.?stock|penny.?stock|مضاربة|رافعة.?مالية|أسهم.?مضاربة/i;

// Saudi sector patterns
const SAUDI_SECTOR_PATTERNS: Record<string, RegExp> = {
  "banks/financials":       /bank|finance|مصرف|بنك|مالي|الراجحي|رياض.?بنك|سامبا/i,
  "energy/petrochemicals":  /energy|oil|aramco|sabic|petrochemi|نفط|طاقة|بتروكيماوي|سابك|أرامكو/i,
  telecom:                  /telecom|stc|zain|mobily|اتصال|زين|موبايلي|اتصالات/i,
  healthcare:               /health|medical|pharma|hospital|صحة|طبي|دواء|مستشفى/i,
  consumer:                 /consumer|retail|food|catering|entertain|مستهلك|تجزئة|غذاء|ترفيه/i,
  utilities:                /utilit|electric|water|كهرباء|مياه/i,
  industrials:              /industr|manufact|construct|cement|engineering|صناعة|إنشاء|أسمنت|هندسة/i,
  "REITs":                  /reit|real.?estate|عقار|صندوق.{0,3}عقاري/i,
};

// Global sector patterns
const GLOBAL_SECTOR_PATTERNS: Record<string, RegExp> = {
  technology:        /tech|software|ai|chip|semiconductor|cloud|internet|تقنية|برمجيات|ذكاء.{0,3}اصطناعي|شريحة/i,
  financials:        /bank|financial|insur|credit|بنك|مالي|تأمين/i,
  energy:            /energy|oil|gas|طاقة|نفط|غاز/i,
  defensives:        /defensive|staples|utilit|healthcare|consumer.{0,5}staple|دفاعي|أساسيات/i,
  cyclicals:         /cyclical|consumer.{0,5}disc|auto|travel|hotel|دوري|سياحة|سيارات/i,
  commodities:       /commodit|gold|copper|metal|silver|سلع|ذهب|معادن|نحاس/i,
  "rates-sensitive": /rate.{0,5}sensitiv|bond|duration|reit|فائدة|سندات|مدة.?سندات/i,
};

// ─── Detection functions ───────────────────────────────────────────────────────

function hasInvestmentIntent(question: string, ctx: string): boolean {
  return INVEST_INTENT.test(question) || INVEST_INTENT.test(ctx.slice(0, 400));
}

function detectSaudiMarket(question: string, ctx: string): boolean {
  return SAUDI_PATTERN.test(question) || SAUDI_PATTERN.test(ctx.slice(0, 500));
}

function detectSynthesisMode(question: string, ctx: string): SynthesisMode {
  const combined = `${question} ${ctx.slice(0, 400)}`;

  // Company selection question — highest specificity
  if (COMPANY_Q_PATTERN.test(combined)) return "company_framework";

  // Sector-specific question without forward-looking horizon
  if (SECTOR_Q_PATTERN.test(combined) && !OUTLOOK_PATTERN.test(question)) return "sector_analysis";

  // Portfolio allocation question
  if (PORTFOLIO_Q_PATTERN.test(combined)) return "portfolio_allocation";

  // Explicit time-horizon outlook question
  if (OUTLOOK_PATTERN.test(question)) return "market_outlook";

  // General investment question → full committee memo
  if (INVEST_INTENT.test(question)) return "committee_memo";

  return "insufficient";
}

function selectSectors(question: string, ctx: string, isSaudi: boolean): string[] {
  const combined = `${question} ${ctx.slice(0, 500)}`;
  const detected: string[] = [];

  const patterns = isSaudi ? SAUDI_SECTOR_PATTERNS : GLOBAL_SECTOR_PATTERNS;
  for (const [sector, pattern] of Object.entries(patterns)) {
    if (pattern.test(combined)) detected.push(sector);
  }

  // Default sectors when none detected — use highest TASI/global weight sectors
  if (!detected.length) {
    if (isSaudi) {
      detected.push("banks/financials", "energy/petrochemicals", "telecom");
    } else {
      detected.push("technology", "financials", "energy");
    }
  }

  return detected.slice(0, 4);
}

// ─── Stance scoring ────────────────────────────────────────────────────────────
// Score each stance signal from question + context. Higher score → stronger signal.

interface StanceScores {
  defensive: number;
  constructive: number;
  wait: number;
  pullback: number;
  highBeta: number;
}

function scoreStanceSignals(question: string, ctx: string): StanceScores {
  const combined = `${question} ${ctx.slice(0, 800)}`;

  const defensive =
    (DEFENSIVE_SIGNALS.test(combined) ? 3 : 0) +
    (/blocked|constrained|human.?review/.test(ctx) ? 2 : 0) +
    (/tightening.?cycle|bear.?ranging|high.?vol.?risk.?off/.test(ctx) ? 2 : 0) +
    (/credit.?stress.?level.{0,10}(high|extreme)|credit.?stress.{0,5}(high|extreme)/.test(ctx) ? 2 : 0) +
    (/fear.?dominant|behavioral.{0,10}fear/.test(ctx) ? 1 : 0);

  const constructive =
    (CONSTRUCTIVE_SIGNALS.test(combined) ? 3 : 0) +
    (/bull.?trending|low.?vol.?accum|easing.?cycle|stable.?cycle/.test(ctx) ? 2 : 0) +
    (/risk.?on/.test(ctx) ? 1 : 0) +
    (/greed.?dominant/.test(ctx) ? 1 : 0);

  const wait =
    (WAIT_SIGNALS.test(combined) ? 3 : 0) +
    (/macro.?transition|conflicting.?regime|fragmented.?cycle/.test(ctx) ? 2 : 0) +
    (/mixed.?signal|insufficient|uncertain/.test(ctx) ? 1 : 0);

  const pullback = PULLBACK_SIGNALS.test(combined) ? 3 : 0;
  const highBeta = HIGH_BETA_SIGNALS.test(combined) ? 2 : 0;

  return { defensive, constructive, wait, pullback, highBeta };
}

function deriveStance(
  question: string,
  ctx: string,
  firewallState: FirewallState,
): InvestmentStance {
  // Firewall blocked → insufficient evidence immediately
  if (firewallState === "blocked") return "insufficient_evidence";

  const s = scoreStanceSignals(question, ctx);

  // Governance-constrained or very high defensive: defensive or insufficient
  if (s.defensive >= 7) return "defensive_preservation";
  if (firewallState === "constrained" && s.constructive < 3) return "insufficient_evidence";

  // Pullback: only when constructive base is present
  if (s.pullback >= 3 && s.constructive >= 2 && s.defensive < 4) {
    return "opportunistic_on_pullbacks";
  }

  // High beta avoidance: speculative question + moderate risk signal
  if (s.highBeta >= 2 && (s.defensive >= 2 || s.wait >= 2)) {
    return "avoid_high_beta_until_confirmation";
  }

  // Decisive scoring
  const max = Math.max(s.defensive, s.constructive, s.wait);
  if (max < 2) return "insufficient_evidence";

  if (s.defensive === max && s.defensive >= 3) return "defensive_preservation";
  if (s.constructive === max && s.constructive >= 3) return "constructive_selective";
  if (s.wait === max && s.wait >= 3) return "neutral_wait_for_confirmation";

  // Soft constructive: constructive edge without strong signal
  if (s.constructive >= 2 && s.constructive > s.defensive) return "constructive_selective";

  return "insufficient_evidence";
}

// ─── Bilingual stance notes ────────────────────────────────────────────────────

const STANCE_NOTES_EN: Record<InvestmentStance, string> = {
  constructive_selective:
    "A selective approach is supported — broad market exposure underperforms targeted sector or factor positioning in the current regime.",
  neutral_wait_for_confirmation:
    "Signal clarity is insufficient for high-conviction directional positioning — a confirmation catalyst is needed before committing a view.",
  defensive_preservation:
    "Risk environment supports capital preservation priority — high-beta and speculative exposure warrants reduction pending regime clarity.",
  opportunistic_on_pullbacks:
    "Setup may be favorable on weakness — a patient, entry-condition-dependent approach is more appropriate than momentum chasing.",
  avoid_high_beta_until_confirmation:
    "Speculative and leveraged exposure is premature — regime confirmation is required before high-beta positions are appropriate.",
  insufficient_evidence:
    "Available context is insufficient for a confident investment stance — analysis proceeds from available evidence only.",
};

const STANCE_NOTES_AR: Record<InvestmentStance, string> = {
  constructive_selective:
    "النهج الانتقائي مدعوم — التعرض الواسع للسوق أقل فاعلية من التمركز القطاعي أو العاملي المستهدف في النظام الحالي.",
  neutral_wait_for_confirmation:
    "وضوح الإشارات غير كافٍ لتمركز اتجاهي عالي القناعة — يُشترط وجود محفز تأكيدي قبل الالتزام بموقف.",
  defensive_preservation:
    "بيئة المخاطر تدعم أولوية الحفاظ على رأس المال — التعرض عالي البيتا والمضاربي يستدعي التخفيض ريثما يتضح النظام.",
  opportunistic_on_pullbacks:
    "الإعداد قد يكون مواتياً عند الضعف — النهج الصبور المشروط بشروط الدخول أكثر ملاءمةً من مطاردة الزخم.",
  avoid_high_beta_until_confirmation:
    "التعرض المضاربي والرافعة سابق لأوانه — يُشترط تأكيد النظام قبل اعتبار مراكز عالية البيتا مناسبة.",
  insufficient_evidence:
    "السياق المتاح غير كافٍ لموقف استثماري واثق — التحليل ينطلق من الأدلة المتوفرة فحسب.",
};

const STANCE_INVALIDATION_EN: Record<InvestmentStance, string> = {
  constructive_selective:
    "View weakens if macro regime shifts to risk-off or credit spreads widen materially.",
  neutral_wait_for_confirmation:
    "Stance resolves if a clear directional catalyst confirms regime direction.",
  defensive_preservation:
    "Defensive posture eases if risk indicators normalize and regime transitions to risk-on.",
  opportunistic_on_pullbacks:
    "Stance invalidated if the underlying macro thesis deteriorates before entry conditions are met.",
  avoid_high_beta_until_confirmation:
    "Restriction lifts when regime confirmation arrives and speculative-grade volatility normalizes.",
  insufficient_evidence:
    "Stance can form when regime clarity, cross-asset confirmation, or fundamental data is available.",
};

const STANCE_INVALIDATION_AR: Record<InvestmentStance, string> = {
  constructive_selective:
    "الرأي يضعف إذا تحوّل النظام إلى الحذر أو اتسعت فوارق الائتمان بشكل ملموس.",
  neutral_wait_for_confirmation:
    "الموقف يُحسم إذا جاء محفز اتجاهي واضح يؤكد اتجاه النظام.",
  defensive_preservation:
    "التوجه الدفاعي يخف إذا تحسنت مؤشرات المخاطر وانتقل النظام إلى الشراء أو التراكم.",
  opportunistic_on_pullbacks:
    "الموقف يُلغى إذا تدهورت الأطروحة الكلية الأساسية قبل استيفاء شروط الدخول.",
  avoid_high_beta_until_confirmation:
    "القيد يرتفع عند توافر تأكيد النظام وتطبيع تقلبات الدرجة المضاربية.",
  insufficient_evidence:
    "يمكن تكوين موقف عند توافر وضوح النظام أو تأكيد الأصول المتقاطعة أو البيانات الأساسية.",
};

const INVESTOR_PROFILE_EN: Record<InvestmentStance, string | null> = {
  constructive_selective:
    "Suitable for medium-to-long horizon investors with moderate-to-high risk tolerance who can be selective across sectors.",
  neutral_wait_for_confirmation:
    "Appropriate for all profiles; particularly relevant for investors with near-term deployment decisions who benefit from regime clarity.",
  defensive_preservation:
    "Aligns with conservative or capital-preservation mandates; also for investors near drawdown limits or with short horizons.",
  opportunistic_on_pullbacks:
    "Suitable for patient investors with available capital and a defined entry framework; not for momentum strategies.",
  avoid_high_beta_until_confirmation:
    "Relevant for risk-aware investors holding speculative positions or considering leveraged exposure in the current regime.",
  insufficient_evidence:
    null,
};

const INVESTOR_PROFILE_AR: Record<InvestmentStance, string | null> = {
  constructive_selective:
    "يناسب المستثمرين ذوي الأفق المتوسط-الطويل وتحمّل المخاطر المعتدل-المرتفع والقدرة على الانتقائية القطاعية.",
  neutral_wait_for_confirmation:
    "يناسب جميع الملفات؛ مهم بشكل خاص لمن يتخذ قرارات نشر رأس مال قريبة الأجل تتطلب وضوح النظام.",
  defensive_preservation:
    "يتوافق مع تفويضات المحافظة أو حفظ رأس المال؛ ومناسب لمن يقترب من حدود التراجع أو يمتلك أفقاً قصيراً.",
  opportunistic_on_pullbacks:
    "يناسب المستثمرين الصبورين الذين يملكون سيولة جاهزة وإطار دخول محدداً؛ غير موصى به لاستراتيجيات الزخم.",
  avoid_high_beta_until_confirmation:
    "مهم لمن يحمل مراكز مضاربية أو يدرس تعرضاً برافعة مالية في النظام الحالي.",
  insufficient_evidence:
    null,
};

// ─── Selection note (company framework only) ──────────────────────────────────

const SELECTION_NOTE_EN =
  "Company selection requires: earnings quality, balance sheet strength, dividend resilience, valuation discipline, " +
  "market liquidity, oil/rates/DXY sensitivity, and current fundamental confirmation. " +
  "Named company picks are conditional on current data not available in this context.";

const SELECTION_NOTE_AR =
  "اختيار الشركات يستلزم: جودة الأرباح، متانة الميزانية، ديمومة الأرباح الموزعة، انضباط التقييم، " +
  "السيولة السوقية، الحساسية للنفط/الفائدة/الدولار، والتأكيد الأساسي الحالي. " +
  "أسماء الشركات مشروطة ببيانات حالية غير متوفرة في هذا السياق.";

// ─── Context string builder ────────────────────────────────────────────────────

function buildContextString(
  mode: SynthesisMode,
  stance: InvestmentStance,
  sectors: string[],
  isSaudi: boolean,
  hasCompanyQ: boolean,
): string {
  if (mode === "insufficient") return "";

  // Abbreviated stance labels to stay within 250 chars
  const stanceAbbrev: Record<InvestmentStance, string> = {
    constructive_selective:             "constructive_selective",
    neutral_wait_for_confirmation:      "neutral_wait",
    defensive_preservation:             "defensive",
    opportunistic_on_pullbacks:         "opportunistic",
    avoid_high_beta_until_confirmation: "avoid_high_beta",
    insufficient_evidence:              "insufficient",
  };

  const modeLabel = mode.replace(/_/g, " ");
  const stanceLabel = stanceAbbrev[stance];
  const marketLabel = isSaudi ? "Saudi/TASI" : "global";
  const sectorStr = sectors.slice(0, 3).join(", ");

  const parts = [
    `Investment synthesis: ${modeLabel}`,
    `Stance: ${stanceLabel}`,
    `Sector lens: ${sectorStr}`,
    `Market: ${marketLabel}`,
  ];

  if (hasCompanyQ) {
    parts.push("Selection framework: earnings quality, balance sheet, dividend, valuation, liquidity | Named picks need current fundamentals");
  }

  return parts.join(" | ").slice(0, 250);
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function computeInvestmentSynthesis(input: InvestmentSynthesisInput): InvestmentSynthesisResult {
  const { question, marketContext, firewallState = "open", ar = false } = input;

  // Firewall blocked — return safe insufficient state
  if (firewallState === "blocked") {
    return {
      synthesisMode: "insufficient",
      stanceType: "insufficient_evidence",
      sectorLens: [],
      isSaudiMarket: false,
      stanceNote: ar
        ? "تحليل الاستثمار المؤسسي معلّق — جدار الحماية محجوب."
        : "Institutional investment synthesis suspended — firewall blocked.",
      selectionNote: null,
      stanceInvalidation: null,
      investorProfile: null,
      contextString: "",
      isTradeInstruction: false,
      isExecution: false,
      isCertaintyAmplified: false,
    };
  }

  // No investment intent detected → no synthesis injected
  if (!hasInvestmentIntent(question, marketContext)) {
    return {
      synthesisMode: "insufficient",
      stanceType: "insufficient_evidence",
      sectorLens: [],
      isSaudiMarket: false,
      stanceNote: ar
        ? "السياق لا يتضمن نية استثمارية واضحة — التركيب التحليلي غير مُفعَّل."
        : "No clear investment intent detected — synthesis layer not activated.",
      selectionNote: null,
      stanceInvalidation: null,
      investorProfile: null,
      contextString: "",
      isTradeInstruction: false,
      isExecution: false,
      isCertaintyAmplified: false,
    };
  }

  // Detect market type and synthesis mode
  const isSaudi = detectSaudiMarket(question, marketContext);
  const mode = detectSynthesisMode(question, marketContext);
  const sectors = selectSectors(question, marketContext, isSaudi);
  const stance = deriveStance(question, marketContext, firewallState);
  const hasCompanyQ = COMPANY_Q_PATTERN.test(question);

  // Build notes
  const stanceNote = ar ? STANCE_NOTES_AR[stance] : STANCE_NOTES_EN[stance];
  const stanceInvalidation = ar ? STANCE_INVALIDATION_AR[stance] : STANCE_INVALIDATION_EN[stance];
  const investorProfile = ar ? INVESTOR_PROFILE_AR[stance] : INVESTOR_PROFILE_EN[stance];
  const selectionNote = hasCompanyQ || mode === "company_framework"
    ? (ar ? SELECTION_NOTE_AR : SELECTION_NOTE_EN)
    : null;

  const contextString = buildContextString(mode, stance, sectors, isSaudi, hasCompanyQ);

  return {
    synthesisMode: mode,
    stanceType: stance,
    sectorLens: sectors,
    isSaudiMarket: isSaudi,
    stanceNote,
    selectionNote,
    stanceInvalidation,
    investorProfile,
    contextString,
    isTradeInstruction: false,
    isExecution: false,
    isCertaintyAmplified: false,
  };
}
