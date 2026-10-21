import { loadConfig } from "../src/server/config.js";
import { openDb } from "../src/server/db.js";

const db = openDb(loadConfig().dbPath);
const q = db.prepare("DELETE FROM qloo_cache").run().changes;
const l = db.prepare("DELETE FROM llm_cache").run().changes;
console.log(`cleared ${q} Qloo and ${l} language model cache rows`);
