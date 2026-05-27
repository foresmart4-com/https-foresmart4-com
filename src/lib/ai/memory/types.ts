export type AIMemoryEventType =
  | "market_regime"
  | "agent_decision"
  | "confidence"
  | "source_reliability"
  | "learning_event"
  | "failed_prediction"
  | "successful_pattern"
  | "provider_quality";

export interface AIMemoryEvent {
  id: string;
  type: AIMemoryEventType;
  timestamp: string;
  title: string;
  summaryAr: string;
  confidence?: number;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface SourceReliability {
  source: string;
  category: string;
  credibility: number;
  lastUpdatedAt: string;
}
