import { z } from "zod";
import type { ToolDef } from "./types.js";
import { guard, result } from "./util.js";

const schema = z.object({
  entity: z.union([z.string(), z.array(z.string())]).describe("One entity id or a list of ids."),
  entity_type: z.string().optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

export const qlooAudienceDemographics: ToolDef<typeof schema> = {
  name: "qloo_audience_demographics",
  description:
    "Describe the audience of the loved things (age and gender shape). This describes the people who like those things, not the person being remembered. Call it once.",
  schema,
  run: (i, ctx) => guard(async () => {
    const ids = Array.isArray(i.entity) ? i.entity : [i.entity];
    const res = await ctx.qloo.insights({ "filter.type": "urn:demographics", "signal.interests.entities": ids, take: i.limit ?? 10 });
    const rows = res.demographics ?? [];
    if (!rows.length) return result("empty", "No audience data came back.");
    const age: Record<string, number> = {};
    let male = 0, female = 0;
    for (const r of rows) {
      for (const [k, v] of Object.entries(r.query.age)) age[k] = (age[k] ?? 0) + v / rows.length;
      male += r.query.gender.male / rows.length;
      female += r.query.gender.female / rows.length;
    }
    for (const k of Object.keys(age)) age[k] = +age[k].toFixed(3);
    const top = Object.entries(age).sort((a, b) => b[1] - a[1])[0];
    return result("ok", `The audience leans toward ages ${top[0].replace(/_/g, " ")}.`, [{ id: "audience", age, gender: { male: +male.toFixed(3), female: +female.toFixed(3) } }]);
  }),
};
