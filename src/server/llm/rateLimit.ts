import crypto from "node:crypto";
import type { Db } from "../db.js";

export interface RateOptions { perHour: number; perDay: number; globalDay: number; now?: () => number }
export const DEFAULT_RATE: RateOptions = { perHour: 6, perDay: 30, globalDay: 400 };

export interface RateVerdict { ok: boolean; retryAfterSec?: number; message?: string }

/** Per-IP and global limits. IPs are HMAC-hashed with RATE_SALT; raw IPs are never stored. */
export class RateLimiter {
  private o: RateOptions;
  constructor(private db: Db, private salt: string, o: Partial<RateOptions> = {}) { this.o = { ...DEFAULT_RATE, ...o }; }
  hash(ip: string) { return crypto.createHmac("sha256", this.salt).update(ip).digest("hex").slice(0, 32); }

  private count(key: string, windowStart: number) {
    const r = this.db.prepare("SELECT count FROM rate WHERE ip_hash = ? AND window_start = ?").get(key, windowStart) as { count: number } | undefined;
    return r?.count ?? 0;
  }
  private bump(key: string, windowStart: number) {
    this.db.prepare("INSERT INTO rate (ip_hash, window_start, count) VALUES (?,?,1) ON CONFLICT(ip_hash, window_start) DO UPDATE SET count = count + 1").run(key, windowStart);
  }

  /** Checks and, when allowed, counts one run. */
  take(ip: string): RateVerdict {
    const now = Math.floor((this.o.now?.() ?? Date.now()) / 1000);
    const h = now - (now % 3600), d = now - (now % 86400);
    const id = this.hash(ip);
    const kh = `${id}:h`, kd = `${id}:d`, kg = "global:d";
    if (this.count(kg, d) >= this.o.globalDay)
      return { ok: false, retryAfterSec: d + 86400 - now, message: "Tribute is very busy today. Please come back tomorrow, or try one of the examples." };
    if (this.count(kh, h) >= this.o.perHour)
      return { ok: false, retryAfterSec: h + 3600 - now, message: "That is a lot of tributes this hour. Please wait a little while, or open one of the examples." };
    if (this.count(kd, d) >= this.o.perDay)
      return { ok: false, retryAfterSec: d + 86400 - now, message: "That is enough for today. Please come back tomorrow." };
    this.bump(kh, h); this.bump(kd, d); this.bump(kg, d);
    return { ok: true };
  }
}
