import type { NormalizedQuote, MarketConnector } from "./types";
import { forexConnector } from "./forexConnector";
import { stocksConnector } from "./stocksConnector";
import { goldConnector } from "./goldConnector";
import { indicesConnector, oilConnector } from "./indicesConnector";

export const ALL_CONNECTORS: MarketConnector[] = [
  forexConnector, stocksConnector, goldConnector, indicesConnector, oilConnector,
];

export async function aggregateMarkets(): Promise<{
  quotes: NormalizedQuote[];
  latencyMs: number;
  byClass: Record<string, number>;
}> {
  const t0 = Date.now();
  const results = await Promise.allSettled(ALL_CONNECTORS.map((c) => c.fetchQuotes([])));
  const quotes: NormalizedQuote[] = [];
  for (const r of results) if (r.status === "fulfilled") quotes.push(...r.value);
  const byClass: Record<string, number> = {};
  for (const q of quotes) byClass[q.assetClass] = (byClass[q.assetClass] ?? 0) + 1;
  return { quotes, latencyMs: Date.now() - t0, byClass };
}

export * from "./types";
