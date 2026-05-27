/**
 * Production route smoke test.
 * Verifies SSR responses do not contain runtime error patterns.
 * Exit code 0 = all pass, 1 = failure found.
 *
 * Usage: PORT=4174 node scripts/smoke-production-routes.mjs
 */

const PORT = process.env.PORT ?? 4174;
const BASE = `http://localhost:${PORT}`;

const PAGE_ROUTES = [
  "/ai-dashboard",
  "/data-fusion",
  "/global-intel",
  "/calendar",
  "/signals",
  "/provider-health",
  "/market-data-monitor",
  "/ai-learning",
  "/heatmap",
  "/dashboard",
  "/alerts",
  "/portfolios",
  "/genesis-100",
  "/subscription",
  "/profile",
  "/settings",
  "/archive",
  "/watchlists",
];

const API_ROUTES = [
  "/api/ping",
  "/api/public/full-site-health",
  "/api/public/provider-health-full",
  "/api/public/intelligence-health",
];

const ERROR_PATTERNS = [
  "Something went wrong",
  "Cannot read properties",
  "is not a function",
  "is not iterable",
  "No provider available for crypto",
  "\\u062",
  "\\u063",
  "\\u064",
];

let failures = 0;

async function testRoute(route, expectJson = false) {
  try {
    const res = await fetch(`${BASE}${route}`, { redirect: "follow" });
    const body = await res.text();

    if (res.status >= 500) {
      console.error(`  FAIL ${res.status} ${route}`);
      failures++;
      return;
    }

    for (const pattern of ERROR_PATTERNS) {
      if (body.includes(pattern)) {
        console.error(`  FAIL ${route} — contains "${pattern}"`);
        failures++;
        return;
      }
    }

    if (expectJson) {
      try {
        const json = JSON.parse(body);
        if (!json.ok && !json.product) {
          console.error(`  WARN ${route} — JSON missing ok/product field`);
        }
      } catch {
        console.error(`  FAIL ${route} — expected JSON, got HTML/text`);
        failures++;
        return;
      }
    }

    console.log(`  PASS ${res.status} ${route}`);
  } catch (err) {
    console.error(`  FAIL ${route} — ${err.message}`);
    failures++;
  }
}

async function run() {
  console.log(`\nSmoke testing ${BASE}...\n`);
  console.log("=== Page Routes ===");
  for (const r of PAGE_ROUTES) await testRoute(r);
  console.log("\n=== API Routes ===");
  for (const r of API_ROUTES) await testRoute(r, true);

  console.log(`\n${"=".repeat(40)}`);
  if (failures > 0) {
    console.error(`FAILED: ${failures} route(s) have runtime errors.`);
    process.exit(1);
  } else {
    console.log(`ALL PASS: ${PAGE_ROUTES.length + API_ROUTES.length} routes verified.`);
    process.exit(0);
  }
}

run();
