import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CATEGORY_NAMES: Record<string, string> = {
  central_bank:       "قرارات البنوك المركزية",
  macro_data:         "البيانات الاقتصادية الكلية",
  geopolitical:       "الأحداث الجيوسياسية",
  market_news:        "أخبار الأسواق",
  economic_research:  "الأبحاث الاقتصادية",
  sector_analysis:    "تحليل القطاعات",
};

export async function getRelevantKnowledge(_question: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from("genesis_knowledge_base")
      .select("category, title, summary, source, created_at")
      .gt("valid_until", new Date().toISOString())
      .neq("category", "system_meta")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!data?.length) return "";

    const grouped: Record<string, typeof data> = {};
    for (const item of data) {
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
