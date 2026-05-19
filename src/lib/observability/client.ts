// Client-side global error capture → forwards to server observability log.
// Lazy import to avoid pulling server fn code into initial bundle paths
// before hydration.
import { reportClientError } from "@/lib/observability/observability.functions";

let installed = false;
const seen = new Map<string, number>(); // throttle by message
const THROTTLE_MS = 30_000;

function shouldReport(key: string): boolean {
  const now = Date.now();
  const last = seen.get(key) ?? 0;
  if (now - last < THROTTLE_MS) return false;
  seen.set(key, now);
  return true;
}

async function send(input: {
  message: string;
  stack?: string;
  kind: "js_crash" | "unhandled_rejection" | "react_error" | "manual";
  context?: Record<string, unknown>;
}) {
  if (!shouldReport(`${input.kind}:${input.message}`)) return;
  try {
    await reportClientError({
      data: {
        message: input.message.slice(0, 2000),
        stack: input.stack?.slice(0, 8000),
        url: typeof window !== "undefined" ? window.location.href : undefined,
        kind: input.kind,
        context: input.context,
      },
    });
  } catch {
    /* swallow */
  }
}

export function installClientObservability() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (ev) => {
    const err = ev.error as Error | undefined;
    void send({
      kind: "js_crash",
      message: err?.message ?? String(ev.message ?? "Unknown error"),
      stack: err?.stack,
      context: { filename: ev.filename, lineno: ev.lineno, colno: ev.colno },
    });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = (ev as PromiseRejectionEvent).reason;
    const message = reason instanceof Error ? reason.message : String(reason ?? "rejection");
    const stack = reason instanceof Error ? reason.stack : undefined;
    void send({ kind: "unhandled_rejection", message, stack });
  });
}

export function reportManual(message: string, context?: Record<string, unknown>) {
  void send({ kind: "manual", message, context });
}
