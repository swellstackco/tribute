import { z } from "zod";
import type { Item, ToolContext, ToolDef, ToolResult } from "./types.js";
import { cleanLove, norm, stripLead } from "./clean.js";
import { fromEntity, guard, remember, result, topNames, urnType } from "./util.js";

const schema = z.object({
  entity: z.string().min(1).max(80).optional().describe("The thing the family loved, in their words, such as 'Merle Haggard'."),
  entities: z.array(z.string().min(1).max(80)).min(1).max(12).optional().describe("Tribute extension: several loves in one call. Results come back one row per love."),
  type: z.string().optional().describe("Optional entity type: artist, book, movie, tv_show, podcast, brand, person."),
});

export const qlooDescribe: ToolDef<typeof schema> = {
  name: "qloo_describe",
  description:
    "Look up one thing the family loved and return the matching Qloo entity with its id. Call it once per love. If two strong matches of different kinds exist (a band and a movie with the same name) it returns status needs_input with up to 3 candidates so you can ask the family one question. If nothing matches (foods, hobbies and places are not entities) it returns empty; then try qloo_find_tags.",
  schema,
  run: (input, ctx) => guard(async () => {
    if (input.entities?.length) return batch(input.entities, input.type, ctx);
    if (!input.entity) return result("error", "Give entity or entities.", [], { code: "TOOL_INPUT", retryable: true, recovery: "Pass the entity field." });
    return describeOne(input.entity, input.type, ctx);
  }),
};

// Things a family can love that are entities. Places, albums and games are not (places come from recommend).
const ALLOWED = new Set(["artist", "book", "movie", "tv_show", "podcast", "brand", "person", "author"]);
const short = (t: string) => t.replace("urn:entity:", "");
// A band, a person and an author with the same name are one love, not three.
const kindOf = (t: string) => (["artist", "person", "author"].includes(short(t)) ? "person" : short(t));
const PREFER = ["artist", "person", "author"];

// Tag namespaces that mean "this word is a hobby, dish or genre, not a named thing".
const TAGGY = /^urn:tag:(hobby|specialty_dish|menu_highlight|nearby_attraction|amenity|cuisine|genre:place|genre:media)/;

async function search(q: string, type: string | undefined, ctx: ToolContext): Promise<Item[]> {
  const rows = await ctx.qloo.search({ query: q, types: type ? [urnType(type)] : undefined, take: 15 });
  return rows.map(fromEntity);
}

function candidates(rows: Item[], queries: string[], type?: string): Item[] {
  const want = new Set(queries.map(norm));
  const ok = rows.filter((r) => ALLOWED.has(short(r.type)) && want.has(norm(r.name)) && (!type || short(r.type) === short(urnType(type))));
  // best per kind (highest popularity), artist preferred over person and author when close
  const best = new Map<string, Item>();
  for (const r of [...ok].sort((x, y) => (y.popularity ?? 0) - (x.popularity ?? 0))) {
    const k = kindOf(r.type);
    const cur = best.get(k);
    if (!cur) best.set(k, r);
    else if (k === "person" && PREFER.indexOf(short(r.type)) < PREFER.indexOf(short(cur.type)) && (r.popularity ?? 0) >= (cur.popularity ?? 0) - 0.15) best.set(k, r);
  }
  return [...best.values()].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
}

async function describeOne(love: string, type: string | undefined, ctx: ToolContext): Promise<ToolResult> {
  const queries = [...new Set([stripLead(love), cleanLove(love)])];
  let cands: Item[] = [];
  for (const q of queries) {
    cands = candidates(await search(q, type, ctx), queries, type);
    if (cands.length) break;
  }
  if (!cands.length) return result("empty", `No named match for "${love}".`);
  const [a, b] = cands;
  if (b && Math.abs((a.popularity ?? 0) - (b.popularity ?? 0)) <= 0.15) {
    const list = cands.slice(0, 3);
    return result("needs_input", `"${love}" could be ${list.map((c) => `${c.name} (${short(c.type).replace("_", " ")})`).join(" or ")}.`, list);
  }
  // A weak entity match for a plain word (pinball, fishing) is really a hobby or dish: let the tag step have it.
  if (!type && (a.popularity ?? 0) < 0.93) {
    const tags = await ctx.qloo.tags({ query: cleanLove(love), take: 6 });
    if (tags.some((t) => norm(t.name) === norm(cleanLove(love)) && TAGGY.test(t.id))) return result("empty", `"${love}" reads as a topic, not a named thing.`);
  }
  remember(ctx, [a]);
  return result("ok", `${a.name} (${short(a.type).replace("_", " ")}).`, [a]);
}

export interface DescribeRow { love: string; status: "ok" | "empty" | "needs_input"; items: Item[] }

async function batch(loves: string[], type: string | undefined, ctx: ToolContext): Promise<ToolResult> {
  // A few at a time: fast, and gentle on the Qloo rate limit.
  const rows: DescribeRow[] = new Array(loves.length);
  let next = 0, failed = 0;
  let firstError: unknown;
  const worker = async () => {
    for (let i = next++; i < loves.length; i = next++) {
      let r: ToolResult;
      try { r = await describeOne(loves[i], type, ctx); } catch (e) { firstError ??= e; r = result("empty", "lookup failed"); failed++; }
      rows[i] = { love: loves[i], status: r.status === "needs_input" ? "needs_input" : r.status === "ok" ? "ok" : "empty", items: r.results as Item[] };
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, loves.length) }, worker));
  if (failed === loves.length && firstError) throw firstError;
  const ok = rows.filter((r) => r.status === "ok").length;
  const ask = rows.filter((r) => r.status === "needs_input").length;
  const status = ask ? "needs_input" : ok === rows.length ? "ok" : ok ? "partial" : "empty";
  const names = topNames(rows.flatMap((r) => (r.status === "ok" ? r.items : [])), 3);
  return result(status, `Matched ${ok} of ${rows.length} loves${names ? ` (${names})` : ""}${ask ? `; ${ask} could mean two things` : ""}.`, rows);
}
