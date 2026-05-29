// Phase-85D: Arabic Thinker and School Detection
// Pure deterministic functions — no AI calls, no network, O(1).
//
// Arabic-language thinker and investment school detection.
// Maps Arabic transliterations and Arabic investment vocabulary to
// profiles in institutionalThinkerLibrary.ts and investmentSchoolLibrary.ts.
//
// Covers all 11 thinkers + 9 investment schools in Arabic.
//
// Arabic transliterations:
//   داليو / راي داليو       → dalio
//   بوفيت / وارن بوفيت     → buffett
//   فريدمان / ميلتون        → friedman
//   مينسكي / هايمان         → minsky
//   سوروس / جورج سوروس     → soros
//   شيلر / روبرت شيلر      → shiller
//   هايك / فريدريك          → hayek
//   كينز / كينزي             → keynes
//   فاما / يوجين             → fama
//   ماركس (هوارد)           → marks
//   دراكنميلر               → druckenmiller
//
// Arabic school vocabulary:
//   استثمار القيمة          → value
//   أسهم النمو / نمو الأسعار → growth
//   الاقتصاد الكلي / الكلي  → macro
//   زخم السعر / تتبع الاتجاه → trend
//   استثمار الجودة           → quality
//   الائتمان / دورة الائتمان → credit
//   توازن المخاطر            → risk_parity
//   صناديق الثروة السيادية   → sovereign_allocation
//   دورة رأس المال           → capital_cycle
//
// No biography focus. Analytical profiles only.
// Educational/advisory use only.

import { THINKER_PROFILES, type ThinkerProfile } from "./institutionalThinkerLibrary";
import { INVESTMENT_SCHOOLS, type InvestmentSchool, type InvestmentSchoolId } from "./investmentSchoolLibrary";

// ─── Arabic thinker map ───────────────────────────────────────────────────────

interface ArabicThinkerEntry {
  patterns: RegExp[];       // Arabic text patterns
  thinkerId: string;
}

const ARABIC_THINKER_MAP: ArabicThinkerEntry[] = [
  {
    thinkerId: "dalio",
    patterns: [
      /(داليو|راي\s*داليو|بريدج\s*ووتر|ب?ريدجووتر|المحفظة\s*الكل\s*طقس|توازن\s*المخاطر\s*الكلي)/u,
    ],
  },
  {
    thinkerId: "buffett",
    patterns: [
      /(بوفيت|وارن\s*بوفيت|بافيت|بيركشاير|هاثاوي|استثمار\s*القيمة\s*الكلاسيكي|هامش\s*الأمان)/u,
    ],
  },
  {
    thinkerId: "friedman",
    patterns: [
      /(فريدمان|ميلتون\s*فريدمان|المدرسة\s*النقدية|النقدية\s*الحديثة|نظرية\s*الكمية\s*للنقود)/u,
    ],
  },
  {
    thinkerId: "minsky",
    patterns: [
      /(مينسكي|هايمان\s*مينسكي|لحظة\s*مينسكي|مرحلة\s*بونزي|التمويل\s*التأملي|عدم\s*الاستقرار\s*المالي)/u,
    ],
  },
  {
    thinkerId: "soros",
    patterns: [
      /(سوروس|جورج\s*سوروس|الانعكاسية|صندوق\s*كوانتم|الطفرة\s*والانهيار)/u,
    ],
  },
  {
    thinkerId: "shiller",
    patterns: [
      /(شيلر|روبرت\s*شيلر|نسبة\s*السعر\s*إلى\s*الأرباح\s*المعدلة|كيب|الوفرة\s*غير\s*العقلانية|اقتصاد\s*السرديات)/u,
    ],
  },
  {
    thinkerId: "hayek",
    patterns: [
      /(هايك|فريدريك\s*هايك|المدرسة\s*النمساوية|النظام\s*العفوي|سوء\s*الاستثمار\s*الرأسمالي)/u,
    ],
  },
  {
    thinkerId: "keynes",
    patterns: [
      /(كينز|كينزي|كينيز|جون\s*مينارد|الطلب\s*الكلي|المضاعف\s*المالي|روح\s*الحيوانات)/u,
    ],
  },
  {
    thinkerId: "fama",
    patterns: [
      /(فاما|يوجين\s*فاما|فرضية\s*السوق\s*الكفوء|العوامل\s*فرنش|أسعار\s*تعكس\s*المعلومات)/u,
    ],
  },
  {
    thinkerId: "marks",
    patterns: [
      /(ماركس|هوارد\s*ماركس|أوكتري|التفكير\s*من\s*الدرجة\s*الثانية|دورة\s*الائتمان\s*ماركس)/u,
    ],
  },
  {
    thinkerId: "druckenmiller",
    patterns: [
      /(دراكنميلر|ستانلي\s*دراكنميلر|دوكسان|السيولة\s*أولاً|التحجيم\s*غير\s*المتماثل)/u,
    ],
  },
];

// ─── Arabic school map ────────────────────────────────────────────────────────

interface ArabicSchoolEntry {
  patterns: RegExp[];
  schoolId: InvestmentSchoolId;
}

const ARABIC_SCHOOL_MAP: ArabicSchoolEntry[] = [
  {
    schoolId: "value",
    patterns: [
      /(استثمار\s*القيمة|الأسهم\s*الرخيصة|هامش\s*الأمان|القيمة\s*الجوهرية|نسبة\s*السعر\s*للقيمة)/u,
    ],
  },
  {
    schoolId: "growth",
    patterns: [
      /(أسهم\s*النمو|نمو\s*الأرباح|التوسع\s*الربحي|الشركات\s*ذات\s*النمو\s*العالي)/u,
    ],
  },
  {
    schoolId: "macro",
    patterns: [
      /(الاقتصاد\s*الكلي|الاستثمار\s*الكلي|تخصيص\s*من\s*الأعلى\s*للأسفل|استراتيجية\s*كلية|النهج\s*الكلي)/u,
    ],
  },
  {
    schoolId: "trend",
    patterns: [
      /(تتبع\s*الاتجاه|زخم\s*السعر|الاستثمار\s*الزخمي|المتوسط\s*المتحرك|كسر\s*المقاومة)/u,
    ],
  },
  {
    schoolId: "quality",
    patterns: [
      /(استثمار\s*الجودة|عائد\s*رأس\s*المال\s*المرتفع|جودة\s*الأرباح|الشركات\s*الممتازة|الخندق\s*التنافسي)/u,
    ],
  },
  {
    schoolId: "credit",
    patterns: [
      /(استثمار\s*الائتمان|فروق\s*الائتمان|دورة\s*الائتمان|الدخل\s*الثابت|السندات\s*عالية\s*العائد|الصكوك)/u,
    ],
  },
  {
    schoolId: "risk_parity",
    patterns: [
      /(توازن\s*المخاطر|المساهمة\s*المتساوية\s*في\s*المخاطر|المحفظة\s*المتوازنة|تعادل\s*المخاطر)/u,
    ],
  },
  {
    schoolId: "sovereign_allocation",
    patterns: [
      /(صناديق\s*الثروة\s*السيادية|صندوق\s*الاستثمارات\s*العامة|السيادي|التخصيص\s*السيادي|إدارة\s*الثروة\s*الوطنية|ساما\s*احتياطيات)/u,
    ],
  },
  {
    schoolId: "capital_cycle",
    patterns: [
      /(دورة\s*رأس\s*المال|دورة\s*الإنفاق\s*الرأسمالي|الشح\s*في\s*العرض|استثمار\s*دورة\s*الطاقة)/u,
    ],
  },
];

// ─── Detection functions ──────────────────────────────────────────────────────

export function detectArabicThinkers(
  text: string,
  maxResults = 2,
): ThinkerProfile[] {
  if (!text || !/[؀-ۿ]/.test(text)) return [];

  const matched: ThinkerProfile[] = [];
  const seen = new Set<string>();

  for (const entry of ARABIC_THINKER_MAP) {
    if (seen.has(entry.thinkerId)) continue;
    const hit = entry.patterns.some(p => p.test(text));
    if (hit) {
      const profile = THINKER_PROFILES.find(t => t.id === entry.thinkerId);
      if (profile) {
        matched.push(profile);
        seen.add(entry.thinkerId);
      }
    }
  }

  // Add conflict partner if only one thinker and has conflicts
  if (matched.length === 1 && matched[0].disagreesWith.length > 0) {
    const conflictId = matched[0].disagreesWith[0];
    if (!seen.has(conflictId)) {
      const conflict = THINKER_PROFILES.find(t => t.id === conflictId);
      if (conflict) matched.push(conflict);
    }
  }

  return matched.slice(0, maxResults);
}

export function detectArabicSchools(
  text: string,
  maxResults = 2,
): InvestmentSchool[] {
  if (!text || !/[؀-ۿ]/.test(text)) return [];

  const matched: InvestmentSchool[] = [];
  const seen = new Set<InvestmentSchoolId>();

  for (const entry of ARABIC_SCHOOL_MAP) {
    if (seen.has(entry.schoolId)) continue;
    const hit = entry.patterns.some(p => p.test(text));
    if (hit) {
      const school = INVESTMENT_SCHOOLS.find(s => s.id === entry.schoolId);
      if (school) {
        matched.push(school);
        seen.add(entry.schoolId);
      }
    }
  }

  return matched.slice(0, maxResults);
}

// ─── Context builders ─────────────────────────────────────────────────────────

export function buildArabicThinkerContext(
  text: string,
  isSaudi = false,
): string {
  const thinkers = detectArabicThinkers(text);
  if (thinkers.length === 0) return "";

  const parts = thinkers.map(t =>
    `${t.name} (${t.framework.slice(0, 50)}): ${t.investmentImplication}`.slice(0, 180),
  );

  const conflictNote = thinkers.length >= 2 &&
    (thinkers[0].disagreesWith.includes(thinkers[1].id) ||
     thinkers[1].disagreesWith.includes(thinkers[0].id))
    ? `${thinkers[0].name} and ${thinkers[1].name} conflict: apply both, weight by regime.`
    : null;

  return [
    `Thinker context (Arabic) [${thinkers.map(t => t.id).join("+")}]:`,
    conflictNote,
    parts.join(" || "),
  ].filter(Boolean).join(" ").slice(0, 420);
}

export function buildArabicSchoolContext(
  text: string,
  isSaudi = false,
): string {
  const schools = detectArabicSchools(text);
  if (schools.length === 0) return "";

  const parts = schools.map(s => {
    let entry = `${s.name}: ${s.investmentLogic}`;
    if (isSaudi && s.saudiNote && s.saudiApplicability !== "low") {
      entry += ` [Saudi: ${s.saudiNote}]`;
    }
    return entry.slice(0, 180);
  });

  return [
    `Investment school (Arabic) [${schools.map(s => s.id).join("+")}]:`,
    parts.join(" || "),
  ].join(" ").slice(0, 400);
}
