/**
 * Server route: /api/finnhub/stream?symbols=AAPL,BTCUSDT
 *
 * Opens an outbound WebSocket to wss://ws.finnhub.io server-side (Cloudflare Worker)
 * and pipes trade ticks to the client over Server-Sent Events.
 *
 * SECURITY:
 *  - FINNHUB_API_KEY is read from process.env (server only) and never sent to the client
 *  - This route lives under /api/ (not /api/public/) so it's behind app auth on prod;
 *    we additionally enforce auth via Supabase claims here.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/finnhub/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Auth check
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });
        const { data: claims, error } = await supabaseAdmin.auth.getClaims(token);
        if (error || !claims) return new Response("Unauthorized", { status: 401 });

        const key = process.env.FINNHUB_API_KEY;
        if (!key) return new Response("FINNHUB_API_KEY not configured", { status: 503 });

        const url = new URL(request.url);
        const raw = url.searchParams.get("symbols") ?? "";
        const symbols = raw
          .split(",")
          .map((s) => s.trim())
          .filter((s) => /^[A-Za-z0-9.:_-]+$/.test(s))
          .slice(0, 25);
        if (symbols.length === 0) return new Response("symbols query required", { status: 400 });

        // Open outbound WebSocket from the Worker (fetch upgrade pattern)
        const upstream = await fetch(`https://ws.finnhub.io?token=${encodeURIComponent(key)}`, {
          headers: { Upgrade: "websocket" },
        });
        // @ts-expect-error workerd-specific
        const ws: WebSocket | undefined = upstream.webSocket;
        if (!ws) return new Response("WS upgrade failed", { status: 502 });
        // @ts-expect-error workerd-specific accept()
        ws.accept();

        const encoder = new TextEncoder();
        let pingTimer: ReturnType<typeof setInterval> | null = null;

        const stream = new ReadableStream({
          start(controller) {
            const send = (event: string, data: unknown) => {
              try {
                controller.enqueue(encoder.encode(`event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`));
              } catch {
                /* closed */
              }
            };

            send("ready", { symbols, ts: Date.now() });
            for (const s of symbols) {
              try { ws.send(JSON.stringify({ type: "subscribe", symbol: s })); } catch { /* ignore */ }
            }

            ws.addEventListener("message", (ev: MessageEvent) => {
              try {
                const msg = typeof ev.data === "string" ? JSON.parse(ev.data) : null;
                if (!msg) return;
                if (msg.type === "trade" && Array.isArray(msg.data)) {
                  send("trade", msg.data.map((t: { s: string; p: number; t: number; v: number }) => ({
                    s: t.s, p: t.p, t: t.t, v: t.v,
                  })));
                } else if (msg.type === "ping") {
                  send("ping", { ts: Date.now() });
                }
              } catch { /* swallow */ }
            });
            ws.addEventListener("close", () => {
              send("close", { ts: Date.now() });
              if (pingTimer) clearInterval(pingTimer);
              try { controller.close(); } catch { /* ignore */ }
            });
            ws.addEventListener("error", () => {
              send("error", { ts: Date.now() });
            });

            // Keep-alive SSE comment every 25s
            pingTimer = setInterval(() => {
              try { controller.enqueue(encoder.encode(`: keep-alive ${Date.now()}\n\n`)); } catch { /* ignore */ }
            }, 25_000);
          },
          cancel() {
            if (pingTimer) clearInterval(pingTimer);
            try {
              for (const s of symbols) ws.send(JSON.stringify({ type: "unsubscribe", symbol: s }));
              // @ts-expect-error workerd close()
              ws.close();
            } catch { /* ignore */ }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
