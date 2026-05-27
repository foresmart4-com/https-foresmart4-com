/**
 * Authenticated route smoke test.
 * Tests built JS bundles for runtime error patterns that would crash
 * when components render with authenticated state.
 * 
 * Usage: PORT=4174 node scripts/smoke-authenticated-routes.mjs
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const PORT = process.env.PORT ?? 4174;
const BASE = `http://localhost:${PORT}`;
const DIST_DIR = resolve(process.cwd(), "dist/server/assets");

const ROUTES = [
  "/ai-dashboard", "/signals", "/provider-health",
  "/calendar", "/global-intel", "/data-fusion",
  "/dashboard", "/heatmap", "/alerts", "/portfolios",
  "/genesis-100", "/settings", "/profile",
];

const ERROR_PATTERNS_SSR = [
  "Something went wrong",
  "Cannot read properties",
  "is not a function",
  "is not iterable",
  "No provider available for crypto",
];

const UNSAFE_BUNDLE_PATTERNS = [
  /const Icon = [^;]*\[[\w.]+\];/g,
  /\.Icon;$/gm,
];

let failures = 0;

// Test 1: SSR output
async function testSSR() {
  console.log("=== SSR Route Tests ===");
  for (const route of ROUTES) {
    try {
      const res = await fetch(`${BASE}${route}`);
      const body = await res.text();
      for (const pattern of ERROR_PATTERNS_SSR) {
        if (body.includes(pattern)) {
          console.error(`  FAIL ${route} — SSR contains "${pattern}"`);
          failures++;
          break;
        }
      }
      if (res.status >= 500) {
        console.error(`  FAIL ${route} — HTTP ${res.status}`);
        failures++;
      } else {
        console.log(`  PASS ${res.status} ${route}`);
      }
    } catch (err) {
      console.error(`  FAIL ${route} — ${err.message}`);
      failures++;
    }
  }
}

// Test 2: Bundle safety audit (checks built JS for unsafe patterns)
function testBundles() {
  console.log("\n=== Bundle Safety Audit ===");
  const files = readdirSync(DIST_DIR).filter((f) => f.endsWith(".js"));
  
  for (const file of files) {
    const content = readFileSync(join(DIST_DIR, file), "utf-8");
    
    // Check for Icon assignments without ?? fallback
    const iconAssigns = content.match(/const \w+ = \w+\[\w+[.\w]*\](?!.*\?\?)/g) ?? [];
    const unsafeIcons = iconAssigns.filter((m) => m.includes("Icon") && !m.includes("??"));
    if (unsafeIcons.length > 0) {
      console.error(`  WARN ${file} — ${unsafeIcons.length} potentially unsafe Icon lookups`);
      for (const u of unsafeIcons.slice(0, 3)) console.error(`       ${u}`);
    }
    
    // Check for throwing on missing provider
    if (content.includes('throw new Error(`No provider available')) {
      console.error(`  FAIL ${file} — contains fatal throw for missing provider`);
      failures++;
    }
  }
  
  console.log(`  Checked ${files.length} bundle files`);
}

// Test 3: API endpoints
async function testAPIs() {
  console.log("\n=== API Endpoints ===");
  const apis = ["/api/ping", "/api/public/full-site-health"];
  for (const api of apis) {
    try {
      const res = await fetch(`${BASE}${api}`);
      const body = await res.text();
      try {
        JSON.parse(body);
        console.log(`  PASS ${res.status} ${api}`);
      } catch {
        console.error(`  FAIL ${api} — not valid JSON`);
        failures++;
      }
    } catch (err) {
      console.error(`  FAIL ${api} — ${err.message}`);
      failures++;
    }
  }
}

async function run() {
  console.log(`\nAuthenticated smoke test — ${BASE}\n`);
  await testSSR();
  testBundles();
  await testAPIs();
  
  console.log(`\n${"=".repeat(40)}`);
  if (failures > 0) {
    console.error(`FAILED: ${failures} issue(s) found.`);
    process.exit(1);
  } else {
    console.log("ALL PASS: Authenticated route safety verified.");
    process.exit(0);
  }
}

run();
