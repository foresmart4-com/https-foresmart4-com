import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAIGateway } from "@/lib/ai-gateway.server";
import { KNOWLEDGE_SOURCES } from "./knowledgeSources";
import { sendEmail } from "@/lib/email.service";
import { fetchFMPData } from "./fmpFetcher";
import { fetchTwelveData } from "./twelvedataFetcher";

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

type WBRow = { value: number | null; country: { value: string }; date: string };
type WBResponse = [unknown, WBRow[]];

async function fetchWorldBankData(): Promise<number> {
  let saved = 0;
  try {
    // GDP Growth — 10 major economies
    const gdpRes = await fetchWithTimeout(
      "https://api.worldbank.org/v2/country/US;CN;SA;DE;JP;GB;IN;BR;KR;RU/indicator/NY.GDP.MKTP.KD.ZG?format=json&mrv=2&per_page=30",
    );
    if (gdpRes?.ok) {
      const data = await gdpRes.json() as WBResponse;
      const entries = data[1]?.filter((e) => e.value !== null).slice(0, 10);
      if (entries?.length) {
        const content = entries
          .map((e) => `${e.country.value}: نمو الناتج المحلي ${e.value?.toFixed(2)}% (${e.date})`)
          .join("\n");
        const summary = await summarizeWithGemini(`بيانات نمو الناتج المحلي العالمي:\n${content}`, "macro_data");
        await saveKnowledge("macro_data", `نمو الناتج المحلي العالمي — ${new Date().toLocaleDateString("ar")}`, summary, "World Bank");
        saved++;
      }
    }

    // Inflation rates
    const inflRes = await fetchWithTimeout(KNOWLEDGE_SOURCES.worldBank.inflation);
    if (inflRes?.ok) {
      const data = await inflRes.json() as WBResponse;
      const entries = data[1]?.filter((e) => e.value !== null).slice(0, 8);
      if (entries?.length) {
        const content = entries
          .map((e) => `${e.country.value}: تضخم ${e.value?.toFixed(2)}% (${e.date})`)
          .join("\n");
        const summary = await summarizeWithGemini(`بيانات التضخم العالمي:\n${content}`, "macro_data");
        await saveKnowledge("macro_data", `معدلات التضخم العالمية — ${new Date().toLocaleDateString("ar")}`, summary, "World Bank", "https://api.worldbank.org");
        saved++;
      }
    }

    // Trade exports (% of GDP)
    const tradeRes = await fetchWithTimeout(
      "https://api.worldbank.org/v2/country/US;CN;SA;DE;JP/indicator/NE.EXP.GNFS.ZS?format=json&mrv=1&per_page=10",
    );
    if (tradeRes?.ok) {
      const tradeData = await tradeRes.json() as WBResponse;
      const tradeEntries = tradeData[1]?.filter((e) => e.value !== null).slice(0, 5);
      if (tradeEntries?.length) {
        const content = tradeEntries
          .map((e) => `${e.country.value}: صادرات ${e.value?.toFixed(1)}% من الناتج المحلي (${e.date})`)
          .join("\n");
        const summary = await summarizeWithGemini(`بيانات الصادرات والتجارة الدولية:\n${content}`, "macro_data");
        await saveKnowledge("macro_data", `مؤشر التجارة الدولية — ${new Date().toLocaleDateString("ar")}`, summary, "World Bank", "https://api.worldbank.org");
        saved++;
      }
    }

    // Foreign direct investment (% of GDP)
    const fdiRes = await fetchWithTimeout(
      "https://api.worldbank.org/v2/country/US;CN;SA;DE;JP/indicator/BX.KLT.DINV.WD.GD.ZS?format=json&mrv=1&per_page=10",
    );
    if (fdiRes?.ok) {
      const fdiData = await fdiRes.json() as WBResponse;
      const fdiEntries = fdiData[1]?.filter((e) => e.value !== null).slice(0, 5);
      if (fdiEntries?.length) {
        const content = fdiEntries
          .map((e) => `${e.country.value}: استثمار أجنبي مباشر ${e.value?.toFixed(2)}% من الناتج المحلي (${e.date})`)
          .join("\n");
        const summary = await summarizeWithGemini(`بيانات الاستثمار الأجنبي المباشر:\n${content}`, "macro_data");
        await saveKnowledge("macro_data", `الاستثمار الأجنبي المباشر — ${new Date().toLocaleDateString("ar")}`, summary, "World Bank", "https://api.worldbank.org");
        saved++;
      }
    }

    // Current account balance
    const caRes = await fetchWithTimeout(KNOWLEDGE_SOURCES.worldBank.currentAccount);
    if (caRes?.ok) {
      const caData = await caRes.json() as WBResponse;
      const caEntries = caData[1]?.filter((e) => e.value !== null).slice(0, 6);
      if (caEntries?.length) {
        const content = caEntries
          .map((e) => `${e.country.value}: رصيد الحساب الجاري ${e.value?.toLocaleString("ar")} مليار دولار (${e.date})`)
          .join("\n");
        const summary = await summarizeWithGemini(`بيانات الحساب الجاري العالمي:\n${content}`, "macro_data");
        await saveKnowledge("macro_data", `الحساب الجاري العالمي — ${new Date().toLocaleDateString("ar")}`, summary, "World Bank", "https://api.worldbank.org");
        saved++;
      }
    }
  } catch (e) {
    console.warn("[knowledge] World Bank fetch failed:", e);
  }
  return saved;
}

type IMFValues = Record<string, Record<string, number>>;

function extractIMFLines(values: IMFValues, limit = 7): string[] {
  return Object.entries(values)
    .map(([country, yearData]) => {
      const years = Object.entries(yearData).slice(-2);
      return `${country}: ${years.map(([y, v]) => `${y}: ${Number(v).toFixed(1)}%`).join(", ")}`;
    })
    .slice(0, limit);
}

async function fetchIMFData(): Promise<number> {
  let saved = 0;
  try {
    // GDP Growth forecasts
    const growthRes = await fetchWithTimeout(KNOWLEDGE_SOURCES.imf.weoGrowth);
    if (growthRes?.ok) {
      const data = await growthRes.json() as { values?: { NGDP_RPCH: IMFValues } };
      const values = data.values?.NGDP_RPCH;
      if (values) {
        const lines = extractIMFLines(values);
        const summary = await summarizeWithGemini(`توقعات صندوق النقد الدولي للنمو:\n${lines.join("\n")}`, "macro_data");
        await saveKnowledge("macro_data", `توقعات IMF للنمو الاقتصادي — ${new Date().toLocaleDateString("ar")}`, summary, "IMF World Economic Outlook");
        saved++;
      }
    }

    // Inflation forecasts
    const inflRes = await fetchWithTimeout(KNOWLEDGE_SOURCES.imf.weoInflation);
    if (inflRes?.ok) {
      const data = await inflRes.json() as { values?: { PCPIPCH: IMFValues } };
      const values = data.values?.PCPIPCH;
      if (values) {
        const lines = extractIMFLines(values);
        const summary = await summarizeWithGemini(`توقعات IMF للتضخم:\n${lines.join("\n")}`, "macro_data");
        await saveKnowledge("macro_data", `توقعات IMF للتضخم — ${new Date().toLocaleDateString("ar")}`, summary, "IMF World Economic Outlook", "https://www.imf.org/external/datamapper");
        saved++;
      }
    }

    // Current account balance (% of GDP)
    const caRes = await fetchWithTimeout(KNOWLEDGE_SOURCES.imf.currentAccount);
    if (caRes?.ok) {
      const data = await caRes.json() as { values?: { BCA_NGDPD: IMFValues } };
      const values = data.values?.BCA_NGDPD;
      if (values) {
        const lines = extractIMFLines(values);
        const summary = await summarizeWithGemini(`توقعات IMF للحساب الجاري:\n${lines.join("\n")}`, "macro_data");
        await saveKnowledge("macro_data", `الحساب الجاري IMF — ${new Date().toLocaleDateString("ar")}`, summary, "IMF World Economic Outlook", "https://www.imf.org/external/datamapper");
        saved++;
      }
    }

    // Government debt (% of GDP)
    const debtRes = await fetchWithTimeout(
      "https://www.imf.org/external/datamapper/api/v1/GGXWDG_NGDP/USA/CHN/SAU/DEU/JPN/GBR",
    );
    if (debtRes?.ok) {
      const data = await debtRes.json() as { values?: { GGXWDG_NGDP: IMFValues } };
      const values = data.values?.GGXWDG_NGDP;
      if (values) {
        const lines = extractIMFLines(values);
        const summary = await summarizeWithGemini(`بيانات IMF للدين الحكومي:\n${lines.join("\n")}`, "macro_data");
        await saveKnowledge("macro_data", `الدين الحكومي IMF — ${new Date().toLocaleDateString("ar")}`, summary, "IMF World Economic Outlook", "https://www.imf.org/external/datamapper");
        saved++;
      }
    }
  } catch (e) {
    console.warn("[knowledge] IMF fetch failed:", e);
  }
  return saved;
}

async function fetchNewsData(): Promise<number> {
  const key = process.env.NEWSAPI_KEY ?? process.env.NEWS_API_KEY;
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

async function parseAndSaveFeed(
  url: string,
  sourceName: string,
  sourceUrl: string,
  labelPrefix: string,
  maxItems = 3,
  category = "economic_research",
): Promise<number> {
  let saved = 0;
  const res = await fetchWithTimeout(url, 10000);
  if (!res?.ok) return 0;
  const text = await res.text();

  const titleMatches = text.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g);
  const descMatches  = text.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/g);

  if (!titleMatches?.length) return 0;

  for (let i = 0; i < Math.min(maxItems, titleMatches.length); i++) {
    const title = titleMatches[i]
      .replace(/<\/?title>/g, "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    const desc  = (descMatches?.[i] ?? "")
      .replace(/<\/?description>/g, "").replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/<[^>]+>/g, " ").trim();

    if (title.length < 5) continue;

    const summary = await summarizeWithGemini(
      `${labelPrefix}:\n${title}\n${desc.slice(0, 800)}`,
      category,
    );
    if (!summary) continue;

    await saveKnowledge(category, title.slice(0, 200), summary, sourceName, sourceUrl);
    saved++;
    await new Promise((r) => setTimeout(r, GEMINI_DELAY));
  }
  return saved;
}

async function fetchAcademicData(): Promise<number> {
  let saved = 0;
  try {
    saved += await parseAndSaveFeed(
      KNOWLEDGE_SOURCES.academic.fedResearch,
      "Federal Reserve Research",
      "https://www.federalreserve.gov",
      "بحث من الفيدرالي الأمريكي",
    );
  } catch (e) {
    console.warn("[knowledge] Fed research fetch failed:", e);
  }

  try {
    saved += await parseAndSaveFeed(
      KNOWLEDGE_SOURCES.academic.bisResearch,
      "BIS Working Papers",
      "https://www.bis.org",
      "ورقة بحثية من بنك التسويات الدولية",
    );
  } catch (e) {
    console.warn("[knowledge] BIS research fetch failed:", e);
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

type BISDataSet = { series?: Record<string, { observations?: Record<string, number[]> }> };
type BISResponse = { dataSets?: BISDataSet[] };

function extractBISRates(series: Record<string, { observations?: Record<string, number[]> }>, countryNames: Record<string, string>): string[] {
  const rates: string[] = [];
  for (const [key, value] of Object.entries(series)) {
    const parts = key.split(":");
    const countryCode = parts[1] ?? parts[0] ?? "";
    const countryName = countryNames[countryCode] ?? countryCode;
    const obs = value.observations ?? {};
    const lastObs = Object.values(obs).slice(-1)[0];
    if (lastObs?.[0] != null) {
      rates.push(`${countryName}: ${lastObs[0].toFixed(2)}%`);
    }
  }
  return rates;
}

async function fetchBISRates(): Promise<number> {
  let saved = 0;
  const countryNames: Record<string, string> = {
    US: "الولايات المتحدة (الفيدرالي)",
    XM: "منطقة اليورو (ECB)",
    GB: "بريطانيا (BOE)",
    JP: "اليابان (BOJ)",
    CN: "الصين (PBOC)",
    SA: "المملكة العربية السعودية (SAMA)",
    AU: "أستراليا (RBA)",
    CA: "كندا (BOC)",
    CH: "سويسرا (SNB)",
    SE: "السويد (Riksbank)",
  };

  try {
    // Policy rates — 10 major central banks
    const ratesRes = await fetchWithTimeout(
      "https://stats.bis.org/api/v1/data/BIS,WS_CBPOL_D,1.0/D.US;XM;GB;JP;CN;SA;AU;CA;CH;SE.P?format=jsondata&lastNObservations=5",
      8000,
    );
    if (ratesRes?.ok) {
      const data = await ratesRes.json() as BISResponse;
      const series = data.dataSets?.[0]?.series;
      if (series) {
        const rates = extractBISRates(series, countryNames);
        if (rates.length > 0) {
          const summary = await summarizeWithGemini(
            `معدلات الفائدة للبنوك المركزية الرئيسية (BIS):\n${rates.join("\n")}`,
            "central_bank",
          );
          await saveKnowledge("central_bank", `معدلات الفائدة العالمية — ${new Date().toLocaleDateString("ar")}`, summary, "BIS Statistics", "https://stats.bis.org");
          saved++;
        }
      }
    }

    // Credit-to-GDP gap (early warning indicator for financial crises)
    const gapRes = await fetchWithTimeout(
      "https://stats.bis.org/api/v1/data/BIS,WS_TC_GAPS,1.0/Q.US;CN;DE;JP;GB;SA.ALL.A?format=jsondata&lastNObservations=4",
      8000,
    );
    if (gapRes?.ok) {
      const data = await gapRes.json() as BISResponse;
      const series = data.dataSets?.[0]?.series;
      if (series) {
        const gaps = extractBISRates(series, {
          US: "الولايات المتحدة", CN: "الصين", DE: "ألمانيا",
          JP: "اليابان", GB: "بريطانيا", SA: "المملكة العربية السعودية",
        });
        if (gaps.length > 0) {
          const summary = await summarizeWithGemini(
            `فجوة الائتمان إلى الناتج المحلي (مؤشر إنذار مبكر للأزمات المالية):\n${gaps.join("\n")}`,
            "central_bank",
          );
          await saveKnowledge("central_bank", `فجوة الائتمان إلى الناتج المحلي — ${new Date().toLocaleDateString("ar")}`, summary, "BIS Statistics", "https://stats.bis.org");
          saved++;
        }
      }
    }
  } catch (e) {
    console.warn("[knowledge] BIS fetch failed:", e);
  }
  return saved;
}

async function fetchGeopoliticalNews(): Promise<number> {
  const key = process.env.NEWSAPI_KEY ?? process.env.NEWS_API_KEY;
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

// ─── New source fetchers ───────────────────────────────────────────────────

const CB_FEEDS = [
  { url: "https://www.federalreserve.gov/feeds/speeches.xml",          source: "Federal Reserve Speeches",  category: "central_bank" },
  { url: "https://www.ecb.europa.eu/rss/speeches.rss",                 source: "ECB Speeches",              category: "central_bank" },
  { url: "https://www.ecb.europa.eu/rss/press.rss",                    source: "ECB Press Releases",        category: "central_bank" },
  { url: "https://www.bankofengland.co.uk/rss/publications",           source: "Bank of England",           category: "central_bank" },
  { url: "https://www.boj.or.jp/en/rss/release.xml",                   source: "Bank of Japan",             category: "central_bank" },
  { url: "https://www.bis.org/feeds/bisqtrly.xml",                     source: "BIS Quarterly Review",      category: "economic_research" },
] as const;

async function fetchCentralBankFeeds(): Promise<number> {
  let saved = 0;
  for (const feed of CB_FEEDS) {
    try {
      const res = await fetchWithTimeout(feed.url, 8000);
      if (!res?.ok) continue;
      const text = await res.text();
      const items = text.match(/<item>[\s\S]*?<\/item>/g) ?? [];
      for (const item of items.slice(0, 2)) {
        const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/)?.[1] ?? "").trim();
        const desc  = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/s)?.[1] ?? "")
          .replace(/<[^>]+>/g, " ").trim();
        if (title.length < 5) continue;
        const isRelevant = /rate|inflation|GDP|monetary|policy|growth|recession|market|financial|banking|trade|debt|credit|interest|oil|energy/i.test(title + " " + desc);
        if (!isRelevant) continue;
        const summary = await summarizeWithGemini(`بيان من ${feed.source}:\n${title}\n${desc.slice(0, 600)}`, feed.category);
        await saveKnowledge(feed.category, title.slice(0, 200), summary, feed.source);
        saved++;
        await new Promise((r) => setTimeout(r, GEMINI_DELAY));
      }
    } catch (e) {
      console.warn(`[central-bank-feeds] ${feed.source}:`, e);
    }
  }
  return saved;
}

const ACADEMIC_FEEDS = [
  { url: "https://feeds.nberpubs.org/nber/new",                        source: "NBER Working Papers",  label: "بحث اقتصادي من NBER" },
  { url: "https://www.ecb.europa.eu/rss/wps.rss",                      source: "ECB Research Papers",  label: "ورقة بحثية من البنك المركزي الأوروبي" },
  { url: "https://www.federalreserve.gov/feeds/working_papers.xml",    source: "Fed Research",         label: "بحث من الفيدرالي الأمريكي" },
] as const;

async function fetchAcademicResearch(): Promise<number> {
  let saved = 0;
  for (const feed of ACADEMIC_FEEDS) {
    try {
      saved += await parseAndSaveFeed(feed.url, feed.source, feed.url, feed.label, 2, "economic_research");
    } catch (e) {
      console.warn(`[academic] ${feed.source}:`, e);
    }
  }
  // OECD economic outlook
  try {
    const res = await fetchWithTimeout(
      "https://stats.oecd.org/sdmx-json/data/EO/USA+CHN+DEU+JPN+GBR+SAU.GDP+CPI+UNR.A/all?startTime=2024&endTime=2025&format=jsondata",
      8000,
    );
    if (res?.ok) {
      const data = await res.json() as Record<string, unknown>;
      const summary = await summarizeWithGemini(
        `بيانات OECD الاقتصادية:\n${JSON.stringify(data).slice(0, 800)}`,
        "macro_data",
      );
      if (summary) {
        await saveKnowledge("macro_data", `توقعات OECD — ${new Date().toLocaleDateString("ar")}`, summary, "OECD Economic Outlook");
        saved++;
      }
    }
  } catch (e) {
    console.warn("[oecd]:", e);
  }
  return saved;
}

async function fetchEnergyData(): Promise<number> {
  let saved = 0;
  // EIA weekly oil prices
  try {
    const res = await fetchWithTimeout(
      "https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=DEMO_KEY&frequency=weekly&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=4",
      8000,
    );
    if (res?.ok) {
      const data = await res.json() as { response?: { data?: Array<{ period: string; "product-name": string; value: number }> } };
      const entries = data.response?.data ?? [];
      if (entries.length > 0) {
        const content = entries.map((e) => `${e["product-name"]}: $${e.value} (${e.period})`).join("\n");
        const summary = await summarizeWithGemini(`أسعار النفط من EIA:\n${content}`, "macro_data");
        if (summary) {
          await saveKnowledge("macro_data", `أسعار النفط — EIA (${new Date().toLocaleDateString("ar")})`, summary, "EIA Energy Data");
          saved++;
        }
      }
    }
  } catch (e) {
    console.warn("[eia]:", e);
  }
  // OPEC RSS
  try {
    saved += await parseAndSaveFeed(
      "https://www.opec.org/opec_web/en/rss.htm",
      "OPEC",
      "https://www.opec.org",
      "تقرير أوبك",
      2,
      "geopolitical",
    );
  } catch (e) {
    console.warn("[opec]:", e);
  }
  // World Bank commodity price index
  try {
    const res = await fetchWithTimeout(
      "https://api.worldbank.org/v2/country/WLD/indicator/PCOMM?format=json&mrv=3&per_page=5",
      8000,
    );
    if (res?.ok) {
      const data = await res.json() as [unknown, Array<{ value: number | null; date: string }>];
      const entries = data[1]?.filter((e) => e.value !== null) ?? [];
      if (entries.length > 0) {
        const content = entries.map((e) => `مؤشر السلع: ${e.value?.toFixed(2)} (${e.date})`).join("\n");
        const summary = await summarizeWithGemini(`مؤشر أسعار السلع العالمي:\n${content}`, "macro_data");
        if (summary) {
          await saveKnowledge("macro_data", `مؤشر السلع العالمي — World Bank`, summary, "World Bank Commodities");
          saved++;
        }
      }
    }
  } catch (e) {
    console.warn("[wb-commodities]:", e);
  }
  return saved;
}

const SAUDI_INDICATORS = [
  { url: "https://api.worldbank.org/v2/country/SA/indicator/NY.GDP.MKTP.KD.ZG?format=json&mrv=4",                                        title: "نمو الاقتصاد السعودي" },
  { url: "https://api.worldbank.org/v2/country/SA/indicator/FP.CPI.TOTL.ZG?format=json&mrv=4",                                           title: "التضخم في السعودية" },
  { url: "https://api.worldbank.org/v2/country/SA/indicator/NY.GDP.PETR.RT.ZS?format=json&mrv=4",                                        title: "النفط كنسبة من GDP السعودي" },
  { url: "https://api.worldbank.org/v2/country/SA/indicator/BX.KLT.DINV.WD.GD.ZS?format=json&mrv=4",                                    title: "الاستثمار الأجنبي في السعودية" },
  { url: "https://api.worldbank.org/v2/country/SA;AE;KW;QA;BH;OM/indicator/NY.GDP.MKTP.KD.ZG?format=json&mrv=2&per_page=20",            title: "نمو دول الخليج" },
] as const;

async function fetchSaudiGCCData(): Promise<number> {
  let saved = 0;
  for (const indicator of SAUDI_INDICATORS) {
    try {
      const res = await fetchWithTimeout(indicator.url, 8000);
      if (!res?.ok) continue;
      const data = await res.json() as [unknown, Array<{ value: number | null; date: string; country: { value: string } }>];
      const entries = data[1]?.filter((e) => e.value !== null).slice(0, 4) ?? [];
      if (entries.length === 0) continue;
      const content = entries.map((e) => `${e.country?.value ?? "SA"}: ${e.value?.toFixed(2)} (${e.date})`).join("\n");
      const summary = await summarizeWithGemini(`${indicator.title}:\n${content}`, "sector_analysis");
      if (summary) {
        await saveKnowledge("sector_analysis", `${indicator.title} — ${new Date().toLocaleDateString("ar")}`, summary, "World Bank — Saudi/GCC");
        saved++;
      }
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.warn(`[saudi-gcc] ${indicator.title}:`, e);
    }
  }
  return saved;
}

async function fetchFinancialStability(): Promise<number> {
  let saved = 0;
  // FDIC US banking health
  try {
    const res = await fetchWithTimeout(
      "https://banks.data.fdic.gov/api/financials?limit=5&sort_by=REPDTE&sort_order=DESC&fields=REPDTE,ASSET,DEP,LNLSNET,ROA,ROE",
      8000,
    );
    if (res?.ok) {
      const data = await res.json() as { data?: Array<{ data: { REPDTE: string; ASSET: number; ROA: number; ROE: number } }> };
      const latest = data.data?.[0]?.data;
      if (latest) {
        const summary = await summarizeWithGemini(
          `صحة البنوك الأمريكية (FDIC):\nالأصول: $${(latest.ASSET / 1e9).toFixed(0)}B\nROA: ${latest.ROA?.toFixed(2)}%\nROE: ${latest.ROE?.toFixed(2)}%\nالفترة: ${latest.REPDTE}`,
          "central_bank",
        );
        if (summary) {
          await saveKnowledge("central_bank", `صحة البنوك الأمريكية — FDIC`, summary, "FDIC Bank Statistics");
          saved++;
        }
      }
    }
  } catch (e) {
    console.warn("[fdic]:", e);
  }
  // World Bank banking sector credit
  try {
    const res = await fetchWithTimeout(
      "https://api.worldbank.org/v2/country/US;CN;DE;JP;GB;SA/indicator/GFDD.DI.01?format=json&mrv=3&per_page=15",
      8000,
    );
    if (res?.ok) {
      const data = await res.json() as WBResponse;
      const entries = data[1]?.filter((e) => e.value !== null) ?? [];
      if (entries.length > 0) {
        const content = entries.map((e) => `${e.country.value}: ${e.value?.toFixed(2)}% (${e.date})`).join("\n");
        const summary = await summarizeWithGemini(`الائتمان المصرفي كنسبة من GDP:\n${content}`, "central_bank");
        if (summary) {
          await saveKnowledge("central_bank", `الائتمان المصرفي العالمي`, summary, "World Bank Financial");
          saved++;
        }
      }
    }
  } catch (e) {
    console.warn("[wb-financial]:", e);
  }
  return saved;
}

const FOOD_INDICATORS = [
  { url: "https://api.worldbank.org/v2/country/WLD/indicator/AG.PRD.FOOD.XD?format=json&mrv=3", title: "مؤشر إنتاج الغذاء العالمي" },
  { url: "https://api.worldbank.org/v2/country/WLD/indicator/AG.PRD.CROP.XD?format=json&mrv=3", title: "مؤشر إنتاج المحاصيل العالمي" },
  { url: "https://api.worldbank.org/v2/country/WLD/indicator/FP.WPI.TOTL?format=json&mrv=3",    title: "مؤشر أسعار الجملة العالمي" },
] as const;

async function fetchFoodAgricultureData(): Promise<number> {
  let saved = 0;
  for (const indicator of FOOD_INDICATORS) {
    try {
      const res = await fetchWithTimeout(indicator.url, 8000);
      if (!res?.ok) continue;
      const data = await res.json() as [unknown, Array<{ value: number | null; date: string }>];
      const latest = data[1]?.find((e) => e.value !== null);
      if (!latest) continue;
      const summary = await summarizeWithGemini(`${indicator.title}: ${latest.value?.toFixed(2)} (${latest.date})`, "macro_data");
      if (summary) {
        await saveKnowledge("macro_data", `${indicator.title} — ${latest.date}`, summary, "World Bank Agriculture");
        saved++;
      }
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {
      console.warn(`[food-agri] ${indicator.title}:`, e);
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

  // ── Existing sources ──────────────────────────────────────────────────────
  try { saved += await fetchWorldBankData();       } catch { errors++; }
  try { saved += await fetchIMFData();             } catch { errors++; }
  try { saved += await fetchNewsData();            } catch { errors++; }
  try { saved += await fetchAcademicData();        } catch { errors++; }
  try { saved += await fetchFOMCMinutes();         } catch { errors++; }
  try { saved += await fetchSECEarnings();         } catch { errors++; }
  try { saved += await fetchBISRates();            } catch { errors++; }
  try { saved += await fetchGeopoliticalNews();    } catch { errors++; }
  // ── New sources ────────────────────────────────────────────────────────────
  try { saved += await fetchCentralBankFeeds();    } catch { errors++; }
  try { saved += await fetchAcademicResearch();    } catch { errors++; }
  try { saved += await fetchEnergyData();          } catch { errors++; }
  try { saved += await fetchSaudiGCCData();        } catch { errors++; }
  try { saved += await fetchFinancialStability();  } catch { errors++; }
  try { saved += await fetchFoodAgricultureData(); } catch { errors++; }
  try { saved += await fetchFMPData();             } catch { errors++; }
  try { saved += await fetchTwelveData();          } catch { errors++; }

  await cleanOldEntries().catch(() => {});

  await supabaseAdmin.from("genesis_knowledge_base").upsert({
    id:          "00000000-0000-0000-0000-000000000001",
    category:    "system_meta",
    title:       "last_refresh",
    summary:     new Date().toISOString(),
    source:      "system",
    valid_until: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
  });

  if (saved > 5) {
    sendEmail({
      to: "Ayyaf08@hotmail.com",
      subject: `Genesis تعلّم ${saved} مصدر جديد`,
      html: `
        <div dir="rtl" style="font-family:Arial;padding:20px;">
          <h2>🧠 Genesis أكمل دورة التعلم</h2>
          <p>حُفظ: <strong>${saved}</strong> مدخل</p>
          <p>أخطاء: ${errors}</p>
          <p>${new Date().toLocaleString("ar-SA")}</p>
        </div>
      `,
    }).catch(() => {});
  }

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

const FREE_SOURCES = [
  { name: "World Bank",   url: "https://api.worldbank.org/v2/country/US/indicator/NY.GDP.MKTP.KD.ZG?format=json&mrv=1&per_page=1" },
  { name: "IMF",          url: "https://www.imf.org/external/datamapper/api/v1/NGDP_RPCH/USA" },
  { name: "BIS",          url: "https://stats.bis.org/api/v1/data/BIS,WS_CBPOL_D,1.0/D.US.P?format=jsondata&lastNObservations=1" },
  { name: "ECB RSS",      url: "https://www.ecb.europa.eu/rss/speeches.rss" },
  { name: "BOE RSS",      url: "https://www.bankofengland.co.uk/rss/publications" },
  { name: "Fed Research", url: "https://www.federalreserve.gov/feeds/working_papers.xml" },
  { name: "NBER",         url: "https://feeds.nberpubs.org/nber/new" },
  { name: "EIA",          url: "https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=DEMO_KEY&length=1" },
  { name: "OPEC",         url: "https://www.opec.org/opec_web/en/rss.htm" },
  { name: "FDIC",         url: "https://banks.data.fdic.gov/api/financials?limit=1" },
  { name: "GDELT",        url: "https://api.gdeltproject.org/api/v2/doc/doc?query=economy&mode=artlist&maxrecords=1&format=json" },
] as const;

async function verifyFreeSourcesConnected(): Promise<void> {
  console.info("[genesis-sources] Verifying all free data sources...");
  let connected = 0;
  for (const source of FREE_SOURCES) {
    try {
      const res = await fetchWithTimeout(source.url, 5000);
      if (res && res.status < 400) {
        console.info(`[${source.name}] ✅ HTTP ${res.status}`);
        connected++;
      } else {
        console.warn(`[${source.name}] ⚠️ HTTP ${res?.status ?? "timeout"}`);
      }
    } catch {
      console.warn(`[${source.name}] ❌ unreachable`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  // FRED check with API key
  const fredKey = process.env.FRED_API_KEY;
  if (fredKey) {
    try {
      const fred = await fetchWithTimeout(
        `https://api.stlouisfed.org/fred/series/observations?series_id=FEDFUNDS&api_key=${fredKey}&limit=1&file_type=json`,
        5000,
      );
      console.info(`[FRED] ✅ HTTP ${fred?.status}`);
      connected++;
    } catch {
      console.warn("[FRED] ❌ unreachable");
    }
  } else {
    console.warn("[FRED] ❌ FRED_API_KEY missing in Railway");
  }
  console.info(`[genesis-sources] ${connected}/${FREE_SOURCES.length + (fredKey ? 1 : 0)} sources reachable`);
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

// Run verification 3 minutes after server start
setTimeout(() => {
  verifyFreeSourcesConnected().catch(console.warn);
}, 3 * 60 * 1000);
