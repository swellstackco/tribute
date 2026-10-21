import { describe, it, expect, vi } from "vitest";
import { openDb } from "../src/server/db.js";
import { RealQlooClient } from "../src/server/qloo/real.js";
import { SqliteQlooCache } from "../src/server/qloo/cache.js";
import { MockQlooClient } from "../src/server/qloo/mock.js";
import { QlooError } from "../src/server/qloo/types.js";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ok = (body: unknown = { results: [] }) => new Response(JSON.stringify(body), { status: 200 });
const mkReal = (fetchImpl: any, cache?: SqliteQlooCache) =>
  new RealQlooClient({ baseUrl: "https://q.test", apiKey: "k", fetchImpl, cache, sleep: async () => {} });

describe("real client query strings (10 request kinds)", () => {
  const urls: Record<string, string> = {};
  const record = async (name: string, fn: (c: RealQlooClient) => Promise<unknown>) => {
    const f = vi.fn(async () => ok());
    await fn(mkReal(f));
    urls[name] = String((f.mock.calls[0] as any)[0]).replace("https://q.test", "");
  };
  it("builds the documented URLs", async () => {
    await record("search", (c) => c.search({ query: "Merle Haggard", types: ["urn:entity:artist"], take: 5 }));
    await record("tags", (c) => c.tags({ query: "carne asada" }));
    await record("tagsSemantic", (c) => c.tags({ query: "carne asada", semantic: true }));
    await record("era", (c) => c.insights({ "filter.type": "urn:tag", "signal.interests.entities": [A, B], "filter.tag.types": ["urn:tag:genre:media", "urn:tag:keyword:media", "urn:tag:style:qloo"], take: 25 }));
    await record("demographics", (c) => c.insights({ "filter.type": "urn:demographics", "signal.interests.entities": [A, B] }));
    await record("music", (c) => c.insights({ "filter.type": "urn:entity:artist", "signal.interests.entities": [A, B], take: 12, "feature.explainability": true }));
    await record("books", (c) => c.insights({ "filter.type": "urn:entity:book", "signal.interests.entities": [A], take: 8 }));
    await record("food", (c) => c.insights({ "filter.type": "urn:entity:place", "signal.interests.entities": [A], "filter.location.query": "Bakersfield, CA", "filter.tags": ["urn:tag:cuisine:place:mexican"], "filter.price_level.max": 2, "filter.properties.business_rating.min": 3.5, take: 8 }));
    await record("venue", (c) => c.insights({ "filter.type": "urn:entity:place", "filter.location.query": "Birmingham, AL", "filter.tags": ["urn:tag:category:place:community_center"], "filter.exclude.tags": ["urn:tag:category:place:bar"], take: 5 }));
    await record("rank", (c) => c.insights({ "filter.type": "urn:entity:artist", "signal.interests.entities": [A], "filter.results.entities": [B] }));
    await record("entities", (c) => c.entities([A, B]));
    expect(urls).toMatchInlineSnapshot(`
      {
        "books": "/v2/insights?filter.type=urn:entity:book&signal.interests.entities=11111111-1111-4111-8111-111111111111&take=8",
        "demographics": "/v2/insights?filter.type=urn:demographics&signal.interests.entities=11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222",
        "entities": "/entities?entity_ids=11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222",
        "era": "/v2/insights?filter.type=urn:tag&signal.interests.entities=11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222&filter.tag.types=urn:tag:genre:media,urn:tag:keyword:media,urn:tag:style:qloo&take=25",
        "food": "/v2/insights?filter.type=urn:entity:place&signal.interests.entities=11111111-1111-4111-8111-111111111111&filter.location.query=Bakersfield,%20CA&filter.tags=urn:tag:cuisine:place:mexican&filter.price_level.max=2&filter.properties.business_rating.min=3.5&take=8",
        "music": "/v2/insights?filter.type=urn:entity:artist&signal.interests.entities=11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222&take=12&feature.explainability=true",
        "rank": "/v2/insights?filter.type=urn:entity:artist&signal.interests.entities=11111111-1111-4111-8111-111111111111&filter.results.entities=22222222-2222-4222-8222-222222222222",
        "search": "/search?query=Merle%20Haggard&types=urn:entity:artist&take=5",
        "tags": "/v2/tags?filter.query=carne%20asada&feature.typo_tolerance=true&take=10",
        "tagsSemantic": "/v2/tags?filter.query=carne%20asada&feature.semantic_search=true&take=10",
        "venue": "/v2/insights?filter.type=urn:entity:place&filter.location.query=Birmingham,%20AL&filter.tags=urn:tag:category:place:community_center&filter.exclude.tags=urn:tag:category:place:bar&take=5",
      }
    `);
    expect(Object.keys(urls).length).toBeGreaterThanOrEqual(10);
  });
  it("rejects an unknown parameter", async () => {
    const c = mkReal(vi.fn());
    await expect(c.insights({ "filter.typo": "x" })).rejects.toThrow(/Unknown Qloo parameter/);
  });
});

describe("real client behavior", () => {
  it("caches a 200 and replays without fetch", async () => {
    const cache = new SqliteQlooCache(openDb(":memory:"));
    const f = vi.fn(async () => ok({ results: [{ name: "x" }] }));
    const c = mkReal(f, cache);
    await c.search({ query: "a" });
    await c.search({ query: "a" });
    expect(f).toHaveBeenCalledTimes(1);
    expect(c.cacheSize()).toBe(1);
  });
  it("does not cache failures; retries 429 then reports retryable", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 429 }));
    const err = await mkReal(f).search({ query: "a" }).catch((e) => e);
    expect(err).toBeInstanceOf(QlooError);
    expect(err.code).toBe("QLOO_RATE_LIMIT");
    expect(err.retryable).toBe(true);
    expect(f).toHaveBeenCalledTimes(4);
  });
  it("sends the key header and maps 401 to QLOO_AUTH", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 401 }));
    const err = await mkReal(f).search({ query: "a" }).catch((e) => e);
    expect(err.code).toBe("QLOO_AUTH");
    expect((f.mock.calls[0] as any)[1].headers["X-Api-Key"]).toBe("k");
  });
});

describe("mock client", () => {
  const m = new MockQlooClient();
  const loves: Record<string, string[]> = {
    walt: ["Merle Haggard", "the Los Angeles Dodgers", "Johnny Cash", "Clint Eastwood westerns"],
    dana: ["David Bowie", "Patti Smith", "Studio Ghibli films", "Ursula K. Le Guin", "The X-Files"],
    roz: ["Mahalia Jackson", "Aretha Franklin", "The Andy Griffith Show", "Maya Angelou", "Dolly Parton"],
    unknown: ["Zebra Accordion Quartet"],
  };
  for (const [name, list] of Object.entries(loves)) {
    it(`returns type-correct, non-empty results for ${name}`, async () => {
      const found: string[] = [];
      for (const love of list) {
        const r = await m.search({ query: love });
        expect(r.length).toBeGreaterThan(0);
        expect(r[0].entity_id).toMatch(/^[0-9a-f-]{36}$/);
        found.push(r[0].entity_id);
      }
      for (const type of ["artist", "book", "movie", "tv_show", "podcast", "brand"]) {
        const r = await m.insights({ "filter.type": `urn:entity:${type}`, "signal.interests.entities": found, take: 6 });
        expect(r.entities!.length).toBeGreaterThan(0);
        for (const e of r.entities!) {
          expect(e.types[0]).toBe(`urn:entity:${type}`);
          expect(typeof e.query.affinity).toBe("number");
        }
      }
      const tg = await m.insights({ "filter.type": "urn:tag", "signal.interests.entities": found });
      expect(tg.tags!.length).toBeGreaterThan(0);
      const demo = await m.insights({ "filter.type": "urn:demographics", "signal.interests.entities": found });
      expect(demo.demographics![0].query.age["55_and_older"]).toBeTypeOf("number");
      const places = await m.insights({ "filter.type": "urn:entity:place", "filter.location.query": "Springfield" });
      expect(places.entities!.length).toBeGreaterThan(0);
      expect((places.entities![0].properties as any).address).toContain("Springfield");
    });
  }
  it("honors place filters", async () => {
    const r = await m.insights({ "filter.type": "urn:entity:place", "filter.location.query": "Bakersfield, CA", "filter.price_level.max": 1, "filter.properties.business_rating.min": 4, "filter.exclude.tags": "urn:tag:category:place:bar" });
    for (const e of r.entities!) {
      expect((e.properties as any).price_level).toBeLessThanOrEqual(1);
      expect((e.tags ?? []).map((t) => t.id)).not.toContain("urn:tag:category:place:bar");
    }
  });
  it("tags lookup works for known and unknown words", async () => {
    expect((await m.tags({ query: "carne asada" }))[0].name).toBe("Mexican");
    expect((await m.tags({ query: "zzz" })).length).toBe(1);
  });
});
