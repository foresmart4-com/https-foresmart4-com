interface SectorPerformance {
  name: string;
  nameAr: string;
  ticker: string;
  currentPrice: number | null;
  changePercent1D: number;
  changePercent1M: number | null;
  performance: "outperforming" | "neutral" | "underperforming";
}

export interface RealSectorRotation {
  topSectors: SectorPerformance[];
  bottomSectors: SectorPerformance[];
  rotationSignal: string;
  arabicAnalysis: string;
  lastUpdated: string;
  dataSource: string;
}

const SECTOR_ETFS = [
  { ticker: "XLK",  nameAr: "التكنولوجيا",           name: "Technology" },
  { ticker: "XLE",  nameAr: "الطاقة",               name: "Energy" },
  { ticker: "XLF",  nameAr: "المال والبنوك",          name: "Financials" },
  { ticker: "XLV",  nameAr: "الرعاية الصحية",        name: "Healthcare" },
  { ticker: "XLI",  nameAr: "الصناعة",              name: "Industrials" },
  { ticker: "XLP",  nameAr: "السلع الأساسية",         name: "Consumer Staples" },
  { ticker: "XLY",  nameAr: "السلع التقديرية",        name: "Consumer Discretionary" },
  { ticker: "XLU",  nameAr: "المرافق",               name: "Utilities" },
  { ticker: "XLB",  nameAr: "المواد الخام",           name: "Materials" },
  { ticker: "XLRE", nameAr: "العقارات",              name: "Real Estate" },
];

const _sectorCache = new Map<string, { data: RealSectorRotation; ts: number }>();
const SECTOR_CACHE_TTL = 3600 * 1000;

export async function getRealSectorRotation(): Promise<RealSectorRotation | null> {
  const cached = _sectorCache.get("sector_rotation");
  if (cached && Date.now() - cached.ts < SECTOR_CACHE_TTL) return cached.data;

  const avKey = process.env.ALPHAVANTAGE_API_KEY;
  if (!avKey) return null;

  const performances: SectorPerformance[] = [];

  for (const etf of SECTOR_ETFS.slice(0, 5)) {
    try {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${etf.ticker}&apikey=${avKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;

      const data = await res.json() as {
        "Global Quote"?: {
          "05. price"?: string;
          "10. change percent"?: string;
        };
      };

      const quote = data["Global Quote"];
      if (!quote) continue;

      const price     = parseFloat(quote["05. price"] ?? "0");
      const changeStr = quote["10. change percent"] ?? "0%";
      const change1D  = parseFloat(changeStr.replace("%", ""));

      if (isNaN(price) || isNaN(change1D)) continue;

      performances.push({
        name: etf.name,
        nameAr: etf.nameAr,
        ticker: etf.ticker,
        currentPrice: price,
        changePercent1D: change1D,
        changePercent1M: null,
        performance:
          change1D > 0.5 ? "outperforming" : change1D < -0.5 ? "underperforming" : "neutral",
      });

      await new Promise((r) => setTimeout(r, 1200));
    } catch {
      continue;
    }
  }

  if (performances.length === 0) return null;

  const sorted = [...performances].sort((a, b) => b.changePercent1D - a.changePercent1D);
  const top    = sorted.slice(0, 3);
  const bottom = sorted.slice(-2);

  const topNames    = top.map((s) => s.nameAr).join("، ");
  const bottomNames = bottom.map((s) => s.nameAr).join("، ");

  const arabicAnalysis = `=== دوران القطاعات الحقيقي (من السوق الأمريكي) ===

القطاعات الأفضل أداءً اليوم:
${top.map((s) => `• ${s.nameAr} (${s.ticker}): ${s.changePercent1D >= 0 ? "+" : ""}${s.changePercent1D.toFixed(2)}%`).join("\n")}

القطاعات الأضعف أداءً اليوم:
${bottom.map((s) => `• ${s.nameAr} (${s.ticker}): ${s.changePercent1D >= 0 ? "+" : ""}${s.changePercent1D.toFixed(2)}%`).join("\n")}

إشارة الدوران: رأس المال يتدفق نحو ${topNames}
تجنب أو خفف: ${bottomNames}`.trim();

  const result: RealSectorRotation = {
    topSectors: top,
    bottomSectors: bottom,
    rotationSignal: `تفضيل: ${topNames}`,
    arabicAnalysis,
    lastUpdated: new Date().toISOString(),
    dataSource: "Alpha Vantage — Sector ETFs",
  };

  _sectorCache.set("sector_rotation", { data: result, ts: Date.now() });
  return result;
}
