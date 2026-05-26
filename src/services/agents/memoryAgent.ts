// AI Memory Layer — tracks user behaviour, risk profile and historical
// AI recommendation accuracy. Local-only, privacy-preserving.
const K_PROFILE = "ai_user_profile_v1";
const K_HISTORY = "ai_recs_history_v1";
const MAX_HISTORY = 200;

export type RiskAppetite = "conservative" | "balanced" | "aggressive";

export interface UserProfile {
  riskAppetite: RiskAppetite;
  preferredAssets: string[];     // tickers user opens/acts on
  avgHoldingMinutes: number;
  interactions: number;
  lastSeen: number;
  genesisQuestionsAsked?: number;
  lastGenesisTs?: number;
  preferredMarkets?: string[];   // e.g. ["crypto","metals","stocks"]
  responseStyle?: "brief" | "detailed";
}

export interface RecommendationOutcome {
  id: string;
  ts: number;
  asset: string;
  bias: "bullish" | "bearish" | "neutral";
  confidence: number;
  realizedReturnPct?: number;    // populated when outcome is reported
  hit?: boolean;                 // true if direction correct
}

function safeRead<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; }
}
function safeWrite(key: string, value: unknown) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

const DEFAULT_PROFILE: UserProfile = {
  riskAppetite: "balanced", preferredAssets: [], avgHoldingMinutes: 0, interactions: 0, lastSeen: 0,
};

export const memoryAgent = {
  getProfile(): UserProfile { return safeRead(K_PROFILE, DEFAULT_PROFILE); },
  setRiskAppetite(r: RiskAppetite) {
    const p = this.getProfile(); p.riskAppetite = r; p.lastSeen = Date.now();
    safeWrite(K_PROFILE, p);
  },
  trackAssetInteraction(asset: string) {
    const p = this.getProfile();
    p.preferredAssets = [asset, ...p.preferredAssets.filter((a) => a !== asset)].slice(0, 12);
    p.interactions++; p.lastSeen = Date.now();
    safeWrite(K_PROFILE, p);
  },
  recordRecommendation(rec: Omit<RecommendationOutcome, "id" | "ts">) {
    const list = safeRead<RecommendationOutcome[]>(K_HISTORY, []);
    list.unshift({ ...rec, id: crypto.randomUUID(), ts: Date.now() });
    safeWrite(K_HISTORY, list.slice(0, MAX_HISTORY));
  },
  resolveRecommendation(id: string, realizedReturnPct: number) {
    const list = safeRead<RecommendationOutcome[]>(K_HISTORY, []);
    const r = list.find((x) => x.id === id);
    if (!r) return;
    r.realizedReturnPct = realizedReturnPct;
    const directional = r.bias === "bullish" ? 1 : r.bias === "bearish" ? -1 : 0;
    r.hit = directional !== 0 && Math.sign(realizedReturnPct) === directional;
    safeWrite(K_HISTORY, list);
  },
  history(): RecommendationOutcome[] { return safeRead(K_HISTORY, []); },
  performance() {
    const list = this.history().filter((x) => typeof x.hit === "boolean");
    const trades = list.length;
    const hits = list.filter((x) => x.hit).length;
    const winRate = trades ? hits / trades : 0;
    const avgReturn = trades ? list.reduce((s, x) => s + (x.realizedReturnPct ?? 0), 0) / trades : 0;
    return { trades, winRate, avgReturn };
  },
  /** Suggested confidence modifier (0.7..1.15) based on track record + sample size */
  confidenceModifier(): number {
    const { winRate, trades } = this.performance();
    if (trades < 5) return 1;
    return Math.max(0.7, Math.min(1.15, 0.85 + winRate * 0.4));
  },

  trackGenesisQuestion() {
    const p = this.getProfile();
    p.genesisQuestionsAsked = (p.genesisQuestionsAsked ?? 0) + 1;
    p.lastGenesisTs = Date.now();
    p.lastSeen = Date.now();
    safeWrite(K_PROFILE, p);
  },

  setResponseStyle(style: "brief" | "detailed") {
    const p = this.getProfile();
    p.responseStyle = style;
    safeWrite(K_PROFILE, p);
  },

  setPreferredMarkets(markets: string[]) {
    const p = this.getProfile();
    p.preferredMarkets = markets.slice(0, 6);
    safeWrite(K_PROFILE, p);
  },

  clear() {
    safeWrite(K_PROFILE, DEFAULT_PROFILE);
    safeWrite(K_HISTORY, []);
  },
};
