import crypto from "node:crypto";
import type { Db } from "../db.js";

export interface QlooCache {
  get(key: string): unknown | undefined;
  set(key: string, body: unknown, status: number): void;
  size(): number;
}

export const cacheKey = (path: string, sortedQuery: string) =>
  crypto.createHash("sha256").update(`${path}?${sortedQuery}`).digest("hex");

export class SqliteQlooCache implements QlooCache {
  constructor(private db: Db) {}
  get(key: string) {
    const row = this.db.prepare("SELECT body FROM qloo_cache WHERE key = ? AND status_code = 200").get(key) as { body: string } | undefined;
    return row ? JSON.parse(row.body) : undefined;
  }
  set(key: string, body: unknown, status: number) {
    if (status !== 200) return; // cache-through on 200 only
    this.db.prepare("INSERT OR REPLACE INTO qloo_cache (key, body, fetched_at, status_code) VALUES (?,?,?,?)")
      .run(key, JSON.stringify(body), Date.now(), status);
  }
  size() {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM qloo_cache").get() as { n: number }).n;
  }
}
