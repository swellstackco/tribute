import { QlooError, type InsightsEntity, type SearchResult, type TagInsight, type TagLookup } from "../qloo/types.js";
import type { Item, ToolContext, ToolResult } from "./types.js";

export const ENTITY_TYPES = ["artist", "book", "movie", "tv_show", "podcast", "brand", "place", "person"] as const;
export const urnType = (t: string) => (t.startsWith("urn:") ? t : `urn:entity:${t}`);

const explainList = (x: unknown): Item["explain"] => {
  if (!x) return undefined;
  if (Array.isArray(x)) {
    return x.map((r: any) => ({ id: String(r.entity_id ?? r.id ?? ""), contribution: typeof (r.contribution ?? r.score) === "number" ? (r.contribution ?? r.score) : undefined })).filter((r) => r.id);
  }
  if (typeof x === "object") return Object.entries(x as Record<string, unknown>).map(([id, v]) => ({ id, contribution: typeof v === "number" ? v : undefined }));
  return undefined;
};

export const fromEntity = (e: SearchResult | InsightsEntity): Item => ({
  id: e.entity_id, kind: "entity", name: e.name, type: e.types?.[0] ?? "urn:entity:unknown",
  affinity: (e as InsightsEntity).query?.affinity, popularity: e.popularity,
  properties: e.properties ?? {}, tags: (e.tags ?? []).map((t) => ({ id: t.id, name: t.name })),
  explain: explainList((e as InsightsEntity).query?.explainability),
});
export const fromTagLookup = (t: TagLookup): Item => ({ id: t.id, kind: "tag", name: t.name, type: t.type ?? "urn:tag", properties: {}, tags: [] });
export const fromTagInsight = (t: TagInsight): Item => ({ id: t.tag_id, kind: "tag", name: t.name, type: t.subtype ?? t.types?.[0] ?? "urn:tag", affinity: t.query?.affinity, properties: {}, tags: [] });

export function remember(ctx: ToolContext, items: Item[]) {
  for (const i of items) ctx.seen.set(i.id, i);
}

export function result(status: ToolResult["status"], summary: string, results: unknown[] = [], error?: ToolResult["error"]): ToolResult {
  return { status, summary, results, result_count: results.length, ...(error ? { error } : {}) };
}

export function topNames(items: Item[], n = 3) {
  return items.slice(0, n).map((i) => i.name).join(", ");
}

export function errorResult(e: unknown): ToolResult {
  if (e instanceof QlooError) {
    const recovery: Record<string, string> = {
      QLOO_AUTH: "The Qloo key was refused. Stop calling Qloo tools and use what you already have.",
      QLOO_RATE_LIMIT: "Qloo asked us to slow down. Try this call once more, then move on.",
      QLOO_TIMEOUT: "Qloo took too long. Try once more with a smaller limit.",
      QLOO_UPSTREAM: "Qloo had a problem. Try once more, then move on.",
    };
    return result("error", e.message, [], { code: e.code, retryable: e.retryable, recovery: recovery[e.code] });
  }
  return result("error", (e as Error).message, [], { code: "TOOL_INPUT", retryable: true, recovery: "Check the input fields and try again." });
}

export async function guard(fn: () => Promise<ToolResult>): Promise<ToolResult> {
  try { return await fn(); } catch (e) { return errorResult(e); }
}
