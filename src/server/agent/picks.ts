import type { Item } from "../tools/index.js";
import { CUISINE_PREF, VENUE_PREF, pickTag } from "../tools/clean.js";
import { resolvedEntities, type RunState } from "./state.js";

const short = (t: string) => t.replace("urn:entity:", "");

export const dedupe = <T extends { id: string }>(xs: T[]) => [...new Map(xs.map((x) => [x.id, x])).values()];

/** Cuisine tags (restaurant genres) pointed to by the family's foods; each remembers which love led to it. */
export function cuisineTags(s: RunState): Item[] {
  const out: Item[] = [];
  for (const word of Object.keys(s.cuisineQueries)) {
    const t = pickTag(s.tagLookups[word] ?? [], word, CUISINE_PREF);
    if (t) out.push(t);
  }
  // A love that was itself a cuisine tag (for example "Thai") counts too.
  for (const l of Object.values(s.love)) if (l.state === "tag" && /:(cuisine|genre:place:restaurant):/.test(l.item.id)) out.push(l.item);
  return dedupe(out);
}
export function cuisineLoveText(s: RunState): Map<string, string> {
  const m = new Map<string, string>();
  for (const [word, love] of Object.entries(s.cuisineQueries)) {
    const t = pickTag(s.tagLookups[word] ?? [], word, CUISINE_PREF);
    if (t) m.set(t.id, love);
  }
  return m;
}

/** Tag ids that describe gathering places (venue words looked up in the tags step). */
export const VENUE_WORDS_ALL = ["event venue", "banquet hall", "community center", "wedding venue", "park", "fellowship hall"];
export function venueTags(s: RunState): Item[] {
  return dedupe(VENUE_WORDS_ALL.flatMap((w) => (s.tagLookups[w]?.length ? [pickTag(s.tagLookups[w], w, VENUE_PREF)!] : [])));
}
export function foodFallbackTags(s: RunState): Item[] {
  return dedupe(["caterer", "restaurant"].flatMap((w) => (s.tagLookups[w]?.length ? [pickTag(s.tagLookups[w], w, w === "caterer" ? VENUE_PREF : CUISINE_PREF)!] : [])));
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
// Real Qloo "event venue" results include escape rooms and arcades. Prefer places whose main category fits a gathering.
const VENUE_GOOD = ["banquet_hall", "community_center", "wedding_venue", "church", "event_venue", "park", "restaurant", "hotel"];
const VENUE_BAD = /(escape_room|amusement|arcade|laser_tag|bowling|golf|casino|night_club|nightclub|live_music_venue|childrens|sports_complex|theme_park|gym)/;
export function venueScore(i: Item): number {
  const cats = i.tags.map((t) => t.id.split(":").pop() ?? "");
  if (cats.some((c) => VENUE_BAD.test(c))) return -1;
  const idx = VENUE_GOOD.findIndex((g) => cats.includes(g));
  return idx === -1 ? 0 : VENUE_GOOD.length - idx;
}
export function venueItems(s: RunState): Item[] {
  const list = s.recs.venue ?? [];
  const ranked = list.map((i, n) => ({ i, n, sc: venueScore(i) })).sort((a, b) => b.sc - a.sc || a.n - b.n);
  const good = ranked.filter((r) => r.sc >= 0).map((r) => r.i);
  return (good.length >= 3 ? good : ranked.map((r) => r.i)).slice(0, 5);
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
    const d = decadeOf(p.release_year ?? p.publication_year ?? p.start_year ?? p.active_since);
    if (d !== null) count.set(d, (count.get(d) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 3).map(([d]) => d).sort((a, b) => a - b);
}

export function allEraItems(s: RunState): Item[] {
  return [...resolvedEntities(s), ...musicIds(s), ...readingItems(s), ...screenItems(s)];
}
