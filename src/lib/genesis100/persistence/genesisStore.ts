// Genesis Store — Phase B: Supabase persistence for Genesis 100.
// Uses supabaseAdmin (service role) for server-side writes.
// All functions are wrapped in try/catch — engine continues even if persistence fails.
// When SUPABASE_SERVICE_ROLE_KEY is absent, all functions degrade gracefully.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  GenesisArchivedDecision,
  GenesisCycleResult,
  GenesisRecommendation,
  GenesisReport,
} from "@/lib/genesis100/engine";

// We cast to `any` because genesis100_* tables are not in the generated Database type yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as unknown as ReturnType<typeof import("@supabase/supabase-js").createClient<any>>;

let _persistenceWarned = false;

function isPersistenceAvailable(): boolean {
  const hasUrl = Boolean(process.env.SUPABASE_URL?.trim());
  const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  if ((!hasUrl || !hasKey) && !_persistenceWarned) {
    console.warn(
      "[genesis-store] Genesis persistence unavailable — running in memory-only mode. " +
        "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable durable state.",
    );
    _persistenceWarned = true;
  }
  return hasUrl && hasKey;
}

export interface GenesisPersistedState {
  decisionArchive: GenesisArchivedDecision[];
  previousRecommendations: Record<string, GenesisRecommendation>;
  currentWeights: Record<string, number>;
}

// ─── Archive ──────────────────────────────────────────────────────────────────

export async function saveArchivedDecision(d: GenesisArchivedDecision): Promise<void> {
  if (!isPersistenceAvailable()) return;
  try {
    const { error } = await db()
      .from("genesis100_decision_archive")
      .upsert(
        {
          id: d.id,
          wallet_id: null,
          user_id: null,
          cycle_id: d.cycleId,
          symbol: d.symbol,
          asset_name: d.assetName,
          asset_class: d.assetClass,
          previous_recommendation: d.previousRecommendation ?? null,
          new_recommendation: d.newRecommendation,
          decision_confidence_percent: d.decisionConfidencePercent,
          final_decision_score: d.finalDecisionScore,
          target_weight: d.targetWeight,
          previous_weight: d.previousWeight,
          action: d.action,
          reason_ar: d.reasonAr,
          reason_en: d.reasonEn,
          data_sources: d.dataSources,
          quote_snapshot: d.quoteSnapshot,
          risk_warnings: d.riskWarnings,
          ai_mode: d.aiMode,
          execution_mode: d.executionMode,
          created_by: d.createdBy,
          // position sizing fields
          decision_credibility_percent: d.decisionCredibilityPercent,
          credibility_tier: d.credibilityTier,
          allocation_multiplier: d.allocationMultiplier,
          risk_mode: d.riskMode,
          max_single_decision_capital_percent: d.maxSingleDecisionCapitalPercent,
          allowed_capital_for_decision: d.allowedCapitalForDecision,
          position_sizing_reason_ar: d.positionSizingReasonAr,
          position_sizing_reason_en: d.positionSizingReasonEn,
          stop_loss_urgency: d.stopLossUrgency,
          action_allowed: d.actionAllowed,
          // credibility firewall fields
          source_credibility_percent: d.sourceCredibilityPercent,
          final_approval_percent: d.finalApprovalPercent,
          blocked_reason: d.blockedReason ?? null,
          intelligence_version: d.intelligenceVersion,
        },
        { onConflict: "id", ignoreDuplicates: false },
      );
    if (error) {
      console.warn(`[genesis-store] Archive upsert failed for ${d.symbol}:`, error.message);
    }
  } catch (err) {
    console.warn("[genesis-store] saveArchivedDecision threw:", err);
  }
}

export async function loadArchive(limit = 1000): Promise<GenesisArchivedDecision[]> {
  if (!isPersistenceAvailable()) return [];
  try {
    const { data, error } = await db()
      .from("genesis100_decision_archive")
      .select("*")
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[genesis-store] loadArchive failed:", error.message);
      return [];
    }
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      timestamp: String(r.created_at),
      cycleId: String(r.cycle_id),
      symbol: String(r.symbol),
      assetName: String(r.asset_name),
      assetClass: r.asset_class as GenesisArchivedDecision["assetClass"],
      previousRecommendation: (r.previous_recommendation as GenesisRecommendation) ?? null,
      newRecommendation: r.new_recommendation as GenesisRecommendation,
      decisionConfidencePercent: Number(r.decision_confidence_percent),
      finalDecisionScore: Number(r.final_decision_score),
      targetWeight: Number(r.target_weight),
      previousWeight: Number(r.previous_weight),
      action: r.action as GenesisArchivedDecision["action"],
      decisionCredibilityPercent: Number(r.decision_credibility_percent ?? 0),
      sourceCredibilityPercent: Number(r.source_credibility_percent ?? 0),
      dataCredibilityPercent: Number(r.data_credibility_percent ?? 0),
      marketConfirmationPercent: Number(r.market_confirmation_percent ?? 0),
      riskApprovalPercent: Number(r.risk_approval_percent ?? 0),
      finalApprovalPercent: Number(r.final_approval_percent ?? 0),
      credibilityTier: (r.credibility_tier ?? "below_51") as GenesisArchivedDecision["credibilityTier"],
      allocationMultiplier: Number(r.allocation_multiplier ?? 0),
      riskMode: (r.risk_mode ?? "blocked") as GenesisArchivedDecision["riskMode"],
      maxSingleDecisionCapitalPercent: Number(r.max_single_decision_capital_percent ?? 0),
      allowedCapitalForDecision: Number(r.allowed_capital_for_decision ?? 0),
      positionSizingReasonAr: String(r.position_sizing_reason_ar ?? ""),
      positionSizingReasonEn: String(r.position_sizing_reason_en ?? ""),
      stopLossUrgency: (r.stop_loss_urgency ?? "low") as GenesisArchivedDecision["stopLossUrgency"],
      actionAllowed: Boolean(r.action_allowed),
      blockedReason: (r.blocked_reason as string | null) ?? null,
      reasonAr: String(r.reason_ar),
      reasonEn: String(r.reason_en),
      dataSources: (r.data_sources as string[]) ?? [],
      quoteSnapshot: (r.quote_snapshot as GenesisArchivedDecision["quoteSnapshot"]) ?? {},
      riskWarnings: (r.risk_warnings as string[]) ?? [],
      aiMode: (r.ai_mode ?? "semi_ai") as GenesisArchivedDecision["aiMode"],
      executionMode: (r.execution_mode ?? "analysis_only") as GenesisArchivedDecision["executionMode"],
      intelligenceVersion: (r.intelligence_version ?? "genesis-intelligence-v2") as GenesisArchivedDecision["intelligenceVersion"],
      createdBy: "genesis100-ai" as const,
    }));
  } catch (err) {
    console.warn("[genesis-store] loadArchive threw:", err);
    return [];
  }
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function saveReport(report: GenesisReport): Promise<void> {
  if (!isPersistenceAvailable()) return;
  try {
    const { error } = await db()
      .from("genesis100_reports")
      .insert({
        wallet_id: null,
        user_id: null,
        period: report.period,
        report: report,
      });
    if (error) {
      console.warn("[genesis-store] saveReport failed:", error.message);
    }
  } catch (err) {
    console.warn("[genesis-store] saveReport threw:", err);
  }
}

export async function loadReports(limit = 50): Promise<GenesisReport[]> {
  if (!isPersistenceAvailable()) return [];
  try {
    const { data, error } = await db()
      .from("genesis100_reports")
      .select("report")
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[genesis-store] loadReports failed:", error.message);
      return [];
    }
    return (data ?? []).map((r: Record<string, unknown>) => r.report as GenesisReport);
  } catch (err) {
    console.warn("[genesis-store] loadReports threw:", err);
    return [];
  }
}

// ─── Cycle snapshot ───────────────────────────────────────────────────────────

export async function saveDecisionCycle(cycle: GenesisCycleResult): Promise<void> {
  if (!isPersistenceAvailable()) return;
  // Save each archived decision from the cycle
  const saves = cycle.topDecisions.slice(0, 100).map((d) => saveArchivedDecision(d));
  await Promise.allSettled(saves);
}

// ─── Hydration ────────────────────────────────────────────────────────────────

export async function loadLatestState(): Promise<GenesisPersistedState | null> {
  const archive = await loadArchive(1000);
  if (!archive.length) return null;

  // Derive previousRecommendations from most recent per symbol
  const seen = new Set<string>();
  const previousRecommendations: Record<string, GenesisRecommendation> = {};
  const currentWeights: Record<string, number> = {};

  for (const d of archive) {
    if (!seen.has(d.symbol)) {
      seen.add(d.symbol);
      previousRecommendations[d.symbol] = d.newRecommendation;
      currentWeights[d.symbol] = d.targetWeight;
    }
  }

  return { decisionArchive: archive, previousRecommendations, currentWeights };
}
