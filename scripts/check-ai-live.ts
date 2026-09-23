import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { createAiExplainer } from "../server/ai-explanations";
import { recommend } from "../src/core/index";
import { smartExamples } from "../src/data/smart-examples";

if (existsSync(".env")) loadEnvFile(".env");
if (!process.env.OPENAI_API_KEY) {
  console.error("OpenAI key is not configured. Add OPENAI_API_KEY to local .env; never send it in chat.");
  process.exitCode = 2;
} else {
  const request = smartExamples[0].request;
  const baseline = await recommend(request);
  const result = await createAiExplainer({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL })(request, baseline);
  console.log(JSON.stringify({ ai: result.ai, cards: result.cards.map(c => ({ id: c.id, explanation: c.explanation, evidence: c.aiEvidence })) }, null, 2));
  if (result.ai?.mode !== "openai") process.exitCode = 1;
}
