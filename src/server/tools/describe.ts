import { z } from "zod";
import type { ToolDef } from "./types.js";
import { fromEntity, guard, remember, result, topNames, urnType } from "./util.js";

const schema = z.object({
  entity: z.string().min(1).max(80).describe("The thing the family loved, in their words, such as 'Merle Haggard'."),
  type: z.string().optional().describe("Optional entity type: artist, book, movie, tv_show, podcast, brand, place, person."),
});

export const qlooDescribe: ToolDef<typeof schema> = {
  name: "qloo_describe",
  description:
    "Look up one thing the family loved and return the matching Qloo entity with its id. Call it once per love. If two strong matches of different types exist (a band and a movie with the same name) it returns status needs_input with up to 3 candidates so you can ask the family one question. If nothing matches it returns empty; then try qloo_find_tags for foods and hobbies.",
  schema,
  run: (input, ctx) => guard(async () => {
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
void topNames;
