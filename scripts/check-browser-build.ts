import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";
import demos from "../src/data/demo-queries.json";

// Compile the core independently: UI entry files are owned by participant B.
const directory = await mkdtemp(join(tmpdir(), "firebird-core-build-"));
const result = await build({
  configFile: false,
  logLevel: "warn",
  build: {
    outDir: directory,
    emptyOutDir: false,
    lib: { entry: fileURLToPath(new URL("../src/core/index.ts", import.meta.url)), formats: ["es"], fileName: () => "core.mjs" },
    minify: false,
    sourcemap: false,
  },
});
for (const output of Array.isArray(result) ? result : [result]) {
  if (!("output" in output)) throw new Error("Unexpected Vite output");
  for (const chunk of output.output) {
    if (chunk.type === "chunk") {
      assert.deepEqual(chunk.imports, []);
      assert.deepEqual(chunk.dynamicImports, []);
      assert.ok(!chunk.code.includes("node:") && !chunk.code.includes("csv-parse"));
    }
  }
}
const bundle = await import(pathToFileURL(join(directory, "core.mjs")).href);
for (const scenario of demos.scenarios) {
  const result = await bundle.recommend(scenario.request);
  assert.equal(result.status, scenario.expected.status);
  assert.deepEqual(result.cards.map((card: { id: string }) => card.id), scenario.expected.ids);
}
console.log("Browser ES module built without Node/CSV imports; all 8 bundled demo scenarios passed.");
