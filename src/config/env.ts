// Centralized environment configuration.
// Third-party paid API keys (Finnhub, NewsAPI) are NOT exposed to the
// client bundle. The corresponding services use keyless public APIs
// (CoinGecko) or fall back to synthetic data.

export const env = {
  COINGECKO_API:
    (import.meta.env.VITE_COINGECKO_API as string | undefined) ??
    "https://api.coingecko.com/api/v3",
} as const;

// Retained as named exports so legacy callers still type-check.
// Always return false on the client — secrets must never live in VITE_*.
export const hasFinnhub = () => false;
export const hasNewsApi = () => false;

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
