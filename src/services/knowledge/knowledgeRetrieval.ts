/**
 * Knowledge Retrieval Engine — Phase 28
 * Pure function — no network calls, no AI calls, no I/O.
 * Deterministic keyword-match retrieval from the static knowledge library.
 *
 * Design rules:
 * - O(n·k) complexity where n=13 cards, k=keywords per card — negligible latency
 * - Retrieves at most 2 cards per query to keep context injection bounded
 * - Only injects when at least 1 keyword match — avoids irrelevant noise
 * - Advisory context only: injection uses hedged framing language
 * - No AI in the retrieval path; no external calls
 */

import { KNOWLEDGE_CARDS, type KnowledgeCard } from "@/services/knowledge/knowledgeLibrary";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RetrievedKnowledge {
  cards: KnowledgeCard[];
  contextString: string;  // compact string for AI injection (≤200 chars total)
  hasKnowledge: boolean;
  frameworkNames: string[]; // for UI display
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Scores a knowledge card against a query string.
 * Returns the number of keyword matches found in the lowercased query.
 */
function scoreCard(card: KnowledgeCard, queryLower: string): number {
  return card.keywords.filter((kw) => queryLower.includes(kw)).length;
}

/**
 * Retrieves at most `maxCards` knowledge cards relevant to the query.
 * Returns an empty result when no matches are found.
 * Pure function — deterministic, no side effects.
 */
export function retrieveKnowledge(
  question: string,
  contextHint: string = "",
  maxCards = 2,
): RetrievedKnowledge {
  if (!question.trim()) {
    return { cards: [], contextString: "", hasKnowledge: false, frameworkNames: [] };
  }

  const queryLower = (question + " " + contextHint).toLowerCase();

  const scored = KNOWLEDGE_CARDS.map((card) => ({
    card,
    score: scoreCard(card, queryLower),
  })).filter((s) => s.score >= 1);

  if (!scored.length) {
    return { cards: [], contextString: "", hasKnowledge: false, frameworkNames: [] };
  }

  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCards)
    .map((s) => s.card);

  // Build compact context string for injection into AI context
  // Format: "Framework context: [Name] — [brief mechanism]; [Name2] — [mechanism2]"
  const contextParts = top.map((c) => `${c.framework} — ${c.causalMechanism.slice(0, 70)}`);
  const contextString = `Framework context: ${contextParts.join(" | ")}`.slice(0, 220);

  return {
    cards: top,
    contextString,
    hasKnowledge: true,
    frameworkNames: top.map((c) => c.framework),
  };
}

/**
 * Builds a narrative usage note for system prompt injection.
 * Called once; output is appended to the system prompt.
 */
export function buildKnowledgeNarrativeGuidance(ar: boolean): string {
  if (ar) {
    return (
      `عند ظهور "Framework context:" في سياق المستخدم: أشر إلى الإطار بلغة محوطة: ` +
      `"كثيراً ما يُشير الأدب المؤسسي"، "الإطار يقترح"، "متسق اقتصادياً مع"، "تاريخياً مرتبط بـ". ` +
      `ممنوع: "الكتاب يُثبت"، "تاريخياً مؤكد"، "الإطار يضمن". ` +
      `لا تُقدّم النظرية كأدلة على التحليل الحي. البيانات الحية تتقدم على الأطر النظرية.`
    );
  }
  return (
    `When "Framework context:" appears in user context: reference it using hedged language — ` +
    `"institutional literature often notes", "framework suggests", "economically consistent with", "historically associated with". ` +
    `FORBIDDEN: "book proves", "historically certain", "framework guarantees". ` +
    `Never present theory as live market evidence. Current data always takes precedence over theoretical frameworks.`
  );
}
