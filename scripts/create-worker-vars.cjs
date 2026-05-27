/**
 * postbuild helper — writes dist/server/.dev.vars from Railway / host environment.
 *
 * Cloudflare Workers (workerd/Miniflare) expose environment bindings via
 * process.env when the `nodejs_compat` flag is set.  Bindings are sourced
 * from the .dev.vars file that sits next to dist/server/wrangler.json.
 *
 * Without this file the worker has NO bindings, so every process.env.*
 * call returns undefined — causing the AI gateway to return "missing_key"
 * and all AI features to be unavailable.
 *
 * This script runs after `vite build` (via the `postbuild` npm script) and
 * captures the current process.env values for every known server-side secret.
 * It writes ONLY non-empty values so missing optional vars don't pollute the
 * file.  Client-facing VITE_* variables are intentionally excluded — they are
 * already baked into the client bundle at build time.
 *
 * Safe to commit: no secret values are stored here.  The generated file lives
 * under dist/ (git-ignored) and is recreated on every Railway deploy.
 */

"use strict";

const fs = require("fs");
const path = require("path");

// Server-side secrets accessed via process.env in server functions.
// Keep this list in sync with actual process.env.* usages in src/lib/*.ts
// and src/routes/**/*.ts.  Order does not matter.
const SERVER_VARS = [
  // AI provider — primary (direct Gemini API) takes priority over fallback gateway
  "GEMINI_API_KEY",
  // AI gateway — fallback when GEMINI_API_KEY is absent; also used for Lovable platform webhooks
  "LOVABLE_API_KEY",

  // Supabase server-side
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",

  // Encryption / vault
  "VAULT_MASTER_KEY",

  // Email
  "RESEND_API_KEY",

  // Market data providers
  "FINNHUB_API_KEY",
  "ALPHAVANTAGE_API_KEY",
  "TWELVEDATA_API_KEY",
  "NEWSAPI_KEY",

  // Payment webhooks
  "LEMONSQUEEZY_WEBHOOK_SECRET",
  "MOYASAR_WEBHOOK_SECRET",
  "MOYASAR_SECRET_KEY",
  "PADDLE_WEBHOOK_SECRET",
  "PAYPAL_WEBHOOK_ID",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",

  // Brokers
  "ALPACA_API_KEY",
  "ALPACA_SECRET_KEY",

  // Observability
  "OBSERVABILITY_CRON_SECRET",
];

const outDir = path.join(__dirname, "..", "dist", "server");
const outFile = path.join(outDir, ".dev.vars");

if (!fs.existsSync(outDir)) {
  console.log("[create-worker-vars] dist/server not found — skipping");
  process.exit(0);
}

const lines = [];
for (const key of SERVER_VARS) {
  const val = process.env[key];
  if (!val) continue;
  // Escape double-quotes inside the value; dotenv parse handles the rest.
  const escaped = val.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  lines.push(`${key}="${escaped}"`);
}

const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());
const hasLovableKey = Boolean(process.env.LOVABLE_API_KEY?.trim());
console.log(`[create-worker-vars] AI env at build time: hasGeminiKey=${hasGeminiKey} hasLovableKey=${hasLovableKey}`);

if (!hasGeminiKey && !hasLovableKey) {
  console.warn("[create-worker-vars] WARNING: Neither GEMINI_API_KEY nor LOVABLE_API_KEY found in build env — Miniflare/preview will have no AI provider.");
}

if (lines.length === 0) {
  console.log("[create-worker-vars] No server env vars found — .dev.vars not written");
  console.log("[create-worker-vars] AI runtime will be unavailable until GEMINI_API_KEY (primary) or LOVABLE_API_KEY (fallback) is set in Railway");
} else {
  fs.writeFileSync(outFile, lines.join("\n") + "\n", "utf8");
  const listed = lines.map((l) => l.split("=")[0]);
  console.log(`[create-worker-vars] Wrote ${lines.length} binding(s) to dist/server/.dev.vars: ${listed.join(", ")}`);
}
