import { describe, it, expect, vi } from "vitest";
import { loadConfig } from "../src/server/config.js";
import { openDb } from "../src/server/db.js";
import { createServices } from "../src/server/services.js";
import { createApp } from "../src/server/app.js";
import { EXAMPLES } from "../src/shared/examples.js";
import { request } from "./helpers.js";
import type { LlmProvider } from "../src/server/llm/provider.js";

const mk = (extra: Parameters<typeof createServices>[1] = {}) => {
  const config = loadConfig({} as NodeJS.ProcessEnv);
  const sv = createServices(config, { db: openDb(":memory:"), ...extra });
  return { sv, app: createApp(config, sv) };
};

describe("orchestrator (mock)", () => {
  it("completes Walt fast with a ledger of 10-16 data steps and six sections", async () => {
    const { sv } = mk();
    const t0 = Date.now();
    const id = sv.orchestrator.start(EXAMPLES.walt.input);
    const v = await sv.orchestrator.finished(id);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(v.status).toBe("done");
    const data = v.steps.filter((s) => s.kind === "data" || s.kind === "ask");
    expect(data.length).toBeGreaterThanOrEqual(10);
    expect(data.length).toBeLessThanOrEqual(16);
    expect(v.steps.filter((s) => s.kind === "write").length).toBeGreaterThanOrEqual(6);
  });

  it("every written pick id appears in a prior step's result ids", async () => {
    const { sv } = mk();
    const v = await sv.orchestrator.finished(sv.orchestrator.start(EXAMPLES.roz.input));
    const known = new Set<string>();
    for (const s of v.steps) {
      if (s.kind === "write") for (const p of (s.input.picks as string[])) expect(known.has(p)).toBe(true);
      s.ids.forEach((i) => known.add(i));
    }
    expect(v.steps.filter((s) => s.kind === "write").length).toBeGreaterThan(0);
  });

  it("an ambiguous love pauses the run, and answer resumes it (one question only)", async () => {
    const { sv } = mk();
    const input = { ...EXAMPLES.walt.input, loves: ["Ghost", "Merle Haggard", "Johnny Cash", "carne asada", "bass fishing"] };
    const id = sv.orchestrator.start(input);
    await vi.waitFor(() => expect(sv.orchestrator.view(id)!.status).toBe("waiting"), { timeout: 2000 });
    const waiting = sv.orchestrator.view(id)!;
    expect(waiting.question!.options.length).toBeGreaterThanOrEqual(2);
    expect(sv.orchestrator.answer(id, 1)).toBe(true);
    const v = await sv.orchestrator.finished(id);
    expect(v.status).toBe("done");
    expect(v.steps.filter((s) => s.tool === "ask_family").length).toBe(1);
  });

  it("a second identical request replays from cache", async () => {
    const { app } = mk();
    const a = await request(app, "POST", "/api/tribute", { ...EXAMPLES.dana.input });
    expect(a.status).toBe(202);
    await new Promise((r) => setTimeout(r, 400));
    const b = await request(app, "POST", "/api/tribute", { ...EXAMPLES.dana.input });
    expect(b.body.cached).toBe(true);
    expect(b.body.id).toBe(a.body.id);
  });

  it("validates input and rate limits with a kind message", async () => {
    const { app } = mk();
    const bad = await request(app, "POST", "/api/tribute", { loves: ["a"], city: "x", constraints: {} });
    expect(bad.status).toBe(400);
    let last = 0;
    for (let i = 0; i < 7; i++) {
      const r = await request(app, "POST", "/api/tribute", { ...EXAMPLES.walt.input, firstName: `N${i}` });
      last = r.status;
      if (i === 6) expect(r.body.error).toMatch(/wait/i);
    }
    expect(last).toBe(429);
  });

  it("serves the SSE stream with step and done events", async () => {
    const { app } = mk();
    const a = await request(app, "POST", "/api/tribute", { ...EXAMPLES.roz.input, firstName: "Zed" });
    const r = await request(app, "GET", `/api/tribute/${a.body.id}/events`);
    expect(r.text).toContain("event: step");
    expect(r.text).toContain("event: done");
  });

  it("falls back to the planner when the model provider errors", async () => {
    const { ProviderError } = await import("../src/server/llm/provider.js");
    const bad: LlmProvider = { name: "anthropic", model: "claude-haiku-5-5", complete: async () => { throw new ProviderError("rate_limit", "busy", true); } };
    const { sv } = mk({ makeProvider: () => bad });
    const v = await sv.orchestrator.finished(sv.orchestrator.start(EXAMPLES.walt.input));
    expect(v.status).toBe("done");
    expect(v.steps.filter((s) => s.kind === "write").length).toBeGreaterThanOrEqual(6);
    expect(v.notice).toMatch(/planner/i);
  });
});
