import { z } from "zod";
import { SECTIONS, type ToolDef } from "./types.js";
import { result } from "./util.js";

const schema = z.object({
  section: z.enum(SECTIONS),
  picks: z.array(z.string()).max(12).describe("Entity ids or tag ids that appeared in earlier tool results."),
  sentence: z.string().min(3).max(240).describe("One warm sentence, 4th to 6th grade reading level."),
});

export const writeSection: ToolDef<typeof schema> = {
  name: "write_section",
  description:
    "Save one section of the tribute: music, readings, food, venue, screen or program. picks must be ids that were returned by Qloo tools in this run; any other id is refused. sentence is one warm, plain sentence (4th to 6th grade). Call once per section.",
  schema,
  run: async (i, ctx) => {
    const bad = i.picks.filter((p) => !ctx.seen.has(p));
    if (bad.length) {
      return result("error", `These ids were not returned by Qloo in this run: ${bad.join(", ")}.`, [], {
        code: "PICK_NOT_FROM_QLOO", retryable: true, recovery: "Use only ids from earlier tool results, then call write_section again.",
      });
    }
    ctx.written[i.section] = { picks: i.picks, sentence: i.sentence };
    return result("ok", `Saved ${i.section} with ${i.picks.length} picks.`, i.picks.map((p) => ({ id: p, name: ctx.seen.get(p)!.name })));
  },
};
