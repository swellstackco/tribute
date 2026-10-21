import type { z } from "zod";
import type { QlooClient } from "../qloo/types.js";

export type Status = "ok" | "empty" | "needs_input" | "partial" | "degraded" | "error";
export type ErrorCode = "QLOO_AUTH" | "QLOO_RATE_LIMIT" | "QLOO_TIMEOUT" | "QLOO_UPSTREAM" | "TOOL_INPUT" | "PICK_NOT_FROM_QLOO" | "QUESTION_LIMIT";

export interface ToolError { code: ErrorCode; retryable: boolean; recovery: string }

/** Common envelope every tool returns (mirrors the Qloo harness shape). */
export interface ToolResult<R = unknown> {
  status: Status;
  summary: string;
  results: R[];
  result_count: number;
  error?: ToolError;
}

/** A Qloo entity or tag, trimmed to what Tribute uses. */
export interface Item {
  id: string;
  kind: "entity" | "tag";
  name: string;
  type: string; // urn:entity:* or tag subtype
  affinity?: number;
  popularity?: number;
  properties: Record<string, unknown>;
  tags: Array<{ id: string; name: string }>;
  explain?: Array<{ id: string; contribution?: number }>;
}

export const SECTIONS = ["music", "readings", "food", "venue", "screen", "program"] as const;
export type SectionName = (typeof SECTIONS)[number];

export interface WrittenSection { picks: string[]; sentence: string }

/** Per-run state shared by tools. */
export interface ToolContext {
  qloo: QlooClient;
  seen: Map<string, Item>;
  questionsAsked: number;
  written: Partial<Record<SectionName, WrittenSection>>;
  finished: boolean;
  mode: "mock" | "live";
  llm: string;
  cacheSize: () => number;
}

export interface ToolDef<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string; // written for a model
  schema: S;
  run(input: z.infer<S>, ctx: ToolContext): Promise<ToolResult>;
}

export function newContext(qloo: QlooClient, llm = "mock"): ToolContext {
  return { qloo, seen: new Map(), questionsAsked: 0, written: {}, finished: false, mode: qloo.mode, llm, cacheSize: () => qloo.cacheSize() };
}
