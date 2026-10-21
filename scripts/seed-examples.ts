import { loadConfig, assertConfig } from "../src/server/config.js";
import { createServices } from "../src/server/services.js";
import { seedExamples } from "../src/server/examples.js";

const config = loadConfig();
assertConfig(config);
const sv = createServices(config);
const ids = await seedExamples(sv);
for (const [slug, id] of Object.entries(ids)) console.log(`${slug.padEnd(6)} ${id}`);
console.log(`mode: qloo=${config.qlooMode} llm=${config.llmProvider}`);
