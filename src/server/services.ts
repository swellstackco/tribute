import type { Config } from "./config.js";
import { openDb, type Db } from "./db.js";
import { Orchestrator } from "./agent/orchestrator.js";
import { createQlooClient } from "./qloo/index.js";
import { RateLimiter } from "./llm/rateLimit.js";
import type { QlooClient } from "./qloo/types.js";
import type { LlmProvider } from "./llm/provider.js";
import type { Spend } from "./llm/spend.js";

export interface Services {
  config: Config;
  db: Db;
  qloo: QlooClient;
  orchestrator: Orchestrator;
  limiter: RateLimiter;
}

export function createServices(config: Config, opts: { db?: Db; qloo?: QlooClient; makeProvider?: (s: Spend) => LlmProvider | null } = {}): Services {
  const db = opts.db ?? openDb(config.dbPath);
  const qloo = opts.qloo ?? createQlooClient(config, db);
  const orchestrator = new Orchestrator({ config, db, qloo, makeProvider: opts.makeProvider });
  // Rate limits are always on.
  const limiter = new RateLimiter(db, config.rateSalt);
  return { config, db, qloo, orchestrator, limiter };
}
