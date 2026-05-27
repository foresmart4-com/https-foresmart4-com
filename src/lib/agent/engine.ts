import type { AgentMode, MarketRegime, AgentStatus, AgentDecision, DecisionConfidence, DecisionFactor, ConfidenceTier, AgentMemoryEntry, ResearchSignal, RiskAssessment } from "./types";

const CONFIDENCE_TIERS: Array<{ min: number; tier: ConfidenceTier }> = [
  { min: 91, tier: "exceptional" },
  { min: 81, tier: "high_confidence" },
  { min: 71, tier: "confident" },
  { min: 61, tier: "cautious" },
  { min: 51, tier: "watch" },
  { min: 0, tier: "reject" },
];

function classifyConfidence(score: number): ConfidenceTier {
  for (const t of CONFIDENCE_TIERS) { if (score >= t.min) return t.tier; }
  return "reject";
}

const STATE = {
  mode: "observation" as AgentMode,
  regime: "mixed" as MarketRegime,
  decisions: [] as AgentDecision[],
  memory: [] as AgentMemoryEntry[],
  researchSignals: [] as ResearchSignal[],
  lastCycleAt: null as string | null,
  agents: {
    planner: { id: "planner", name: "Planner Agent", nameAr: "وكيل التخطيط", active: true, lastRunAt: null, health: "healthy" },
    research: { id: "research", name: "Research Agent", nameAr: "وكيل الأبحاث", active: true, lastRunAt: null, health: "healthy" },
    market_data: { id: "market_data", name: "Market Data Agent", nameAr: "وكيل بيانات السوق", active: true, lastRunAt: null, health: "healthy" },
    risk: { id: "risk", name: "Risk Agent", nameAr: "وكيل المخاطر", active: true, lastRunAt: null, health: "healthy" },
    strategy: { id: "strategy", name: "Strategy Agent", nameAr: "وكيل الاستراتيجية", active: true, lastRunAt: null, health: "healthy" },
    learning: { id: "learning", name: "Learning Agent", nameAr: "وكيل التعلم", active: true, lastRunAt: null, health: "healthy" },
  } as Record<string, AgentStatus>,
};

export function getAgentMode(): AgentMode { return STATE.mode; }
export function setAgentMode(mode: AgentMode) { STATE.mode = mode; }
export function getMarketRegime(): MarketRegime { return STATE.regime; }
export function getAgentStatuses(): AgentStatus[] { return Object.values(STATE.agents); }

export function computeDecisionConfidence(factors: DecisionFactor[]): DecisionConfidence {
  if (factors.length === 0) return { score: 0, tier: "reject", reasons: ["No factors available"], sources: [], riskApproval: false };

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const weightedScore = factors.reduce((s, f) => s + (f.confidence * f.weight), 0) / Math.max(1, totalWeight);
  const bullish = factors.filter((f) => f.direction === "bullish").length;
  const bearish = factors.filter((f) => f.direction === "bearish").length;
  const agreement = Math.abs(bullish - bearish) / Math.max(1, factors.length);
  const score = Math.round(Math.min(100, weightedScore * (0.7 + agreement * 0.3)));
  const tier = classifyConfidence(score);

  return {
    score,
    tier,
    reasons: factors.map((f) => `${f.source}: ${f.signal} (${f.direction}, ${f.confidence}%)`),
    sources: [...new Set(factors.map((f) => f.source))],
    riskApproval: score >= 61,
  };
}

export function assessRisk(symbol: string, factors: DecisionFactor[]): RiskAssessment {
  const avgConf = factors.length > 0 ? factors.reduce((s, f) => s + f.confidence, 0) / factors.length : 0;
  const volatilityFactor = factors.find((f) => f.source === "volatility");
  const vol = volatilityFactor?.confidence ?? 50;

  return {
    drawdownRisk: Math.round(100 - avgConf * 0.7),
    exposureRisk: Math.round(vol * 0.6),
    correlationRisk: Math.round(30 + Math.random() * 20),
    volatilityRisk: Math.round(vol),
    positionSizeRecommended: Math.max(1, Math.min(8, Math.round((avgConf / 100) * 8))),
    stopLossLevel: null,
    credibilityThreshold: 60,
    approved: avgConf >= 60,
    reasons: avgConf >= 60 ? ["Risk within acceptable bounds"] : ["Confidence below threshold"],
  };
}

export function createAgentDecision(symbol: string, action: AgentDecision["action"], factors: DecisionFactor[]): AgentDecision {
  const confidence = computeDecisionConfidence(factors);
  const decision: AgentDecision = {
    id: `AD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    symbol,
    action,
    confidence,
    factors,
    regime: STATE.regime,
    agentMode: STATE.mode,
    archived: false,
  };
  STATE.decisions.unshift(decision);
  if (STATE.decisions.length > 500) STATE.decisions.length = 500;
  STATE.lastCycleAt = decision.timestamp;
  return decision;
}

export function addMemory(type: AgentMemoryEntry["type"], content: string, symbol?: string, outcome?: AgentMemoryEntry["outcome"]): AgentMemoryEntry {
  const entry: AgentMemoryEntry = {
    id: `MEM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    type, symbol: symbol ?? null, content, outcome: outcome ?? null, tags: [],
  };
  STATE.memory.unshift(entry);
  if (STATE.memory.length > 1000) STATE.memory.length = 1000;
  return entry;
}

export function addResearchSignal(signal: Omit<ResearchSignal, "timestamp">): ResearchSignal {
  const entry = { ...signal, timestamp: new Date().toISOString() };
  STATE.researchSignals.unshift(entry);
  if (STATE.researchSignals.length > 200) STATE.researchSignals.length = 200;
  return entry;
}

export function getDecisions(limit = 50): AgentDecision[] { return STATE.decisions.slice(0, limit); }
export function getMemory(limit = 50): AgentMemoryEntry[] { return STATE.memory.slice(0, limit); }
export function getResearchSignals(limit = 30): ResearchSignal[] { return STATE.researchSignals.slice(0, limit); }

export function getAgentHealth() {
  return {
    plannerAgent: STATE.agents.planner,
    researchAgent: STATE.agents.research,
    marketAgent: STATE.agents.market_data,
    riskAgent: STATE.agents.risk,
    strategyAgent: STATE.agents.strategy,
    learningAgent: STATE.agents.learning,
    mode: STATE.mode,
    regime: STATE.regime,
    memoryConnected: true,
    memorySize: STATE.memory.length,
    confidenceEngine: true,
    executionEnabled: false,
    decisionsCount: STATE.decisions.length,
    lastCycleAt: STATE.lastCycleAt,
    runtimeErrors: [],
    safety: {
      withdrawalBlocked: true,
      externalTransferBlocked: true,
      brokerGated: true,
      treasuryIsolated: true,
      fundMovementBlocked: true,
    },
  };
}
