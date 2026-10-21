import fs from "node:fs";
import path from "node:path";

const envFile = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envFile)) {
  try { process.loadEnvFile(envFile); } catch { /* ignore */ }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const qlooMode = env.QLOO_MODE === "live" ? "live" : "mock";
  const llm = (env.LLM_PROVIDER || "mock") as "mock" | "anthropic";
  return {
    port: Number(env.PORT || 5117),
    qlooMode: qlooMode as "mock" | "live",
    qlooKey: env.QLOO_API_KEY || "",
    qlooBase: env.QLOO_BASE_URL || "https://hackathon.api.qloo.com",
    llmProvider: llm,
    anthropicKey: env.ANTHROPIC_API_KEY || "",
    llmModel: env.LLM_MODEL || "claude-haiku-5-5",
    spendCap: Number(env.LLM_SPEND_CAP_USD || 4),
    rateSalt: env.RATE_SALT || "dev-salt",
    dbPath: env.DB_PATH || "data/tribute.db",
  };
}
export type Config = ReturnType<typeof loadConfig>;

export function assertConfig(c: Config) {
  if (c.qlooMode === "live" && !c.qlooKey) throw new Error("QLOO_MODE=live requires QLOO_API_KEY");
  if (c.llmProvider === "anthropic" && !c.anthropicKey) throw new Error("LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY");
}
