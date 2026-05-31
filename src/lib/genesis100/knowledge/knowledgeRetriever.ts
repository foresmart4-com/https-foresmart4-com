import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CATEGORY_NAMES: Record<string, string> = {
  central_bank:       "قرارات البنوك المركزية",
  macro_data:         "البيانات الاقتصادية الكلية",
  geopolitical:       "الأحداث الجيوسياسية",
  market_news:        "أخبار الأسواق",
  economic_research:  "الأبحاث الاقتصادية",
  sector_analysis:    "تحليل القطاعات",
};

type KnowledgeEntry = {
  category: string;
  title: string;
  summary: string;
  source: string;
  created_at: string | null;
};

function scoreRelevance(question: string, entry: KnowledgeEntry): number {
  let score = 1.0;

  if (question.includes("نفط") || question.includes("oil")) {
    if (entry.category === "geopolitical") score += 2;
    if (entry.title.includes("OPEC") || entry.summary.includes("OPEC")) score += 3;
  }
  if (question.includes("السعودي") || question.includes("saudi")) {
    if (entry.summary.includes("السعود")) score += 2;
    if (entry.summary.includes("أرامكو")) score += 2;
  }
  if (question.includes("كريبتو") || question.includes("bitcoin")) {
    if (entry.category === "market_news") score += 2;
  }
  if (question.includes("فائدة") || question.includes("rate")) {
    if (entry.category === "central_bank") score += 3;
  }
  if (question.includes("شركات") || question.includes("أسهم")) {
    if (entry.category === "sector_analysis") score += 2;
  }
  if (question.includes("أزمة") || question.includes("ركود")) {
    if (entry.category === "economic_research") score += 2;
  }

  const ageHours = entry.created_at
    ? (Date.now() - new Date(entry.created_at).getTime()) / 3600000
    : 48;
  if (ageHours < 6)       score += 1.5;
  else if (ageHours < 24) score += 0.5;

  return score;
}

export async function getRelevantKnowledge(question: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from("genesis_knowledge_base")
      .select("category, title, summary, source, created_at")
      .gt("valid_until", new Date().toISOString())
      .neq("category", "system_meta")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!data?.length) return "";

    // Sort by relevance before grouping so highest-scoring items win per category
    const sorted = [...data].sort(
      (a, b) =>
        scoreRelevance(question, b as KnowledgeEntry) -
        scoreRelevance(question, a as KnowledgeEntry),
    );

    const grouped: Record<string, typeof sorted> = {};
    for (const item of sorted) {
      if (!grouped[item.category]) grouped[item.category] = [];
      if (grouped[item.category].length < 3) grouped[item.category].push(item);
    }

    const sections = Object.entries(grouped)
      .map(([cat, items]) => {
        const name = CATEGORY_NAMES[cat] ?? cat;
        const content = items.map((i) => `• ${i.title}: ${i.summary}`).join("\n");
        return `${name}:\n${content}`;
      })
      .join("\n\n");

    const lastUpdate = data[0]?.created_at
      ? new Date(data[0].created_at).toLocaleString("ar-SA")
      : "غير معروف";

    return `=== أحدث المعلومات الاقتصادية (${lastUpdate}) ===\n\n${sections}`;
  } catch {
    return "";
  }
}
