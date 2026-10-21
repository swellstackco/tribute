/** Helpers that turn what a family typed into something Qloo can match. */
const LEAD = /^(the|a|an|her|his|their|my|our)\s+/i;
const TRAIL = /\s+(films?|movies?|westerns?|shows?|series|music|songs?|albums?|books?|novels?|food|cuisine|games?)$/i;

export const norm = (s: string | undefined) =>
  (s ?? "").toLowerCase().replace(/[.'’]/g, "").replace(/[^a-z0-9 -]+/g, " ").replace(/\s+/g, " ").trim().replace(/^the /, "");

export const stripLead = (t: string) => t.trim().replace(LEAD, "").trim() || t.trim();

/** "Clint Eastwood westerns" -> "Clint Eastwood"; "Thai food" -> "Thai". */
export function cleanLove(t: string): string {
  const s = stripLead(t).replace(TRAIL, "").trim();
  return s || stripLead(t);
}

/** For tag lookups: "fried catfish and greens" -> "fried catfish"; "black coffee at the diner" -> "black coffee". */
export function tagQuery(t: string): string {
  return cleanLove(t).split(/\s+(?:and|at the|at|with|in the)\s+/i)[0].trim();
}

/** Dish and drink words that point to a cuisine tag Qloo can filter places by. */
const CUISINE_HINTS: Array<[RegExp, string]> = [
  [/\b(carne asada|tacos?|burritos?|enchiladas?|tamales?|salsa|mexican)\b/i, "Mexican"],
  [/\b(catfish|collard|greens|grits|fried chicken|cornbread|soul food|southern)\b/i, "Soul Food"],
  [/\b(pad thai|curry|thai)\b/i, "Thai"],
  [/\b(bbq|barbecue|brisket|ribs)\b/i, "Barbecue"],
  [/\b(pizza|pasta|lasagna|italian)\b/i, "Italian"],
  [/\b(sushi|ramen|japanese)\b/i, "Japanese"],
  [/\b(diner|pancakes?|breakfast|coffee)\b/i, "Diner"],
  [/\b(chinese|dumplings?|dim sum)\b/i, "Chinese"],
  [/\b(burgers?|hot dogs?|american)\b/i, "American"],
  [/\b(pho|vietnamese)\b/i, "Vietnamese"],
];
export function cuisineHint(love: string): string | null {
  for (const [re, name] of CUISINE_HINTS) if (re.test(love)) return name;
  return null;
}

export interface TagLike { id: string; name: string }
export const CUISINE_PREF = ["urn:tag:genre:place:restaurant:", "urn:tag:cuisine:", "urn:tag:category:place:"];
export const VENUE_PREF = ["urn:tag:category:place:", "urn:tag:genre:place:"];
export const TOPIC_PREF = ["urn:tag:hobby", "urn:tag:genre:media:", "urn:tag:specialty_dish", "urn:tag:menu_highlight", "urn:tag:nearby_attraction", "urn:tag:amenity", "urn:tag:genre:place:restaurant:", "urn:tag:cuisine:"];

/** Best tag from a lookup: exact name first, then the preferred id namespaces, then Qloo's own order. */
export function pickTag<T extends TagLike>(items: T[], query: string, pref: string[] = TOPIC_PREF): T | undefined {
  const q = norm(query);
  const exact = items.filter((t) => norm(t.name) === q);
  const pool = exact.length ? exact : items;
  for (const p of pref) {
    const hit = pool.find((t) => t.id.startsWith(p));
    if (hit) return hit;
  }
  return pool[0];
}
