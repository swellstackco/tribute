import { describe, it, expect } from "vitest";
import { callTool, newContext } from "../src/server/tools/index.js";
import { cleanLove, tagQuery, cuisineHint, pickTag } from "../src/server/tools/clean.js";
import { fromEntity } from "../src/server/tools/util.js";
import { hasBarTag } from "../src/server/agent/constraintTags.js";
import type { QlooClient, SearchResult } from "../src/server/qloo/types.js";

// Hand-made rows that copy the SHAPE the real API returned (not its data).
const row = (name: string, type: string, popularity?: number): SearchResult => ({ name, entity_id: `${name}-${type}`.toUpperCase(), types: [`urn:entity:${type}`], popularity, properties: {}, tags: [] });
const stub = (rows: SearchResult[], tags: Array<{ id: string; name: string }> = []): QlooClient => ({
  mode: "mock", search: async () => rows, tags: async () => tags, insights: async () => ({}), entities: async () => [], cacheSize: () => 0,
});

describe("real-API behaviors", () => {
  it("skips albums, games and places, and needs an exact name", async () => {
    const r = await callTool("qloo_describe", { entity: "Bass Fishing" }, newContext(stub([row("Sega Bass Fishing", "videogame", 0.97), row("Tackle Talk - Bass Fishing Podcast", "podcast", 0.8)])));
    expect(r.status).toBe("empty");
  });
  it("treats a band, a person and an author with one name as one love", async () => {
    const r = await callTool("qloo_describe", { entity: "Merle Haggard" }, newContext(stub([row("Merle Haggard", "artist", 0.98), row("Merle Haggard", "person", 0.79), row("Merle Haggard", "author", 0.675)])));
    expect(r.status).toBe("ok");
    expect((r.results[0] as any).type).toBe("urn:entity:artist");
  });
  it("asks when a band and a movie share a name, ignoring albums and games", async () => {
    const r = await callTool("qloo_describe", { entity: "Ghost" }, newContext(stub([row("Ghost", "album", 0.997), row("Ghost", "artist", 0.995), row("Ghost", "movie", 0.983), row("Ghost", "videogame", 0.978)])));
    expect(r.status).toBe("needs_input");
    expect((r.results as any[]).map((c) => c.type).sort()).toEqual(["urn:entity:artist", "urn:entity:movie"]);
  });
  it("lets a weak match for a plain word go to the tag step", async () => {
    const r = await callTool("qloo_describe", { entity: "pinball" }, newContext(stub([row("Pinball", "artist", 0.9)], [{ id: "urn:tag:genre:media:pinball", name: "Pinball" }])));
    expect(r.status).toBe("empty");
  });
  it("keeps a strong match even when a tag has the same name", async () => {
    const r = await callTool("qloo_describe", { entity: "Ghost" }, newContext(stub([row("Ghost", "artist", 0.99)], [{ id: "urn:tag:genre:media:ghost", name: "Ghost" }])));
    expect(r.status).toBe("ok");
  });
  it("cleans typed loves", () => {
    expect(cleanLove("Clint Eastwood westerns")).toBe("Clint Eastwood");
    expect(cleanLove("her rose garden")).toBe("rose garden");
    expect(tagQuery("fried catfish and greens")).toBe("fried catfish");
    expect(tagQuery("black coffee at the diner")).toBe("black coffee");
    expect(cuisineHint("carne asada")).toBe("Mexican");
    expect(cuisineHint("Clint Eastwood")).toBeNull();
  });
  it("picks the restaurant-genre tag for cuisines", () => {
    const items = [{ id: "urn:tag:decor:qloo:thai", name: "Thai" }, { id: "urn:tag:genre:place:restaurant:thai", name: "Thai" }, { id: "urn:tag:genre:music:thai", name: "Thai" }];
    expect(pickTag(items, "Thai", ["urn:tag:genre:place:restaurant:"])!.id).toBe("urn:tag:genre:place:restaurant:thai");
  });
  it("reads insights rows (type urn:entity, subtype carries the kind) and keyed explainability", () => {
    const item = fromEntity({ name: "Waylon Jennings", entity_id: "A", type: "urn:entity", subtype: "urn:entity:artist", properties: {}, popularity: 0.9, tags: [], query: { affinity: 0.97, explainability: { "signal.interests.entities": [{ entity_id: "B", score: 0.4 }] } } } as any);
    expect(item.type).toBe("urn:entity:artist");
    expect(item.explain).toEqual([{ id: "B", contribution: 0.4 }]);
  });
  it("recognises bars by main category or name, not by amenity", () => {
    expect(hasBarTag({ name: "Quiet Hall", tags: [{ id: "urn:tag:amenity:place:bar", name: "Bar" }] })).toBe(false);
    expect(hasBarTag({ name: "The Tower Craft Bar & Grill", tags: [] })).toBe(true);
    expect(hasBarTag({ name: "Hall", tags: [{ id: "urn:tag:category:place:brewery", name: "Brewery" }] })).toBe(true);
  });
});
