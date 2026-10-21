// Tag lists used by the critique pass. Ids are matched exactly; names are matched by pattern as a backup
// because Qloo's real tag ids are confirmed on the probe (T13). Edit here, nowhere else.
export const BAR_TAG_IDS = [
  "urn:tag:category:place:bar", "urn:tag:category:place:nightclub", "urn:tag:category:place:brewery",
];
export const BAR_NAME = /\b(bar|pub|tavern|saloon|nightclub|night club|brewery|taproom|brewpub)\b/i;

export const ACTIVE_TAG_IDS = ["urn:tag:category:place:hiking_trail", "urn:tag:category:place:rooftop"];
export const ACTIVE_NAME = /\b(hiking|trail|rooftop)\b/i;

export interface TagLike { id: string; name: string }
export const hasBarTag = (tags: TagLike[]) => tags.some((t) => BAR_TAG_IDS.includes(t.id) || BAR_NAME.test(t.name));
export const hasActiveTag = (tags: TagLike[]) => tags.some((t) => ACTIVE_TAG_IDS.includes(t.id) || ACTIVE_NAME.test(t.name));
