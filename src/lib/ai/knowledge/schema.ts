export const KNOWLEDGE_BRAIN_VERSION = "foresmart-knowledge-v2";
export const KNOWLEDGE_EMPTY_AR = "لا توجد معرفة كافية بعد.";

export type KnowledgeSourceType = "book_reference" | "investor_principle" | "academic_framework" | "market_framework" | "risk_framework";

export interface KnowledgeBaseItem {
  id: string;
  title: string;
  author: string;
  sourceType: KnowledgeSourceType;
  category: string;
  topic: string;
  summaryAr: string;
  summaryEn: string;
  tags: string[];
  confidence: number;
  createdAt: string;
}

export interface KnowledgeDocument extends KnowledgeBaseItem {
  reference: string;
}

export interface KnowledgeChunk extends KnowledgeBaseItem {
  documentId: string;
  chunkTextAr: string;
  chunkTextEn: string;
}

export interface KnowledgeTopic extends KnowledgeBaseItem {
  documentCount: number;
}

export interface KnowledgeReference extends KnowledgeBaseItem {
  referenceType: "concept" | "person" | "framework";
}
