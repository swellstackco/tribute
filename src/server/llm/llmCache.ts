import crypto from "node:crypto";
import type { Db } from "../db.js";
import type { CompleteRequest, CompleteResult, LlmProvider } from "./provider.js";

export const llmKey = (provider: string, model: string, req: Pick<CompleteRequest, "messages" | "tools"> & { system?: string }) =>
  crypto.createHash("sha256").update(JSON.stringify([provider, model, req.system ?? "", req.messages, req.tools])).digest("hex");

export class LlmCache {
  constructor(private db: Db) {}
  get(key: string): CompleteResult | undefined {
    const row = this.db.prepare("SELECT body, usage FROM llm_cache WHERE key = ?").get(key) as { body: string; usage: string } | undefined;
    return row ? { ...JSON.parse(row.body), usage: { input_tokens: 0, output_tokens: 0 } } : undefined;
  }
  set(key: string, r: CompleteResult) {
    this.db.prepare("INSERT OR REPLACE INTO llm_cache (key, body, usage, created_at) VALUES (?,?,?,?)")
      .run(key, JSON.stringify({ text: r.text, toolCalls: r.toolCalls }), JSON.stringify(r.usage), Date.now());
  }
}

/** Outermost wrapper: a hit never reaches the provider (or the meter). */
export class CachedProvider implements LlmProvider {
  hits = 0;
  constructor(private inner: LlmProvider, private cache: LlmCache) {}
  get name() { return this.inner.name; }
  get model() { return this.inner.model; }
  async complete(req: CompleteRequest): Promise<CompleteResult> {
    const key = llmKey(this.name, this.model, req);
    const hit = this.cache.get(key);
    if (hit) { this.hits++; return hit; }
    const r = await this.inner.complete(req);
    this.cache.set(key, r);
    return r;
  }
}
