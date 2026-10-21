// Tag lists used by the critique pass. Edit here, nowhere else.
// Real Qloo place tags are noisy (a hotel or banquet center can carry "bar" as an amenity), so we only
// treat a place as a bar when its main category says so, or its name does. Verified with scripts/probe.ts.
const CAT = "urn:tag:category:place:";
export const BAR_TAG_IDS = ["bar", "night_club", "nightclub", "brewery", "pub", "tavern", "sports_bar", "cocktail_bar", "wine_bar", "bar_grill", "lounge", "casino"].map((x) => CAT + x);
export const BAR_NAME = /\b(bar|pub|tavern|saloon|nightclub|night club|brewery|brewing|taproom|brewpub|lounge|cantina|speakeasy)\b/i;

export const ACTIVE_TAG_IDS = [`${CAT}hiking_trail`, `${CAT}biking_trail`, "urn:tag:amenity:place:rooftop_terrace", "urn:tag:amenity:place:rooftop_bar", `${CAT}rooftop`];
export const ACTIVE_NAME = /\b(hiking|trail|rooftop|adventure park|ropes course)\b/i;

export interface TagLike { id: string; name: string }
export interface PlaceLike { name: string; tags: TagLike[] }
export const hasBarTag = (p: PlaceLike) => p.tags.some((t) => BAR_TAG_IDS.includes(t.id)) || BAR_NAME.test(p.name);
export const hasActiveTag = (p: PlaceLike) => p.tags.some((t) => ACTIVE_TAG_IDS.includes(t.id)) || ACTIVE_NAME.test(p.name);
