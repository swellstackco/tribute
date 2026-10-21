import { z } from "zod";
import type { ToolDef } from "./types.js";
import { result } from "./util.js";

const schema = z.object({
  question: z.string().min(3).max(200).describe("One short question in plain words."),
  options: z.array(z.string().min(1).max(80)).min(2).max(3),
});

export const askFamily: ToolDef<typeof schema> = {
  name: "ask_family",
  description:
    "Ask the family ONE short question when a love could mean two different things and the answer would change the result. Allowed once per tribute; a second call is refused. The run pauses until the family answers.",
  schema,
  run: async (i, ctx) => {
    if (ctx.questionsAsked >= 1) {
      return result("error", "Only one question is allowed.", [], {
        code: "QUESTION_LIMIT", retryable: false, recovery: "Choose the most popular candidate and note the choice. Do not ask again.",
      });
    }
    ctx.questionsAsked++;
    return result("needs_input", i.question, i.options.map((o) => ({ option: o })));
  },
};
