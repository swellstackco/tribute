import { checkParams, sortedQueryString, toQueryString } from "./params.js";
import { cacheKey, type QlooCache } from "./cache.js";
import { QlooError, type InsightsResult, type Params, type QlooClient, type SearchResult, type TagLookup } from "./types.js";

export interface RealOptions {
  baseUrl: string;
  apiKey: string;
  cache?: QlooCache;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
}

export class RealQlooClient implements QlooClient {
  readonly mode = "live" as const;
  private o: Required<Omit<RealOptions, "cache">> & { cache?: QlooCache };
  constructor(o: RealOptions) {
    this.o = {
      timeoutMs: 8000, retries: 2, fetchImpl: fetch,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)), ...o,
    };
  }

  /** Builds the exact URL path+query that will be sent (used by snapshot tests). */
  buildUrl(path: string, params: Params): string {
    const clean = checkParams(params);
    const qs = toQueryString(clean);
    return qs ? `${path}?${qs}` : path;
  }

  private async get(path: string, params: Params): Promise<any> {
    const clean = checkParams(params);
    const key = cacheKey(path, sortedQueryString(clean));
    const hit = this.o.cache?.get(key);
    if (hit !== undefined) return hit;
    const url = `${this.o.baseUrl}${this.buildUrl(path, clean)}`;
    let last: QlooError | undefined;
    for (let attempt = 0; attempt <= this.o.retries; attempt++) {
      if (attempt > 0) await this.o.sleep(Math.round(250 * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5)));
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), this.o.timeoutMs);
      try {
        const res = await this.o.fetchImpl(url, { headers: { "X-Api-Key": this.o.apiKey, accept: "application/json" }, signal: ctl.signal });
        if (res.status === 401 || res.status === 403) throw new QlooError("QLOO_AUTH", "Qloo rejected the key", false, res.status);
        if (res.status === 429) { last = new QlooError("QLOO_RATE_LIMIT", "Qloo rate limit", true, 429); continue; }
        if (res.status >= 500) { last = new QlooError("QLOO_UPSTREAM", `Qloo error ${res.status}`, true, res.status); continue; }
        if (res.status !== 200) throw new QlooError("QLOO_UPSTREAM", `Qloo returned ${res.status}`, false, res.status);
        const body = await res.json();
        this.o.cache?.set(key, body, 200);
        return body;
      } catch (e) {
        if (e instanceof QlooError) { if (!e.retryable) throw e; last = e; continue; }
        if ((e as Error).name === "AbortError") { last = new QlooError("QLOO_TIMEOUT", "Qloo timed out", true); continue; }
        last = new QlooError("QLOO_UPSTREAM", `Qloo request failed: ${(e as Error).message}`, true);
      } finally {
        clearTimeout(timer);
      }
    }
    throw last!;
  }

  /** One uncached request that never throws on HTTP errors. Used by scripts/probe.ts. */
  async raw(path: string, params: Params): Promise<{ status: number; body: any; ms: number; url: string }> {
    const url = this.buildUrl(path, params);
    const t0 = Date.now();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    try {
      const res = await this.o.fetchImpl(`${this.o.baseUrl}${url}`, { headers: { "X-Api-Key": this.o.apiKey, accept: "application/json" }, signal: ctl.signal });
      const body = await res.json().catch(() => null);
      return { status: res.status, body, ms: Date.now() - t0, url };
    } catch (e) {
      return { status: 0, body: { error: (e as Error).message }, ms: Date.now() - t0, url };
    } finally {
      clearTimeout(timer);
    }
  }

  async search(q: { query: string; types?: string[]; take?: number }): Promise<SearchResult[]> {
    const body = await this.get("/search", { query: q.query, types: q.types, take: q.take ?? 5 });
    return (body?.results ?? []) as SearchResult[];
  }
  async tags(q: { query: string; semantic?: boolean; take?: number }): Promise<TagLookup[]> {
    const body = await this.get("/v2/tags", {
      "filter.query": q.query,
      "feature.typo_tolerance": q.semantic ? undefined : true,
      "feature.semantic_search": q.semantic ? true : undefined,
      take: q.take ?? 10,
    });
    return (body?.results?.tags ?? []) as TagLookup[];
  }
  async insights(params: Params): Promise<InsightsResult> {
    const body = await this.get("/v2/insights", params);
    return (body?.results ?? {}) as InsightsResult;
  }
  async entities(ids: string[]): Promise<SearchResult[]> {
    const body = await this.get("/entities", { ids });
    return (body?.results ?? body?.entities ?? []) as SearchResult[];
  }
  cacheSize() { return this.o.cache?.size() ?? 0; }
}
