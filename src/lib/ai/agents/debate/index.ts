import { routeQuote } from "@/lib/market/router";
import { getMacroFeed } from "@/lib/ai/feeds/macroFeed";
import { getNewsFeed } from "@/lib/ai/feeds/newsFeed";
import { applyKnowledge } from "@/lib/ai/knowledge";
import { getGenesisArchiveSummary } from "@/lib/genesis100/engine";
import { getSourceCredibilityReport } from "@/lib/ai/credibility/sourceCredibility";
import { safeRead } from "@/lib/ai/core/safety";
import type { DebateAgentResult, DebateStance } from "@/lib/ai/agents/debate/types";

function stanceFromChange(change: number | null | undefined): DebateStance {
  if ((change ?? 0) > 0.75) return "bullish";
  if ((change ?? 0) < -0.75) return "bearish";
  return "neutral";
}

async function context(symbol: string) {
  const [quote, macro, news, knowledge, archive, credibility] = await Promise.all([
    safeRead(() => routeQuote(symbol), null),
    safeRead(() => getMacroFeed(), null),
    safeRead(() => getNewsFeed(), null),
    safeRead(() => applyKnowledge(symbol), null),
    safeRead(() => getGenesisArchiveSummary(), null),
    safeRead(() => getSourceCredibilityReport(), null),
  ]);
  return { quote, macro, news, knowledge, archive, credibility };
}

export class BullAgent {
  async analyze(symbol: string): Promise<DebateAgentResult> {
    const ctx = await context(symbol);
    return {
      agent: "BullAgent",
      stance: stanceFromChange(ctx.quote?.changePercent) === "bearish" ? "neutral" : "bullish",
      argumentsAr: [
        `الزخم الحالي لـ ${symbol} يدعم سيناريو إيجابي إذا بقيت جودة البيانات مقبولة.`,
        ctx.knowledge?.decisionSupportAr ?? "المعرفة الاستثمارية غير كافية.",
      ],
      confidencePercent: Math.min(90, 55 + Math.max(0, ctx.quote?.changePercent ?? 0) * 8),
      riskWarnings: ctx.quote?.success ? [] : ["المصدر السعري غير متاح بالكامل."],
      evidenceSources: ["quotes_router", "knowledge_brain"],
      uncertainty: "يعتمد السيناريو الإيجابي على استمرار السيولة وعدم تدهور الماكرو.",
    };
  }
}

export class BearAgent {
  async analyze(symbol: string): Promise<DebateAgentResult> {
    const ctx = await context(symbol);
    const change = ctx.quote?.changePercent ?? 0;
    return {
      agent: "BearAgent",
      stance: change < 0 ? "bearish" : "risk_watch",
      argumentsAr: [
        `يجب اختبار قرار ${symbol} ضد مخاطر الهبوط وحساسية الأخبار.`,
        "أي ضعف في مصدر البيانات أو ارتفاع مفاجئ في المخاطر يقلل حجم القرار.",
      ],
      confidencePercent: Math.min(88, 50 + Math.abs(Math.min(0, change)) * 10 + (ctx.quote?.success ? 10 : 0)),
      riskWarnings: ["احتمال انعكاس الاتجاه", "مخاطر فجوات سعرية أو أخبار مفاجئة"],
      evidenceSources: ["quotes_router", "risk_framework"],
      uncertainty: "السيناريو السلبي قد يضعف إذا تحسن الزخم والسيولة.",
    };
  }
}

export class MacroDebateAgent {
  async analyze(symbol: string): Promise<DebateAgentResult> {
    const ctx = await context(symbol);
    return {
      agent: "MacroAgent",
      stance: ctx.macro?.riskImpact === "elevated" ? "risk_watch" : "neutral",
      argumentsAr: [ctx.macro?.macroSummaryAr ?? "المصدر غير متاح حالياً"],
      confidencePercent: ctx.macro?.confidencePercent ?? 20,
      riskWarnings: ctx.macro?.missingIndicators?.map((i: { key: string }) => `مؤشر مفقود: ${i.key}`) ?? [],
      evidenceSources: ["macro_feed", "trusted_sources"],
      uncertainty: "قراءة الماكرو محدودة عند نقص المؤشرات الرسمية.",
    };
  }
}

export class RiskAgent {
  async analyze(symbol: string): Promise<DebateAgentResult> {
    const ctx = await context(symbol);
    const risk = Math.abs(ctx.quote?.changePercent ?? 0);
    return {
      agent: "RiskAgent",
      stance: risk > 2 ? "risk_watch" : "neutral",
      argumentsAr: ["حجم المركز يجب أن يرتبط بمصداقية القرار وليس بالرغبة في الدخول فقط."],
      confidencePercent: Math.min(90, 65 + risk * 4),
      riskWarnings: risk > 2 ? ["تقلب مرتفع يتطلب تخفيض الحجم"] : [],
      evidenceSources: ["risk_management", "quotes_router"],
      uncertainty: "التقلب اللحظي قد لا يمثل الخطر الكامل.",
    };
  }
}

export class ValuationAgent {
  async analyze(symbol: string): Promise<DebateAgentResult> {
    const ctx = await context(symbol);
    return {
      agent: "ValuationAgent",
      stance: "neutral",
      argumentsAr: ["لا يوجد تقييم كامل بدون قوائم مالية؛ يتم استخدام مبادئ هامش الأمان كفلتر فقط."],
      confidencePercent: symbol.endsWith("USDT") ? 40 : 58,
      riskWarnings: ["التقييم الأساسي غير مكتمل لبعض الأصول."],
      evidenceSources: ["knowledge_brain", "fundamental_framework"],
      uncertainty: "نقص بيانات التقييم يقلل قوة الرأي.",
    };
  }
}

export class SentimentAgent {
  async analyze(symbol: string): Promise<DebateAgentResult> {
    const ctx = await context(symbol);
    const items = ctx.news?.items ?? [];
    return {
      agent: "SentimentAgent",
      stance: items.length ? "neutral" : "risk_watch",
      argumentsAr: [ctx.news?.summaryAr ?? "مصادر الأخبار الحية غير مهيأة حالياً."],
      confidencePercent: items.length ? 62 : 30,
      riskWarnings: items.length ? [] : ["لا توجد تغذية أخبار كافية"],
      evidenceSources: ["news_feed", "source_credibility"],
      uncertainty: "المعنويات تحتاج مصادر أخبار مباشرة أكثر.",
    };
  }
}

export class KnowledgeAgent {
  async analyze(symbol: string): Promise<DebateAgentResult> {
    const ctx = await context(symbol);
    return {
      agent: "KnowledgeAgent",
      stance: "neutral",
      argumentsAr: [ctx.knowledge?.decisionSupportAr ?? "لا توجد معرفة كافية بعد."],
      confidencePercent: ctx.knowledge?.confidence ?? 0,
      riskWarnings: ctx.knowledge?.riskWarnings ?? [],
      evidenceSources: ["knowledge_brain"],
      uncertainty: "المعرفة إطار مساعد وليست إشارة تنفيذ.",
    };
  }
}

export class PortfolioAgent {
  async analyze(symbol: string): Promise<DebateAgentResult> {
    const ctx = await context(symbol);
    return {
      agent: "PortfolioAgent",
      stance: (ctx.archive?.count ?? 0) > 0 ? "neutral" : "risk_watch",
      argumentsAr: ["يجب أن يخضع القرار لحدود التركيز، السيولة، والارتباط داخل المحفظة."],
      confidencePercent: (ctx.archive?.count ?? 0) > 0 ? 60 : 35,
      riskWarnings: ["لا تنفيذ حقيقي؛ القرار مرشح فقط"],
      evidenceSources: ["genesis_archive", "portfolio_policy"],
      uncertainty: "بيانات المحفظة التاريخية قد تكون محدودة.",
    };
  }
}

export async function runDebate(symbol: string) {
  const agents = [
    new BullAgent(),
    new BearAgent(),
    new MacroDebateAgent(),
    new RiskAgent(),
    new ValuationAgent(),
    new SentimentAgent(),
    new KnowledgeAgent(),
    new PortfolioAgent(),
  ];
  return Promise.all(agents.map((agent) => agent.analyze(symbol)));
}
