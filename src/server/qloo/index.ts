import type { Config } from "../config.js";
import type { Db } from "../db.js";
import { SqliteQlooCache } from "./cache.js";
import { MockQlooClient } from "./mock.js";
import { RealQlooClient } from "./real.js";
import type { QlooClient } from "./types.js";

export function createQlooClient(config: Config, db: Db): QlooClient {
  if (config.qlooMode === "live") {
    return new RealQlooClient({ baseUrl: config.qlooBase, apiKey: config.qlooKey, cache: new SqliteQlooCache(db) });
  }
  return new MockQlooClient();
}
