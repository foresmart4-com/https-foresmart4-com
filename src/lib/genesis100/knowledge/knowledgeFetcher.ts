import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAIGateway } from "@/lib/ai-gateway.server";
import { KNOWLEDGE_SOURCES } from "./knowledgeSources";

const FETCH_TIMEOUT = 8000;
const MAX_ENTRIES   = 500;
const TTL_HOURS     = 48;
const GEMINI_DELAY  = 1500;

async function fetchWithTimeout(
  url: string,
  timeoutMs = FETCH_TIMEOUT,
): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "ForeSmart-Genesis/1.0" },
    });
    clearTimeout(id);
    return res;
  } catch {
    return null;
  }
}

async function summarizeWithGemini(
  content: string,
  _category: string,
): Promise<string> {
  const result = await callAIGateway({
    system: `أنت محلل اقتصادي مؤسسي متخصص.
لخص المعلومات التالية في 3 جمل عربية احترافية.
ركز على: الحدث الرئيسي، التأثير على الأسواق،
الأفق الزمني والدول المتأثرة.
لا تتجاوز 200 كلمة.`,
    user: content.slice(0, 2000),
    model: "gemini-1.5-flash",
    maxTokens: 300,
    temperature: 0.1,
  });
  return result.raw?.slice(0, 500) ?? "";
}

async function saveKnowledge(
  category: string,
  title: string,
  summary: string,
  source: string,
  sourceUrl?: string,
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
    title:      title.slice(0, 200),
    summary:    summary.slice(0, 500),
    source,
    source_url: sourceUrl ?? null,
    valid_until: new Date(Date.now() + TTL_HOURS * 3600 * 1000).toISOString(),
  });
}

async function cleanOldEntries(): Promise<void> {
  await supabaseAdmin
    .from("genesis_knowledge_base")
    .delete()
    .lt("valid_until", new Date().toISOString());

  const { count } = await supabaseAdmin
    .from("genesis_knowledge_base")
    .select("*", { count: "exact", head: true });

  if ((count ?? 0) > MAX_ENTRIES) {
    const { data: oldest } = await supabaseAdmin
      .from("genesis_knowledge_base")
      .select("id")
      .order("created_at", { ascending: true })
      .limit((count ?? 0) - MAX_ENTRIES);

    if (oldest?.length) {
      await supabaseAdmin
        .from("genesis_knowledge_base")
        .delete()
        .in("id", oldest.map((r) => r.id));
    }
  }
}

// ─── Source fetchers ───────────────────────────────────────────────────────

async function fetchWorldBankData(): Promise<number> {
  let saved = 0;
  try {
    const res = await fetchWithTimeout(KNOWLEDGE_SOURCES.worldBank.gdpGrowth);
    if (!res?.ok) return 0;
    const data = await res.json() as [unknown, Array<{ value: number | null; country: { value: string }; date: string }>];
    const entries = data[1]?.filter((e) => e.value !== null).slice(0, 8);

    if (entries?.length) {
      const content = entries
        .map((e) => `${e.country.value}: نمو الناتج المحلي ${e.value?.toFixed(2)}% (${e.date})`)
        .join("\n");

      const summary = await summarizeWithGemini(
        `بيانات نمو الناتج المحلي العالمي:\n${content}`,
        "macro_data",
      );

      await saveKnowledge(
        "macro_data",
        `نمو الناتج المحلي العالمي — ${new Date().toLocaleDateString("ar")}`,
        summary,
        "World Bank",
      );
      saved++;
    }

    // Trade exports (% of GDP)
    const tradeRes = await fetchWithTimeout(
      "https://api.worldbank.org/v2/country/US;CN;SA;DE;JP/indicator/NE.EXP.GNFS.ZS?format=json&mrv=1&per_page=10",
    );
    if (tradeRes?.ok) {
      const tradeData = await tradeRes.json() as [unknown, Array<{ value: number | null; country: { value: string }; date: string }>];
      const tradeEntries = tradeData[1]?.filter((e) => e.value !== null).slice(0, 5);
      if (tradeEntries?.length) {
        const content = tradeEntries
          .map((e) => `${e.country.value}: صادرات ${e.value?.toFixed(1)}% من الناتج المحلي (${e.date})`)
          .join("\n");
        const summary = await summarizeWithGemini(`بيانات الصادرات والتجارة الدولية:\n${content}`, "macro_data");
        await saveKnowledge(
          "macro_data",
          `مؤشر التجارة الدولية — ${new Date().toLocaleDateString("ar")}`,
          summary,
          "World Bank",
          "https://api.worldbank.org",
        );
        saved++;
      }
    }

    // Foreign direct investment (% of GDP)
    const fdiRes = await fetchWithTimeout(
      "https://api.worldbank.org/v2/country/US;CN;SA;DE;JP/indicator/BX.KLT.DINV.WD.GD.ZS?format=json&mrv=1&per_page=10",
    );
    if (fdiRes?.ok) {
      const fdiData = await fdiRes.json() as [unknown, Array<{ value: number | null; country: { value: string }; date: string }>];
      const fdiEntries = fdiData[1]?.filter((e) => e.value !== null).slice(0, 5);
      if (fdiEntries?.length) {
        const content = fdiEntries
          .map((e) => `${e.country.value}: استثمار أجنبي مباشر ${e.value?.toFixed(2)}% من الناتج المحلي (${e.date})`)
          .join("\n");
        const summary = await summarizeWithGemini(`بيانات الاستثمار الأجنبي المباشر:\n${content}`, "macro_data");
        await saveKnowledge(
          "macro_data",
          `الاستثمار الأجنبي المباشر — ${new Date().toLocaleDateString("ar")}`,
          summary,
          "World Bank",
          "https://api.worldbank.org",
        );
        saved++;
      }
    }
  } catch (e) {
    console.warn("[knowledge] World Bank fetch failed:", e);
  }
  return saved;
}

async function fetchIMFData(): Promise<number> {
  let saved = 0;
  try {
    const res = await fetchWithTimeout(KNOWLEDGE_SOURCES.imf.weoGrowth);
    if (!res?.ok) return 0;
    const data = await res.json() as { values?: { NGDP_RPCH: Record<string, Record<string, number>> } };
    const values = data.values?.NGDP_RPCH;
    if (!values) return 0;

    const lines = Object.entries(values)
      .map(([country, yearData]) => {
        const years = Object.entries(yearData).slice(-2);
        return `${country}: ${years.map(([y, v]) => `${y}: ${Number(v).toFixed(1)}%`).join(", ")}`;
      })
      .slice(0, 7);

    const summary = await summarizeWithGemini(
      `توقعات صندوق النقد الدولي للنمو:\n${lines.join("\n")}`,
      "macro_data",
    );

    await saveKnowledge(
      "macro_data",
      `توقعات IMF للنمو الاقتصادي — ${new Date().toLocaleDateString("ar")}`,
      summary,
      "IMF World Economic Outlook",
    );
    saved++;
  } catch (e) {
    console.warn("[knowledge] IMF fetch failed:", e);
  }
  return saved;
}

async function fetchNewsData(): Promise<number> {
  const key = process.env.NEWS_API_KEY;
  if (!key) return 0;
  let saved = 0;

  for (const query of KNOWLEDGE_SOURCES.news.queries.slice(0, 5)) {
    try {
      const url = `${KNOWLEDGE_SOURCES.news.endpoint}?q=${encodeURIComponent(query)}&language=en&pageSize=3&sortBy=publishedAt&apiKey=${key}`;
      const res = await fetchWithTimeout(url);
      if (!res?.ok) continue;
      const data = await res.json() as {
        articles?: Array<{
          title: string;
          description: string | null;
          url: string;
          source?: { name?: string };
        }>;
      };

      for (const article of (data.articles ?? []).slice(0, 2)) {
        if (!article.title || !article.description) continue;

        const content = `${article.title}\n${article.description}`;
        const summary = await summarizeWithGemini(content, "market_news");
        if (!summary) continue;

        const category =
          query.includes("Federal Reserve") || query.includes("ECB")
            ? "central_bank"
            : query.includes("geopolitical") || query.includes("sanctions")
            ? "geopolitical"
            : "market_news";

        await saveKnowledge(
          category,
          article.title.slice(0, 200),
          summary,
          article.source?.name ?? "NewsAPI",
          article.url,
        );
        saved++;

        await new Promise((r) => setTimeout(r, GEMINI_DELAY));
      }
    } catch (e) {
      console.warn(`[knowledge] News fetch failed for: ${query}`, e);
    }
  }
  return saved;
}

async function fetchFOMCMinutes(): Promise<number> {
  let saved = 0;
  try {
    const res = await fetchWithTimeout(
      "https://www.federalreserve.gov/feeds/press_all.xml",
      10000,
    );
    if (!res?.ok) return 0;
    const text = await res.text();

    const itemMatches = text.match(/<item>[\s\S]*?<\/item>/g);
    if (!itemMatches?.length) return 0;

    for (const item of itemMatches.slice(0, 5)) {
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
      const descMatch  = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/s);

      const title = (titleMatch?.[1] ?? titleMatch?.[2] ?? "").trim();
      const desc  = (descMatch?.[1]  ?? descMatch?.[2]  ?? "").trim().replace(/<[^>]+>/g, " ");

      if (title.length < 5) continue;

      const isFomc =
        /FOMC|Federal Open Market|rate decision|monetary policy|basis points/i.test(title + desc);

      if (!isFomc) continue;

      const summary = await summarizeWithGemini(
        `بيان من الاحتياطي الفيدرالي الأمريكي:\n${title}\n${desc.slice(0, 800)}`,
        "central_bank",
      );

      await saveKnowledge(
        "central_bank",
        title.slice(0, 200),
        summary,
        "Federal Reserve FOMC",
        "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
      );
      saved++;

      await new Promise((r) => setTimeout(r, GEMINI_DELAY));
    }
  } catch (e) {
    console.warn("[knowledge] FOMC fetch failed:", e);
  }
  return saved;
}

async function fetchAcademicData(): Promise<number> {
  let saved = 0;
  try {
    const res = await fetchWithTimeout(KNOWLEDGE_SOURCES.academic.fedResearch);
    if (!res?.ok) return 0;
    const text = await res.text();

    const titleMatches = text.match(/<title>([^<]+)<\/title>/g);
    const descMatches  = text.match(/<description>([^<]+)<\/description>/g);

    if (titleMatches?.length && descMatches?.length) {
      for (let i = 0; i < Math.min(3, titleMatches.length); i++) {
        const title = titleMatches[i].replace(/<\/?title>/g, "").trim();
        const desc  = (descMatches[i] ?? "").replace(/<\/?description>/g, "").trim();

        if (title.length < 5) continue;

        const summary = await summarizeWithGemini(
          `بحث من الفيدرالي الأمريكي:\n${title}\n${desc}`,
          "economic_research",
        );

        await saveKnowledge(
          "economic_research",
          title.slice(0, 200),
          summary,
          "Federal Reserve Research",
          "https://www.federalreserve.gov",
        );
        saved++;

        await new Promise((r) => setTimeout(r, GEMINI_DELAY));
      }
    }
  } catch (e) {
    console.warn("[knowledge] Academic fetch failed:", e);
  }
  return saved;
}

async function fetchSECEarnings(): Promise<number> {
  let saved = 0;
  try {
    const companies = [
      { ticker: "AAPL",  cik: "0000320193", name: "Apple" },
      { ticker: "MSFT",  cik: "0000789019", name: "Microsoft" },
      { ticker: "NVDA",  cik: "0001045810", name: "NVIDIA" },
      { ticker: "GOOGL", cik: "0001652044", name: "Alphabet" },
      { ticker: "AMZN",  cik: "0001018724", name: "Amazon" },
      { ticker: "META",  cik: "0001326801", name: "Meta" },
      { ticker: "TSLA",  cik: "0001318605", name: "Tesla" },
      { ticker: "JPM",   cik: "0000019617", name: "JPMorgan" },
    ];

    for (const company of companies.slice(0, 4)) {
      const url = `https://data.sec.gov/submissions/CIK${company.cik}.json`;
      const res = await fetchWithTimeout(url, 8000);
      if (!res?.ok) continue;

      const data = await res.json() as {
        name?: string;
        filings?: {
          recent?: {
            form?: string[];
            filingDate?: string[];
            primaryDocument?: string[];
          };
        };
      };

      const filings = data.filings?.recent;
      if (!filings) continue;

      const idx = filings.form?.findIndex((f) => f === "10-Q" || f === "10-K") ?? -1;
      if (idx === -1) continue;

      const filingDate = filings.filingDate?.[idx] ?? "";
      const formType   = filings.form?.[idx] ?? "";

      const summary = await summarizeWithGemini(
        `تقرير أرباح ${company.name} (${company.ticker})
نوع التقرير: ${formType}
تاريخ الإيداع: ${filingDate}
الشركة: ${data.name ?? company.name}
قدم تحليلاً مختصراً لتوقعات هذه الشركة بناءً على نوع التقرير وتاريخه.`,
        "sector_analysis",
      );

      await saveKnowledge(
        "sector_analysis",
        `تقرير ${company.name} — ${formType} (${filingDate})`,
        summary,
        "SEC EDGAR",
        `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${company.cik}&type=10-Q&dateb=&owner=include&count=10`,
      );
      saved++;

      await new Promise((r) => setTimeout(r, GEMINI_DELAY));
    }
  } catch (e) {
    console.warn("[knowledge] SEC EDGAR fetch failed:", e);
  }
  return saved;
}

async function fetchBISRates(): Promise<number> {
  let saved = 0;
  try {
    const res = await fetchWithTimeout(
      "https://stats.bis.org/api/v1/data/BIS,WS_CBPOL_D,1.0/D.US;XM;GB;JP;CN;SA.P?format=jsondata&lastNObservations=3",
      8000,
    );
    if (!res?.ok) return 0;

    const data = await res.json() as {
      dataSets?: Array<{
        series?: Record<string, { observations?: Record<string, number[]> }>;
      }>;
    };

    const series = data.dataSets?.[0]?.series;
    if (!series) return 0;

    const countryNames: Record<string, string> = {
      US: "الولايات المتحدة",
      XM: "منطقة اليورو",
      GB: "بريطانيا",
      JP: "اليابان",
      CN: "الصين",
      SA: "المملكة العربية السعودية",
    };

    const rates: string[] = [];
    for (const [key, value] of Object.entries(series)) {
      const countryCode = key.split(":")[1] ?? "";
      const countryName = countryNames[countryCode] ?? countryCode;
      const obs = value.observations ?? {};
      const lastObs = Object.values(obs).slice(-1)[0];
      if (lastObs?.[0] != null) {
        rates.push(`${countryName}: ${lastObs[0].toFixed(2)}%`);
      }
    }

    if (rates.length === 0) return 0;

    const summary = await summarizeWithGemini(
      `معدلات الفائدة للبنوك المركزية الرئيسية (BIS):\n${rates.join("\n")}`,
      "central_bank",
    );

    await saveKnowledge(
      "central_bank",
      `معدلات الفائدة العالمية — ${new Date().toLocaleDateString("ar")}`,
      summary,
      "BIS Statistics",
      "https://stats.bis.org",
    );
    saved++;
  } catch (e) {
    console.warn("[knowledge] BIS fetch failed:", e);
  }
  return saved;
}

async function fetchGeopoliticalNews(): Promise<number> {
  const key = process.env.NEWS_API_KEY;
  if (!key) return 0;
  let saved = 0;

  const geopoliticalQueries = [
    "US China trade war tariffs 2025",
    "Russia Ukraine war economic sanctions",
    "Middle East conflict oil supply",
    "OPEC oil production cut increase",
    "Federal Reserve rate decision inflation",
    "ECB interest rate eurozone",
    "Saudi Arabia Vision 2030 economy",
    "China GDP growth slowdown",
    "Global recession risk 2025 2026",
    "Dollar index DXY emerging markets",
  ];

  for (const query of geopoliticalQueries.slice(0, 6)) {
    try {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&pageSize=2&sortBy=publishedAt&apiKey=${key}`;
      const res = await fetchWithTimeout(url, 6000);
      if (!res?.ok) continue;

      const data = await res.json() as {
        articles?: Array<{
          title?: string;
          description?: string;
          source?: { name?: string };
          url?: string;
        }>;
      };

      for (const article of (data.articles ?? []).slice(0, 1)) {
        if (!article.title || !article.description) continue;

        const isGeopolitical =
          /sanction|war|conflict|OPEC|tariff|trade|China|Russia|Middle East/i.test(
            article.title + " " + article.description,
          );

        const category = isGeopolitical ? "geopolitical" : "market_news";

        const summary = await summarizeWithGemini(
          `${article.title}\n${article.description}`,
          category,
        );
        if (!summary) continue;

        await saveKnowledge(
          category,
          article.title.slice(0, 200),
          summary,
          article.source?.name ?? "NewsAPI",
          article.url,
        );
        saved++;

        await new Promise((r) => setTimeout(r, GEMINI_DELAY));
      }
    } catch (e) {
      console.warn(`[knowledge] Geo news failed for: ${query}`, e);
    }
  }
  return saved;
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function fetchAndLearn(): Promise<{
  processed: number;
  saved: number;
  errors: number;
}> {
  console.info("[genesis-knowledge] Starting learning cycle...");
  let saved  = 0;
  let errors = 0;

  try { saved += await fetchWorldBankData();      } catch { errors++; }
  try { saved += await fetchIMFData();            } catch { errors++; }
  try { saved += await fetchNewsData();           } catch { errors++; }
  try { saved += await fetchAcademicData();       } catch { errors++; }
  try { saved += await fetchFOMCMinutes();        } catch { errors++; }
  try { saved += await fetchSECEarnings();        } catch { errors++; }
  try { saved += await fetchBISRates();           } catch { errors++; }
  try { saved += await fetchGeopoliticalNews();   } catch { errors++; }

  await cleanOldEntries().catch(() => {});

  await supabaseAdmin.from("genesis_knowledge_base").upsert({
    id:          "00000000-0000-0000-0000-000000000001",
    category:    "system_meta",
    title:       "last_refresh",
    summary:     new Date().toISOString(),
    source:      "system",
    valid_until: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
  });

  console.info(`[genesis-knowledge] Done. saved=${saved} errors=${errors}`);
  return { processed: saved + errors, saved, errors };
}

export async function getLastLearningTime(): Promise<Date | null> {
  try {
    const { data } = await supabaseAdmin
      .from("genesis_knowledge_base")
      .select("summary")
      .eq("title", "last_refresh")
      .eq("category", "system_meta")
      .maybeSingle();
    return data?.summary ? new Date(data.summary) : null;
  } catch {
    return null;
  }
}

export async function shouldRefresh(): Promise<boolean> {
  const last = await getLastLearningTime();
  if (!last) return true;
  return last.getTime() < Date.now() - 6 * 3600 * 1000;
}

// Start learning 1 minute after server start
setTimeout(() => {
  fetchAndLearn().catch(err =>
    console.warn("[knowledge] Auto-learn failed:", err)
  );
}, 60000);

// Then every 6 hours
setInterval(() => {
  fetchAndLearn().catch(err =>
    console.warn("[knowledge] Auto-learn failed:", err)
  );
}, 6 * 60 * 60 * 1000);
