import { z } from "zod";
import type { ToolDef } from "./types.js";
import { result } from "./util.js";

const schema = z.object({});
export const qlooCapabilities: ToolDef<typeof schema> = {
  name: "qloo_capabilities",
  description: "Report which mode Tribute is running in (mock or live), which model is used, and how many Qloo responses are cached. No inputs.",
  schema,
  run: async (_i, ctx) =>
    result("ok", `Qloo mode ${ctx.mode}; model ${ctx.llm}; cache ${ctx.cacheSize()} entries.`, [
      { qloo: ctx.mode, llm: ctx.llm, cache_entries: ctx.cacheSize() },
    ]),
};
