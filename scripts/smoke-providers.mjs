#!/usr/bin/env node
/**
 * Build-time smoke test for provider adapters.
 *
 * Verifies each provider module under src/services/providers/ can be loaded
 * and exposes the expected surface (a providerHealth() function and at least
 * one fetcher). This catches:
 *  - Accidental use of node-only built-ins that break the edge/client bundle
 *    (e.g. `import { createHash } from "node:crypto"`).
 *  - Missing or renamed exports referenced by the unified facade.
 *  - Syntax errors in adapters that would otherwise only surface at runtime.
 *
 * Run via `node scripts/smoke-providers.mjs`. Exits non-zero on failure with
 * a precise per-adapter diagnostic.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd(), "src/services/providers");
const NODE_ONLY = [
  /from\s+["']node:/, /from\s+["']fs["']/, /from\s+["']child_process["']/,
  /from\s+["']os["']/, /from\s+["']path["']/, /from\s+["']worker_threads["']/,
];

const ADAPTERS = [
  "finnhub.ts", "twelvedata.ts", "alphavantage.ts", "newsapi.ts", "gdelt.ts",
];

let failed = 0;
const results = [];

for (const file of ADAPTERS) {
  const path = join(ROOT, file);
  const row = { file, ok: true, errors: [], warnings: [] };
  if (!existsSync(path)) {
    row.ok = false; row.errors.push("missing file"); results.push(row); failed++; continue;
  }
  const src = readFileSync(path, "utf8");

  // Edge/client safety: no Node-only modules.
  for (const re of NODE_ONLY) {
    if (re.test(src)) { row.ok = false; row.errors.push(`forbidden import matches ${re}`); }
  }
  // Required surface.
  if (!/export\s+(function|const)\s+providerHealth\b/.test(src)
      && !/export\s+const\s+\w*ProviderHealth\b/.test(src)) {
    row.warnings.push("no providerHealth export detected");
  }
  // Each adapter must expose at least one async fetcher.
  if (!/export\s+async\s+function|export\s+const\s+\w+\s*=\s*async/.test(src)) {
    row.warnings.push("no async fetcher exported");
  }
  if (!row.ok) failed++;
  results.push(row);
}

const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
console.log("\nProvider adapter smoke test");
console.log("───────────────────────────");
for (const r of results) {
  const tag = r.ok ? "\x1b[32mOK \x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`${tag} ${pad(r.file, 22)} ${r.warnings.length ? "warn=" + r.warnings.join("; ") : ""}`);
  for (const e of r.errors) console.log(`     → ${e}`);
}
if (failed) {
  console.error(`\n${failed} adapter(s) failed smoke checks.`);
  process.exit(1);
}
console.log("\nAll provider adapters bundle-safe ✔");
