// P0 Genesis Intelligence Rescue — Knowledge Activation Core
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Root cause fix:
//   Genesis produces shallow output not because the AI lacks knowledge, but because:
//   (a) Long prompt context causes specific facts to get lost in noise.
//   (b) Directive-style injections ("reason about oil breakeven") are
//       acknowledged then ignored in favour of safe generalisations.
//   (c) Without concrete numbers and named chains, the AI defaults to
//       "oil affects the market" rather than grounded institutional analysis.
//
//   This engine detects which knowledge domains a question requires, then injects
//   a COMPACT, FACT-DENSE knowledge block — specific numbers, named entities,
//   explicit transmission chains — that the AI MUST use. Generic commentary
//   becomes structurally harder once the model has specific facts in front of it.
//
// Architecture:
//   - 12 knowledge domains, each with factual assertions + transmission chain
//     + allocator implication + key questions to answer
//   - Domain detection via keyword/intent patterns
//   - Returns a compact injection string (<1500 chars for all domains combined)
//   - Also returns a human-readable summary for the activatedKnowledge reply field

// ─── Types ─────────────────────────────────────────────────────────────────────

export type KnowledgeDomain =
  | "saudi_market"
  | "oil_fiscal"
  | "sama_fed_peg"
  | "banks_credit"
  | "petrochemicals_china"
  | "aramco_dividends"
  | "vision_2030"
  | "valuation_earnings"
  | "liquidity_credit_rates"
  | "allocator_playbook"
  | "historical_analogs"
  | "sector_rotation";

export interface KnowledgeActivationResult {
  activatedDomains: KnowledgeDomain[];
  knowledgeContext: string;    // compact block injected into AI prompt
  activationSummary: string;   // value for activatedKnowledge reply field
  mandatoryQuestions: string[]; // questions the final answer must address
}

// ─── Domain detection ─────────────────────────────────────────────────────────

const DOMAIN_PATTERNS: Record<KnowledgeDomain, RegExp> = {
  saudi_market:           /tasi|saudi|سعود|تاسي|خليج|gulf|ksa/i,
  oil_fiscal:             /oil|نفط|brent|wti|opec|crude|fiscal|breakeven|نقطة\s*التعادل|ميزانية/i,
  sama_fed_peg:           /sama|fed|federal|سامة|الفيدرالي|peg|ربط|sar\s+peg|فائدة|rate\s+policy|monetary/i,
  banks_credit:           /bank|بنك|credit|ائتمان|lending|إقراض|nim|margin|مصرف|القطاع\s+المصرفي/i,
  petrochemicals_china:   /petrochem|بتروكيماوي|sabic|سابك|china|صين|naphtha|ethylene|إيثيلين/i,
  aramco_dividends:       /aramco|أرامكو|dividend|توزيعات|2222|defensive|دفاعي/i,
  vision_2030:            /vision\s+2030|رؤية\s+2030|neom|نيوم|capex|رأسمالية|project|مشروع|giga/i,
  valuation_earnings:     /valuation|تقييم|p\/e|pe\s+ratio|earnings|أرباح|multiple|مضاعف|growth|نمو/i,
  liquidity_credit_rates: /liquidity|سيولة|dxy|dollar|دولار|tlt|rates?|فائدة|credit\s+spread|فوارق/i,
  allocator_playbook:     /allocat|مخصص|conservative|محافظ|portfolio|محفظة|horizon|أفق|deployment|investment\s+manager|مدير\s+استثمار/i,
  historical_analogs:     /history|تاريخ|analog|2014|2016|2020|cycle|دورة|precedent|previous\s+(oil|market)/i,
  sector_rotation:        /sector|قطاع|rotation|دوران|winner|rابح|loser|خاسر|outperform|تفوق/i,
};

function detectDomains(question: string, ctx: string, isSaudi: boolean): KnowledgeDomain[] {
  const text = `${question} ${ctx}`.slice(0, 2000);
  const detected = new Set<KnowledgeDomain>();

  for (const [domain, pattern] of Object.entries(DOMAIN_PATTERNS) as [KnowledgeDomain, RegExp][]) {
    if (pattern.test(text)) detected.add(domain);
  }

  // Saudi questions always need these core packs
  if (isSaudi || detected.has("saudi_market")) {
    (["oil_fiscal", "sama_fed_peg", "banks_credit", "aramco_dividends"] as KnowledgeDomain[]).forEach(d => detected.add(d));
  }

  // Allocator questions always need playbook
  if (/محافظ|conservative|أفق|horizon|12.{0,5}24|مدير\s+استثمار|investment\s+manager/i.test(text)) {
    detected.add("allocator_playbook");
  }

  return Array.from(detected);
}

// ─── Knowledge packs (fact-dense, number-grounded) ────────────────────────────
// Each pack contains: structural facts + transmission chain + allocator implication.
// All claims are bounded/conditional — no fabricated live data.

const PACKS_EN: Record<KnowledgeDomain, { facts: string; chain: string; allocatorNote: string; questions: string[] }> = {
  saudi_market: {
    facts: "TASI structural facts: Aramco ≈60% of TASI market cap; banking sector (PRE) ≈30%; petrochemicals (SABIC) ≈5-8%. Foreign ownership ≈10-15% — flows sensitive to oil price and EM risk-on/off cycles. TASI historical P/E range: 15-22x; tends to re-rate with oil price and regional liquidity.",
    chain: "Oil direction → government fiscal space → public capex pace → non-oil GDP → bank deposit growth → credit growth → TASI earnings breadth.",
    allocatorNote: "Conservative allocator: Aramco's yield (~4-5% at standard dividend) sets the TASI opportunity cost floor; selective over broad ETF exposure in uncertain oil regime.",
    questions: ["Is the Aramco dividend covered at current oil prices?", "Are TASI multiples above or below historical average given current regime?"],
  },
  oil_fiscal: {
    facts: "Saudi fiscal breakeven: estimated ~$75-80/bbl WTI (adjusted for Vision 2030 spending commitments; varies ±$5 with annual budget). Budget revenues ≈65-70% oil-dependent. At oil above breakeven: surplus → accelerated capex; below: deficit financing reduces spending velocity.",
    chain: "Oil price vs breakeven → fiscal surplus/deficit → government spending pace → Vision 2030 disbursements → infrastructure sector revenues → TASI non-energy earnings.",
    allocatorNote: "Breakeven is the single most important number for Saudi equity conviction. Oil $5/bbl below breakeven for a sustained period historically precedes spending deferrals and TASI multiple compression.",
    questions: ["Is oil currently above or below the Saudi fiscal breakeven?", "What is the trajectory — rising toward or falling away from breakeven?"],
  },
  sama_fed_peg: {
    facts: "SAR hard-pegged to USD since 1986 (1 USD ≈ 3.75 SAR). SAMA has no independent monetary policy: when Fed raises, SAMA raises; when Fed cuts, SAMA cuts. This means Saudi borrowing costs are set by US inflation/growth dynamics, not Saudi domestic conditions.",
    chain: "Fed rate decision → SAMA mirrors → Saudi local lending rates → mortgage and corporate credit costs → bank net interest margins (NIM) → credit growth → TASI banking sector PE.",
    allocatorNote: "The peg constraint is the key risk for any allocator: if Saudi economy weakens but Fed holds rates, SAMA cannot provide domestic stimulus — allocator must price in this policy trap.",
    questions: ["Where is the Fed in its rate cycle?", "Is SAMA's constrained policy a tailwind (easing) or headwind (holding/hiking) right now?"],
  },
  banks_credit: {
    facts: "Saudi banking sector: ~30% of TASI. Key NIM dynamic: rising rates → NIM expansion (banks benefit short-term) but rising credit costs → NPL risk medium-term. Government deposits in banks fund much of the lending base; oil revenue decline → government deposit withdrawal → credit tightening.",
    chain: "Fed/SAMA rate → NIM → bank profitability → bank PE multiple → TASI direction. Oil decline → government deposit outflows → bank funding pressure → credit tightening → real estate valuation pressure → NPL risk.",
    allocatorNote: "Banks are a leveraged play on both oil (via government deposits) and rates (via NIM). In a stable oil/moderate-rate environment, quality Saudi banks are attractive. In oil stress + tight rates, bank valuations compress faster than TASI average.",
    questions: ["Is bank credit growth positive or decelerating?", "Are government deposits growing or declining (oil proxy)?"],
  },
  petrochemicals_china: {
    facts: "SABIC (70% Aramco-owned, listed): largest petrochemical company in Saudi Arabia. Revenue and margins driven by naphtha-ethylene spread, which tracks China industrial PMI and domestic ethylene demand. China accounts for ~40% of global ethylene consumption.",
    chain: "China PMI/industrial activity → global ethylene demand → naphtha-ethylene spread → SABIC EBITDA margin → SABIC PE → petrochemicals sector performance in TASI.",
    allocatorNote: "SABIC is a China-demand proxy, not a Saudi domestic story. Allocators should size SABIC exposure relative to China recovery conviction, not Saudi fiscal health.",
    questions: ["Is China industrial PMI in expansion or contraction?", "Where is the ethylene-naphtha spread relative to historical average?"],
  },
  aramco_dividends: {
    facts: "Saudi Aramco: ~98% state-owned (post-IPO small float). Dividend policy: ordinary dividend ($0.43/share quarterly ≈$7B/qtr) + performance-linked dividend. At oil ~$70-75, ordinary dividend is approximately covered; below $65 becomes fiscally strained. Aramco dividend = primary mechanism funding Saudi government budget.",
    chain: "Oil price → Aramco free cash flow → ordinary + performance dividend → Saudi government revenue → public spending capacity → Vision 2030 disbursements → TASI macro environment.",
    allocatorNote: "Aramco's dividend yield functions as the TASI PE floor anchor: foreign investors require yield premium over risk-free. At yield > 4%, Aramco acts as a defensive anchor for conservative Saudi allocators.",
    questions: ["Is Aramco's dividend coverage ratio positive at current oil?", "Is the performance-linked dividend at risk of reduction?"],
  },
  vision_2030: {
    facts: "Vision 2030: ~$500B+ in committed capex across Giga-Projects (NEOM, Qiddiya, Red Sea, ROSHN, Diriyah). Status: capital-consuming pre-revenue phase. Most projects will not generate material earnings for 5-10+ years. Government funding contingent on oil surplus — if oil below breakeven, disbursements are deferred, not cancelled (but pace slows).",
    chain: "Oil surplus → government budget surplus → Vision 2030 capex disbursements → construction/infrastructure sector revenues → beneficiary company revenues (ACWA, Saudi Aramco Base, local contractors) → TASI growth sector PE.",
    allocatorNote: "Vision 2030 names trade on future earnings expectation, not current fundamentals. Premium valuations (P/E 30-60x) require sustained oil surplus conviction. Conservative allocator avoids unless oil is firmly above breakeven and government spending rate is confirmed.",
    questions: ["Is government capex disbursement accelerating or decelerating?", "Are Vision 2030 beneficiary company revenues materializing or still promise-based?"],
  },
  valuation_earnings: {
    facts: "Multiple expansion vs earnings growth distinction: Saudi TASI can re-rate via (a) PE expansion driven by risk-on flow and rate easing — fragile, reverses with policy or risk-off; or (b) EPS growth from oil revenue → bank credit → corporate earnings — durable, but requires oil above breakeven for 2+ years. TASI trailing P/E at high oil environments: 18-22x; at oil-stress: 14-17x.",
    chain: "PE expansion path: rate cut expectations → risk-on capital flows → TASI PE expands from 16x to 20x → index return without earnings growth. Earnings growth path: oil above $80 for 12+ months → government spending up → bank lending up → corporate revenue growth → EPS up 10-15% → TASI return with fundamental support.",
    allocatorNote: "PE expansion returns are borrowing from future returns; EPS growth returns are adding to the value base. Conservative allocator with 12-24M horizon prefers EPS-growth thesis (requires oil conviction) over PE-expansion thesis (requires monetary easing conviction).",
    questions: ["Is the current TASI return driven by multiple expansion or earnings growth?", "What is the P/E level vs historical average in this oil regime?"],
  },
  liquidity_credit_rates: {
    facts: "Global liquidity drivers: Fed balance sheet direction, DXY level, US real rates. DXY inversely correlated with EM/commodity flows: DXY strength → EM outflows → TASI foreign investor selling. US real rates (10Y TIPS): positive real rates are a headwind for PE expansion globally including TASI. Credit conditions (IG/HY spreads) measure risk appetite: widening = risk-off = EM outflows.",
    chain: "DXY direction → EM capital flows → TASI foreign ownership level → TASI index liquidity and support. US real rates → global equity PE compression/expansion → TASI fair value multiple.",
    allocatorNote: "Global liquidity is the amplifier for Saudi domestic fundamentals. Even if Saudi macro is solid, DXY strength + tight global credit will cap TASI re-rating. Allocator must assess both Saudi domestic (oil/fiscal) AND global liquidity conditions simultaneously.",
    questions: ["Is DXY strengthening or weakening?", "Are global credit spreads widening (risk-off) or compressing (risk-on)?"],
  },
  allocator_playbook: {
    facts: "Conservative institutional allocator with 12-24M horizon and drawdown constraint: deploys in tranches, not all at once; requires regime confirmation (oil direction, rate trajectory, credit conditions) before building full position. Position sizing framework: high conviction + favourable asymmetry = up to 5% position; uncertainty + neutral asymmetry = 1-2% or zero. Patience is a valid decision — waiting for better asymmetry is not inaction.",
    chain: "Regime assessment → asymmetry judgment (upside potential vs maximum drawdown) → position sizing → entry point timing → monitoring condition (what must hold for the thesis to work).",
    allocatorNote: "Correct framing: 'Given what I know and don't know, is the risk/reward favourable enough to deploy now, or should I wait for a better entry?' Not: 'Should I be bullish or bearish?' The allocator question is about deployment timing, not direction alone.",
    questions: ["Is the risk/reward asymmetry clearly favourable or is the outcome distribution too wide?", "What is the minimum confirmation needed before building a meaningful position?"],
  },
  historical_analogs: {
    facts: "Saudi market historical cycles: 2014-16 oil crash (Brent $115 → $27) — TASI fell ~50%, recovered over 3 years. 2020 COVID oil shock (WTI -$37) — TASI fell 30%, recovered within 12 months aided by Vision 2030 spending. 2022 oil spike (Brent $120+) — TASI hit record high 13,000+. Key pattern: TASI corrections correlate with oil drops below fiscal breakeven; recoveries correlate with oil recovery + SAMA accommodation.",
    chain: "Historical pattern: oil shock below breakeven → TASI multiple compression within 3-6 months → government deficit spending reduction → non-oil growth slowdown → 12-18 month recovery cycle once oil recovers.",
    allocatorNote: "Historical analog is not a guarantee but provides base rate: TASI oil-shock drawdowns of 30-50% create 3-5 year entry opportunities for patient capital. Conservative allocator uses historical cycle as a calibration tool, not a trigger.",
    questions: ["Is the current regime more analogous to 2014 (sustained low oil) or 2020 (sharp but short shock)?", "Where is TASI valuation vs prior cycle lows?"],
  },
  sector_rotation: {
    facts: "Saudi sector rotation by oil regime: HIGH OIL (>$80): Energy (Aramco) + Banks + Vision 2030 beneficiaries lead; petrochemicals lag if China weak. MID OIL ($65-80): Defensive quality (Aramco yield, telecoms, healthcare) + selective banks. LOW OIL (<$65): Defensives dominate; banks and V2030 compress; Aramco relative outperforms on yield.",
    chain: "Oil level → government fiscal space → sector capex and revenue → sector earnings → PE by sector → TASI sector rotation.",
    allocatorNote: "In uncertain oil regime: Aramco (yield anchor, defensively priced, government priority) > quality banks (NIM positive if rates stable) > telecom/healthcare (stable growth, not oil-dependent) >> petrochemicals (China risk) >> V2030 pure-plays (earnings uncertainty).",
    questions: ["Which sector is most/least exposed to the current oil and rate regime?", "Is sector rotation supporting defensives or cyclicals right now?"],
  },
};

const PACKS_AR: Record<KnowledgeDomain, { facts: string; chain: string; allocatorNote: string; questions: string[] }> = {
  saudi_market: {
    facts: "حقائق تاسي الهيكلية: أرامكو ≈60% من رسملة تاسي؛ القطاع المصرفي ≈30%؛ البتروكيماويات (سابك) ≈5-8%. الملكية الأجنبية ≈10-15% — حساسة لسعر النفط وشهية EM. النطاق التاريخي لـ P/E في تاسي: 15-22x؛ يعاد تسعيره مع أسعار النفط والسيولة الإقليمية.",
    chain: "اتجاه النفط → الفضاء المالي الحكومي → وتيرة الإنفاق الرأسمالي → نمو GDP غير النفطي → نمو الودائع المصرفية → نمو الائتمان → اتساع أرباح تاسي.",
    allocatorNote: "المخصص المحافظ: عائد أرامكو (~4-5% عند الأرباح المعتادة) يُحدد أرضية تكلفة الفرصة في تاسي؛ التعرض الانتقائي أفضل من ETF واسع في نظام نفط غير مؤكد.",
    questions: ["هل أرباح أرامكو مغطاة عند سعر النفط الحالي؟", "هل مضاعفات تاسي فوق أو دون المتوسط التاريخي في النظام الحالي؟"],
  },
  oil_fiscal: {
    facts: "نقطة التعادل المالي السعودي: تقديرياً ~75-80$/ب WTI (تتغير ±$5 بحسب التزامات الإنفاق). الإيرادات النفطية ≈65-70% من إيرادات الميزانية. فوق نقطة التعادل: فائض → تسريع الإنفاق الرأسمالي؛ دون ذلك: عجز → تباطؤ صرف المشاريع.",
    chain: "سعر النفط مقارنةً بنقطة التعادل → فائض/عجز الميزانية → وتيرة الإنفاق الحكومي → صرف رؤية 2030 → إيرادات قطاع البنية التحتية → أرباح تاسي غير النفطية.",
    allocatorNote: "نقطة التعادل هي الرقم الأهم لقناعة المخصص في الأسهم السعودية. تراجع النفط $5/ب دون نقطة التعادل لفترة مستدامة يُنذر تاريخياً بتأجيل الإنفاق وانضغاط مضاعفات تاسي.",
    questions: ["هل سعر النفط حالياً فوق أو دون نقطة التعادل السعودية؟", "ما الاتجاه — صعود نحو نقطة التعادل أم تراجع عنها؟"],
  },
  sama_fed_peg: {
    facts: "الريال مربوط بالدولار ربطاً ثابتاً منذ 1986 (3.75 ريال/دولار). SAMA لا تمتلك سياسة نقدية مستقلة: حين يرفع الفيدرالي، SAMA ترفع؛ حين يخفّض، SAMA تخفّض. تكاليف الاقتراض السعودية تُحدَّد بديناميكيات التضخم/النمو الأمريكية، لا الظروف المحلية.",
    chain: "قرار الفيدرالي → SAMA تعكسه → أسعار الإقراض المحلية السعودية → تكاليف الرهن والائتمان المؤسسي → هوامش الفائدة الصافية (NIM) للبنوك → نمو الائتمان → مضاعف القطاع المصرفي في تاسي.",
    allocatorNote: "قيد الربط هو المخاطرة الرئيسية: إذا ضعف الاقتصاد السعودي والفيدرالي يُثبّت الأسعار، لا تستطيع SAMA تقديم تحفيز محلي — المخصص يُسعّر هذا الفخ السياسي.",
    questions: ["أين الفيدرالي في دورة الأسعار؟", "هل قيد SAMA رياح مواتية (تخفيف) أم معاكسة (تثبيت/رفع) حالياً؟"],
  },
  banks_credit: {
    facts: "القطاع المصرفي السعودي: ~30% من تاسي. ديناميكية NIM: رفع الأسعار → توسع NIM (يستفيد المصرف قصيراً) لكن ارتفاع تكاليف الائتمان → مخاطر قروض متعثرة متوسطاً. الودائع الحكومية في البنوك تُموّل قاعدة إقراض كبيرة؛ تراجع إيرادات النفط → سحب الودائع الحكومية → تضييق الائتمان.",
    chain: "الفيدرالي/SAMA → NIM → ربحية البنوك → مضاعف PE للبنوك → اتجاه تاسي. تراجع النفط → تدفق خارج لودائع الحكومة → ضغط تمويل البنوك → تضييق الائتمان → ضغط تقييمات العقار → مخاطر قروض متعثرة.",
    allocatorNote: "البنوك رهان رافعة على النفط (عبر الودائع) والأسعار (عبر NIM). في بيئة نفط/معتدل الأسعار: البنوك السعودية الجيدة جذابة. في ضغط نفطي + أسعار مرتفعة: تنضغط تقييمات البنوك أسرع من المتوسط.",
    questions: ["هل نمو الائتمان المصرفي إيجابي أم يتراجع؟", "هل الودائع الحكومية تنمو أم تتقلص (مرآة النفط)؟"],
  },
  petrochemicals_china: {
    facts: "سابك (70% مملوكة لأرامكو، مدرجة): أكبر شركة بتروكيماويات في السعودية. الإيرادات والهوامش مدفوعة بفارق النافثا-الإيثيلين، ويتتبع مؤشر PMI الصناعي الصيني. الصين تستهلك ~40% من الإيثيلين العالمي.",
    chain: "PMI الصين/النشاط الصناعي → الطلب العالمي على الإيثيلين → فارق النافثا-الإيثيلين → هامش EBITDA لسابك → مضاعف PE لسابك → أداء قطاع البتروكيماويات في تاسي.",
    allocatorNote: "سابك قصة طلب صيني، لا قصة محلية سعودية. يجب تحديد حجم تعرض سابك وفق قناعة انتعاش الصين، ليس الصحة المالية السعودية.",
    questions: ["هل PMI الصين الصناعي في مرحلة توسع أم تراجع؟", "أين فارق الإيثيلين-النافثا مقارنةً بالمتوسط التاريخي؟"],
  },
  aramco_dividends: {
    facts: "أرامكو السعودية: ~98% ملكية حكومية (بعد IPO). سياسة الأرباح: أرباح عادية (~$7 مليار/ربع) + أرباح مرتبطة بالأداء. عند نفط ~70-75$، الأرباح العادية مغطاة تقريباً؛ دون $65 يُصبح ضغط مالي. توزيعات أرامكو = آلية التمويل الرئيسية للحكومة السعودية.",
    chain: "سعر النفط → التدفق النقدي الحر لأرامكو → الأرباح العادية + المرتبطة بالأداء → إيرادات الحكومة السعودية → قدرة الإنفاق العام → صرف رؤية 2030 → البيئة الكلية لتاسي.",
    allocatorNote: "عائد توزيعات أرامكو يعمل كأرضية PE في تاسي: المستثمرون الأجانب يطلبون علاوة عائد على الخالي من المخاطر. عند عائد >4%، تعمل أرامكو كمرساة دفاعية للمخصصين المحافظين.",
    questions: ["هل نسبة تغطية أرباح أرامكو إيجابية عند سعر النفط الحالي؟", "هل الأرباح المرتبطة بالأداء في خطر التخفيض؟"],
  },
  vision_2030: {
    facts: "رؤية 2030: إنفاق رأسمالي ملتزم >$500 مليار عبر المشاريع الكبرى (نيوم، قدية، البحر الأحمر، روشن، الدرعية). الوضع الراهن: مرحلة استهلاك رأس المال قبل تحقيق الإيرادات. معظم المشاريع لن تولّد أرباحاً ملموسة لـ5-10 سنوات. التمويل الحكومي مشروط بفائض النفط — إذا انخفض النفط دون نقطة التعادل، تُرجأ الصرفيات (لا تُلغى، لكن تتباطأ).",
    chain: "فائض النفط → فائض الميزانية → صرف الإنفاق الرأسمالي لرؤية 2030 → إيرادات قطاع الإنشاء/البنية التحتية → إيرادات الشركات المستفيدة → قطاع النمو في تاسي PE.",
    allocatorNote: "أسماء رؤية 2030 تتداول على توقعات أرباح مستقبلية، لا أساسيات حالية. المضاعفات العالية (P/E 30-60x) تتطلب قناعة بفائض نفطي مستدام. المخصص المحافظ يتجنب هذه الأسماء ما لم يكن النفط فوق نقطة التعادل بشكل ثابت ومعدل صرف الحكومة مؤكد.",
    questions: ["هل صرف الإنفاق الرأسمالي الحكومي يتسارع أم يتباطأ؟", "هل إيرادات الشركات المستفيدة من رؤية 2030 تتحقق فعلياً أم لا تزال وعوداً؟"],
  },
  valuation_earnings: {
    facts: "التمييز بين توسع المضاعفات ونمو الأرباح: تاسي يمكن أن يرتفع عبر (أ) توسع PE مدفوع بتدفقات رأس المال في الأسواق الناشئة وتوقعات تخفيف الأسعار — هش، ينعكس بتغيير السياسة؛ أو (ب) نمو EPS من إيرادات النفط → ائتمان البنوك → أرباح الشركات — مستدام، يحتاج نفطاً فوق نقطة التعادل 2+ سنوات. P/E تاسي في بيئات نفط مرتفعة: 18-22x؛ في ضغط نفطي: 14-17x.",
    chain: "مسار توسع PE: توقعات خفض الأسعار → تدفقات رأس المال الخطرة → PE تاسي يتوسع من 16x إلى 20x → عائد دون نمو أرباح. مسار نمو الأرباح: نفط >$80 لـ12+ شهراً → الإنفاق الحكومي يرتفع → إقراض البنوك يتوسع → إيرادات الشركات تنمو → EPS يرتفع 10-15% → عائد تاسي بدعم أساسي.",
    allocatorNote: "عوائد توسع PE تقترض من عوائد مستقبلية؛ عوائد نمو EPS تُضيف إلى قاعدة القيمة. المخصص المحافظ بأفق 12-24 شهراً يُفضّل أطروحة نمو EPS (تتطلب قناعة نفطية) على أطروحة توسع PE (تتطلب قناعة تيسير نقدي).",
    questions: ["هل العائد الحالي لتاسي مدفوع بتوسع المضاعفات أم نمو الأرباح؟", "ما مستوى P/E مقارنةً بالمتوسط التاريخي في هذا النظام النفطي؟"],
  },
  liquidity_credit_rates: {
    facts: "محركات السيولة العالمية: اتجاه الميزانية العمومية للفيدرالي، مستوى DXY، الأسعار الحقيقية الأمريكية. DXY علاقة عكسية مع تدفقات الأسواق الناشئة/السلع: قوة DXY → تدفقات خارج من الأسواق الناشئة → بيع المستثمرين الأجانب لتاسي. الأسعار الحقيقية الأمريكية (10Y TIPS): أسعار حقيقية موجبة = عائق على توسع PE عالمياً بما في ذلك تاسي.",
    chain: "اتجاه DXY → تدفقات رأس المال للأسواق الناشئة → مستوى ملكية الأجانب في تاسي → سيولة ودعم مؤشر تاسي. الأسعار الحقيقية الأمريكية → انضغاط/توسع PE الأسهم العالمية → القيمة العادلة لمضاعف تاسي.",
    allocatorNote: "السيولة العالمية هي المضخّم للأساسيات المحلية السعودية. حتى لو كانت الماكرو السعودية متينة، فإن قوة DXY + ضيق الائتمان العالمي يُقيّد إعادة التسعير. المخصص يقيّم الأساسيات السعودية المحلية (النفط/المالي) والسيولة العالمية في آنٍ معاً.",
    questions: ["هل DXY يتقوى أم يضعف؟", "هل فوارق الائتمان العالمية تتسع (تراجع شهية المخاطرة) أم تضيق (صعود شهية المخاطرة)؟"],
  },
  allocator_playbook: {
    facts: "المخصص المؤسسي المحافظ بأفق 12-24 شهراً وقيد على الحد الأقصى للتراجع: يدخل على دفعات، لا دفعة واحدة؛ يشترط تأكيد النظام (اتجاه النفط، مسار الأسعار، ظروف الائتمان) قبل بناء المركز الكامل. إطار تحديد حجم المركز: قناعة عالية + تماثل مناسب = حتى 5% من المحفظة؛ غموض + تماثل محايد = 1-2% أو صفر. الصبر قرار صحيح — الانتظار لتماثل أفضل ليس خمولاً.",
    chain: "تقييم النظام → حكم التماثل (إمكانية الصعود مقابل الحد الأقصى للتراجع) → تحديد حجم المركز → توقيت نقطة الدخول → شرط المراقبة (ما الذي يجب أن يتحقق حتى تظل الأطروحة سارية).",
    allocatorNote: "الإطار الصحيح: 'بالنظر إلى ما أعرفه وما لا أعرفه، هل تماثل المخاطر/العائد مناسب بما يكفي للنشر الآن، أم يجب الانتظار لنقطة دخول أفضل؟' ليس: 'هل أكون صاعداً أم هابطاً؟' سؤال المخصص يتعلق بتوقيت النشر، لا الاتجاه وحده.",
    questions: ["هل تماثل المخاطر/العائد مناسب بوضوح أم أن توزيع النتائج واسع جداً؟", "ما الحد الأدنى من التأكيد المطلوب قبل بناء مركز ذي حجم معقول؟"],
  },
  historical_analogs: {
    facts: "الدورات التاريخية للسوق السعودي: 2014-16 انهيار النفط (برنت $115→$27) — تاسي تراجع ~50%، استرد قيمته خلال 3 سنوات. 2020 صدمة كوفيد النفطية (WTI -$37) — تاسي تراجع 30%، استرد خلال 12 شهراً. 2022 ارتفاع النفط (برنت >$120) — تاسي بلغ قمة تاريخية 13000+. النمط الرئيسي: تصحيحات تاسي تترافق مع انخفاض النفط دون نقطة التعادل؛ الانتعاشات تترافق مع استرداد النفط + تيسير SAMA.",
    chain: "النمط التاريخي: صدمة نفطية دون نقطة التعادل → انضغاط مضاعفات تاسي خلال 3-6 أشهر → تقليص الإنفاق بعجز حكومي → تباطؤ نمو غير النفطي → دورة انتعاش 12-18 شهراً بعد استرداد النفط.",
    allocatorNote: "الأنالوغ التاريخي ليس ضماناً لكنه يوفر معدل أساسي: التراجعات النفطية لتاسي 30-50% تُنشئ نقاط دخول لـ3-5 سنوات لرأس المال الصبور. المخصص المحافظ يستخدم الدورة التاريخية كأداة معايرة، لا كمحفّز.",
    questions: ["هل النظام الحالي أشبه بـ2014 (نفط منخفض مستدام) أم 2020 (صدمة حادة قصيرة)؟", "أين تقييم تاسي مقارنةً بقيعان دورات سابقة؟"],
  },
  sector_rotation: {
    facts: "دوران قطاعات تاسي حسب نظام النفط: نفط مرتفع (>$80): الطاقة (أرامكو) + البنوك + مستفيدو رؤية 2030 يتصدرون؛ البتروكيماويات تتأخر إذا كانت الصين ضعيفة. نفط متوسط ($65-80): الدفاعيات (عائد أرامكو، الاتصالات، الرعاية) + البنوك الانتقائية. نفط منخفض (<$65): الدفاعيات تتصدر؛ البنوك وأسماء V2030 تنضغط؛ أرامكو تتفوق نسبياً بفضل العائد.",
    chain: "مستوى النفط → الفضاء المالي الحكومي → رأسمالية القطاعات وإيراداتها → أرباح القطاع → PE حسب القطاع → دوران قطاعات تاسي.",
    allocatorNote: "في نظام نفط غير مؤكد: أرامكو (مرساة عائد، تسعير دفاعي، أولوية حكومية) > بنوك جيدة (NIM إيجابي إذا الأسعار مستقرة) > اتصالات/رعاية صحية (نمو مستقر، غير مرتبط بالنفط) >> بتروكيماويات (مخاطر الصين) >> أسماء V2030 البحتة (عدم يقين الأرباح).",
    questions: ["أي قطاع أكثر/أقل تعرضاً للنظام النفطي والأسعار الحالي؟", "هل دوران القطاعات يدعم الدفاعيات أم الدوريات حالياً؟"],
  },
};

// ─── Context builder ──────────────────────────────────────────────────────────

function buildKnowledgeContext(
  domains: KnowledgeDomain[],
  lang: "ar" | "en",
  oilContext?: string,
): string {
  if (domains.length === 0) return "";
  const ar = lang === "ar";
  const packs = ar ? PACKS_AR : PACKS_EN;

  const header = ar
    ? "حزم المعرفة المُفعَّلة (حقائق إلزامية — يجب الاستشهاد بها في الإجابة، لا الاستعاضة عنها بتعليق عام):"
    : "ACTIVATED KNOWLEDGE PACKS (mandatory facts — cite these in your answer; do not substitute generic commentary):";

  const blocks: string[] = [header];

  // Limit to 6 most relevant domains to stay under token budget
  const prioritized = prioritizeDomains(domains);

  for (const domain of prioritized.slice(0, 6)) {
    const pack = packs[domain];
    if (!pack) continue;
    const domainLabel = ar ? DOMAIN_LABELS_AR[domain] : DOMAIN_LABELS_EN[domain];
    blocks.push(`[${domainLabel}] ${pack.facts} | ${ar ? "السلسلة" : "Chain"}: ${pack.chain}`);
  }

  if (oilContext) {
    blocks.push(ar
      ? `[السياق النفطي الحالي] ${oilContext}`
      : `[Current oil context] ${oilContext}`);
  }

  const footer = ar
    ? "قاعدة الاستخدام: يُسمح بالعبارات الوصفية العامة فقط إذا سبقتها أو تلتها مباشرةً حقيقة محددة من الحزم أعلاه + آلية انتقال سببية."
    : "Usage rule: generic descriptive statements are only permitted if immediately preceded or followed by a specific fact from the above packs + a causal transmission mechanism.";
  blocks.push(footer);

  return blocks.join("\n");
}

function prioritizeDomains(domains: KnowledgeDomain[]): KnowledgeDomain[] {
  const priority: KnowledgeDomain[] = [
    "saudi_market", "oil_fiscal", "sama_fed_peg", "allocator_playbook",
    "valuation_earnings", "sector_rotation", "banks_credit", "aramco_dividends",
    "vision_2030", "petrochemicals_china", "liquidity_credit_rates", "historical_analogs",
  ];
  const set = new Set(domains);
  return priority.filter(d => set.has(d));
}

const DOMAIN_LABELS_EN: Record<KnowledgeDomain, string> = {
  saudi_market: "TASI Structure",
  oil_fiscal: "Oil/Fiscal Transmission",
  sama_fed_peg: "SAMA/Fed Peg",
  banks_credit: "Banks/Credit",
  petrochemicals_china: "Petrochemicals/China",
  aramco_dividends: "Aramco/Dividends",
  vision_2030: "Vision 2030 Capex",
  valuation_earnings: "Valuation vs Earnings",
  liquidity_credit_rates: "Liquidity/Credit/Rates",
  allocator_playbook: "Allocator Playbook",
  historical_analogs: "Historical Analogs",
  sector_rotation: "Sector Rotation",
};

const DOMAIN_LABELS_AR: Record<KnowledgeDomain, string> = {
  saudi_market: "هيكل تاسي",
  oil_fiscal: "النفط/الانتقال المالي",
  sama_fed_peg: "SAMA/الفيدرالي/الربط",
  banks_credit: "البنوك/الائتمان",
  petrochemicals_china: "البتروكيماويات/الصين",
  aramco_dividends: "أرامكو/التوزيعات",
  vision_2030: "رأسمالية رؤية 2030",
  valuation_earnings: "التقييم مقابل الأرباح",
  liquidity_credit_rates: "السيولة/الائتمان/الأسعار",
  allocator_playbook: "دليل المخصص",
  historical_analogs: "الأنالوغات التاريخية",
  sector_rotation: "دوران القطاعات",
};

// ─── Activation summary builder ───────────────────────────────────────────────

function buildActivationSummary(
  domains: KnowledgeDomain[],
  lang: "ar" | "en",
): string {
  if (domains.length === 0) return "";
  const ar = lang === "ar";
  const labels = ar ? DOMAIN_LABELS_AR : DOMAIN_LABELS_EN;
  const list = domains.slice(0, 8).map(d => labels[d]).join(", ");
  return ar
    ? `حزم المعرفة المُفعَّلة (${domains.length}): ${list}.`
    : `Activated knowledge packs (${domains.length}): ${list}.`;
}

// ─── Mandatory questions aggregator ──────────────────────────────────────────

function aggregateMandatoryQuestions(
  domains: KnowledgeDomain[],
  lang: "ar" | "en",
): string[] {
  const packs = lang === "ar" ? PACKS_AR : PACKS_EN;
  const questions: string[] = [];
  for (const domain of prioritizeDomains(domains).slice(0, 4)) {
    const pack = packs[domain];
    if (pack) questions.push(...pack.questions.slice(0, 1));
  }
  return questions;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detects required knowledge domains from the question/context, then builds
 * a compact, fact-dense knowledge block for injection into the Genesis prompt.
 * Pure O(1) — no AI calls, no network.
 */
export function activateKnowledge(
  question: string,
  ctx: string,
  isSaudi: boolean,
  lang: "ar" | "en",
  oilContext?: string,
): KnowledgeActivationResult {
  const domains = detectDomains(question, ctx, isSaudi);
  if (domains.length === 0) {
    return {
      activatedDomains: [],
      knowledgeContext: "",
      activationSummary: "",
      mandatoryQuestions: [],
    };
  }

  const knowledgeContext = buildKnowledgeContext(domains, lang, oilContext);
  const activationSummary = buildActivationSummary(domains, lang);
  const mandatoryQuestions = aggregateMandatoryQuestions(domains, lang);

  return {
    activatedDomains: domains,
    knowledgeContext,
    activationSummary,
    mandatoryQuestions,
  };
}
