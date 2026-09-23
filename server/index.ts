import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { resolve, extname, sep } from "node:path";
import { createApiHandler } from "./api";

if (existsSync(".env")) loadEnvFile(".env");
const handle = createApiHandler({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL });
const dist = resolve("dist");
const mime: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer(async (req, res) => {
  if (req.url === "/healthz" && (req.method === "GET" || req.method === "HEAD")) {
    const ready = existsSync(resolve(dist, "index.html"));
    res.writeHead(ready ? 200 : 503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : JSON.stringify({ status: ready ? "ok" : "build_missing" }));
    return;
  }
  if (await handle(req, res)) return;
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); res.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    const file = resolve(dist, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(dist + sep)) { res.writeHead(403); res.end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream", "X-Content-Type-Options": "nosniff" });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch { res.writeHead(404); res.end("Not found"); }
});
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535");
server.requestTimeout = 10_000;
server.listen(port, host, () => console.log(`Firebird: http://${host}:${port} (${process.env.OPENAI_API_KEY ? "OpenAI configured" : "local explanations"})`));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
