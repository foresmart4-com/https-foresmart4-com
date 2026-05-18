// Analytics Plan Engine — generates AI analytics membership templates.
export type PlanType = "conservative" | "balanced" | "aggressive" | "ai_adaptive" | "custom";
export type RiskLevel = "low" | "medium" | "high" | "adaptive";

export interface PlanTemplate {
  type: PlanType;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  defaultDurationDays: number;
  riskLevel: RiskLevel;
  targetMarkets: string[];
  expectedAnnualReturnPct: [number, number];
  expectedVolatilityPct: number;
  drawdownTolerancePct: number;
  rebalanceCadenceDays: number;
  aiConfidenceBaseline: number;
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    type: "conservative", name: "Starter Analytics", nameAr: "تحليلات المبتدئ",
    description: "Entry-level AI analytics with low-volatility educational insights.",
    descriptionAr: "تحليلات ذكية للمبتدئين مع رؤى تعليمية منخفضة التقلب.",
    defaultDurationDays: 180, riskLevel: "low",
    targetMarkets: ["XAU", "DXY", "BTC"],
    expectedAnnualReturnPct: [6, 12], expectedVolatilityPct: 12, drawdownTolerancePct: 5,
    rebalanceCadenceDays: 14, aiConfidenceBaseline: 78,
  },
  {
    type: "balanced", name: "Pro Analytics", nameAr: "تحليلات احترافية",
    description: "Balanced AI analytics across growth and safe-haven market intelligence.",
    descriptionAr: "تحليلات احترافية متوازنة عبر أسواق النمو والملاذات الآمنة.",
    defaultDurationDays: 270, riskLevel: "medium",
    targetMarkets: ["BTC", "ETH", "SPX", "XAU"],
    expectedAnnualReturnPct: [12, 22], expectedVolatilityPct: 22, drawdownTolerancePct: 10,
    rebalanceCadenceDays: 10, aiConfidenceBaseline: 72,
  },
  {
    type: "aggressive", name: "Elite Analytics", nameAr: "تحليلات النخبة",
    description: "Elite-tier AI analytics focused on high-conviction momentum insights.",
    descriptionAr: "تحليلات النخبة المركّزة على رؤى الزخم عالية الثقة.",
    defaultDurationDays: 120, riskLevel: "high",
    targetMarkets: ["BTC", "ETH", "NDX"],
    expectedAnnualReturnPct: [25, 60], expectedVolatilityPct: 45, drawdownTolerancePct: 20,
    rebalanceCadenceDays: 5, aiConfidenceBaseline: 65,
  },
  {
    type: "ai_adaptive", name: "AI Adaptive Analytics", nameAr: "تحليلات تكيفية",
    description: "AI continuously recalibrates analytics based on regime and confidence.",
    descriptionAr: "تحليلات مستمرة تتكيّف وفق حالة السوق ومستوى الثقة.",
    defaultDurationDays: 365, riskLevel: "adaptive",
    targetMarkets: ["BTC", "ETH", "XAU", "SPX", "NDX"],
    expectedAnnualReturnPct: [18, 45], expectedVolatilityPct: 28, drawdownTolerancePct: 12,
    rebalanceCadenceDays: 3, aiConfidenceBaseline: 80,
  },
  {
    type: "custom", name: "Custom AI Analytics", nameAr: "تحليلات مخصصة",
    description: "User-defined analytics parameters tuned by the AI brain.",
    descriptionAr: "معاملات تحليلية يحددها المستخدم ويضبطها الذكاء الاصطناعي.",
    defaultDurationDays: 180, riskLevel: "medium",
    targetMarkets: [],
    expectedAnnualReturnPct: [10, 30], expectedVolatilityPct: 25, drawdownTolerancePct: 10,
    rebalanceCadenceDays: 7, aiConfidenceBaseline: 70,
  },
];

export function getTemplate(type: PlanType): PlanTemplate {
  return PLAN_TEMPLATES.find((t) => t.type === type) ?? PLAN_TEMPLATES[1];
}
