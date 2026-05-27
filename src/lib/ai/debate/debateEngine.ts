import { routeQuote } from "@/lib/market/router";
import { getMacroFeed } from "@/lib/ai/feeds/macroFeed";
import { getNewsFeed } from "@/lib/ai/feeds/newsFeed";
import { applyKnowledge } from "@/lib/ai/knowledge";
import { getAIMemoryStatus } from "@/lib/ai/memory/store";
import { getSourceCredibilityReport } from "@/lib/ai/credibility/sourceCredibility";
import { getGenesisArchiveSummary, getGenesisCredibility, getGenesisDecisionFirewall, getGenesisPositionSizing } from "@/lib/genesis100/engine";
import { safeRead } from "@/lib/ai/core/safety";
import type { InstitutionalAgentOpinion, InstitutionalStance } from "@/lib/ai/debate/types";

async function context(symbol: string) {
  const [quote, macro, news, knowledge, memory, credibility, archive, positionSizing, firewall, genesisCredibility] = await Promise.all([
    safeRead(() => routeQuote(symbol), null),
    safeRead(() => getMacroFeed(), null),
    safeRead(() => getNewsFeed(), null),
    safeRead(() => applyKnowledge(symbol), null),
    safeRead(() => getAIMemoryStatus(), null),
    safeRead(() => getSourceCredibilityReport(), null),
    safeRead(() => getGenesisArchiveSummary(), null),
    safeRead(() => getGenesisPositionSizing(new URLSearchParams({ symbol })), null),
    safeRead(() => getGenesisDecisionFirewall(), null),
    safeRead(() => getGenesisCredibility(new URLSearchParams({ symbol })), null),
  ]);
  return { quote, macro, news, knowledge, memory, credibility, archive, positionSizing, firewall, genesisCredibility };
}

function opinion(input: Partial<InstitutionalAgentOpinion> & Pick<InstitutionalAgentOpinion, "agentId" | "reasoningAr">): InstitutionalAgentOpinion {
  const bullishScore = Math.max(0, Math.min(100, Math.round(input.bullishScore ?? 50)));
  const bearishScore = Math.max(0, Math.min(100, Math.round(input.bearishScore ?? 50)));
  const riskScore = Math.max(0, Math.min(100, Math.round(input.riskScore ?? 50)));
  let stance: InstitutionalStance = input.stance ?? "neutral";
  if (!input.stance) {
    stance = bullishScore > bearishScore + 12 ? "bullish" : bearishScore > bullishScore + 12 ? "bearish" : riskScore > 70 ? "uncertain" : "neutral";
  }
  return {
    agentId: input.agentId,
    stance,
    confidencePercent: Math.max(0, Math.min(100, Math.round(input.confidencePercent ?? ((bullishScore + bearishScore) / 2)))),
    bullishScore,
    bearishScore,
    riskScore,
    reasoningAr: input.reasoningAr,
    supportingEvidence: input.supportingEvidence ?? [],
    warnings: input.warnings ?? [],
    dataQuality: input.dataQuality ?? "medium",
    sourceCredibility: Math.max(0, Math.min(100, Math.round(input.sourceCredibility ?? 50))),
  };
}

export class MarketAgent {
  async analyze(symbol: string) {
    const ctx = await context(symbol);
    const change = ctx.quote?.changePercent ?? 0;
    return opinion({
      agentId: "MarketAgent",
      bullishScore: 50 + Math.max(0, change) * 8,
      bearishScore: 50 + Math.max(0, -change) * 8,
      riskScore: ctx.quote?.success ? Math.min(70, Math.abs(change) * 10) : 75,
      confidencePercent: ctx.quote?.success ? 68 : 30,
      reasoningAr: ctx.quote?.success ? `قراءة السوق لـ ${symbol} تعتمد على السعر والمزود ${ctx.quote.provider ?? "غير معروف"}.` : "المصدر غير متاح حالياً",
      supportingEvidence: ["quotes_router", ctx.quote?.provider ?? "no_provider"],
      warnings: ctx.quote?.success ? [] : ["تعذر تأكيد السعر الحي"],
      dataQuality: ctx.quote?.success ? "medium" : "low",
      sourceCredibility: ctx.quote?.provider ? 75 : 25,
    });
  }
}

export class MacroAgent {
  async analyze(symbol: string) {
    const ctx = await context(symbol);
    return opinion({
      agentId: "MacroAgent",
      bullishScore: ctx.macro?.riskImpact === "moderate" ? 60 : 45,
      bearishScore: ctx.macro?.riskImpact === "elevated" ? 65 : 45,
      riskScore: ctx.macro?.riskImpact === "unknown" ? 70 : 50,
      confidencePercent: ctx.macro?.confidencePercent ?? 20,
      reasoningAr: ctx.macro?.macroSummaryAr ?? "المصدر غير متاح حالياً",
      supportingEvidence: ["macro_feed", "trusted_sources"],
      warnings: ctx.macro?.missingIndicators?.map((i: { key: string }) => `مؤشر مفقود: ${i.key}`) ?? [],
      dataQuality: (ctx.macro?.confidencePercent ?? 0) > 60 ? "high" : "low",
      sourceCredibility: ctx.macro?.sourceCredibilityAverage ?? 50,
    });
  }
}

export class RiskAgent {
  async analyze(symbol: string) {
    const ctx = await context(symbol);
    const item = ctx.positionSizing?.positionSizing?.[0];
    return opinion({
      agentId: "RiskAgent",
      bullishScore: item?.actionAllowed ? 55 : 25,
      bearishScore: item?.actionAllowed ? 45 : 70,
      riskScore: item?.riskPercent ?? 65,
      confidencePercent: item?.decisionCredibilityPercent ?? 35,
      reasoningAr: item?.actionAllowed ? "المخاطر تسمح بالمتابعة ضمن حدود حجم مركز صارمة." : "جدار القرار يمنع الإجراء بسبب ضعف المصداقية.",
      supportingEvidence: ["position_sizing", "decision_firewall"],
      warnings: item?.actionAllowed ? [] : [item?.positionSizingReasonAr ?? "مصداقية القرار منخفضة"],
      dataQuality: item ? "medium" : "low",
      sourceCredibility: 72,
    });
  }
}

export class SentimentAgent {
  async analyze(symbol: string) {
    const ctx = await context(symbol);
    const items = ctx.news?.items ?? [];
    return opinion({
      agentId: "SentimentAgent",
      bullishScore: items.length ? 54 : 45,
      bearishScore: items.length ? 46 : 55,
      riskScore: items.length ? 45 : 62,
      confidencePercent: items.length ? 60 : 30,
      reasoningAr: ctx.news?.summaryAr ?? "المصدر غير متاح حالياً",
      supportingEvidence: ["news_feed", "source_credibility"],
      warnings: items.length ? [] : ["لا توجد تغذية أخبار مباشرة كافية"],
      dataQuality: items.length ? "medium" : "low",
      sourceCredibility: ctx.news?.sourceCredibilityAverage ?? 50,
    });
  }
}

export class ValuationAgent {
  async analyze(symbol: string) {
    const ctx = await context(symbol);
    const isCrypto = symbol.endsWith("USDT");
    return opinion({
      agentId: "ValuationAgent",
      bullishScore: isCrypto ? 42 : 55,
      bearishScore: isCrypto ? 50 : 45,
      riskScore: isCrypto ? 62 : 48,
      confidencePercent: isCrypto ? 42 : 58,
      reasoningAr: isCrypto ? "التقييم الأساسي محدود للأصول الرقمية؛ استخدم حجم مركز محافظ." : "يجب مقارنة السعر بهامش الأمان وجودة الأساسيات.",
      supportingEvidence: ["knowledge_brain", "valuation_framework"],
      warnings: ["لا يوجد نموذج تقييم كامل في هذه الطبقة"],
      dataQuality: "medium",
      sourceCredibility: ctx.knowledge?.confidence ?? 55,
    });
  }
}

export class TechnicalAgent {
  async analyze(symbol: string) {
    const ctx = await context(symbol);
    const change = ctx.quote?.changePercent ?? 0;
    return opinion({
      agentId: "TechnicalAgent",
      bullishScore: 50 + Math.max(0, change) * 10,
      bearishScore: 50 + Math.max(0, -change) * 10,
      riskScore: Math.min(85, Math.abs(change) * 12),
      confidencePercent: ctx.quote?.success ? 62 : 25,
      reasoningAr: "الهيكل الفني يعتمد على الزخم والتغير اللحظي فقط في هذه المرحلة.",
      supportingEvidence: ["quotes_router", "technical_structure"],
      warnings: Math.abs(change) > 2 ? ["تقلب فني مرتفع"] : [],
      dataQuality: ctx.quote?.success ? "medium" : "low",
      sourceCredibility: 65,
    });
  }
}

export class KnowledgeAgent {
  async analyze(symbol: string) {
    const ctx = await context(symbol);
    return opinion({
      agentId: "KnowledgeAgent",
      bullishScore: 52,
      bearishScore: 48,
      riskScore: 45,
      confidencePercent: ctx.knowledge?.confidence ?? 0,
      reasoningAr: ctx.knowledge?.decisionSupportAr ?? "المصدر غير متاح حالياً",
      supportingEvidence: ["knowledge_brain"],
      warnings: ctx.knowledge?.riskWarnings ?? [],
      dataQuality: ctx.knowledge?.confidence ? "high" : "low",
      sourceCredibility: ctx.knowledge?.confidence ?? 0,
    });
  }
}

export class PortfolioAgent {
  async analyze(symbol: string) {
    const ctx = await context(symbol);
    const archiveCount = ctx.archive?.count ?? 0;
    return opinion({
      agentId: "PortfolioAgent",
      bullishScore: archiveCount > 10 ? 55 : 45,
      bearishScore: archiveCount > 10 ? 45 : 55,
      riskScore: archiveCount > 10 ? 45 : 60,
      confidencePercent: archiveCount > 10 ? 62 : 35,
      reasoningAr: "قرار المحفظة يجب أن يحترم التركيز، النقد، وحدود المخاطر قبل أي ترجيح.",
      supportingEvidence: ["genesis_archive", "portfolio_policy", "memory_status"],
      warnings: archiveCount ? [] : ["أرشيف Genesis محدود"],
      dataQuality: archiveCount ? "medium" : "low",
      sourceCredibility: 70,
    });
  }
}

export async function runInstitutionalDebate(symbol: string) {
  const agents = [
    new MarketAgent(),
    new MacroAgent(),
    new RiskAgent(),
    new SentimentAgent(),
    new ValuationAgent(),
    new TechnicalAgent(),
    new KnowledgeAgent(),
    new PortfolioAgent(),
  ];
  return Promise.all(agents.map((agent) => agent.analyze(symbol)));
}

export function getInstitutionalAgentStatus() {
  return {
    agents: ["MarketAgent", "MacroAgent", "RiskAgent", "SentimentAgent", "ValuationAgent", "TechnicalAgent", "KnowledgeAgent", "PortfolioAgent"].map((agentId) => ({
      agentId,
      active: true,
      executionAgent: false,
    })),
  };
}
