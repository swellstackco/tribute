import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type Db = Database.Database;

export function openDb(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY, created_at INTEGER, input_hash TEXT, status TEXT, mode TEXT, provider TEXT,
      ip_hash TEXT, spend_usd REAL DEFAULT 0, plan TEXT, trace TEXT, answered_question TEXT
    );
    CREATE INDEX IF NOT EXISTS runs_hash ON runs(input_hash);
    CREATE TABLE IF NOT EXISTS qloo_cache (key TEXT PRIMARY KEY, body TEXT, fetched_at INTEGER, status_code INTEGER);
    CREATE TABLE IF NOT EXISTS llm_cache (key TEXT PRIMARY KEY, body TEXT, usage TEXT, created_at INTEGER);
    CREATE TABLE IF NOT EXISTS spend (id INTEGER PRIMARY KEY AUTOINCREMENT, provider TEXT, model TEXT,
      input_tokens INTEGER, output_tokens INTEGER, usd REAL, created_at INTEGER);
    CREATE TABLE IF NOT EXISTS rate (ip_hash TEXT, window_start INTEGER, count INTEGER, PRIMARY KEY (ip_hash, window_start));
    CREATE TABLE IF NOT EXISTS examples (slug TEXT PRIMARY KEY, run_id TEXT);
  `);
  return db;
}
