import { z } from "zod";
import type { ToolDef } from "./types.js";
import { fromEntity, guard, remember, result, topNames, urnType } from "./util.js";

const schema = z.object({
  options: z.array(z.string()).min(1).max(30).describe("Entity ids to rank (from earlier tool results)."),
  option_type: z.string().describe("The type of the options: artist, book, movie, tv_show, podcast, brand, place."),
  signals: z.array(z.string()).optional(),
  signal_location: z.string().optional(),
  demographic: z.object({ age: z.string().optional(), gender: z.string().optional() }).optional(),
  include_tags: z.array(z.string()).optional(),
  exclude_tags: z.array(z.string()).optional(),
});

export const qlooRank: ToolDef<typeof schema> = {
  name: "qloo_rank",
  description:
    "Rank a shortlist you already have by how well each option fits the family's taste. Pass option ids and the same signals you used before. Returns the options sorted by affinity.",
  schema,
  run: (i, ctx) => guard(async () => {
    const res = await ctx.qloo.insights({
      "filter.type": urnType(i.option_type),
      "signal.interests.entities": i.signals,
      "signal.location.query": i.signal_location,
      "signal.demographics.age": i.demographic?.age,
      "signal.demographics.gender": i.demographic?.gender,
      "filter.tags": i.include_tags,
      "filter.exclude.tags": i.exclude_tags,
      "filter.results.entities": i.options,
    });
    const rows = (res.entities ?? []).map(fromEntity);
    if (!rows.length) return result("empty", "None of the options could be ranked.");
    remember(ctx, rows);
    return result(rows.length < i.options.length ? "partial" : "ok", `Ranked ${rows.length}: ${topNames(rows)}.`, rows);
  }),
};
