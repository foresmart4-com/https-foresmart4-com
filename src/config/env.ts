// Centralized environment configuration for client-side API keys.
// All keys are optional — services fall back to local intelligence when missing.

export const env = {
  FINNHUB_API_KEY: import.meta.env.VITE_FINNHUB_API_KEY as string | undefined,
  COINGECKO_API: (import.meta.env.VITE_COINGECKO_API as string | undefined) ?? "https://api.coingecko.com/api/v3",
  NEWS_API_KEY: import.meta.env.VITE_NEWS_API_KEY as string | undefined,
  // AI text analysis is routed through the Lovable AI gateway via server
  // functions; no AI provider key is ever read on the client.

} as const;

export const hasFinnhub = () => Boolean(env.FINNHUB_API_KEY);
export const hasNewsApi = () => Boolean(env.NEWS_API_KEY);

// Generic timed fetch with retry + JSON parse. Throws on non-2xx after retries.
export async function fetchJson<T>(
  url: string,
  opts: { retries?: number; timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  const { retries = 2, timeoutMs = 8000, headers } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
}
