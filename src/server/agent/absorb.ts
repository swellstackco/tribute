import type { Item, ToolResult } from "../tools/index.js";
import type { RunState } from "./state.js";
import type { DescribeRow } from "../tools/describe.js";
import { cuisineHint, pickTag } from "../tools/clean.js";

export interface PlannedCall { name: string; input: Record<string, unknown>; label?: string }

const isCuisine = (t: Item) => t.id.includes(":cuisine:");

/** Purpose label for a recommend call (artist, book, ..., food, venue). */
export function recLabel(input: Record<string, any>): string {
  const t = String(input.target_type ?? "").replace("urn:entity:", "");
  if (t !== "place") return t;
  const inc: string[] = input.include_tags ?? [];
  return inc.some((x) => x.includes(":cuisine:")) || inc.some((x) => x.includes(":caterer") || x.includes(":restaurant")) ? "food" : "venue";
}

/** Update run state from any tool result, whoever asked for it (model, planner or critique). */
export function absorb(s: RunState, call: PlannedCall, r: ToolResult) {
  const items = r.results as any[];
  if (call.label?.startsWith("__")) s.recAttempted.add(call.label);
  switch (call.name) {
    case "qloo_describe": {
      if ((call.input.entities as string[] | undefined)?.length) {
        s.described = true;
        for (const row of items as DescribeRow[]) {
          if (row.status === "ok") s.love[row.love] = { state: "item", item: row.items[0] };
          else if (row.status === "needs_input") s.love[row.love] = { state: "ambiguous", candidates: row.items };
          else s.love[row.love] = { state: "empty" };
        }
      } else if (call.input.entity) {
        const love = String(call.input.entity);
        if (r.status === "ok") s.love[love] = { state: "item", item: items[0] };
        if (call.input.type) s.redescribed = true;
      }
      break;
    }
    case "qloo_find_tags": {
      s.tagsDone = true;
      for (const row of items as Array<{ query: string; items: Item[] }>) {
        s.tagLookups[row.query] = row.items;
        const love = s.love[row.query] ? row.query : s.tagQueryLove[row.query];
        const cur = love ? s.love[love] : undefined;
        const best = pickTag(row.items, row.query);
        // A dish or menu tag is only a fair match for a food love. "Clint Eastwood" is not a burger.
        const fair = best && (/^urn:tag:(hobby|genre:media|nearby_attraction|cuisine|genre:place:restaurant|amenity)/.test(best.id) || (/^urn:tag:(specialty_dish|menu_highlight)/.test(best.id) && !!cuisineHint(love ?? "")));
        if (love && cur && cur.state === "empty" && best && fair) s.love[love] = { state: "tag", item: best };
      }
      break;
    }
    case "qloo_entity_tags":
      s.recAttempted.add("__tags");
      if (r.status === "ok") s.tagProfile = items as Item[];
      break;
    case "qloo_audience_demographics":
      s.recAttempted.add("__demo");
      if (r.status === "ok") s.audience = items[0];
      break;
    case "qloo_recommend": {
      const label = call.label ?? recLabel(call.input);
      s.recAttempted.add(label);
      s.recs[label] = r.status === "ok" || r.status === "partial" ? (items as Item[]) : [];
      break;
    }
    default:
      break;
  }
}

export { isCuisine };
