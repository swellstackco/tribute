import { loadConfig, assertConfig } from "./config.js";
import { createApp } from "./app.js";

const config = loadConfig();
assertConfig(config);
const app = createApp(config);
app.listen(config.port, "127.0.0.1", () => {
  console.log(`tribute listening on 127.0.0.1:${config.port} qloo=${config.qlooMode} llm=${config.llmProvider}`);
});
