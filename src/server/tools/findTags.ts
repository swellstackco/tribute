import { z } from "zod";
import type { ToolDef } from "./types.js";
import { fromTagLookup, guard, remember, result, topNames } from "./util.js";

const schema = z.object({
  query: z.string().min(1).max(80).describe("A word or short phrase, such as 'carne asada' or 'event venue'."),
  semantic: z.boolean().optional().describe("Use meaning-based search when the plain search finds nothing."),
  limit: z.number().int().min(1).max(20).optional(),
});

export const qlooFindTags: ToolDef<typeof schema> = {
  name: "qloo_find_tags",
  description:
    "Find Qloo tags (cuisines, hobbies, venue types, genres) for a word or phrase. Use it for foods, hobbies and place types, and for venue words such as 'community center'. Returns tag ids you can pass as signal_tags or include_tags to qloo_recommend.",
  schema,
  run: (input, ctx) => guard(async () => {
    const rows = (await ctx.qloo.tags({ query: input.query, semantic: input.semantic, take: input.limit ?? 10 })).map(fromTagLookup);
    if (!rows.length) return result("empty", `No tags for "${input.query}".`);
    remember(ctx, rows);
    return result("ok", `Tags: ${topNames(rows)}.`, rows);
  }),
};
