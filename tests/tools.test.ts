import { describe, it, expect } from "vitest";
import { MockQlooClient } from "../src/server/qloo/mock.js";
import { QlooError, type QlooClient } from "../src/server/qloo/types.js";
import { callTool, newContext, toolDefinitions, TOOLS, type ToolContext } from "../src/server/tools/index.js";

const mock = new MockQlooClient();
const fresh = (q: QlooClient = mock): ToolContext => newContext(q);

async function resolve(ctx: ToolContext, ...names: string[]) {
  const ids: string[] = [];
  for (const n of names) {
    const r = await callTool("qloo_describe", { entity: n }, ctx);
    ids.push((r.results[0] as any).id);
  }
  return ids;
}

describe("tool layer", () => {
  it("exports ten tools with JSON schemas and descriptions", () => {
    const defs = toolDefinitions();
    expect(defs.map((d) => d.name)).toEqual(["qloo_describe", "qloo_find_tags", "qloo_recommend", "qloo_rank", "qloo_entity_tags", "qloo_audience_demographics", "qloo_capabilities", "ask_family", "write_section", "finish"]);
    for (const d of defs) { expect(d.description.length).toBeGreaterThan(40); expect((d.input_schema as any).type).toBe("object"); }
    expect(TOOLS.length).toBe(10);
  });

  it("describe: ok for a clear match", async () => {
    const r = await callTool("qloo_describe", { entity: "Merle Haggard" }, fresh());
    expect(r.status).toBe("ok");
    expect(r.result_count).toBe(1);
    expect(r.summary).toContain("Merle Haggard");
  });
  it("describe: needs_input for the ambiguous 'Ghost'", async () => {
    const r = await callTool("qloo_describe", { entity: "Ghost" }, fresh());
    expect(r.status).toBe("needs_input");
    expect(r.result_count).toBeGreaterThanOrEqual(2);
    const types = new Set((r.results as any[]).map((c) => c.type));
    expect(types.size).toBeGreaterThan(1);
  });
  it("describe: a type hint removes the ambiguity", async () => {
    const r = await callTool("qloo_describe", { entity: "Ghost", type: "movie" }, fresh());
    expect(r.status).toBe("ok");
    expect((r.results[0] as any).type).toBe("urn:entity:movie");
  });
  it("describe: empty for a tag-like love", async () => {
    const r = await callTool("qloo_describe", { entity: "bass fishing" }, fresh());
    expect(r.status).toBe("empty");
  });
  it("describe: rejects bad input with TOOL_INPUT", async () => {
    const r = await callTool("qloo_describe", { entity: "" }, fresh());
    expect(r.status).toBe("error");
    expect(r.error!.code).toBe("TOOL_INPUT");
  });
  it("find_tags: ok and marks ids as seen", async () => {
    const ctx = fresh();
    const r = await callTool("qloo_find_tags", { query: "carne asada" }, ctx);
    expect(r.status).toBe("ok");
    expect(ctx.seen.has((r.results[0] as any).id)).toBe(true);
  });
  it("recommend: artists for Walt", async () => {
    const ctx = fresh();
    const ids = await resolve(ctx, "Merle Haggard", "Johnny Cash");
    const r = await callTool("qloo_recommend", { target_type: "artist", signals: ids, explain: true, limit: 8 }, ctx);
    expect(r.status).toBe("ok");
    expect(r.result_count).toBeGreaterThan(4);
    expect((r.results[0] as any).affinity).toBeGreaterThan(0.5);
    expect((r.results[0] as any).explain.length).toBeGreaterThan(0);
  });
  it("recommend: places respect price, rating, exclude", async () => {
    const ctx = fresh();
    const r = await callTool("qloo_recommend", { target_type: "place", filter_location: "Bakersfield, CA", exclude_tags: ["urn:tag:category:place:bar"], price_level_max: 1, rating_min: 4 }, ctx);
    expect(r.status).toBe("ok");
    for (const p of r.results as any[]) expect(p.properties.price_level).toBeLessThanOrEqual(1);
  });
  it("recommend: empty when filters remove everything", async () => {
    const r = await callTool("qloo_recommend", { target_type: "place", filter_location: "Bakersfield, CA", include_tags: ["urn:tag:cuisine:place:nonexistent"] }, fresh());
    expect(r.status).toBe("empty");
  });
  it("rank: sorts a shortlist", async () => {
    const ctx = fresh();
    const ids = await resolve(ctx, "Merle Haggard");
    const rec = await callTool("qloo_recommend", { target_type: "artist", signals: ids }, ctx);
    const opts = (rec.results as any[]).slice(0, 4).map((x) => x.id);
    const r = await callTool("qloo_rank", { options: opts, option_type: "artist", signals: ids }, ctx);
    expect(r.status).toBe("ok");
    const a = (r.results as any[]).map((x) => x.affinity);
    expect([...a].sort((x, y) => y - x)).toEqual(a);
  });
  it("entity_tags: returns a tag profile", async () => {
    const ctx = fresh();
    const ids = await resolve(ctx, "Merle Haggard", "Johnny Cash");
    const r = await callTool("qloo_entity_tags", { entities: ids }, ctx);
    expect(r.status).toBe("ok");
    expect((r.results[0] as any).kind).toBe("tag");
  });
  it("audience_demographics: aggregates", async () => {
    const ctx = fresh();
    const ids = await resolve(ctx, "Merle Haggard", "Johnny Cash");
    const r = await callTool("qloo_audience_demographics", { entity: ids }, ctx);
    expect(r.status).toBe("ok");
    expect((r.results[0] as any).age["55_and_older"]).toBeGreaterThan(0);
  });
  it("capabilities: reports mode", async () => {
    const r = await callTool("qloo_capabilities", {}, fresh());
    expect((r.results[0] as any).qloo).toBe("mock");
  });
  it("ask_family: second call returns QUESTION_LIMIT", async () => {
    const ctx = fresh();
    const a = await callTool("ask_family", { question: "Did you mean the band or the movie?", options: ["The band", "The movie"] }, ctx);
    expect(a.status).toBe("needs_input");
    const b = await callTool("ask_family", { question: "Another one?", options: ["a", "b"] }, ctx);
    expect(b.status).toBe("error");
    expect(b.error!.code).toBe("QUESTION_LIMIT");
  });
  it("write_section: accepts seen ids, rejects unknown ids", async () => {
    const ctx = fresh();
    const ids = await resolve(ctx, "Merle Haggard");
    const good = await callTool("write_section", { section: "music", picks: ids, sentence: "Songs he loved will fill the room." }, ctx);
    expect(good.status).toBe("ok");
    const bad = await callTool("write_section", { section: "music", picks: ["not-in-run"], sentence: "Made up." }, ctx);
    expect(bad.status).toBe("error");
    expect(bad.error!.code).toBe("PICK_NOT_FROM_QLOO");
  });
  it("finish: sets the flag", async () => {
    const ctx = fresh();
    await callTool("finish", {}, ctx);
    expect(ctx.finished).toBe(true);
  });
  it("429 from Qloo becomes a retryable error envelope", async () => {
    const failing: QlooClient = { ...mock, mode: "mock", search: async () => { throw new QlooError("QLOO_RATE_LIMIT", "Qloo rate limit", true, 429); }, tags: mock.tags.bind(mock), insights: mock.insights.bind(mock), entities: mock.entities.bind(mock), cacheSize: () => 0 };
    const r = await callTool("qloo_describe", { entity: "Merle Haggard" }, fresh(failing));
    expect(r.status).toBe("error");
    expect(r.error).toMatchObject({ code: "QLOO_RATE_LIMIT", retryable: true });
  });
  it("unknown tool is an error envelope", async () => {
    const r = await callTool("nope", {}, fresh());
    expect(r.status).toBe("error");
  });
});

describe("tool layer extras", () => {
  it("recommend maps harness fields to Qloo params", async () => {
    const { recommendParams } = await import("../src/server/tools/recommend.js");
    const p = recommendParams({ target_type: "place", signals: ["a"], filter_location: "Portland", include_tags: ["t1"], exclude_tags: ["t2"], explain: true, price_level_max: 2, rating_min: 3.5, limit: 5 });
    expect(p).toMatchObject({ "filter.type": "urn:entity:place", "signal.interests.entities": ["a"], "filter.location.query": "Portland", "filter.tags": ["t1"], "filter.exclude.tags": ["t2"], "feature.explainability": true, "filter.price_level.max": 2, "filter.properties.business_rating.min": 3.5, take: 5 });
  });
});
