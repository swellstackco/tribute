import { loadConfig, assertConfig } from "./config.js";
import { createApp } from "./app.js";
import { missingExamples, seedExamples } from "./examples.js";
import { createServices } from "./services.js";

const config = loadConfig();
assertConfig(config);
const app = createApp(config);
// In mock mode the examples are free, so build any that are missing. In live mode run `npm run seed:examples`.
if (config.qlooMode === "mock" && config.llmProvider === "mock") {
  const missing = missingExamples(app.services);
  if (missing.length) await seedExamples(app.services, missing);
} else if (config.qlooMode === "mock" && missingExamples(app.services).length) {
  // Mock Qloo with a live model: seed the examples with the free planner so startup never spends money.
  const free = createServices({ ...config, llmProvider: "mock" }, { db: app.services.db });
  await seedExamples(free, missingExamples(free));
}
app.listen(config.port, "127.0.0.1", () => {
  console.log(`tribute listening on 127.0.0.1:${config.port} qloo=${config.qlooMode} llm=${config.llmProvider}`);
});
