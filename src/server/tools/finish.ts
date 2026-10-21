import { z } from "zod";
import type { ToolDef } from "./types.js";
import { result } from "./util.js";

const schema = z.object({});
export const finish: ToolDef<typeof schema> = {
  name: "finish",
  description: "End the run once all six sections are saved. No inputs.",
  schema,
  run: async (_i, ctx) => { ctx.finished = true; return result("ok", "Finished."); },
};
