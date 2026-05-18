// Investment Plan Engine — generates institutional-style plan templates.
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
    type: "conservative", name: "Conservative Capital", nameAr: "محفظة محافظة",
    description: "Capital preservation with steady, low-volatility returns.",
    descriptionAr: "حماية رأس المال مع عوائد ثابتة منخفضة التقلب.",
    defaultDurationDays: 180, riskLevel: "low",
    targetMarkets: ["XAU", "DXY", "BTC"],
    expectedAnnualReturnPct: [6, 12], expectedVolatilityPct: 12, drawdownTolerancePct: 5,
    rebalanceCadenceDays: 14, aiConfidenceBaseline: 78,
  },
  {
    type: "balanced", name: "Balanced Growth", nameAr: "نمو متوازن",
    description: "Equal-weighted exposure to growth and safe-haven assets.",
    descriptionAr: "توزيع متوازن بين أصول النمو والملاذات الآمنة.",
    defaultDurationDays: 270, riskLevel: "medium",
    targetMarkets: ["BTC", "ETH", "SPX", "XAU"],
    expectedAnnualReturnPct: [12, 22], expectedVolatilityPct: 22, drawdownTolerancePct: 10,
    rebalanceCadenceDays: 10, aiConfidenceBaseline: 72,
  },
  {
    type: "aggressive", name: "Aggressive Alpha", nameAr: "ألفا الهجومية",
    description: "Maximum exposure to high-conviction momentum opportunities.",
    descriptionAr: "أعلى انكشاف لفرص الزخم عالية الثقة.",
    defaultDurationDays: 120, riskLevel: "high",
    targetMarkets: ["BTC", "ETH", "NDX"],
    expectedAnnualReturnPct: [25, 60], expectedVolatilityPct: 45, drawdownTolerancePct: 20,
    rebalanceCadenceDays: 5, aiConfidenceBaseline: 65,
  },
  {
    type: "ai_adaptive", name: "AI Adaptive", nameAr: "تكييف الذكاء الاصطناعي",
    description: "AI continuously rebalances based on regime and confidence.",
    descriptionAr: "إعادة توازن مستمرة بناءً على نظام السوق والثقة.",
    defaultDurationDays: 365, riskLevel: "adaptive",
    targetMarkets: ["BTC", "ETH", "XAU", "SPX", "NDX"],
    expectedAnnualReturnPct: [18, 45], expectedVolatilityPct: 28, drawdownTolerancePct: 12,
    rebalanceCadenceDays: 3, aiConfidenceBaseline: 80,
  },
  {
    type: "custom", name: "Custom AI Strategy", nameAr: "إستراتيجية مخصصة",
    description: "User-defined parameters tuned by the AI brain.",
    descriptionAr: "معاملات يحددها المستخدم ويضبطها الذكاء الاصطناعي.",
    defaultDurationDays: 180, riskLevel: "medium",
    targetMarkets: [],
    expectedAnnualReturnPct: [10, 30], expectedVolatilityPct: 25, drawdownTolerancePct: 10,
    rebalanceCadenceDays: 7, aiConfidenceBaseline: 70,
  },
];

export function getTemplate(type: PlanType): PlanTemplate {
  return PLAN_TEMPLATES.find((t) => t.type === type) ?? PLAN_TEMPLATES[1];
}
