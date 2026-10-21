import type { Params } from "./types.js";

// Parameter names from the Qloo docs. Unknown names are silently ignored by Qloo (empty results),
// so we refuse to send them.
export const ALLOWED_PARAMS = new Set([
  "query", "types", "take", "offset", "ids", "entity_ids", "page",
  "filter.type", "filter.query", "filter.tag.types", "filter.tags", "filter.tags.operator",
  "filter.exclude.tags", "filter.exclude.tags.operator",
  "filter.location.query", "filter.location", "filter.location.radius",
  "filter.price_level.min", "filter.price_level.max",
  "filter.properties.business_rating.min", "filter.properties.business_rating.max",
  "filter.results.entities", "filter.popularity.min", "filter.popularity.max",
  "filter.release_year.min", "filter.release_year.max", "filter.publication_year.min", "filter.publication_year.max",
  "signal.interests.entities", "signal.interests.tags", "signal.interests.tags.operator",
  "signal.location.query", "signal.location", "signal.demographics.age", "signal.demographics.gender",
  "feature.explainability", "feature.typo_tolerance", "feature.semantic_search",
  "bias.trends", "sort_by",
]);

export function checkParams(params: Params, strict = process.env.NODE_ENV !== "production"): Params {
  const out: Params = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    if (!ALLOWED_PARAMS.has(k)) {
      if (strict) throw new Error(`Unknown Qloo parameter: ${k}`);
      console.warn(`[qloo] dropping unknown parameter ${k}`);
      continue;
    }
    out[k] = v;
  }
  return out;
}

const enc = (s: string) => encodeURIComponent(s).replace(/%3A/gi, ":").replace(/%2C/gi, ",");

/** Builds the query string in the order the caller gave (stable for snapshots). */
export function toQueryString(params: Params): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${enc(Array.isArray(v) ? v.join(",") : String(v))}`)
    .join("&");
}

export function sortedQueryString(params: Params): string {
  return toQueryString(Object.fromEntries(Object.entries(params).sort(([a], [b]) => (a < b ? -1 : 1))));
}
