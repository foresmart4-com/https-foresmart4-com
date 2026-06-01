import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAIGateway } from "@/lib/ai-gateway.server";

const FMP_BASE = "https://financialmodelingprep.com/api/v3";
const FMP_KEY = process.env.FMP_API_KEY;

async function summarize(content: string, _category: string): Promise<string> {
  const result = await callAIGateway({
    system: "أنت محلل اقتصادي. لخص في 3 جمل عربية احترافية. ركز على التأثير على الأسواق.",
    user: content.slice(0, 1500),
    model: "google/gemini-2.5-flash",
    maxTokens: 300,
    temperature: 0.1,
  });
  return result.raw?.slice(0, 500) ?? "";
}

async function saveEntry(
  category: string,
  title: string,
  summary: string,
  source: string,
  url?: string,
): Promise<void> {
  if (!summary || summary.length < 20) return;
  const { data: existing } = await supabaseAdmin
    .from("genesis_knowledge_base")
    .select("id")
    .eq("title", title.slice(0, 200))
    .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .maybeSingle();
  if (existing) return;
  await supabaseAdmin.from("genesis_knowledge_base").insert({
    category,
    title:       title.slice(0, 200),
    summary:     summary.slice(0, 500),
    source,
    source_url:  url,
    valid_until: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
  });
}

export async function fetchFMPData(): Promise<number> {
  if (!FMP_KEY) {
    console.warn("[fmp] FMP_API_KEY missing");
    return 0;
  }
  let saved = 0;

  // Economic Calendar
  try {
    const res = await fetch(`${FMP_BASE}/economic_calendar?apikey=${FMP_KEY}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json() as Array<{
        event: string;
        date: string;
        country: string;
        impact: string;
        actual?: number;
        estimate?: number;
      }>;
      const highImpact = data.filter((e) => e.impact === "High").slice(0, 5);
      if (highImpact.length > 0) {
        const content = highImpact
          .map((e) => `${e.event} (${e.country}) — ${e.date} — فعلي: ${e.actual ?? "لم يصدر"} / متوقع: ${e.estimate ?? "—"}`)
          .join("\n");
        const summary = await summarize(
          `التقويم الاقتصادي — أحداث عالية التأثير:\n${content}`,
          "central_bank",
        );
        await saveEntry(
          "central_bank",
          `التقويم الاقتصادي — ${new Date().toLocaleDateString("ar")}`,
          summary,
          "Financial Modeling Prep",
        );
        saved++;
      }
    }
  } catch (e) {
    console.warn("[fmp] economic calendar:", e);
  }

  // Sector Performance
  try {
    const res = await fetch(`${FMP_BASE}/sector-performance?apikey=${FMP_KEY}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json() as Array<{ sector: string; changesPercentage: string }>;
      if (data.length > 0) {
        const content = data.map((s) => `${s.sector}: ${s.changesPercentage}`).join("\n");
        const summary = await summarize(`أداء القطاعات الأمريكية:\n${content}`, "sector_analysis");
        await saveEntry(
          "sector_analysis",
          `أداء القطاعات — FMP (${new Date().toLocaleDateString("ar")})`,
          summary,
          "Financial Modeling Prep",
        );
        saved++;
      }
    }
  } catch (e) {
    console.warn("[fmp] sector performance:", e);
  }

  // Key Metrics for top companies
  const TICKERS = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN"];
  for (const ticker of TICKERS) {
    try {
      const res = await fetch(`${FMP_BASE}/key-metrics/${ticker}?limit=1&apikey=${FMP_KEY}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const data = await res.json() as Array<{
        peRatio: number;
        priceToBookRatio: number;
        debtToEquity: number;
        returnOnEquity: number;
      }>;
      const metrics = data[0];
      if (!metrics) continue;
      const content = `${ticker}: P/E=${metrics.peRatio?.toFixed(1)} | P/B=${metrics.priceToBookRatio?.toFixed(1)} | ROE=${(metrics.returnOnEquity * 100)?.toFixed(1)}% | Debt/Eq=${metrics.debtToEquity?.toFixed(2)}`;
      const summary = await summarize(`مؤشرات تقييم ${ticker}:\n${content}`, "sector_analysis");
      await saveEntry(
        "sector_analysis",
        `تقييم ${ticker} — FMP`,
        summary,
        "Financial Modeling Prep",
        `https://financialmodelingprep.com/financial-ratios/${ticker}`,
      );
      saved++;
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.warn(`[fmp] ${ticker}:`, e);
    }
  }

  console.info(`[fmp] saved ${saved} entries`);
  return saved;
}
