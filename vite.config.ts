import { defineConfig, loadEnv } from "vite";
import { createApiHandler } from "./server/api";

export default defineConfig(({ mode }) => {
  // Only server code receives these values. Never expose them using VITE_ or define.
  const env = loadEnv(mode, process.cwd(), "OPENAI_");
  const handle = createApiHandler({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL });
  return { plugins: [{ name: "firebird-api", configureServer(server) {
    server.middlewares.use((req, res, next) => { void handle(req, res).then((handled) => { if (!handled) next(); }).catch(next); });
  } }] };
});
