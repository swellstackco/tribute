import type { Item } from "../tools/index.js";
import { resolvedEntities, type RunState } from "./state.js";

const short = (t: string) => t.replace("urn:entity:", "");

/** Cuisine tags the family named (found through find_tags). */
export function cuisineTags(s: RunState): Item[] {
  const out: Item[] = [];
  for (const l of Object.values(s.love)) if (l.state === "tag" && l.item.id.includes(":cuisine:")) out.push(l.item);
  for (const [q, items] of Object.entries(s.tagLookups)) {
    if (s.love[q]) continue;
    void q; void items;
  }
  return dedupe(out);
}
export const dedupe = <T extends { id: string }>(xs: T[]) => [...new Map(xs.map((x) => [x.id, x])).values()];

/** Tag ids that describe gathering places (venue words looked up in the tags step). */
export function venueTags(s: RunState): Item[] {
  const words = ["event venue", "banquet hall", "community center", "park", "church hall"];
  return dedupe(words.flatMap((w) => (s.tagLookups[w] ?? []).slice(0, 1)));
}
export function foodFallbackTags(s: RunState): Item[] {
  return dedupe(["caterer", "restaurant"].flatMap((w) => (s.tagLookups[w] ?? []).slice(0, 1)));
}

const typed = (s: RunState, type: string) => resolvedEntities(s).filter((i) => short(i.type) === type);

const byAffinity = (a: Item, b: Item) => (b.affinity ?? 0) - (a.affinity ?? 0);

export function musicIds(s: RunState): Item[] {
  return dedupe([...typed(s, "artist"), ...(s.recs.artist ?? []).slice().sort(byAffinity)]).slice(0, 8);
}
export function readingItems(s: RunState): Item[] {
  return dedupe([...typed(s, "book"), ...(s.recs.book ?? [])]).slice(0, 6);
}
export function listenItems(s: RunState): Item[] {
  return dedupe([...typed(s, "podcast"), ...(s.recs.podcast ?? [])]).slice(0, 2);
}
export function foodItems(s: RunState): Item[] {
  const places = (s.recs.food ?? []).slice(0, 5);
  return dedupe([...cuisineTags(s).slice(0, 2), ...places]);
}
export function venueItems(s: RunState): Item[] {
  return (s.recs.venue ?? []).slice(0, 5);
}
export function screenItems(s: RunState): Item[] {
  const movies = dedupe([...typed(s, "movie"), ...(s.recs.movie ?? [])]);
  const shows = dedupe([...typed(s, "tv_show"), ...(s.recs.tv_show ?? [])]);
  return dedupe([...movies.slice(0, 4), ...shows.slice(0, 2), ...movies.slice(4), ...shows.slice(2)]).slice(0, 6);
}
export function programItems(s: RunState): Item[] {
  return [...musicIds(s).slice(0, 2), ...readingItems(s).slice(0, 1)];
}

export function decadeOf(year: unknown): number | null {
  const y = Number(year);
  return Number.isFinite(y) && y > 1850 && y < 2100 ? Math.floor(y / 10) * 10 : null;
}

/** Top 3 decades by count, from media release years and artists' start years. */
export function erasFrom(items: Item[]): number[] {
  const count = new Map<number, number>();
  for (const i of items) {
    const p = i.properties as Record<string, unknown>;
    const d = decadeOf(p.release_year ?? p.publication_year ?? p.active_since);
    if (d !== null) count.set(d, (count.get(d) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 3).map(([d]) => d).sort((a, b) => a - b);
}

export function allEraItems(s: RunState): Item[] {
  return [...resolvedEntities(s), ...musicIds(s), ...readingItems(s), ...screenItems(s)];
}
