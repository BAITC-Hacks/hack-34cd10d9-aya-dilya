import type { IncomingMessage, ServerResponse } from "node:http";
import { recommend } from "../src/core/index";
import { validateRequest } from "../src/core/validate-request";
import { RequestValidationError } from "../src/shared/contracts";
import { createAiExplainer, type AiConfig } from "./ai-explanations";

export function createApiHandler(config: AiConfig = {}) {
  const explain = createAiExplainer(config);
  const rates = new Map<string, { count: number; until: number }>();
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    if (req.url?.split("?")[0] !== "/api/recommend") return false;
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end(JSON.stringify(body));
    };
    if (req.method !== "POST") { send(405, { code: "METHOD_NOT_ALLOWED" }); return true; }
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host) { send(403, { code: "FORBIDDEN_ORIGIN" }); return true; }
      } catch { send(403, { code: "FORBIDDEN_ORIGIN" }); return true; }
    }
    if (!req.headers["content-type"]?.startsWith("application/json")) { send(415, { code: "JSON_REQUIRED" }); return true; }
    const now = Date.now();
    for (const [key, item] of rates) if (item.until < now) rates.delete(key);
    const address = req.socket.remoteAddress ?? "local";
    const rate = rates.get(address) ?? { count: 0, until: now + 60_000 };
    rates.set(address, rate);
    if (++rate.count > 30) { send(429, { code: "RATE_LIMITED" }); return true; }
    try {
      const chunks: Buffer[] = []; let length = 0;
      for await (const chunk of req) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        length += bytes.length;
        if (length > 8192) { send(413, { code: "REQUEST_TOO_LARGE" }); return true; }
        chunks.push(bytes);
      }
      let input: unknown;
      try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
      catch { send(400, { code: "INVALID_JSON" }); return true; }
      const request = validateRequest(input);
      const result = await recommend(request);
      send(200, await explain(request, result));
    } catch (error) {
      if (error instanceof RequestValidationError) send(400, { code: error.code, issues: error.issues });
      else send(500, { code: "SERVICE_ERROR", message: "Не удалось выполнить подбор." });
    }
    return true;
  };
}
