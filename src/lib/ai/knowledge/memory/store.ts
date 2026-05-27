import { knowledge_chunks, knowledge_documents, knowledge_references, knowledge_topics } from "@/lib/ai/knowledge/sources/seed";
import { KNOWLEDGE_BRAIN_VERSION, KNOWLEDGE_EMPTY_AR, type KnowledgeBaseItem } from "@/lib/ai/knowledge/schema";
import { routeQuote } from "@/lib/market/router";
import { AI_SAFETY_FLAGS, safeRead } from "@/lib/ai/core/safety";

function scoreItem(item: KnowledgeBaseItem, query: string): number {
  const q = query.toLowerCase();
  const haystack = [
    item.title,
    item.author,
    item.sourceType,
    item.category,
    item.topic,
    item.summaryAr,
    item.summaryEn,
    ...item.tags,
  ].join(" ").toLowerCase();
  return q.split(/\s+/).filter(Boolean).reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

export function getKnowledgeStatus() {
  return {
    knowledgeBrainVersion: KNOWLEDGE_BRAIN_VERSION,
    ready: knowledge_documents.length > 0,
    counts: {
      knowledge_documents: knowledge_documents.length,
      knowledge_chunks: knowledge_chunks.length,
      knowledge_topics: knowledge_topics.length,
      knowledge_references: knowledge_references.length,
    },
    categories: knowledge_topics.map((topic) => topic.category),
    ...AI_SAFETY_FLAGS,
  };
}

export function searchKnowledge(query: string | null) {
  const q = (query || "").trim();
  const source = knowledge_chunks;
  const results = q
    ? source
      .map((item) => ({ item, score: scoreItem(item, q) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || b.item.confidence - a.item.confidence)
      .map((entry) => entry.item)
    : source.slice(0, 10);

  return {
    knowledgeBrainVersion: KNOWLEDGE_BRAIN_VERSION,
    query: q,
    count: results.length,
    messageAr: results.length ? "تم العثور على معرفة مرتبطة." : KNOWLEDGE_EMPTY_AR,
    results,
    ...AI_SAFETY_FLAGS,
  };
}

export function getKnowledgeTopics() {
  return {
    knowledgeBrainVersion: KNOWLEDGE_BRAIN_VERSION,
    count: knowledge_topics.length,
    topics: knowledge_topics,
    ...AI_SAFETY_FLAGS,
  };
}

function queryForSymbol(symbol: string) {
  const s = symbol.toUpperCase();
  if (["WTI", "BRENT", "XAUUSD", "XAGUSD"].includes(s)) return "inflation commodities macro risk";
  if (["BTCUSDT", "ETHUSDT"].includes(s)) return "behavioral finance risk management liquidity";
  if (s.endsWith(".SR")) return "value investing risk management market cycles";
  if (["EURUSD", "GBPUSD", "DXY", "US10Y"].includes(s)) return "interest rates liquidity macro investing";
  return "value investing fundamental analysis portfolio theory risk management";
}

export async function applyKnowledge(symbol: string | null) {
  const normalized = (symbol || "AAPL").trim().toUpperCase();
  const quote = await safeRead(() => routeQuote(normalized), null);
  const matches = searchKnowledge(queryForSymbol(normalized)).results.slice(0, 5);

  if (!matches.length) {
    return {
      knowledgeBrainVersion: KNOWLEDGE_BRAIN_VERSION,
      symbol: normalized,
      messageAr: KNOWLEDGE_EMPTY_AR,
      relevantTheories: [],
      matchingHistoricalPatterns: [],
      riskWarnings: [],
      investmentPrinciples: [],
      decisionSupportAr: KNOWLEDGE_EMPTY_AR,
      confidence: 0,
      ...AI_SAFETY_FLAGS,
    };
  }

  const riskWarnings = [
    ...(quote?.success ? [] : ["المصدر غير متاح حالياً"]),
    ...matches.filter((item) => item.category.includes("risk") || item.tags.includes("risk")).map((item) => item.summaryAr),
  ].slice(0, 4);

  return {
    knowledgeBrainVersion: KNOWLEDGE_BRAIN_VERSION,
    symbol: normalized,
    quoteContext: quote ? {
      success: quote.success,
      assetClass: quote.assetClass,
      provider: quote.provider,
      price: quote.price,
      changePercent: quote.changePercent,
    } : null,
    relevantTheories: matches.map((item) => ({
      title: item.title,
      author: item.author,
      category: item.category,
      summaryAr: item.summaryAr,
      confidence: item.confidence,
    })),
    matchingHistoricalPatterns: matches
      .filter((item) => ["market cycles", "crisis history", "liquidity", "inflation"].includes(item.category))
      .map((item) => item.summaryAr),
    riskWarnings,
    investmentPrinciples: matches.map((item) => item.summaryAr),
    decisionSupportAr: `تحليل ${normalized}: اربط القرار بهامش الأمان، جودة البيانات، وحجم المخاطر. ${matches[0]?.summaryAr}`,
    confidence: Math.round(matches.reduce((sum, item) => sum + item.confidence, 0) / matches.length),
    ...AI_SAFETY_FLAGS,
  };
}
