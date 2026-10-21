import type { Item, ToolResult } from "../tools/index.js";
import type { PlannedCall } from "./absorb.js";
import { ACTIVE_TAG_IDS, BAR_TAG_IDS, hasActiveTag, hasBarTag } from "./constraintTags.js";
import { foodItems, venueItems } from "./picks.js";
import { recommendCall, writeCall } from "./planner.js";
import type { RunState } from "./state.js";

export type Exec = (call: PlannedCall, source: "critique", reason: string) => Promise<ToolResult>;

const price = (i: Item) => Number((i.properties as any).price_level ?? 0);
const rating = (i: Item) => Number((i.properties as any).business_rating ?? 5);

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

interface Fix { section: "food" | "venue"; reason: string; exclude: string[]; priceMax?: number; ratingMin?: number }

/** Deterministic rules from the family's constraints. Returns the fixes that are needed. */
export function findViolations(s: RunState): Fix[] {
  const { faith, budget, guests } = s.input.constraints;
  const venues = venueItems(s);
  const food = foodItems(s).filter((i) => i.kind === "entity");
  const fixes: Fix[] = [];

  const venueExclude: string[] = [];
  const venueReasons: string[] = [];
  if ((faith === "faith" || guests === "older") && venues.some((v) => hasBarTag(v))) {
    venueExclude.push(...BAR_TAG_IDS);
    venueReasons.push(faith === "faith" ? "a bar is not right for a faith-based service" : "a bar is not right for many older guests");
  }
  if (guests === "older" && venues.some((v) => hasActiveTag(v))) {
    venueExclude.push(...ACTIVE_TAG_IDS);
    venueReasons.push("hiking and rooftop places are hard for walkers");
  }
  const venueTooPricey = budget === "modest" && venues.some((v) => price(v) > 2);
  if (venueExclude.length || venueTooPricey) {
    if (venueTooPricey) venueReasons.push("the budget is modest");
    fixes.push({ section: "venue", reason: `Changed the gathering place. ${venueReasons.map(cap).join(". ")}.`, exclude: [...new Set(venueExclude)], priceMax: budget === "modest" ? 2 : undefined });
  }

  const reasons: string[] = [];
  let ratingMin: number | undefined;
  let priceMax: number | undefined;
  if (faith === "faith" && food.some((f) => rating(f) < 3.5)) { ratingMin = 3.5; reasons.push("the caterer needs a rating of 3.5 or more"); }
  if (budget === "modest" && food.some((f) => price(f) > 2)) { priceMax = 2; reasons.push("the budget is modest"); }
  if (reasons.length) fixes.push({ section: "food", reason: `Changed the food. ${reasons.map(cap).join(". ")}.`, exclude: [], priceMax, ratingMin });
  return fixes;
}

/** Belt and braces: drop anything that still breaks a rule after the filtered query. Keeps the list if nothing would be left. */
function enforce(s: RunState, fix: Fix) {
  const list = s.recs[fix.section] ?? [];
  const bad = (i: Item) => {
    if (fix.section === "venue") {
      if (fix.exclude.some((id) => BAR_TAG_IDS.includes(id)) && hasBarTag(i)) return true;
      if (fix.exclude.some((id) => ACTIVE_TAG_IDS.includes(id)) && hasActiveTag(i)) return true;
    }
    if (fix.priceMax && i.properties && (i.properties as any).price_level > fix.priceMax) return true;
    if (fix.ratingMin && (i.properties as any)?.business_rating < fix.ratingMin) return true;
    return false;
  };
  const kept = list.filter((i) => !bad(i));
  if (kept.length) s.recs[fix.section] = kept;
}

/** Re-run the Qloo call with filters and rewrite the section. Runs once. */
export async function critique(s: RunState, exec: Exec): Promise<void> {
  if (s.critiqued) return;
  s.critiqued = true;
  if (s.input.constraints.guests === "older") {
    s.programNotes.push("Seated throughout. Plan chairs for everyone, with room for walkers and wheelchairs.");
  }
  for (const fix of findViolations(s)) {
    const base = recommendCall(s, fix.section);
    const withFilters = (relax: boolean): PlannedCall => ({
      ...base,
      input: {
        ...base.input,
        ...(relax ? { include_tags: [] } : {}),
        ...(fix.exclude.length ? { exclude_tags: fix.exclude } : {}),
        ...(fix.priceMax ? { price_level_max: fix.priceMax } : {}),
        ...(fix.ratingMin ? { rating_min: fix.ratingMin } : {}),
      },
    });
    let r = await exec(withFilters(false), "critique", fix.reason);
    if (r.status !== "ok") {
      // Nothing fit with the tag filter; try again with only the family's constraints.
      r = await exec(withFilters(true), "critique", `${fix.reason} (widened the search)`);
    }
    if (r.status !== "ok") {
      s.notes.push(`We could not find a better ${fix.section === "venue" ? "gathering place" : "food option"} that fits every wish. Please check the list.`);
      continue;
    }
    enforce(s, fix);
    await exec(writeCall(s, fix.section), "critique", fix.reason);
    s.notes.push(fix.reason);
  }
}
