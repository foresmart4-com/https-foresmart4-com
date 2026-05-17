// AI Mock Analyst — structured responses for the ForeSmart AI Analyst page.
// No external API calls. Replace with Lovable AI Gateway when ready.

export type AnalysisType = "saudi" | "crypto" | "compare" | "risk" | "allocation" | "general";

export type MockAnalysis = {
  type: AnalysisType;
  summary: string;
  indicators: { label: string; value: string; tone?: "success" | "danger" | "warning" | "primary" }[];
  riskLevel: "low" | "medium" | "high";
  watchPoints: string[];
  disclaimer: string;
};

export type MarketContext = { symbol: string; price: number; changePct: number }[];
export type PortfolioContext = { totalSar?: number; cashSar?: number; holdings?: { symbol: string; weight: number }[] };

function classify(prompt: string): AnalysisType {
  const p = prompt.toLowerCase();
  if (/(saudi|سعودي|تاسي|tasi|أرامكو|aramco|الراجحي)/i.test(p)) return "saudi";
  if (/(crypto|btc|bitcoin|بتكوين|عملات رقمية|eth|ethereum)/i.test(p)) return "crypto";
  if (/(compare|مقارنة|قارن|vs|بين)/i.test(p)) return "compare";
  if (/(risk|مخاطر|خطر)/i.test(p)) return "risk";
  if (/(allocation|توزيع|محفظة|portfolio|balanced)/i.test(p)) return "allocation";
  return "general";
}

const DISCLAIMER_AR = "هذا التحليل لأغراض تعليمية فقط ولا يُعتبر توصية مالية ملزمة. القرار النهائي مسؤولية المستخدم.";
const DISCLAIMER_EN = "Educational analysis only — not binding financial advice. Final decision is the user's responsibility.";

export function generateMockAnalysis(
  prompt: string,
  marketContext: MarketContext = [],
  _portfolio: PortfolioContext = {},
  lang: "ar" | "en" = "ar",
): MockAnalysis {
  const type = classify(prompt);
  const disclaimer = lang === "ar" ? DISCLAIMER_AR : DISCLAIMER_EN;
  const topMover = marketContext.slice().sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];

  switch (type) {
    case "saudi":
      return {
        type,
        summary: lang === "ar"
          ? "السوق السعودي يتداول في نطاق إيجابي مع دعم من قطاع البنوك والطاقة. تاسي يقترب من مقاومة قصيرة المدى."
          : "Saudi market trades positively with support from banks and energy. TASI nears short-term resistance.",
        indicators: [
          { label: lang === "ar" ? "تاسي" : "TASI", value: "11,820 (+0.62%)", tone: "success" },
          { label: lang === "ar" ? "أرامكو" : "Aramco", value: "28.40 (+1.42%)", tone: "success" },
          { label: lang === "ar" ? "الراجحي" : "Al Rajhi", value: "92.10 (+0.35%)", tone: "primary" },
        ],
        riskLevel: "medium",
        watchPoints: lang === "ar"
          ? ["مستوى المقاومة 11,950 على تاسي", "أسعار النفط فوق 78$", "بيانات تضخم أمريكية"]
          : ["TASI resistance at 11,950", "Oil holding above $78", "US inflation prints"],
        disclaimer,
      };

    case "crypto":
      return {
        type,
        summary: lang === "ar"
          ? "العملات الرقمية في مرحلة تذبذب مع ضعف قصير المدى على BTC وETH. الزخم يفضل المراقبة قبل الدخول."
          : "Crypto consolidating with short-term weakness on BTC and ETH. Momentum favors waiting before entries.",
        indicators: [
          { label: "BTC", value: "$64,800 (-0.74%)", tone: "danger" },
          { label: "ETH", value: "$3,120 (-0.42%)", tone: "danger" },
          { label: "SOL", value: lang === "ar" ? "زخم نسبي قوي" : "Relative strength", tone: "success" },
        ],
        riskLevel: "high",
        watchPoints: lang === "ar"
          ? ["دعم BTC 62,500$", "حجم تداول ETF", "تنظيمات SEC"]
          : ["BTC support at $62,500", "ETF inflow volume", "SEC regulatory news"],
        disclaimer,
      };

    case "compare":
      return {
        type,
        summary: lang === "ar"
          ? "الذهب يستفيد من تخفيف السياسة النقدية وضعف الدولار، بينما ناسداك يعتمد على نتائج التكنولوجيا والذكاء الاصطناعي."
          : "Gold benefits from policy easing and a weaker dollar; Nasdaq depends on tech earnings and AI demand.",
        indicators: [
          { label: lang === "ar" ? "الذهب" : "Gold", value: "$2,418 (+0.94%)", tone: "success" },
          { label: "NASDAQ", value: "19,240 (+0.42%)", tone: "primary" },
          { label: lang === "ar" ? "الارتباط" : "Correlation", value: lang === "ar" ? "منخفض" : "Low", tone: "warning" },
        ],
        riskLevel: "medium",
        watchPoints: lang === "ar"
          ? ["قرارات الفيدرالي", "نتائج إنفيديا", "مؤشر الدولار DXY"]
          : ["Fed decisions", "Nvidia earnings", "DXY dollar index"],
        disclaimer,
      };

    case "risk":
      return {
        type,
        summary: lang === "ar"
          ? "تقييم المخاطر يعتمد على حجم المركز، أفق الاستثمار، وتنوع المحفظة. أرامكو منخفضة المخاطر نسبياً لكنها مرتبطة بأسعار النفط."
          : "Risk depends on position size, horizon and diversification. Aramco is relatively low-risk but oil-linked.",
        indicators: [
          { label: lang === "ar" ? "تقلب 30 يوم" : "30d volatility", value: "~14%", tone: "warning" },
          { label: lang === "ar" ? "بيتا مقابل تاسي" : "Beta vs TASI", value: "0.9", tone: "primary" },
          { label: lang === "ar" ? "العائد الموزع" : "Dividend yield", value: "~6%", tone: "success" },
        ],
        riskLevel: "low",
        watchPoints: lang === "ar"
          ? ["أسعار النفط Brent", "إنتاج OPEC+", "سعر الصرف"]
          : ["Brent oil prices", "OPEC+ production", "FX exposure"],
        disclaimer,
      };

    case "allocation":
      return {
        type,
        summary: lang === "ar"
          ? "اقتراح توزيع متوازن: 40% أسهم محلية، 25% أسهم عالمية، 15% ذهب وسلع، 10% عملات رقمية، 10% نقد."
          : "Balanced allocation: 40% local equities, 25% global equities, 15% gold/commodities, 10% crypto, 10% cash.",
        indicators: [
          { label: lang === "ar" ? "أسهم محلية" : "Local equities", value: "40%", tone: "primary" },
          { label: lang === "ar" ? "أسهم عالمية" : "Global equities", value: "25%", tone: "primary" },
          { label: lang === "ar" ? "ذهب وسلع" : "Gold/Commodities", value: "15%", tone: "warning" },
          { label: lang === "ar" ? "عملات رقمية" : "Crypto", value: "10%", tone: "danger" },
          { label: lang === "ar" ? "نقد" : "Cash", value: "10%", tone: "muted" as any },
        ],
        riskLevel: "medium",
        watchPoints: lang === "ar"
          ? ["إعادة التوازن الفصلي", "متابعة الارتباط بين الأصول", "احتياط طوارئ 3-6 أشهر"]
          : ["Quarterly rebalancing", "Asset correlations", "3-6 months emergency reserve"],
        disclaimer,
      };

    default:
      return {
        type: "general",
        summary: lang === "ar"
          ? `سؤال عام: ${prompt}. الأسواق العالمية تتداول بحذر مع تركيز على بيانات التضخم وقرارات البنوك المركزية.`
          : `General query: ${prompt}. Global markets trade cautiously, focused on inflation prints and central-bank decisions.`,
        indicators: topMover
          ? [{ label: topMover.symbol, value: `${topMover.price} (${topMover.changePct.toFixed(2)}%)`, tone: topMover.changePct >= 0 ? "success" : "danger" }]
          : [{ label: lang === "ar" ? "حالة السوق" : "Market state", value: lang === "ar" ? "حذر" : "Cautious", tone: "warning" }],
        riskLevel: "medium",
        watchPoints: lang === "ar"
          ? ["تقارير الأرباح", "العائد على السندات الأمريكية 10 سنوات", "أحداث جيوسياسية"]
          : ["Earnings reports", "US 10Y yield", "Geopolitical events"],
        disclaimer,
      };
  }
}
