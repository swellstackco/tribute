import { loadConfig, assertConfig } from "../config.js";
import { createServices } from "../services.js";
import { seedExamples } from "../examples.js";

// Seed the three examples. Use LLM_PROVIDER=mock to keep it free (the plans are still built from live Qloo data).
const config = loadConfig();
assertConfig(config);
const sv = createServices(config);
const ids = await seedExamples(sv);
for (const [slug, id] of Object.entries(ids)) console.log(`${slug.padEnd(6)} ${id}`);
console.log(`mode: qloo=${config.qlooMode} llm=${config.llmProvider}`);
