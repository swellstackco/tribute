import { z } from "zod";
import type { Item, ToolContext, ToolDef, ToolResult } from "./types.js";
import { fromEntity, guard, remember, result, topNames, urnType } from "./util.js";

const schema = z.object({
  entity: z.string().min(1).max(80).optional().describe("The thing the family loved, in their words, such as 'Merle Haggard'."),
  entities: z.array(z.string().min(1).max(80)).min(1).max(12).optional().describe("Tribute extension: several loves in one call. Results come back one row per love."),
  type: z.string().optional().describe("Optional entity type: artist, book, movie, tv_show, podcast, brand, place, person."),
});

export const qlooDescribe: ToolDef<typeof schema> = {
  name: "qloo_describe",
  description:
    "Look up one thing the family loved and return the matching Qloo entity with its id. Call it once per love. If two strong matches of different types exist (a band and a movie with the same name) it returns status needs_input with up to 3 candidates so you can ask the family one question. If nothing matches it returns empty; then try qloo_find_tags for foods and hobbies.",
  schema,
  run: (input, ctx) => guard(async () => {
    if (input.entities?.length) return batch(input.entities, input.type, ctx);
    if (!input.entity) return result("error", "Give entity or entities.", [], { code: "TOOL_INPUT", retryable: true, recovery: "Pass the entity field." });
    const types = input.type ? [urnType(input.type)] : undefined;
    const rows = (await ctx.qloo.search({ query: input.entity, types, take: 5 })).map(fromEntity);
    if (!rows.length) return result("empty", `No match for "${input.entity}".`);
    const [a, b] = rows;
    if (b && Math.abs((a.popularity ?? 0) - (b.popularity ?? 0)) <= 0.15 && a.type !== b.type) {
      const cands = rows.slice(0, 3);
      return result("needs_input", `"${input.entity}" could be ${cands.map((c) => `${c.name} (${c.type.replace("urn:entity:", "")})`).join(" or ")}.`, cands);
    }
    remember(ctx, [a]);
    return result("ok", `${a.name} (${a.type.replace("urn:entity:", "")}).`, [a]);
  }),
};

export interface DescribeRow { love: string; status: "ok" | "empty" | "needs_input"; items: Item[] }

async function batch(loves: string[], type: string | undefined, ctx: ToolContext): Promise<ToolResult> {
  const rows: DescribeRow[] = [];
  for (const love of loves) {
    const r = await qlooDescribe.run({ entity: love, type }, ctx);
    rows.push({ love, status: r.status === "needs_input" ? "needs_input" : r.status === "ok" ? "ok" : "empty", items: r.results as Item[] });
  }
  const ok = rows.filter((r) => r.status === "ok").length;
  const ask = rows.filter((r) => r.status === "needs_input").length;
  const status = ask ? "needs_input" : ok === rows.length ? "ok" : ok ? "partial" : "empty";
  const names = topNames(rows.flatMap((r) => (r.status === "ok" ? r.items : [])), 3);
  return result(status, `Matched ${ok} of ${rows.length} loves${names ? ` (${names})` : ""}${ask ? `; ${ask} could mean two things` : ""}.`, rows);
}
