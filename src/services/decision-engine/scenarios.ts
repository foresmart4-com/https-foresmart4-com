// Bullish / base / bearish probability tree with sub-scenarios per branch.
import type { ScenarioNode, UncertaintyBand } from "./types";

export function buildScenarioTree(
  compositeScore: number,
  unc: UncertaintyBand,
  language: "ar" | "en",
): ScenarioNode[] {
  const ar = language === "ar";

  // Logistic skew, dampened by entropy (more uncertainty → flatter probabilities)
  const damp = 1 - unc.entropy * 0.5;
  const skew = Math.max(-35, Math.min(35, compositeScore * 0.35)) * damp;
  const pBull = Math.round(50 + skew);
  const pBear = Math.round(35 - skew * 0.7);
  const pBase = Math.max(5, 100 - pBull - pBear);

  const t = (en: string, arT: string) => (ar ? arT : en);

  return [
    {
      id: "bull", label: t("Bullish continuation", "استمرار صعودي"),
      probability: pBull / 100,
      expectedReturnPct: +(2 + Math.max(0, compositeScore) * 0.06).toFixed(2),
      trigger: t("Breadth expands with macro tailwind intact.", "اتساع السوق مع تدفقات داعمة كلياً."),
      defence: t("Trail stops under prior structure; trim on parabolic extension.", "تتبع وقف الخسارة تحت الهيكل السابق وتقليل عند التمدد المفرط."),
      children: [
        {
          id: "bull-mom", label: t("Momentum acceleration", "تسارع الزخم"),
          probability: 0.55, expectedReturnPct: +(3 + compositeScore * 0.07).toFixed(2),
          trigger: t("MTF agreement + breakout pressure rising.", "اتفاق الأطر الزمنية وزيادة ضغط الاختراق."),
          defence: t("Pyramid only on confirmed retest.", "زيادة المراكز فقط عند إعادة اختبار مؤكدة."),
        },
        {
          id: "bull-rot", label: t("Sector rotation", "دوران قطاعي"),
          probability: 0.45, expectedReturnPct: +(1.2 + compositeScore * 0.03).toFixed(2),
          trigger: t("Leadership rotates to lagging high-beta.", "تنتقل القيادة لأسهم بيتا أعلى تأخرت."),
          defence: t("Cap per-name to 10%; hedge index beta.", "تقييد الوزن لكل اسم 10% وتحوط مؤشر."),
        },
      ],
    },
    {
      id: "base", label: t("Range / base case", "نطاق / السيناريو الأساسي"),
      probability: pBase / 100, expectedReturnPct: 0,
      trigger: t("No new macro catalyst; volatility compresses.", "لا محفز كلي جديد وضغط التذبذب."),
      defence: t("Size light; rotate into low-correlation assets.", "تقليل الحجم والدوران لأصول قليلة الارتباط."),
    },
    {
      id: "bear", label: t("Bearish reversal", "انعكاس هبوطي"),
      probability: pBear / 100,
      expectedReturnPct: +(-(2 + Math.max(0, -compositeScore) * 0.05)).toFixed(2),
      trigger: t("Risk-off catalyst + breadth divergence + credit stress.", "محفز رفض المخاطرة وتباين الاتساع وضغط الائتمان."),
      defence: t("Hard stops, hedge sleeve, deleverage gross exposure.", "وقف صارم وغطاء تحوط وتخفيض التعرض الإجمالي."),
      children: [
        {
          id: "bear-flush", label: t("Liquidity flush", "تصفية سيولة"),
          probability: 0.4, expectedReturnPct: -(3 + Math.abs(compositeScore) * 0.05),
          trigger: t("Vol-of-vol spike; correlations → 1.", "ارتفاع تذبذب التذبذب وارتباطات تقترب من 1."),
          defence: t("Move to cash / short-dated paper.", "التحول إلى نقد أو سندات قصيرة الأجل."),
        },
        {
          id: "bear-grind", label: t("Slow grind lower", "هبوط متدرج"),
          probability: 0.6, expectedReturnPct: -(1 + Math.abs(compositeScore) * 0.02),
          trigger: t("Sentiment decays while macro stays soft.", "تآكل المعنويات مع ضعف كلي."),
          defence: t("Trim weakest cohort; protect winners with collars.", "تقليل أضعف المراكز وحماية الرابحين بإستراتيجية الطوق."),
        },
      ],
    },
  ];
}
