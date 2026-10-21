import { describe, it, expect, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { openDb } from "../src/server/db.js";
import { MockQlooClient } from "../src/server/qloo/mock.js";
import { callTool, newContext } from "../src/server/tools/index.js";
import { newRunState } from "../src/server/agent/state.js";
import { absorb } from "../src/server/agent/absorb.js";
import { planNext } from "../src/server/agent/planner.js";
import { EXAMPLES } from "../src/shared/examples.js";
import { MockProvider } from "../src/server/llm/mock.js";
import { AnthropicProvider, MODEL } from "../src/server/llm/anthropic.js";
import { Spend, MeteredProvider } from "../src/server/llm/spend.js";
import { CachedProvider, LlmCache } from "../src/server/llm/llmCache.js";
import { RateLimiter } from "../src/server/llm/rateLimit.js";
import { ProviderError, type LlmProvider } from "../src/server/llm/provider.js";
import { loadConfig } from "../src/server/config.js";

const qloo = new MockQlooClient();

describe("mock planner", () => {
  it("produces the full phase sequence for Walt within 16 data/ask calls", async () => {
    const state = newRunState(EXAMPLES.walt.input, newContext(qloo));
    const provider = new MockProvider(() => state);
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      const r = await provider.complete();
      const c = r.toolCalls[0];
      seen.push(c.name);
      if (c.name === "finish") break;
      const res = await callTool(c.name, c.input, state.ctx);
      absorb(state, { name: c.name, input: c.input }, res);
      expect(res.status).not.toBe("error");
    }
    const counted = seen.filter((n) => n !== "write_section" && n !== "finish");
    expect(counted.length).toBeLessThanOrEqual(16);
    expect(counted.length).toBeGreaterThanOrEqual(9);
    expect(seen.filter((n) => n === "write_section").length).toBe(6);
    expect(seen[0]).toBe("qloo_describe");
    expect(seen.indexOf("qloo_entity_tags")).toBeLessThan(seen.indexOf("qloo_recommend"));
    expect(seen.at(-1)).toBe("finish");
    expect(planNext(state)).toBeNull();
  });
});

describe("spend ledger", () => {
  it("trips at the cap and blocks the provider", async () => {
    const db = openDb(":memory:");
    const spend = new Spend(db, loadConfig({} as NodeJS.ProcessEnv).spendCap);
    expect(spend.capUsd).toBe(4);
    expect(spend.canSpend()).toBe(true);
    spend.record("anthropic", MODEL, 20_000_000, 4_000_000); // 2.00 + 2.00
    expect(spend.total()).toBeCloseTo(4.0, 5);
    expect(spend.canSpend()).toBe(false);
    const inner: LlmProvider = { name: "anthropic", model: MODEL, complete: vi.fn(async () => ({ toolCalls: [], usage: { input_tokens: 1, output_tokens: 1 } })) };
    await expect(new MeteredProvider(inner, spend).complete({ system: "", messages: [], tools: [], maxTokens: 10 })).rejects.toBeInstanceOf(ProviderError);
    expect(inner.complete).not.toHaveBeenCalled();
  });
  it("defaults the cap to 4 even with a bad env value", () => {
    expect(loadConfig({ LLM_SPEND_CAP_USD: "abc" } as unknown as NodeJS.ProcessEnv).spendCap).toBe(4);
    expect(loadConfig({ LLM_SPEND_CAP_USD: "" } as unknown as NodeJS.ProcessEnv).spendCap).toBe(4);
    expect(loadConfig({} as NodeJS.ProcessEnv).llmModel).toBe("claude-haiku-5-5");
  });
  it("refuses an unpriced model", () => {
    expect(() => new Spend(openDb(":memory:"), 4).cost("other-model", 1, 1)).toThrow();
  });
});

describe("rate limiter", () => {
  it("returns a kind 429 verdict on the 7th run in an hour", () => {
    const rl = new RateLimiter(openDb(":memory:"), "salt", { now: () => 1_800_000_000_000 });
    for (let i = 0; i < 6; i++) expect(rl.take("1.2.3.4").ok).toBe(true);
    const v = rl.take("1.2.3.4");
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/wait/i);
    expect(rl.take("5.6.7.8").ok).toBe(true);
  });
  it("does not store raw IPs", () => {
    const db = openDb(":memory:");
    new RateLimiter(db, "salt").take("203.0.113.9");
    const rows = JSON.stringify(db.prepare("SELECT * FROM rate").all());
    expect(rows).not.toContain("203.0.113.9");
  });
  it("applies the per-day and global limits", () => {
    let t = 1_800_000_000_000;
    const rl = new RateLimiter(openDb(":memory:"), "s", { perHour: 100, perDay: 3, globalDay: 5, now: () => t });
    for (let i = 0; i < 3; i++) expect(rl.take("a").ok).toBe(true);
    expect(rl.take("a").ok).toBe(false);
    expect(rl.take("b").ok).toBe(true);
    expect(rl.take("c").ok).toBe(true);
    expect(rl.take("d").ok).toBe(false);
    t += 86_400_000;
    expect(rl.take("a").ok).toBe(true);
  });
});

describe("llm cache", () => {
  it("a hit skips the provider", async () => {
    const db = openDb(":memory:");
    const inner: LlmProvider = { name: "anthropic", model: MODEL, complete: vi.fn(async () => ({ text: "hi", toolCalls: [], usage: { input_tokens: 5, output_tokens: 5 } })) };
    const p = new CachedProvider(inner, new LlmCache(db));
    const req = { system: "s", messages: [{ role: "user" as const, content: "x" }], tools: [], maxTokens: 10 };
    await p.complete(req);
    const second = await p.complete(req);
    expect(inner.complete).toHaveBeenCalledTimes(1);
    expect(second.text).toBe("hi");
    expect(second.usage.input_tokens).toBe(0);
  });
});

describe("anthropic provider (stubbed client only)", () => {
  it("sends the spec'd request and parses tool_use", async () => {
    const create = vi.fn(async () => ({
      content: [{ type: "text", text: "ok" }, { type: "tool_use", id: "t1", name: "qloo_describe", input: { entity: "x" } }],
      usage: { input_tokens: 100, output_tokens: 20 },
    }));
    const p = new AnthropicProvider({ messages: { create } });
    const r = await p.complete({ system: "sys", messages: [{ role: "user", content: "go" }], tools: [{ name: "a", description: "d", input_schema: { type: "object" } }], maxTokens: 9999 });
    const body = (create.mock.calls[0] as any)[0];
    expect(body.model).toBe("claude-haiku-5-5");
    expect(body.max_tokens).toBe(2048);
    expect(body.thinking).toBeUndefined();
    expect(body.output_config).toEqual({ effort: "low" });
    expect(body.tool_choice).toEqual({ type: "auto" });
    expect(r.toolCalls[0]).toEqual({ id: "t1", name: "qloo_describe", input: { entity: "x" } });
    expect(r.usage).toEqual({ input_tokens: 100, output_tokens: 20 });
  });
  it("maps SDK errors to provider errors", async () => {
    const mk = (e: unknown) => new AnthropicProvider({ messages: { create: async () => { throw e; } } }).complete({ system: "", messages: [], tools: [], maxTokens: 1 }).catch((x) => x);
    const rl = await mk(new Anthropic.RateLimitError(429, {}, "slow", new Headers()));
    expect(rl).toMatchObject({ kind: "rate_limit", retryable: true });
    const st = await mk(new Anthropic.InternalServerError(500, {}, "boom", new Headers()));
    expect(st.kind).toBe("status");
    const cn = await mk(new Anthropic.APIConnectionError({ message: "down" }));
    expect(cn.kind).toBe("connection");
  });
});

describe("run cost through the cache wrapper", () => {
  it("reports the metered spend for the run, and 0 on a hit", async () => {
    const db = openDb(":memory:");
    const inner: LlmProvider = { name: "anthropic", model: MODEL, complete: async () => ({ toolCalls: [], usage: { input_tokens: 1_000_000, output_tokens: 0 } }) };
    const p = new CachedProvider(new MeteredProvider(inner, new Spend(db, 4)), new LlmCache(db));
    const req = { system: "s", messages: [{ role: "user" as const, content: "x" }], tools: [], maxTokens: 10 };
    await p.complete(req);
    expect(p.runUsd).toBeCloseTo(0.1, 5);
    await p.complete(req); // cache hit adds nothing
    expect(p.runUsd).toBeCloseTo(0.1, 5);
  });
});
