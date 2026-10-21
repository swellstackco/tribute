import { z } from "zod";
import { askFamily } from "./askFamily.js";
import { qlooCapabilities } from "./capabilities.js";
import { qlooAudienceDemographics } from "./demographics.js";
import { qlooDescribe } from "./describe.js";
import { qlooEntityTags } from "./entityTags.js";
import { finish } from "./finish.js";
import { qlooFindTags } from "./findTags.js";
import { qlooRank } from "./rank.js";
import { qlooRecommend } from "./recommend.js";
import type { ToolContext, ToolDef, ToolResult } from "./types.js";
import { result } from "./util.js";
import { writeSection } from "./writeSection.js";

export * from "./types.js";
export { urnType } from "./util.js";

export const TOOLS: ToolDef<any>[] = [
  qlooDescribe, qlooFindTags, qlooRecommend, qlooRank, qlooEntityTags, qlooAudienceDemographics, qlooCapabilities, askFamily, writeSection, finish,
];
const byName = new Map(TOOLS.map((t) => [t.name, t]));

export function toolDefinitions() {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: z.toJSONSchema(t.schema, { target: "draft-7" }) as Record<string, unknown>,
  }));
}

/** Validates input with zod, runs the tool, always returns the common envelope. */
export async function callTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolResult> {
  const tool = byName.get(name);
  if (!tool) return result("error", `Unknown tool ${name}.`, [], { code: "TOOL_INPUT", retryable: false, recovery: "Use a tool from the list." });
  const parsed = tool.schema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return result("error", `Bad input: ${parsed.error.issues.map((i: { path: PropertyKey[]; message: string }) => `${i.path.map(String).join(".")} ${i.message}`).join("; ")}`, [], {
      code: "TOOL_INPUT", retryable: true, recovery: "Fix the input fields and call again.",
    });
  }
  return tool.run(parsed.data, ctx);
}
