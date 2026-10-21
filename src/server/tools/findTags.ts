import { z } from "zod";
import type { Item, ToolDef } from "./types.js";
import { fromTagLookup, guard, remember, result, topNames } from "./util.js";

const schema = z.object({
  query: z.string().min(1).max(80).optional().describe("A word or short phrase, such as 'carne asada' or 'event venue'."),
  queries: z.array(z.string().min(1).max(80)).min(1).max(16).optional().describe("Tribute extension: several phrases in one call. One row per phrase."),
  semantic: z.boolean().optional().describe("Use meaning-based search when the plain search finds nothing."),
  limit: z.number().int().min(1).max(20).optional(),
});

export const qlooFindTags: ToolDef<typeof schema> = {
  name: "qloo_find_tags",
  description:
    "Find Qloo tags (cuisines, hobbies, venue types, genres) for a word or phrase. Use it for foods, hobbies and place types, and for venue words such as 'community center'. Returns tag ids you can pass as signal_tags or include_tags to qloo_recommend.",
  schema,
  run: (input, ctx) => guard(async () => {
    if (input.queries?.length) {
      const out: Array<{ query: string; items: Item[] }> = [];
      for (const q of input.queries) {
        const items = (await ctx.qloo.tags({ query: q, semantic: input.semantic, take: input.limit ?? 5 })).map(fromTagLookup);
        remember(ctx, items);
        out.push({ query: q, items });
      }
      const all = out.flatMap((o) => o.items);
      return all.length ? result("ok", `Tags: ${topNames(all, 4)}.`, out) : result("empty", "No tags came back.");
    }
    if (!input.query) return result("error", "Give query or queries.", [], { code: "TOOL_INPUT", retryable: true, recovery: "Pass the query field." });
    const rows = (await ctx.qloo.tags({ query: input.query, semantic: input.semantic, take: input.limit ?? 10 })).map(fromTagLookup);
    if (!rows.length) return result("empty", `No tags for "${input.query}".`);
    remember(ctx, rows);
    return result("ok", `Tags: ${topNames(rows)}.`, rows);
  }),
};
