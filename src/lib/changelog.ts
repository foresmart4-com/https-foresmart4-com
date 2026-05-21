// Public changelog of frontend releases.
// Add a new entry at the TOP each time you click Publish.
// The page at /changelog renders this list with AR/EN summaries.

export type ChangelogEntry = {
  version: string;
  date: string; // ISO date (YYYY-MM-DD)
  title_ar: string;
  title_en: string;
  highlights_ar: string[];
  highlights_en: string[];
  tag?: "feature" | "fix" | "security" | "performance" | "ui";
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "v1.18.0",
    date: "2026-05-21",
    tag: "feature",
    title_ar: "زر نشر سريع وصفحة سجل التغييرات",
    title_en: "Quick Publish button & Changelog page",
    highlights_ar: [
      "إضافة زر «نشر التحديث» يفتح حوار النشر الرسمي مباشرة من داخل التطبيق.",
      "إنشاء صفحة /changelog لعرض كل نسخة منشورة مع التاريخ والملخص.",
      "تبسيط التحقق من آخر تحديث للواجهة قبل وبعد النشر.",
    ],
    highlights_en: [
      "Added a 'Publish update' button that opens the official publish dialog from inside the app.",
      "New /changelog page listing every published version with date and summary.",
      "Easier verification of the latest frontend release before and after publishing.",
    ],
  },
  {
    version: "v1.17.0",
    date: "2026-05-20",
    tag: "feature",
    title_ar: "أرشيف بيانات السوق التاريخية",
    title_en: "Historical Market Archive Engine",
    highlights_ar: [
      "محرّك مركزي للبيانات التاريخية لكل فئات الأصول مع ذاكرة تخزين على Supabase.",
      "صفحة /market-history مع شموع OHLC ونطاقات من 24 ساعة حتى 3 سنوات.",
      "ربط /backtest-lab و /ai-learning بالأرشيف الحقيقي مع شارة Mock عند الغياب.",
    ],
    highlights_en: [
      "Centralized historical engine across all asset classes with Supabase cache.",
      "/market-history page with OHLC candles and ranges from 24h to 3y.",
      "/backtest-lab and /ai-learning wired to the real archive with Mock badge fallback.",
    ],
  },
  {
    version: "v1.16.0",
    date: "2026-05-19",
    tag: "performance",
    title_ar: "موجّه السوق الموحّد",
    title_en: "Unified Market Router",
    highlights_ar: [
      "توجيه مركزي لطلبات الأسعار مع سلاسل احتياط حسب فئة الأصل.",
      "ذاكرة تخزين TTL وإلغاء التكرار وقياسات EWMA لكل مزوّد.",
      "نقطة اختبار /api/public/router-test لمراقبة الأداء.",
    ],
    highlights_en: [
      "Central price routing with per-asset-class fallback chains.",
      "TTL cache, request dedup, and EWMA metrics per provider.",
      "Diagnostic endpoint at /api/public/router-test.",
    ],
  },
  {
    version: "v1.15.0",
    date: "2026-05-18",
    tag: "feature",
    title_ar: "خريطة حرارية وتقويم اقتصادي محدّثان",
    title_en: "Refreshed Heatmap & Economic Calendar",
    highlights_ar: [
      "تحديث تلقائي كل 60 ثانية وزر «تحديث الآن».",
      "روابط من التقويم إلى الأصول المتأثرة في ذكاء السوق.",
      "تصدير CSV/PDF من صفحة الأرشيف وفلترة حسب مستوى المخاطرة.",
    ],
    highlights_en: [
      "60s auto-refresh and 'Refresh now' buttons.",
      "Calendar events link to affected assets in Market Intelligence.",
      "CSV/PDF export from Archive and risk-tolerance filtering.",
    ],
  },
];
