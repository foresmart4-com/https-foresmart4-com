// Phase-83A: Research Pack Registry
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Distinct from knowledgeActivationCore.ts:
//   knowledgeActivationCore — domain detection + compact fact injection
//   researchPackRegistry    — curated research-intelligence packs with:
//                             • institutional frameworks (Grantham, Dalio, Marks style)
//                             • explicit quality signals for use-enforcement
//                             • weighted evidence requirements
//                             • governed retrieval (no random, no hallucination)
//
// 8 research packs, each with:
//   facts          — numbered/measurable assertions
//   frameworks     — institutional investment frameworks applied to this domain
//   qualitySignals — patterns that MUST appear in a reply claiming this pack was used
//   contextBlock   — compact injection string (≤400 chars per pack)

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ResearchPackId =
  | "SaudiMacroPack"
  | "OilFiscalPack"
  | "FedPolicyPack"
  | "CreditCyclePack"
  | "InstitutionalAllocatorPack"
  | "HistoricalAnalogPack"
  | "SectorRotationPack"
  | "RiskManagementPack";

export interface ResearchPack {
  id: ResearchPackId;
  name: string;
  domains: string[];                  // knowledge domains this pack covers
  facts: string[];                    // specific, measurable assertions
  frameworks: string[];               // institutional frameworks applied
  transmissionChains: string[];       // causal chains from this pack
  qualitySignals: {                   // MUST appear in reply to count as "used"
    patterns: RegExp[];               // at least 1 must match
    minimumMatches: number;           // minimum number of pattern hits
    description: string;
  };
  contextBlock: (lang: "ar" | "en") => string; // compact injection for prompt
}

// ─── Pack definitions ──────────────────────────────────────────────────────────

const PACKS: Record<ResearchPackId, ResearchPack> = {

  SaudiMacroPack: {
    id: "SaudiMacroPack",
    name: "Saudi Macro Intelligence",
    domains: ["saudi_market", "oil_fiscal", "sama_fed_peg"],
    facts: [
      "Aramco ≈60% of TASI by market cap; its dividend is the primary government revenue mechanism",
      "Saudi fiscal breakeven ~$75-80/bbl WTI; above: surplus → capex acceleration; below: deficit → spending cuts",
      "SAR hard-pegged to USD since 1986; SAMA mirrors Fed rate decisions — no independent monetary policy",
      "TASI historical P/E range 15-22x; re-rates with oil above/below breakeven and EM risk-on/off",
    ],
    frameworks: [
      "Sovereign wealth cycle: oil surplus → fiscal expansion → non-oil growth → TASI re-rating",
      "Monetary constraint trap: SAR peg prevents countercyclical policy when Fed holds and oil weakens",
      "Dividend yield anchoring: Aramco yield floor creates a TASI PE support level for conservative capital",
    ],
    transmissionChains: [
      "Oil price vs breakeven → fiscal surplus/deficit → government spending pace → bank deposit growth → credit growth → TASI non-energy PE",
      "Fed rate → SAMA mirrors → Saudi borrowing cost → bank NIM → credit availability → non-oil GDP",
    ],
    qualitySignals: {
      patterns: [
        /aramco|أرامكو/i,
        /breakeven|نقطة\s*التعادل/i,
        /sama|sar\s+peg|ربط/i,
        /\$7[0-9]|\$8[0-9]|75|80/i,
        /fiscal\s+(surplus|deficit|breakeven)|فائض|عجز\s+الميزانية/i,
      ],
      minimumMatches: 2,
      description: "Saudi macro reply must reference Aramco, fiscal breakeven with numbers, and SAMA constraint",
    },
    contextBlock: (lang) => lang === "ar"
      ? "[تاسي/ماكرو] أرامكو≈60% من تاسي؛ نقطة التعادل~$75-80/ب — فوقها: فائض→تسارع الإنفاق؛ دونها: عجز→تراجع. SAMA تعكس الفيدرالي (ربط SAR). المخصص: انتقائي مع وضوح اتجاه النفط."
      : "[TASI/Macro] Aramco≈60% of TASI; fiscal breakeven~$75-80/bbl — above: surplus→capex; below: deficit→cuts. SAMA mirrors Fed (SAR peg). Allocator: selective until oil direction confirmed.",
  },

  OilFiscalPack: {
    id: "OilFiscalPack",
    name: "Oil/Fiscal Transmission Intelligence",
    domains: ["oil_fiscal", "saudi_market"],
    facts: [
      "Saudi budget ~65-70% oil-revenue-dependent; fiscal multiplier ~1.2-1.5x for non-oil GDP",
      "Every $10/bbl oil move ≈ ±$30-40B in Saudi government revenues annually",
      "Below-breakeven oil sustained for 6+ months historically triggers SAMA reserve drawdown and spending deferral",
      "Vision 2030 capex commitment creates a floor on government spending — deferrals ≠ cancellations",
    ],
    frameworks: [
      "Petrodollar recycling: oil revenues → government deposits → bank lending → credit growth → TASI",
      "Fiscal multiplier: $1 of oil revenue ≈ $1.2-1.5 of non-oil GDP activity through government spending channel",
      "Breakeven asymmetry: the damage from below-breakeven is faster than the benefit above (spending takes time to deploy)",
    ],
    transmissionChains: [
      "Oil price → government revenues → fiscal balance → spending velocity → bank deposit base → credit expansion → non-oil GDP → TASI",
      "Oil drop below breakeven → SAMA reserve drawdown → domestic liquidity reduction → credit tightening → real estate pressure → bank NPL risk",
    ],
    qualitySignals: {
      patterns: [
        /fiscal\s+(breakeven|transmission|space)|نقطة\s*التعادل/i,
        /government\s+spending|spending\s+(velocity|contraction)|الإنفاق\s+الحكومي/i,
        /oil.{0,30}(budget|revenue|fiscal)|النفط.{0,30}(ميزانية|إيراد|مالي)/i,
        /petrodollar|non-oil\s+gdp|الناتج\s+غير\s+النفطي/i,
      ],
      minimumMatches: 2,
      description: "Oil/fiscal reply must show the transmission from oil price to government spending to economy",
    },
    contextBlock: (lang) => lang === "ar"
      ? "[النفط/المالي] كل $10/ب تغيير≈±$30-40م في إيرادات الحكومة سنوياً. النفط دون نقطة التعادل لـ6+ أشهر → سحب احتياطيات SAMA → تضييق الائتمان المحلي. رؤية 2030: التأجيل≠الإلغاء."
      : "[Oil/Fiscal] Every $10/bbl move ≈ ±$30-40B in government revenues annually. Oil below breakeven 6+ months → SAMA reserve drawdown → credit tightening. Vision 2030: deferrals ≠ cancellations.",
  },

  FedPolicyPack: {
    id: "FedPolicyPack",
    name: "Fed Policy Reaction Intelligence",
    domains: ["sama_fed_peg", "liquidity_credit_rates"],
    facts: [
      "Fed reaction function: Fed raises when inflation exceeds target AND labor market is tight; cuts when inflation falls AND growth weakens",
      "Fed tightening cycles historically produce EM outflows (DXY strengthens); Gulf markets doubly affected via SAMA peg",
      "Yield curve inversion (2Y > 10Y) historically precedes recession by 12-24 months but timing is unreliable",
      "Real rates (10Y TIPS): positive real rates constrain PE multiples globally; the higher the real rate, the lower the justified equity multiple",
    ],
    frameworks: [
      "Taylor Rule framing: Fed rate = neutral rate + 1.5*(inflation gap) + 0.5*(output gap) — determines how far rates are from equilibrium",
      "Dual mandate conflict: when inflation above target AND growth weakening, Fed faces a genuine dilemma that markets will reprice",
      "Forward guidance credibility: Fed dot plots move markets; gaps between dot plot and market pricing signal opportunity or risk",
    ],
    transmissionChains: [
      "Fed rate decision → SAMA mirrors (SAR peg) → Saudi local rates → mortgage/corporate credit cost → NIM for banks → credit growth → TASI",
      "Fed rate → DXY direction → EM capital flows → TASI foreign investor positioning → TASI liquidity and support",
      "Real rates (TIPS) → global equity multiple compression/expansion → TASI fair-value P/E range",
    ],
    qualitySignals: {
      patterns: [
        /fed|federal\s+reserve|الفيدرالي/i,
        /reaction\s+function|policy\s+(pivot|hold|hike|cut)|دالة\s+رد\s+الفعل/i,
        /real\s+rate|yield\s+curve|أسعار\s+حقيقية/i,
        /dxy|dollar\s+(strength|weakness)|الدولار/i,
      ],
      minimumMatches: 2,
      description: "Fed policy reply must reference reaction function/mechanism and transmission to assets",
    },
    contextBlock: (lang) => lang === "ar"
      ? "[الفيدرالي] دالة رد فعل الفيدرالي: يرفع عند تضخم مرتفع+سوق عمل ضيق؛ يخفض عند تراجع التضخم+ضعف النمو. الأسعار الحقيقية الموجبة تضغط مضاعفات PE عالمياً. SAMA ملزمة باتباع الفيدرالي (ربط SAR)."
      : "[Fed] Reaction function: hikes at high inflation+tight labor; cuts at falling inflation+weakening growth. Positive real rates compress PE multiples globally. SAMA must follow (SAR peg constraint).",
  },

  CreditCyclePack: {
    id: "CreditCyclePack",
    name: "Credit Cycle Intelligence",
    domains: ["banks_credit", "liquidity_credit_rates"],
    facts: [
      "Credit cycle stages: expansion (spreads tight, leverage rising) → late-cycle (spreads widen, quality divergence) → contraction (liquidity premium rises) → recovery (quality assets re-rate first)",
      "IG/HY spread widening > 50bps from cycle lows historically signals tightening financial conditions",
      "Saudi credit cycle: government deposit flows fund ~40% of bank lending — oil price is the primary credit impulse",
      "Bank NIM in Saudi: rises 15-20bps per 100bps rate increase (SAR peg transmits Fed moves directly to lending rates)",
    ],
    frameworks: [
      "Hyman Minsky framework: stability breeds instability — low credit stress encourages leverage; eventual credit event resets the cycle",
      "Credit impulse: the rate of change in credit growth (not level) predicts economic momentum — decelerating credit = deteriorating outlook",
      "Quality hierarchy in credit stress: government debt > quality corporates > leveraged names > speculative assets (cascade from worst to best quality)",
    ],
    transmissionChains: [
      "Fed rate → Saudi lending rates → bank NIM → credit profitability → lending appetite → credit growth → non-oil GDP → TASI earnings",
      "IG/HY spread widening → risk-off → EM capital outflow → Saudi foreign investor selling → TASI pressure → domestic buying support tested",
    ],
    qualitySignals: {
      patterns: [
        /credit\s+(cycle|spread|growth|impulse)|دورة\s+الائتمان/i,
        /nim|net\s+interest\s+margin|هامش\s+الفائدة\s+الصافي/i,
        /leverage|rba|bank\s+(lending|loan)|الإقراض\s+المصرفي/i,
        /ig.{0,5}hy|credit\s+spread|spread\s+widen|فوارق\s+الائتمان/i,
      ],
      minimumMatches: 2,
      description: "Credit cycle reply must reference spread dynamics, bank lending mechanics, or credit impulse",
    },
    contextBlock: (lang) => lang === "ar"
      ? "[دورة الائتمان] NIM السعودي يرتفع 15-20 نقطة/100نقطة رفع. ودائع الحكومة~40% من قاعدة الإقراض — النفط هو المحرك الأول للائتمان. اتساع فوارق IG/HY>50نقطة: إشارة تضييق مالي."
      : "[Credit Cycle] Saudi NIM rises 15-20bps per 100bps hike. Government deposits ~40% of lending base — oil is the primary credit impulse. IG/HY spreads >50bps from lows: tightening signal.",
  },

  InstitutionalAllocatorPack: {
    id: "InstitutionalAllocatorPack",
    name: "Institutional Allocator Playbook",
    domains: ["allocator_playbook"],
    facts: [
      "Conservative allocator with drawdown constraint: deploys in 3-5 tranches; never all-in on a single entry",
      "Position sizing: high conviction + favourable asymmetry → up to 5% position; uncertainty → 1-2% or zero",
      "Opportunity cost discipline: cash is a real alternative when the risk/reward of deploying is unclear",
      "Patience as alpha: the best entry points come when others are forced to sell or fear prevents deployment",
    ],
    frameworks: [
      "Margin of safety (Graham/Buffett): only deploy when the price provides meaningful buffer against forecast error",
      "Asymmetric risk/reward (Marks): the best investments have large upside and limited downside — skew matters more than direction",
      "Broad vs selective (institutional): in uncertain regimes, sector selectivity outperforms index exposure because regime-sensitive sectors diverge",
    ],
    transmissionChains: [
      "Regime assessment → asymmetry evaluation (upside/downside ratio) → position size determination → entry timing → monitoring condition (thesis invalidation event)",
      "Conviction level + liquidity + mandate → maximum single-name/sector concentration → portfolio construction",
    ],
    qualitySignals: {
      patterns: [
        /allocat|مخصص/i,
        /scale.{0,5}in|tranche|deploy|position\s+size|تدريجي|دفعات/i,
        /asymmetr|risk.reward|skew|تماثل\s+المخاطر/i,
        /selective\s+over\s+broad|انتقائية\s+قطاعية|broad\s+exposure/i,
        /wait|patience|انتظار|صبر/i,
      ],
      minimumMatches: 2,
      description: "Allocator reply must reference deployment stance (scale-in/wait/avoid), asymmetry, or selectivity",
    },
    contextBlock: (lang) => lang === "ar"
      ? "[المخصص] نشر رأس المال على دفعات (3-5)؛ مركز ≤5% عند قناعة عالية، 1-2% أو صفر عند غموض. الانتقائية القطاعية تتفوق على التعرض الواسع في النظام غير المؤكد. الصبر استراتيجية — الانتظار ليس خمولاً."
      : "[Allocator] Deploy capital in tranches (3-5); ≤5% position at high conviction, 1-2% or zero at uncertainty. Sector selectivity outperforms broad exposure in uncertain regime. Patience is strategy — waiting is not inaction.",
  },

  HistoricalAnalogPack: {
    id: "HistoricalAnalogPack",
    name: "Historical Analog Intelligence",
    domains: ["historical_analogs"],
    facts: [
      "Saudi TASI below-breakeven oil episodes (1986, 2014-16): TASI fell 40-50%; recovery correlated with oil stabilisation above breakeven",
      "2022 inflation cycle: fastest Fed tightening in 40 years; oil exporters (Saudi) outperformed; duration assets worst year since 1788",
      "COVID 2020: oil briefly negative (WTI); TASI -30% then recovered in 12 months aided by Vision 2030 announcement",
      "Historical base rate: TASI recovers from oil-shock drawdowns within 12-36 months when oil returns above breakeven",
    ],
    frameworks: [
      "Analogical reasoning protocol: name the analog, state which characteristics match, state what is different THIS time — never predict from analog alone",
      "Regime-conditional returns: TASI in oil-above-breakeven regimes has historically delivered 15-25% annualised returns; in below-breakeven regimes: -10 to -25%",
      "Cycle positioning: conservative allocators use historical drawdown ranges to calibrate margin-of-safety requirements",
    ],
    transmissionChains: [
      "Prior cycle: oil below breakeven → TASI drawdown 40-50% → recovery when oil stabilised → 2-3 year full recovery period",
      "Historical analog application: map current regime characteristics → find closest episode → apply lessons with explicit 'what is different' caveat",
    ],
    qualitySignals: {
      patterns: [
        /historical\s+analog|prior\s+cycle|تاريخي|دورة\s+سابقة/i,
        /2014|2016|2020|2022|1986|1970s/i,
        /analog|precedent|what\s+is\s+different|ما\s+يختلف\s+هذه\s+المرة/i,
        /base\s+rate|historical\s+(range|pattern|return)|معدل\s+أساسي/i,
      ],
      minimumMatches: 1,
      description: "Historical analog reply must reference a specific prior episode and state the current-vs-prior difference",
    },
    contextBlock: (lang) => lang === "ar"
      ? "[الأنالوغ التاريخي] تاسي دون نقطة التعادل (1986، 2014-16): تراجع 40-50%؛ الانتعاش ترابط مع استقرار النفط. 2022: أفضل أداء لمصدري النفط. ليس تنبؤاً — سياق فقط."
      : "[Historical Analog] TASI below-breakeven episodes (1986, 2014-16): -40-50%; recovery correlated with oil stabilisation. 2022: oil exporters outperformed. Not prediction — context only.",
  },

  SectorRotationPack: {
    id: "SectorRotationPack",
    name: "Sector Rotation Intelligence",
    domains: ["sector_rotation"],
    facts: [
      "TASI sector weights: Energy (Aramco) ~60%, Banks ~30%, Petrochemicals ~5-8%, Telecom ~3%, Healthcare ~2%",
      "Oil regime sectors: above $80 → energy+banks lead; $65-80 → defensives+selective banks; below $65 → defensives only",
      "SABIC margin = f(naphtha-ethylene spread, China PMI) — independent from Saudi fiscal health",
      "Telecom/Healthcare: stable non-oil revenue; partially defensive; low beta to oil regime",
    ],
    frameworks: [
      "Regime-conditional sector allocation: each oil price regime has a distinct sector leadership pattern — not a universal risk-on/risk-off",
      "Valuation vs quality split: in high-credit-stress regime, quality (FCF/low debt/yield) outperforms growth (high P/E, leverage-dependent)",
      "Earnings visibility spectrum: Aramco > quality banks > telecom/healthcare > petrochemicals > Vision 2030 pure-plays",
    ],
    transmissionChains: [
      "Oil level → government fiscal position → Vision 2030 disbursements → construction sector revenue → infrastructure earnings",
      "China PMI → ethylene demand → naphtha-ethylene spread → SABIC EBITDA margin → SABIC PE",
    ],
    qualitySignals: {
      patterns: [
        /aramco|أرامكو/i,
        /sabic|سابك|petrochem|بتروكيماوي/i,
        /sector\s+(rotation|winner|loser)|قطاع\s+(رابح|خاسر|دوران)/i,
        /bank.{0,20}sector|energy.{0,20}sector|القطاع\s+المصرفي/i,
      ],
      minimumMatches: 2,
      description: "Sector reply must name specific Saudi sectors with regime-conditional reasoning",
    },
    contextBlock: (lang) => lang === "ar"
      ? "[دوران القطاعات] أوزان تاسي: طاقة~60%، بنوك~30%، بتروكيماويات~5-8%. فوق $80: طاقة+بنوك تقود؛ $65-80: دفاعيات+بنوك انتقائية؛ دون $65: دفاعيات فقط. سابك = متغير صيني مستقل."
      : "[Sector Rotation] TASI weights: Energy~60%, Banks~30%, Petrochem~5-8%. Above $80: energy+banks lead; $65-80: defensives+selective banks; below $65: defensives only. SABIC = independent China variable.",
  },

  RiskManagementPack: {
    id: "RiskManagementPack",
    name: "Risk Management Framework",
    domains: ["allocator_playbook", "liquidity_credit_rates"],
    facts: [
      "Tail risk definition: events >2 standard deviations from mean; in oil markets, $20+/bbl moves in 3 months happen ~once per decade",
      "Drawdown management: conservative allocator pre-defines maximum acceptable drawdown (typically 10-15% for mandated capital)",
      "Concentration risk: single-security >10% of portfolio or single sector >40% creates non-linear risk",
      "Liquidity risk: in market stress, bid-ask spreads widen 5-20x; liquidity you depend on in stress is not real liquidity",
    ],
    frameworks: [
      "Capital preservation first (Marks): never risk permanent capital impairment for temporary return opportunity",
      "Convexity preference: in uncertain regimes, asymmetric instruments (optionality, tranched entry) preserve capital while maintaining upside",
      "Risk budget allocation: total portfolio risk = sum of position risks + correlations; in stress, correlations approach 1 (everything falls together)",
    ],
    transmissionChains: [
      "Tail event → liquidity shock → forced selling → price dislocation → contagion across correlated positions → portfolio drawdown",
      "Risk budget exhaustion → forced position reduction → feedback selling → further price decline → second-order loss amplification",
    ],
    qualitySignals: {
      patterns: [
        /tail\s+risk|drawdown|capital\s+preservation|حفظ\s+رأس\s+المال/i,
        /concentration\s+risk|تركيز\s+المخاطر/i,
        /liquidity\s+risk|stress|مخاطر\s+السيولة/i,
        /downside\s+(protection|risk)|protect.{0,10}capital|حماية\s+رأس/i,
      ],
      minimumMatches: 2,
      description: "Risk management reply must reference drawdown, capital preservation, or concentration risk",
    },
    contextBlock: (lang) => lang === "ar"
      ? "[إدارة المخاطر] الحد الأقصى للتراجع المقبول: 10-15% للرأسمال المُلتزم. مخاطر التركيز: ورقة واحدة>10% أو قطاع>40% ينشئ مخاطر غير خطية. السيولة التي تعتمد عليها في الضغط لا تتوافر في الضغط."
      : "[Risk Management] Acceptable max drawdown: 10-15% for mandated capital. Concentration risk: single security >10% or sector >40% creates non-linear risk. Liquidity you depend on in stress is unavailable in stress.",
  },
};

// ─── Pack selection ───────────────────────────────────────────────────────────

const PACK_TRIGGER_PATTERNS: Record<ResearchPackId, RegExp> = {
  SaudiMacroPack:           /tasi|saudi|سعود|تاسي|aramco|أرامكو|gulf|خليج|ksa/i,
  OilFiscalPack:            /oil|نفط|brent|wti|crude|fiscal|breakeven|نقطة\s*التعادل|ميزانية/i,
  FedPolicyPack:            /fed|federal|الفيدرالي|rate\s+(hike|cut|policy)|monetary|نقطة\s+أساس|basis\s+point/i,
  CreditCyclePack:          /credit|ائتمان|spread|nim|bank\s+(loan|lending)|بنك|مصرف|leverage/i,
  InstitutionalAllocatorPack: /allocat|مخصص|conservative|محافظ|portfolio|محفظة|horizon|أفق|deploy|invest/i,
  HistoricalAnalogPack:     /history|تاريخ|analog|2014|2016|2022|cycle|دورة|prior|precedent/i,
  SectorRotationPack:       /sector|قطاع|rotation|دوران|sabic|سابك|petrochem|winner|loser/i,
  RiskManagementPack:       /risk\s+(management|control)|tail\s+risk|drawdown|capital\s+preservation|حفظ\s+رأس/i,
};

export function selectResearchPacks(
  question: string,
  ctx: string,
  isSaudi: boolean,
): ResearchPackId[] {
  const text = `${question} ${ctx}`.slice(0, 2000);
  const selected = new Set<ResearchPackId>();

  for (const [id, pattern] of Object.entries(PACK_TRIGGER_PATTERNS) as [ResearchPackId, RegExp][]) {
    if (pattern.test(text)) selected.add(id);
  }

  // Saudi questions always include core Saudi packs
  if (isSaudi || selected.has("SaudiMacroPack")) {
    (["SaudiMacroPack", "OilFiscalPack", "InstitutionalAllocatorPack"] as ResearchPackId[]).forEach(id => selected.add(id));
  }

  // Investment questions always include allocator pack
  if (/invest|allocat|portfolio|استثمار|محفظة|مخصص/i.test(text)) {
    selected.add("InstitutionalAllocatorPack");
  }

  return Array.from(selected);
}

export function getResearchPack(id: ResearchPackId): ResearchPack {
  return PACKS[id];
}

export function getResearchPacks(ids: ResearchPackId[]): ResearchPack[] {
  return ids.map(id => PACKS[id]).filter(Boolean);
}

/**
 * Builds a compact combined research pack context for injection into the prompt.
 * Limits to 5 packs to avoid prompt bloat. Returns empty string if no packs.
 */
export function buildResearchPackContext(
  packIds: ResearchPackId[],
  lang: "ar" | "en",
): string {
  if (packIds.length === 0) return "";

  const priority: ResearchPackId[] = [
    "SaudiMacroPack", "InstitutionalAllocatorPack", "OilFiscalPack",
    "FedPolicyPack", "SectorRotationPack", "CreditCyclePack",
    "HistoricalAnalogPack", "RiskManagementPack",
  ];
  const ordered = priority.filter(id => packIds.includes(id));
  const limited = ordered.slice(0, 5);

  const header = lang === "ar"
    ? "حزم البحث المؤسسي المفعّلة (حقائق ومسارات انتقال مؤسسية — إلزامية في الإجابة):"
    : "ACTIVATED RESEARCH PACKS (institutional facts and transmission paths — mandatory in answer):";

  const blocks = limited.map(id => PACKS[id].contextBlock(lang));
  return [header, ...blocks].join("\n");
}
