import { z } from "zod";
import type { ToolDef } from "./types.js";
import { fromTagInsight, guard, remember, result, topNames } from "./util.js";

const schema = z.object({
  entities: z.array(z.string()).min(1).describe("Resolved entity ids."),
  entity_type: z.string().optional(),
  limit: z.number().int().min(1).max(40).optional(),
});

export const qlooEntityTags: ToolDef<typeof schema> = {
  name: "qloo_entity_tags",
  description:
    "Describe the era and vibe of the family's loves as a list of Qloo tags (genres, keywords, styles) with affinity. Call it once on all resolved love ids. The result feeds the 'why' page.",
  schema,
  run: (i, ctx) => guard(async () => {
    const res = await ctx.qloo.insights({
      "filter.type": "urn:tag",
      "signal.interests.entities": i.entities,
      "filter.tag.types": ["urn:tag:genre:media", "urn:tag:keyword:media", "urn:tag:style:qloo"],
      take: i.limit ?? 25,
    });
    const rows = (res.tags ?? []).map(fromTagInsight);
    if (!rows.length) return result("empty", "No tag profile came back.");
    remember(ctx, rows);
    return result("ok", `Top tags: ${topNames(rows, 4)}.`, rows);
  }),
};
