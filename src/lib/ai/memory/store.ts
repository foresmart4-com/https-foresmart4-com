import { AI_INSUFFICIENT_HISTORY_AR } from "@/lib/ai/core/safety";
import type { AIMemoryEvent, AIMemoryEventType, SourceReliability } from "@/lib/ai/memory/types";

const memory: AIMemoryEvent[] = [];
const sourceReliability = new Map<string, SourceReliability>();

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function addMemoryEvent(input: Omit<AIMemoryEvent, "id" | "timestamp">): AIMemoryEvent {
  const event: AIMemoryEvent = {
    id: id("ai-mem"),
    timestamp: new Date().toISOString(),
    ...input,
  };
  memory.unshift(event);
  if (memory.length > 2000) memory.length = 2000;
  return event;
}

export function addSimpleMemory(type: AIMemoryEventType, title: string, summaryAr: string, metadata?: Record<string, unknown>) {
  return addMemoryEvent({ type, title, summaryAr, metadata });
}

export function updateSourceReliability(source: string, category: string, credibility: number) {
  const item: SourceReliability = {
    source,
    category,
    credibility: Math.max(0, Math.min(100, Math.round(credibility))),
    lastUpdatedAt: new Date().toISOString(),
  };
  sourceReliability.set(source, item);
  addMemoryEvent({
    type: "source_reliability",
    title: `Source reliability: ${source}`,
    summaryAr: `تم تحديث موثوقية المصدر ${source} إلى ${item.credibility}%.`,
    confidence: item.credibility,
    source,
    metadata: { category },
  });
  return item;
}

export function getMemoryEvents(limit = 100) {
  return memory.slice(0, limit);
}

export function getSourceReliability() {
  return [...sourceReliability.values()];
}

export function getAIMemoryStatus() {
  const lastLearning = memory.find((event) => event.type === "learning_event");
  const learningReady = memory.length >= 25;
  return {
    memoryConnected: true,
    memorySize: memory.length,
    lastLearningEventAt: lastLearning?.timestamp ?? null,
    learningReady,
    messageAr: learningReady ? "ذاكرة الذكاء جاهزة للتعلم التحليلي." : AI_INSUFFICIENT_HISTORY_AR,
    sourceReliability: getSourceReliability(),
  };
}
