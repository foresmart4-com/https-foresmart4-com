import { getMemoryEvents, addMemoryEvent } from "@/lib/ai/memory/store";
import { getMacroFeed } from "@/lib/ai/feeds/macroFeed";
import { getNewsFeed } from "@/lib/ai/feeds/newsFeed";
import { runDailyResearchAgent } from "@/lib/ai/researchAgent/researchAgent";
import { applyKnowledge } from "@/lib/ai/knowledge";
import { AI_SAFETY_FLAGS, safeRead } from "@/lib/ai/core/safety";

interface GraphNode { id: string; type: string; labelAr: string; }
interface GraphEdge { from: string; to: string; relation: string; confidence: number; }

const nodes = new Map<string, GraphNode>();
const edges: GraphEdge[] = [];

function ensureNode(node: GraphNode) {
  nodes.set(node.id, node);
  return node;
}

function addEdge(edge: GraphEdge) {
  if (!edges.some((e) => e.from === edge.from && e.to === edge.to && e.relation === edge.relation)) edges.push(edge);
}

export function getKnowledgeGraphStatus() {
  return {
    knowledgeGraphVersion: "knowledge-graph-v1",
    nodeCount: nodes.size,
    edgeCount: edges.length,
    memoryEvents: getMemoryEvents(50).length,
    ready: true,
    ...AI_SAFETY_FLAGS,
  };
}

export async function updateKnowledgeGraph() {
  const [macro, news, research, knowledge] = await Promise.all([
    safeRead(() => getMacroFeed(), null),
    safeRead(() => getNewsFeed(), null),
    safeRead(() => runDailyResearchAgent(), null),
    safeRead(() => applyKnowledge("AAPL"), null),
  ]);
  ensureNode({ id: "macro", type: "economic_event", labelAr: "الماكرو" });
  ensureNode({ id: "liquidity", type: "concept", labelAr: "السيولة" });
  ensureNode({ id: "risk", type: "concept", labelAr: "المخاطر" });
  ensureNode({ id: "aapl", type: "market_event", labelAr: "AAPL" });
  addEdge({ from: "macro", to: "liquidity", relation: "influences", confidence: macro?.confidencePercent ?? 35 });
  addEdge({ from: "liquidity", to: "risk", relation: "changes", confidence: 70 });
  addEdge({ from: "risk", to: "aapl", relation: "affects", confidence: knowledge?.confidence ?? 50 });
  addMemoryEvent({
    type: "learning_event",
    title: "Knowledge graph update",
    summaryAr: "تم تحديث الرسم المعرفي السببي من الماكرو والأخبار والبحث.",
    confidence: Math.round(((macro?.confidencePercent ?? 0) + (research?.researchConfidence ?? 0)) / 2),
    metadata: { newsItems: news?.items?.length ?? 0 },
  });
  return getKnowledgeGraphStatus();
}

export function queryKnowledgeGraph() {
  const connectedConcepts = [...nodes.values()];
  const historicalSimilarity = Math.min(100, edges.length * 12);
  const confidencePercent = Math.min(95, 35 + edges.length * 10);
  return {
    knowledgeGraphVersion: "knowledge-graph-v1",
    connectedConcepts,
    relationships: edges,
    causalSummaryAr: connectedConcepts.length
      ? "تُظهر الذاكرة السببية أن الماكرو والسيولة يؤثران على المخاطر ومن ثم على قرارات الأصول."
      : "لا توجد روابط سببية كافية بعد.",
    historicalSimilarity,
    confidencePercent,
    ...AI_SAFETY_FLAGS,
  };
}
