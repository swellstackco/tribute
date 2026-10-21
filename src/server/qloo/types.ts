// Shapes follow the documented Qloo hackathon API (see docs/SPEC.md section 4).
// Field names marked "verify" are checked by scripts/probe.ts once a key is available.

export interface QlooTag {
  id: string; // e.g. urn:tag:genre:media:country
  name: string;
  type?: string;
}

/** One row from GET /search (flat results array). */
export interface SearchResult {
  name: string;
  entity_id: string;
  types: string[]; // /search: ["urn:entity:artist"]. /v2/insights rows carry type "urn:entity" and subtype "urn:entity:artist" instead.
  disambiguation?: string;
  popularity?: number; // 0..1
  properties?: Record<string, unknown>;
  tags?: QlooTag[];
}

export interface Explainability {
  // Real (probed): { "signal.interests.entities": [{ entity_id, score }] }. We also accept a plain list or an id -> score map.
  [key: string]: unknown;
}

/** One row of /v2/insights with filter.type = urn:entity:* */
export interface InsightsEntity extends SearchResult {
  subtype?: string; // the entity kind on /v2/insights rows
  type?: string;
  query: { affinity: number; measurements?: unknown; explainability?: Explainability | Array<Record<string, unknown>> };
}

/** One row of /v2/insights with filter.type = urn:tag */
export interface TagInsight {
  tag_id: string;
  name: string;
  subtype?: string;
  types?: string[];
  query: { affinity: number };
}

/** One row of /v2/insights with filter.type = urn:demographics */
export interface DemographicsInsight {
  entity_id: string;
  query: {
    age: Record<string, number>; // 24_and_younger, 25_to_29, ... 55_and_older (affinity deltas)
    gender: { male: number; female: number };
  };
}

/** One row of GET /v2/tags */
export type TagLookup = QlooTag;

export interface InsightsResult {
  entities?: InsightsEntity[];
  tags?: TagInsight[];
  demographics?: DemographicsInsight[];
}

export type Params = Record<string, string | number | boolean | string[] | undefined | null>;

export interface QlooClient {
  readonly mode: "mock" | "live";
  search(q: { query: string; types?: string[]; take?: number }): Promise<SearchResult[]>;
  tags(q: { query: string; semantic?: boolean; take?: number }): Promise<TagLookup[]>;
  insights(params: Params): Promise<InsightsResult>;
  entities(ids: string[]): Promise<SearchResult[]>;
  cacheSize(): number;
}

export class QlooError extends Error {
  constructor(
    public code: "QLOO_AUTH" | "QLOO_RATE_LIMIT" | "QLOO_TIMEOUT" | "QLOO_UPSTREAM",
    message: string,
    public retryable: boolean,
    public status?: number,
  ) {
    super(message);
  }
}
