// Economic Intelligence layer — demo macro snapshot with deterministic refresh.

export interface MacroIndicator {
  key: "rates" | "inflation" | "cpi" | "gdp" | "oil" | "usd";
  label: string;
  labelAr: string;
  value: number;
  unit: string;
  changePct: number;
  impact: "bullish" | "bearish" | "neutral";
  note: string;
  noteAr: string;
}

function bucket() { return Math.floor(Date.now() / (15 * 60_000)); }
function jitter(seed: number, scale = 1) {
  const s = ((seed * 9301 + 49297) % 233280) / 233280;
  return (s - 0.5) * 2 * scale;
}

export function getMacroSnapshot(): MacroIndicator[] {
  const b = bucket();
  return [
    {
      key: "rates", label: "Fed Funds Rate", labelAr: "سعر الفائدة الفيدرالي",
      value: +(5.25 + jitter(b + 1, 0.05)).toFixed(2), unit: "%",
      changePct: +jitter(b + 2, 0.1).toFixed(2),
      impact: "bearish",
      note: "Restrictive policy pressures risk assets",
      noteAr: "السياسة المتشددة تضغط على الأصول الخطرة",
    },
    {
      key: "inflation", label: "Inflation YoY", labelAr: "التضخم السنوي",
      value: +(3.1 + jitter(b + 3, 0.15)).toFixed(2), unit: "%",
      changePct: +jitter(b + 4, 0.3).toFixed(2),
      impact: "neutral",
      note: "Sticky services inflation",
      noteAr: "تضخم الخدمات ثابت نسبياً",
    },
    {
      key: "cpi", label: "Core CPI", labelAr: "مؤشر الأسعار الأساسي",
      value: +(3.4 + jitter(b + 5, 0.1)).toFixed(2), unit: "%",
      changePct: +jitter(b + 6, 0.2).toFixed(2),
      impact: "neutral",
      note: "Cooling slower than headline",
      noteAr: "يتباطأ أبطأ من المؤشر الرئيسي",
    },
    {
      key: "gdp", label: "GDP Growth", labelAr: "نمو الناتج المحلي",
      value: +(2.6 + jitter(b + 7, 0.3)).toFixed(2), unit: "%",
      changePct: +jitter(b + 8, 0.4).toFixed(2),
      impact: "bullish",
      note: "Resilient consumer spend",
      noteAr: "إنفاق استهلاكي مرن",
    },
    {
      key: "oil", label: "WTI Crude", labelAr: "النفط الخام",
      value: +(78 + jitter(b + 9, 4)).toFixed(2), unit: "$",
      changePct: +jitter(b + 10, 2).toFixed(2),
      impact: "neutral",
      note: "OPEC+ discipline vs demand worry",
      noteAr: "انضباط أوبك+ مقابل قلق الطلب",
    },
    {
      key: "usd", label: "DXY (USD)", labelAr: "مؤشر الدولار",
      value: +(104.2 + jitter(b + 11, 0.8)).toFixed(2), unit: "",
      changePct: +jitter(b + 12, 0.6).toFixed(2),
      impact: "bearish",
      note: "Strong USD pressures EM and commodities",
      noteAr: "قوة الدولار تضغط على الأسواق الناشئة والسلع",
    },
  ];
}

export function macroBias(snapshot: MacroIndicator[]): number {
  const map = { bullish: 1, bearish: -1, neutral: 0 } as const;
  return snapshot.reduce((s, x) => s + map[x.impact], 0);
}
