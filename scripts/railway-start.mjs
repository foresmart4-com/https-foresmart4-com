import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";

const host = "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const root = resolve(process.cwd());
const clientDir = resolve(root, "dist/client");
const serverEntry = resolve(root, "dist/server/index.js");

if (!existsSync(serverEntry)) {
  throw new Error("Missing dist/server/index.js. Run the build command before starting.");
}

const workerModule = await import(pathToFileURL(serverEntry).href);
const worker = workerModule.default ?? workerModule;

if (typeof worker.fetch !== "function") {
  throw new Error("dist/server/index.js must export a default object with a fetch(request, env, ctx) handler.");
}

// Startup env diagnostics — logs boolean presence only, never key values.
console.info(
  "[railway-start] AI env: hasGeminiKey=%s hasLovableKey=%s hasOpenAIKey=%s aiDisabled=%s",
  Boolean(process.env.GEMINI_API_KEY?.trim()),
  Boolean(process.env.LOVABLE_API_KEY?.trim()),
  Boolean(process.env.OPENAI_API_KEY?.trim()),
  process.env.AI_DISABLED === "true",
);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function staticResponse(pathname, method) {
  if (!existsSync(clientDir)) return null;

  const decoded = decodeURIComponent(pathname);
  const relativePath = normalize(decoded).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
  const filePath = resolve(join(clientDir, relativePath));

  if (!filePath.startsWith(clientDir + "/") && filePath !== clientDir) return null;
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return null;

  const headers = {
    "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream",
  };

  if (relativePath.startsWith("assets/")) {
    headers["cache-control"] = "public, max-age=31536000, immutable";
  }

  if (method === "HEAD") return new Response(null, { headers });

  return new Response(Readable.toWeb(createReadStream(filePath)), { headers });
}

function requestUrl(req) {
  const proto = req.headers["x-forwarded-proto"] ?? "http";
  const hostHeader = req.headers.host ?? `localhost:${port}`;
  return `${proto}://${hostHeader}${req.url ?? "/"}`;
}

function toFetchRequest(req) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value != null) {
      headers.set(name, value);
    }
  }

  const init = {
    method: req.method,
    headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = Readable.toWeb(req);
    init.duplex = "half";
  }

  return new Request(requestUrl(req), init);
}

async function writeNodeResponse(res, fetchResponse) {
  res.statusCode = fetchResponse.status;
  res.statusMessage = fetchResponse.statusText;
  fetchResponse.headers.forEach((value, key) => res.setHeader(key, value));

  if (!fetchResponse.body) {
    res.end();
    return;
  }

  Readable.fromWeb(fetchResponse.body).pipe(res);
}

const ctx = {
  waitUntil(promise) {
    Promise.resolve(promise).catch((error) => console.error("waitUntil failed", error));
  },
  passThroughOnException() {},
};

createServer(async (req, res) => {
  try {
    const url = new URL(requestUrl(req));
    console.log("[railway-request]", req.method, req.url);

    if (url.pathname === "/api/ping") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.setHeader("cache-control", "no-store");
      res.end(JSON.stringify({
        ok: true,
        source: "railway-start-direct",
        apiRouting: true,
        commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? "unknown",
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    const asset = staticResponse(url.pathname, req.method ?? "GET");
    const response = asset ?? await worker.fetch(toFetchRequest(req), process.env, ctx);
    await writeNodeResponse(res, response);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Internal Server Error");
  }
}).listen(port, host, () => {
  console.log(`Railway server listening on http://${host}:${port}`);
});
