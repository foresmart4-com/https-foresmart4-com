import type { GeoEvent, RawSignal, Bias, Severity } from "./types";

const KINDS: Array<{ match: RegExp; kind: GeoEvent["kind"]; impact: Bias; affected: string[] }> = [
  { match: /sanction|embargo/i, kind: "sanctions", impact: "bullish", affected: ["oil", "gold", "defense"] },
  { match: /opec|output cut|production/i, kind: "opec", impact: "bullish", affected: ["oil", "wti", "energy"] },
  { match: /election|poll|vote/i, kind: "election", impact: "neutral", affected: ["fx", "equities"] },
  { match: /tariff|trade war|trade conflict/i, kind: "trade", impact: "bearish", affected: ["equities", "industrials"] },
  { match: /war|missile|attack|conflict/i, kind: "war", impact: "bullish", affected: ["gold", "oil", "defense"] },
  { match: /central bank|governor|fed|ecb|boe/i, kind: "cb_speech", impact: "neutral", affected: ["usd", "bonds"] },
  { match: /protest|coup|instability|unrest/i, kind: "instability", impact: "bearish", affected: ["fx", "em"] },
];

function severityFromScore(s: number): Severity {
  if (s >= 0.85) return "critical";
  if (s >= 0.6) return "high";
  if (s >= 0.3) return "medium";
  return "low";
}

export function processGeopolitical(signals: RawSignal[]): GeoEvent[] {
  const geo = signals.filter((s) => s.category === "geopolitical" || s.category === "news");
  const out: GeoEvent[] = [];
  for (const s of geo) {
    const matched = KINDS.find((k) => k.match.test(s.title));
    if (!matched) continue;
    const polarity = Number(s.payload?.polarity ?? 0);
    const score = Math.min(1, Math.abs(polarity) * 0.6 + s.reliability * 0.4);
    out.push({
      id: `${s.source}-${s.ts}-${out.length}`,
      kind: matched.kind,
      region: s.region ?? "GLOBAL",
      headline: s.title,
      severity: severityFromScore(score),
      marketImpact: matched.impact,
      affected: matched.affected,
      confidence: Math.min(0.95, 0.5 + score * 0.4),
      ts: s.ts,
    });
  }
  return out.slice(0, 24);
}
