// Binance REST connector — signed requests, server-side only.
import { createHmac } from "crypto";

export type BinanceMode = "testnet" | "live";

const BASE: Record<BinanceMode, string> = {
  testnet: "https://testnet.binance.vision",
  live: "https://api.binance.com",
};

export interface BinanceCreds { apiKey: string; apiSecret: string; }

export class BinanceClient {
  private readonly base: string;
  constructor(private readonly creds: BinanceCreds, public readonly mode: BinanceMode = "testnet") {
    this.base = BASE[mode];
  }

  private sign(query: string): string {
    return createHmac("sha256", this.creds.apiSecret).update(query).digest("hex");
  }

  async signedRequest<T = unknown>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    params: Record<string, string | number | undefined> = {},
    attempt = 0,
  ): Promise<T> {
    const ts = Date.now();
    const filtered = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string | number][];
    const qp = new URLSearchParams([...filtered.map(([k, v]) => [k, String(v)] as [string, string]), ["timestamp", String(ts)], ["recvWindow", "5000"]]);
    const sig = this.sign(qp.toString());
    qp.set("signature", sig);
    const url = `${this.base}${path}?${qp.toString()}`;
    const res = await fetch(url, {
      method,
      headers: { "X-MBX-APIKEY": this.creds.apiKey, "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (res.status === 429 || res.status === 418) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        return this.signedRequest(method, path, params, attempt + 1);
      }
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Binance ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  publicRequest<T = unknown>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const qp = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
    return fetch(`${this.base}${path}?${qp.toString()}`).then((r) => {
      if (!r.ok) throw new Error(`Binance public ${r.status}`);
      return r.json() as Promise<T>;
    });
  }
}
