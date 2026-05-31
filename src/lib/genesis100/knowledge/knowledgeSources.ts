export const KNOWLEDGE_SOURCES = {

  // ─── Federal Reserve ───────────────────────────────────────────────────────
  // Note: FRED URLs use process.env.FRED_API_KEY at call time.
  // These are used by macroDataService.ts; listed here for reference.
  fred: {
    gdp:          "https://api.stlouisfed.org/fred/series/observations?series_id=GDPC1&api_key=${FRED_API_KEY}&limit=4&sort_order=desc&file_type=json",
    unemployment: "https://api.stlouisfed.org/fred/series/observations?series_id=UNRATE&api_key=${FRED_API_KEY}&limit=3&sort_order=desc&file_type=json",
    yield10y:     "https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${FRED_API_KEY}&limit=5&sort_order=desc&file_type=json",
    dollarIndex:  "https://api.stlouisfed.org/fred/series/observations?series_id=DTWEXBGS&api_key=${FRED_API_KEY}&limit=5&sort_order=desc&file_type=json",
    creditSpread: "https://api.stlouisfed.org/fred/series/observations?series_id=BAMLH0A0HYM2&api_key=${FRED_API_KEY}&limit=5&sort_order=desc&file_type=json",
  },

  // ─── World Bank (no API key needed) ───────────────────────────────────────
  worldBank: {
    gdpGrowth:      "https://api.worldbank.org/v2/country/US;CN;SA;DE;JP;GB;IN;BR/indicator/NY.GDP.MKTP.KD.ZG?format=json&mrv=2&per_page=50",
    inflation:      "https://api.worldbank.org/v2/country/US;CN;SA;DE;JP;GB;IN;BR/indicator/FP.CPI.TOTL.ZG?format=json&mrv=2&per_page=50",
    currentAccount: "https://api.worldbank.org/v2/country/US;CN;SA;DE;JP/indicator/BN.CAB.XOKA.CD?format=json&mrv=2&per_page=30",
  },

  // ─── IMF Data (no API key needed) ─────────────────────────────────────────
  imf: {
    weoGrowth:     "https://www.imf.org/external/datamapper/api/v1/NGDP_RPCH/USA/CHN/SAU/DEU/JPN/GBR/IND",
    weoInflation:  "https://www.imf.org/external/datamapper/api/v1/PCPIPCH/USA/CHN/SAU/DEU/JPN/GBR/IND",
    currentAccount:"https://www.imf.org/external/datamapper/api/v1/BCA_NGDPD/USA/CHN/SAU/DEU/JPN",
  },

  // ─── BIS Central Bank Rates ───────────────────────────────────────────────
  bis: {
    policyRates: "https://stats.bis.org/api/v1/data/BIS,WS_CBPOL_D,1.0/D.US;XM;GB;JP;CN;SA.P?format=jsondata&lastNObservations=5",
  },

  // ─── News (NewsAPI key required) ──────────────────────────────────────────
  news: {
    queries: [
      "Federal Reserve interest rate monetary policy",
      "ECB European Central Bank inflation",
      "OPEC oil production Saudi Arabia",
      "China economy GDP growth slowdown",
      "global inflation recession outlook 2025",
      "geopolitical risk markets sanctions",
      "emerging markets capital flows dollar",
      "cryptocurrency Bitcoin regulation",
      "Saudi Arabia Vision 2030 economy",
      "IMF World Bank economic forecast",
    ],
    endpoint: "https://newsapi.org/v2/everything",
    get key(): string | undefined { return process.env.NEWS_API_KEY; },
  },

  // ─── Free Academic / Research Feeds ──────────────────────────────────────
  academic: {
    nber:        "https://api.nber.org/papers.json?page=1&per_page=5&q=monetary+policy+inflation",
    ssrn:        "https://api.ssrn.com/content/v1/binaries/papers?query=central+bank+policy&count=5",
    fedResearch: "https://www.federalreserve.gov/feeds/working_papers.xml",
    bisResearch: "https://www.bis.org/feeds/index.xml",
    ecbResearch: "https://www.ecb.europa.eu/pub/research/working-papers/html/index.en.html",
  },
};
