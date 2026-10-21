import { resolvedIds, type RunState } from "./state.js";
import type { PlannedCall } from "./absorb.js";
import { cuisineTags, foodFallbackTags, programItems, readingItems, listenItems, venueTags, musicIds, foodItems, venueItems, screenItems } from "./picks.js";
import { plannerSentence } from "./sentences.js";
import { cuisineHint, tagQuery } from "../tools/clean.js";
import { SECTIONS, type SectionName } from "../tools/index.js";

const VENUE_WORDS = ["event venue", "banquet hall", "community center", "wedding venue", "park"];
export const REC_ORDER = ["artist", "book", "movie", "tv_show", "podcast", "food", "venue"] as const;

export const venueWords = (s: RunState) => (s.input.constraints.faith === "faith" ? [...VENUE_WORDS, "fellowship hall"] : VENUE_WORDS);

/**
 * The deterministic planner: returns the next required call in phase order, or null when every
 * section is written. It is the mock LLM, the gap filler when a model stops early, and the fallback.
 */
export function planNext(s: RunState): PlannedCall | null {
  const loves = s.input.loves;
  // 1 Resolve
  if (!s.described) return { name: "qloo_describe", input: { entities: loves } };
  if (!s.tagsDone) {
    const unmatched = loves.filter((l) => s.love[l]?.state === "empty");
    const topicQueries = unmatched.map((l) => { const q = tagQuery(l); s.tagQueryLove[q] = l; return q; });
    // Dishes and drinks are not place filters; their cuisine is.
    for (const l of loves) { const c = cuisineHint(l); if (c && !s.cuisineQueries[c]) s.cuisineQueries[c] = l; }
    const queries = [...new Set([...topicQueries, ...Object.keys(s.cuisineQueries), ...venueWords(s), "caterer", "restaurant"])];
    return { name: "qloo_find_tags", input: { queries } };
  }
  // 2 Clarify (once)
  const amb = Object.entries(s.love).find(([, v]) => v.state === "ambiguous");
  if (amb && !s.ctx.questionsAsked) {
    const [love, v] = amb as [string, { state: "ambiguous"; candidates: { name: string; type: string }[] }];
    const opts = v.candidates.slice(0, 3).map((c) => `${c.name} (${c.type.replace("urn:entity:", "").replace("_", " ")})`);
    return { name: "ask_family", input: { question: `Did you mean ${opts.length === 2 ? `${opts[0]} or ${opts[1]}` : opts.join(", ")}?`, options: opts }, label: love };
  }
  if (s.question && s.answered && !s.redescribed) {
    // the answer chose a candidate; look it up again by type so it counts as resolved
    const chosen = s.question.candidates[0];
    return { name: "qloo_describe", input: { entity: s.question.love, type: chosen.type.replace("urn:entity:", "") } };
  }
  const ids = resolvedIds(s);
  // 3 Profile
  if (!s.tagProfile && !s.recAttempted.has("__tags") && ids.length) {
    return { name: "qloo_entity_tags", input: { entities: ids.length ? ids : [], limit: 25 }, label: "__tags" };
  }
  if (!s.audience && !s.recAttempted.has("__demo") && ids.length) {
    return { name: "qloo_audience_demographics", input: { entity: ids }, label: "__demo" };
  }
  // 4 Expand
  for (const key of REC_ORDER) {
    if (s.recAttempted.has(key)) continue;
    return recommendCall(s, key, ids);
  }
  // 4b A food search with the cuisine filter found nothing: try caterers and restaurants in general.
  if (s.recAttempted.has("food") && !(s.recs.food?.length) && !s.foodRetried) {
    s.foodRetried = true;
    const c = recommendCall(s, "food", ids);
    return { ...c, input: { ...c.input, include_tags: foodFallbackTags(s).map((t) => t.id) } };
  }
  // 5 Plan
  for (const sec of SECTIONS) {
    if (!s.ctx.written[sec]) return writeCall(s, sec);
  }
  return null;
}

export function recommendCall(s: RunState, key: (typeof REC_ORDER)[number], ids = resolvedIds(s)): PlannedCall {
  const loc = s.input.city;
  const tagIds = [...cuisineTags(s), ...(cuisineTags(s).length ? [] : foodFallbackTags(s))].slice(0, 3).map((t) => t.id);
  switch (key) {
    case "food":
      return { name: "qloo_recommend", label: "food", input: { target_type: "place", signals: ids, filter_location: loc, include_tags: tagIds, limit: 8, explain: false } };
    case "venue":
      return { name: "qloo_recommend", label: "venue", input: { target_type: "place", signals: ids, filter_location: loc, include_tags: venueTags(s).map((t) => t.id), limit: 8 } };
    case "artist":
      return { name: "qloo_recommend", label: key, input: { target_type: "artist", signals: ids, explain: true, limit: 12 } };
    default:
      return { name: "qloo_recommend", label: key, input: { target_type: key, signals: key === "book" || key === "podcast" ? nonBrand(s, ids) : ids, explain: true, limit: key === "podcast" ? 4 : 8 } };
  }
}

/** A team or a company says little about reading taste; drop brands from the signals when others remain. */
function nonBrand(s: RunState, ids: string[]): string[] {
  const keep = ids.filter((id) => !/brand$/.test(s.ctx.seen.get(id)?.type ?? ""));
  return keep.length >= 2 ? keep : ids;
}

export function sectionPickIds(s: RunState, sec: SectionName): string[] {
  const items =
    sec === "music" ? musicIds(s)
    : sec === "readings" ? [...readingItems(s), ...listenItems(s)]
    : sec === "food" ? foodItems(s)
    : sec === "venue" ? venueItems(s)
    : sec === "screen" ? screenItems(s)
    : programItems(s);
  return items.map((i) => i.id);
}

export function writeCall(s: RunState, sec: SectionName): PlannedCall {
  return { name: "write_section", input: { section: sec, picks: sectionPickIds(s, sec), sentence: plannerSentence(sec, s) } };
}
