import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAIGateway } from "@/lib/ai-gateway.server";

const TWELVE_BASE = "https://api.twelvedata.com";
const TWELVE_KEY = process.env.TWELVEDATA_API_KEY;

async function summarize(content: string): Promise<string> {
  const result = await callAIGateway({
    system: "أنت محلل تقني. لخص الإشارة في جملتين عربيتين. اذكر التوصية الواضحة.",
    user: content.slice(0, 800),
    model: "google/gemini-2.5-flash",
    maxTokens: 200,
    temperature: 0.1,
  });
  return result.raw?.slice(0, 400) ?? "";
}

async function saveEntry(title: string, summary: string): Promise<void> {
  if (!summary || summary.length < 10) return;
  const { data: existing } = await supabaseAdmin
    .from("genesis_knowledge_base")
    .select("id")
    .eq("title", title)
    .gte("created_at", new Date(Date.now() - 12 * 3600 * 1000).toISOString())
    .maybeSingle();
  if (existing) return;
  await supabaseAdmin.from("genesis_knowledge_base").insert({
    category:    "sector_analysis",
    title,
    summary,
    source:      "TwelveData",
    valid_until: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  });
}

export async function fetchTwelveData(): Promise<number> {
  if (!TWELVE_KEY) {
    console.warn("[twelvedata] key missing");
    return 0;
  }
  let saved = 0;

  // RSI for major assets
  const RSI_ASSETS = [
    { symbol: "SPY", name: "S&P 500" },
    { symbol: "QQQ", name: "Nasdaq 100" },
    { symbol: "GLD", name: "الذهب" },
    { symbol: "TLT", name: "سندات 20 سنة" },
    { symbol: "XLK", name: "التكنولوجيا" },
  ];

  for (const asset of RSI_ASSETS) {
    try {
      const res = await fetch(
        `${TWELVE_BASE}/rsi?symbol=${asset.symbol}&interval=1day&outputsize=1&apikey=${TWELVE_KEY}`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) continue;
      const data = await res.json() as {
        values?: Array<{ rsi: string }>;
        status?: string;
      };
      if (data.status === "error") continue;
      const rsi = parseFloat(data.values?.[0]?.rsi ?? "50");
      if (isNaN(rsi)) continue;

      const signal =
        rsi > 70
          ? "تشبع شراء — تحذير من انعكاس"
          : rsi < 30
          ? "تشبع بيع — فرصة شراء محتملة"
          : "منطقة محايدة";

      const content = `RSI لـ ${asset.name} (${asset.symbol}): ${rsi.toFixed(1)} — ${signal}`;
      const summary = await summarize(content);

      await saveEntry(`RSI ${asset.symbol} — TwelveData`, summary || content);
      saved++;
      await new Promise((r) => setTimeout(r, 1000));
    } catch (e) {
      console.warn(`[twelvedata] RSI ${asset.symbol}:`, e);
    }
  }

  // Global indices
  try {
    const res = await fetch(
      `${TWELVE_BASE}/quote?symbol=SPX,NDX,FTSE,DAX,N225&apikey=${TWELVE_KEY}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (res.ok) {
      const data = await res.json() as Record<string, {
        name: string;
        close: string;
        percent_change: string;
      }>;
      const lines = Object.entries(data)
        .filter(([, v]) => v?.close)
        .map(([symbol, v]) =>
          `${v.name ?? symbol}: ${parseFloat(v.close).toLocaleString("ar")} (${parseFloat(v.percent_change).toFixed(2)}%)`
        );
      if (lines.length > 0) {
        const summary = await summarize(`المؤشرات العالمية:\n${lines.join("\n")}`);
        await saveEntry(
          `المؤشرات العالمية — TwelveData (${new Date().toLocaleDateString("ar")})`,
          summary || lines.join("\n"),
        );
        saved++;
      }
    }
  } catch (e) {
    console.warn("[twelvedata] indices:", e);
  }

  // MACD for S&P 500
  try {
    const res = await fetch(
      `${TWELVE_BASE}/macd?symbol=SPX&interval=1day&outputsize=1&apikey=${TWELVE_KEY}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (res.ok) {
      const data = await res.json() as {
        values?: Array<{ macd: string; macd_signal: string }>;
        status?: string;
      };
      if (data.status !== "error" && data.values?.[0]) {
        const v = data.values[0];
        const macd   = parseFloat(v.macd);
        const signal = parseFloat(v.macd_signal);
        const direction =
          macd > signal
            ? "إشارة صاعدة — MACD فوق الإشارة"
            : "إشارة هابطة — MACD تحت الإشارة";
        const content = `MACD للـ S&P 500: ${macd.toFixed(3)} / إشارة: ${signal.toFixed(3)} — ${direction}`;
        const summary = await summarize(content);
        await saveEntry(`MACD S&P 500 — TwelveData`, summary || content);
        saved++;
      }
    }
  } catch (e) {
    console.warn("[twelvedata] MACD:", e);
  }

  console.info(`[twelvedata] saved ${saved} entries`);
  return saved;
}
