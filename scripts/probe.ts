/**
 * Qloo probe. Run once the key lands:   QLOO_API_KEY=... npm run probe
 * Hits every request kind Tribute uses, for the three demo cities, and prints:
 *   1. a table per kind: HTTP status, result count, top names, ms
 *   2. field-name differences against src/server/qloo/types.ts (missing and extra keys)
 *   3. the tag ids found for cuisines and venue types
 *   4. a pass/fail summary against the T13 criteria
 * Nothing is written to the repo. Never commit its output (kit rule: no Qloo response data in the repo).
 * Flags: --mock   run against the synthetic fixtures (tests the probe itself, needs no key)
 *        --json=/path/out.json   also save the raw summary outside the repo
 */
import fs from "node:fs";
import { loadConfig } from "../src/server/config.js";
import { MockQlooClient } from "../src/server/qloo/mock.js";
import { RealQlooClient } from "../src/server/qloo/real.js";
import type { Params } from "../src/server/qloo/types.js";
import { EXAMPLES } from "../src/shared/examples.js";

type Raw = { status: number; body: any; ms: number; url: string };
type Fetcher = (path: string, params: Params) => Promise<Raw>;

const useMock = process.argv.includes("--mock");
const jsonOut = process.argv.find((a) => a.startsWith("--json="))?.slice(7);
const config = loadConfig();

let fetcher: Fetcher;
if (useMock) {
  const m = new MockQlooClient();
  fetcher = async (path, params) => {
    const t0 = Date.now();
    let body: any;
    if (path === "/search") body = { results: await m.search({ query: String(params.query), types: params.types ? String(params.types).split(",") : undefined, take: Number(params.take ?? 5) }) };
    else if (path === "/v2/tags") body = { results: { tags: await m.tags({ query: String(params["filter.query"]) }) } };
    else if (path === "/entities") body = { results: await m.entities(String(params.ids).split(",")) };
    else body = { results: await m.insights(params) };
    return { status: 200, body, ms: Date.now() - t0, url: path };
  };
} else {
  if (!config.qlooKey) { console.error("Set QLOO_API_KEY (server .env or the shell). Or use --mock to test the probe itself."); process.exit(2); }
  const real = new RealQlooClient({ baseUrl: config.qlooBase, apiKey: config.qlooKey });
  fetcher = (p, q) => real.raw(p, q);
}

// ---- expected field names (from src/server/qloo/types.ts and SPEC section 4) ----
const EXPECT = {
  search: ["name", "entity_id", "types", "popularity", "properties", "tags"],
  entity: ["name", "entity_id", "types", "popularity", "properties", "tags", "query", "subtype"],
  tagInsight: ["tag_id", "name", "subtype", "types", "query"],
  demographics: ["entity_id", "query"],
  tagLookup: ["id", "name", "type"],
  place: ["address", "geocode", "business_rating", "price_level", "phone", "website"],
  age: ["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "45_to_54", "55_and_older"],
};

interface Row { kind: string; status: number; count: number; top: string; ms: number; flag: string }
const rows: Row[] = [];
const diffs: string[] = [];
const tagFinds: Record<string, string[]> = {};
let errors = 0;
const emptyKinds: string[] = [];
const searchEmpty: string[] = [];
let explainShape = "not returned";

const keysOf = (o: any) => (o && typeof o === "object" ? Object.keys(o) : []);
function diff(label: string, sample: any, expected: string[]) {
  if (!sample) return;
  const got = keysOf(sample);
  const missing = expected.filter((k) => !got.includes(k));
  const extra = got.filter((k) => !expected.includes(k));
  if (missing.length || extra.length) diffs.push(`${label}: missing [${missing.join(", ")}] extra [${extra.join(", ")}]`);
}

async function hit(kind: string, path: string, params: Params, pick: (b: any) => any[], name: (x: any) => string, demoCityKind = false) {
  const r = await fetcher(path, params);
  const list = r.status === 200 ? pick(r.body) ?? [] : [];
  const flag = r.status !== 200 ? "ERROR" : list.length === 0 ? "EMPTY" : "";
  if (flag === "ERROR") errors++;
  if (flag === "EMPTY" && kind.startsWith("search ")) searchEmpty.push(kind.slice(7)); // foods and hobbies resolve through /v2/tags instead
  else if (flag === "EMPTY") emptyKinds.push(demoCityKind ? `${kind} (DEMO CITY)` : kind);
  rows.push({ kind, status: r.status, count: list.length, top: list.slice(0, 3).map(name).join(" | "), ms: r.ms, flag });
  return { r, list };
}
const nm = (x: any) => String(x?.name ?? x?.tag_id ?? x?.entity_id ?? "?");

const T = {
  artist: "urn:entity:artist", book: "urn:entity:book", movie: "urn:entity:movie", tv: "urn:entity:tv_show",
  podcast: "urn:entity:podcast", brand: "urn:entity:brand", place: "urn:entity:place",
};

// 1. /search for every love of every profile
const resolved: Record<string, string[]> = {};
for (const ex of Object.values(EXAMPLES)) {
  resolved[ex.slug] = [];
  for (const love of ex.input.loves) {
    const { list } = await hit(`search "${love}"`, "/search", { query: love, take: 5 }, (b) => b.results, nm);
    if (list[0]) { diff("search result", list[0], EXPECT.search); resolved[ex.slug].push(list[0].entity_id); }
  }
}

// 2. /v2/tags for foods, hobbies and venue words
for (const w of ["carne asada", "Thai", "catfish", "soul food", "diner", "bass fishing", "pinball", "rose garden", "record shops", "event venue", "banquet hall", "community center", "park", "church hall", "caterer", "restaurant"]) {
  const { list } = await hit(`tags "${w}"`, "/v2/tags", { "filter.query": w, "feature.typo_tolerance": true, take: 10 }, (b) => b.results?.tags, nm);
  if (list[0]) diff("tag lookup", list[0], EXPECT.tagLookup);
  tagFinds[w] = list.slice(0, 4).map((t: any) => `${t.id ?? t.tag_id} (${t.type ?? t.subtype ?? "?"}, ${t.name})`);
}
{ // semantic fallback once
  await hit(`tags semantic "church fellowship hall"`, "/v2/tags", { "filter.query": "church fellowship hall", "feature.semantic_search": true, take: 10 }, (b) => b.results?.tags, nm);
}

// 3. Insights for Walt's ids: tag analysis, demographics, entity types, explainability
const walt = resolved.walt.slice(0, 4);
if (walt.length) {
  const sig = walt.join(",");
  const tagRes = await hit("insights urn:tag (Walt)", "/v2/insights", { "filter.type": "urn:tag", "signal.interests.entities": sig, "filter.tag.types": "urn:tag:genre:media,urn:tag:keyword:media,urn:tag:style:qloo", take: 25 }, (b) => b.results?.tags, nm);
  diff("tag insight", tagRes.list[0], EXPECT.tagInsight);
  diff("tag insight .query", tagRes.list[0]?.query, ["affinity"]);
  const demo = await hit("insights urn:demographics (Walt)", "/v2/insights", { "filter.type": "urn:demographics", "signal.interests.entities": sig }, (b) => b.results?.demographics, (x) => x.entity_id);
  diff("demographics", demo.list[0], EXPECT.demographics);
  diff("demographics .query.age", demo.list[0]?.query?.age, EXPECT.age);
  diff("demographics .query.gender", demo.list[0]?.query?.gender, ["male", "female"]);
  for (const [label, type, extra] of [["artist", T.artist, { "feature.explainability": true }], ["book", T.book, {}], ["movie", T.movie, {}], ["tv_show", T.tv, {}], ["podcast", T.podcast, {}], ["brand", T.brand, {}]] as const) {
    const r = await hit(`insights ${label} (Walt)`, "/v2/insights", { "filter.type": type, "signal.interests.entities": sig, take: 12, ...extra }, (b) => b.results?.entities, nm);
    diff(`entity ${label}`, r.list[0], EXPECT.entity);
    diff(`entity ${label} .query`, r.list[0]?.query, label === "artist" ? ["affinity", "explainability"] : ["affinity"]);
    if (label === "artist" && r.list[0]?.query?.explainability) explainShape = JSON.stringify(r.list[0].query.explainability).slice(0, 160);
    if (label === "book" && r.list[0]) diffs.push(`book properties keys: ${keysOf(r.list[0].properties).join(", ") || "none"}`);
    if ((label === "movie" || label === "tv_show") && r.list[0]) diffs.push(`${label} properties keys: ${keysOf(r.list[0].properties).join(", ") || "none"}`);
    if (label === "artist" && r.list[0]) diffs.push(`artist properties keys: ${keysOf(r.list[0].properties).join(", ") || "none"}`);
  }
  // rank
  const cand = (await fetcher("/v2/insights", { "filter.type": T.artist, "signal.interests.entities": sig, take: 5 })).body?.results?.entities?.map((e: any) => e.entity_id) ?? [];
  if (cand.length) await hit("rank (filter.results.entities)", "/v2/insights", { "filter.type": T.artist, "signal.interests.entities": sig, "filter.results.entities": cand.join(",") }, (b) => b.results?.entities, nm);
  const ent = await hit("entities?ids (Walt)", "/entities", { ids: walt.join(",") }, (b) => b.results ?? b.entities, nm);
  void ent;
}

// 4. Places in each demo city, with and without filters
const cityFood: Record<string, string> = { walt: "carne asada", dana: "Thai", roz: "catfish" };
for (const ex of Object.values(EXAMPLES)) {
  const sig = resolved[ex.slug].slice(0, 4).join(",");
  const cuisineId = (tagFinds[cityFood[ex.slug]] ?? [])[0]?.split(" ")[0];
  const base: Params = { "filter.type": T.place, "filter.location.query": ex.city, take: 8 };
  if (sig) base["signal.interests.entities"] = sig;
  const plain = await hit(`places ${ex.city} (no filters)`, "/v2/insights", base, (b) => b.results?.entities, nm, true);
  diff(`place ${ex.city}`, plain.list[0], EXPECT.entity);
  diff(`place ${ex.city} .properties`, plain.list[0]?.properties, EXPECT.place);
  if (cuisineId) {
    await hit(`food ${ex.city} (cuisine+price+rating)`, "/v2/insights", { ...base, "filter.tags": cuisineId, "filter.price_level.max": 2, "filter.properties.business_rating.min": 3.5 }, (b) => b.results?.entities, nm, true);
  }
  const venueIds = ["event venue", "banquet hall", "community center", "park"].map((w) => (tagFinds[w] ?? [])[0]?.split(" ")[0]).filter(Boolean).join(",");
  if (venueIds) await hit(`venue ${ex.city} (venue tags, no bars)`, "/v2/insights", { ...base, "filter.tags": venueIds, "filter.exclude.tags": (tagFinds["bar"] ?? [])[0]?.split(" ")[0] }, (b) => b.results?.entities, nm, true);
}

// ---- report ----
const pad = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));
console.log(`\nQLOO PROBE (${useMock ? "mock fixtures" : config.qlooBase})\n`);
console.log(`${pad("kind", 46)} ${pad("http", 5)} ${pad("n", 4)} ${pad("ms", 6)} top`);
for (const r of rows) console.log(`${pad(r.kind, 46)} ${pad(String(r.status), 5)} ${pad(String(r.count), 4)} ${pad(String(r.ms), 6)} ${r.top}${r.flag ? `   <-- ${r.flag}` : ""}`);
console.log("\nFIELD DIFFS vs types.ts (missing = we expect it and it is absent; extra = real field we do not model)");
console.log(diffs.length ? diffs.map((d) => `  - ${d}`).join("\n") : "  none");
console.log(`\nLOVES WITH NO /search MATCH (they must resolve through /v2/tags, or be reworded): ${searchEmpty.join(", ") || "none"}`);
console.log(`\nEXPLAINABILITY SHAPE: ${explainShape}`);
console.log("\nTAG IDS (pick cuisine and venue ids from here; edit src/server/agent/constraintTags.ts for bar/active ids)");
for (const [w, v] of Object.entries(tagFinds)) console.log(`  ${pad(w, 18)} ${v.join("  ||  ") || "(none)"}`);

const demoEmpty = emptyKinds.filter((k) => k.includes("DEMO CITY"));
const pass = errors === 0 && emptyKinds.length <= 2 && demoEmpty.length === 0;
console.log(`\nSUMMARY: ${rows.length} requests, ${errors} errors, ${emptyKinds.length} empty (${emptyKinds.join("; ") || "none"}), demo-city empties: ${demoEmpty.length}`);
console.log(pass ? "T13 criteria: PASS" : "T13 criteria: FAIL (fix the items above, or change a demo city)");
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ rows, diffs, tagFinds, explainShape }, null, 1));
process.exit(pass ? 0 : 1);
