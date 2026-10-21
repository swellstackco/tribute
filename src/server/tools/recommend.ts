import { z } from "zod";
import type { Params } from "../qloo/types.js";
import type { ToolDef } from "./types.js";
import { fromEntity, guard, remember, result, topNames, urnType } from "./util.js";

export const recommendSchema = z.object({
  target_type: z.string().describe("What to recommend: artist, book, movie, tv_show, podcast, brand, or place."),
  signals: z.array(z.string()).optional().describe("Entity ids (from qloo_describe) that describe the taste."),
  signal_tags: z.array(z.string()).optional().describe("Tag ids that describe the taste."),
  signal_tags_operator: z.enum(["union", "intersection"]).optional(),
  signal_location: z.string().optional(),
  demographic: z.object({ age: z.string().optional(), gender: z.string().optional() }).optional(),
  filter_location: z.string().optional().describe("City name for places, such as 'Bakersfield, CA'."),
  include_tags: z.array(z.string()).optional().describe("Only return results with at least one of these tag ids."),
  include_tags_operator: z.enum(["union", "intersection"]).optional(),
  exclude_tags: z.array(z.string()).optional().describe("Never return results with these tag ids."),
  exclude_tags_operator: z.enum(["union", "intersection"]).optional(),
  explain: z.boolean().optional().describe("Ask Qloo why each result fits."),
  limit: z.number().int().min(1).max(20).optional(),
  // Tribute extensions (not part of the Qloo harness):
  price_level_max: z.number().int().min(1).max(4).optional(),
  rating_min: z.number().min(0).max(5).optional(),
});

export type RecommendInput = z.infer<typeof recommendSchema>;

export function recommendParams(i: RecommendInput): Params {
  return {
    "filter.type": urnType(i.target_type),
    "signal.interests.entities": i.signals,
    "signal.interests.tags": i.signal_tags,
    "signal.interests.tags.operator": i.signal_tags_operator,
    "signal.location.query": i.signal_location,
    "signal.demographics.age": i.demographic?.age,
    "signal.demographics.gender": i.demographic?.gender,
    "filter.location.query": i.filter_location,
    "filter.tags": i.include_tags,
    "filter.tags.operator": i.include_tags_operator,
    "filter.exclude.tags": i.exclude_tags,
    "filter.exclude.tags.operator": i.exclude_tags_operator,
    "feature.explainability": i.explain,
    "filter.price_level.max": i.price_level_max,
    "filter.properties.business_rating.min": i.rating_min,
    take: i.limit ?? 8,
  };
}

export const qlooRecommend: ToolDef<typeof recommendSchema> = {
  name: "qloo_recommend",
  description:
    "Ask Qloo for things people with this taste also love. target_type picks the kind (artist, book, movie, tv_show, podcast, brand, place). Pass the resolved love ids as signals. For places add filter_location (the city) and include_tags (cuisine or venue tag ids); use exclude_tags, price_level_max and rating_min to respect the family's constraints. Returns ranked items with affinity from 0 to 1. Only ids returned here may be used in write_section.",
  schema: recommendSchema,
  run: (input, ctx) => guard(async () => {
    const res = await ctx.qloo.insights(recommendParams(input));
    const rows = (res.entities ?? []).map(fromEntity);
    if (!rows.length) return result("empty", `Nothing came back for ${input.target_type}${input.filter_location ? ` near ${input.filter_location}` : ""}.`);
    remember(ctx, rows);
    return result("ok", `${rows.length} ${input.target_type} results: ${topNames(rows)}.`, rows);
  }),
};
