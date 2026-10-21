import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { checkParams } from "./params.js";
import type { InsightsEntity, InsightsResult, Params, QlooClient, SearchResult, TagLookup } from "./types.js";

type Fx = {
  search: Record<string, SearchResult[]>;
  tags: Record<string, TagLookup[]>;
  insights: Record<string, any>;
  places: Record<string, InsightsEntity[]>;
  entities: Record<string, SearchResult>;
};

export const norm = (s: string) =>
  s.toLowerCase().replace(/[.'’]/g, "").replace(/[^a-z0-9\- ]+/g, " ").replace(/\s+/g, " ").trim();
const stripThe = (s: string) => s.replace(/^the /, "");

function loadFx(dir: string): Fx {
  const r = (f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  return { search: r("search.json"), tags: r("tags.json"), insights: r("insights.json"), places: r("places.json"), entities: r("entities.json") };
}

const fakeId = (seed: string) => {
  const h = crypto.createHash("sha256").update(seed).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
const hasWord = (hay: string, needle: string) => new RegExp(`(^| )${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(hay);

export class MockQlooClient implements QlooClient {
  readonly mode = "mock" as const;
  private fx: Fx;
  constructor(dir = path.resolve(process.cwd(), "fixtures/qloo")) { this.fx = loadFx(dir); }

  async search(q: { query: string; types?: string[]; take?: number }): Promise<SearchResult[]> {
    const n = norm(q.query);
    const keys = Object.keys(this.fx.search).sort((a, b) => b.length - a.length);
    const key = [n, stripThe(n)].find((k) => k in this.fx.search) ?? keys.find((k) => hasWord(n, k));
    let rows: SearchResult[];
    if (key !== undefined) rows = this.fx.search[key];
    else {
      const t = q.types?.[0] ?? "urn:entity:artist";
      rows = [{ name: titleCase(stripThe(n)) || "Unknown", entity_id: fakeId(`search:${n}`), types: [t], popularity: 0.5, properties: {}, tags: [] }];
    }
    if (q.types?.length) {
      const f = rows.filter((r) => r.types.some((t) => q.types!.includes(t)));
      rows = f;
    }
    return rows.slice(0, q.take ?? 5);
  }

  async tags(q: { query: string; semantic?: boolean; take?: number }): Promise<TagLookup[]> {
    const n = norm(q.query);
    const keys = Object.keys(this.fx.tags).sort((a, b) => b.length - a.length);
    const key = [n, stripThe(n)].find((k) => k in this.fx.tags) ?? keys.find((k) => hasWord(n, k));
    if (key !== undefined) return this.fx.tags[key].slice(0, q.take ?? 10);
    const slug = n.replace(/ /g, "_") || "unknown";
    return [{ id: `urn:tag:keyword:media:${slug}`, name: titleCase(n), type: "urn:tag:keyword" }];
  }

  async entities(ids: string[]): Promise<SearchResult[]> {
    return ids.map((i) => this.fx.entities[i]).filter(Boolean);
  }

  cacheSize() { return 0; }

  async insights(params: Params): Promise<InsightsResult> {
    const p = checkParams(params);
    const type = String(p["filter.type"] ?? "");
    const take = Number(p["take"] ?? 10);
    const signals = String(p["signal.interests.entities"] ?? "").split(",").filter(Boolean);
    const sortedSig = [...signals].sort().join(",");

    if (type === "urn:entity:place") return { entities: this.places(p, take) };

    const exact = `insights:${type}:${sortedSig}`;
    let entry = this.fx.insights[exact];
    if (!entry) {
      let best = 0;
      for (const [k, v] of Object.entries(this.fx.insights)) {
        if (!k.startsWith(`insights:${type}:`) || k.endsWith(":*")) continue;
        const ids = k.slice(`insights:${type}:`.length).split(",");
        const overlap = ids.filter((i) => signals.includes(i)).length;
        if (overlap > best) { best = overlap; entry = v; }
      }
    }
    if (!entry) entry = this.fx.insights[`insights:${type}:*`];
    if (!entry) return {};
    const out: InsightsResult = JSON.parse(JSON.stringify(entry));

    if (out.demographics) out.demographics = out.demographics.map((d) => ({ ...d, entity_id: d.entity_id === "*" ? signals[0] ?? d.entity_id : d.entity_id })).slice(0, take);
    if (out.tags) out.tags = out.tags.slice(0, take);
    if (out.entities) {
      const cand = String(p["filter.results.entities"] ?? "").split(",").filter(Boolean);
      if (cand.length) {
        // rank: score any candidate, known ones from the fixtures, others by a stable hash
        const known = new Map(out.entities.map((e) => [e.entity_id, e]));
        out.entities = cand.map((cid) => {
          const hit = known.get(cid);
          if (hit) return hit;
          const reg = this.fx.entities[cid];
          const h = parseInt(crypto.createHash("sha256").update(cid + sortedSig).digest("hex").slice(0, 4), 16) / 65535;
          return reg ? ({ ...reg, subtype: reg.types[0], query: { affinity: +(0.3 + h * 0.4).toFixed(2) } } as InsightsEntity) : null;
        }).filter(Boolean) as InsightsEntity[];
        out.entities.sort((a, b) => b.query.affinity - a.query.affinity);
      }
      if (p["feature.explainability"] !== true && p["feature.explainability"] !== "true") {
        out.entities = out.entities.map((e) => { const { explainability, ...q } = e.query as any; return { ...e, query: q }; });
      }
      // Never return signal entities as recommendations of themselves for the same type.
      out.entities = out.entities.slice(0, take);
    }
    return out;
  }

  private places(p: Params, take: number): InsightsEntity[] {
    const loc = norm(String(p["filter.location.query"] ?? p["signal.location.query"] ?? ""));
    const key = Object.keys(this.fx.places).find((k) => k !== "*" && loc.includes(k));
    const city = key ? null : titleCase(loc.split(",")[0].trim() || "Your Town");
    let rows: InsightsEntity[] = JSON.parse(JSON.stringify(this.fx.places[key ?? "*"]));
    if (city) rows = rows.map((r) => {
      const props = r.properties as any;
      return { ...r, entity_id: fakeId(`place:${city}:${r.name}`), properties: { ...props, address: String(props.address).replace("{CITY}", city).replace(/, US$/, ""), geocode: { ...props.geocode, city } } };
    });
    const tagList = (v: unknown) => String(v ?? "").split(",").filter(Boolean);
    const inc = tagList(p["filter.tags"]);
    const exc = tagList(p["filter.exclude.tags"]);
    const maxPrice = p["filter.price_level.max"] !== undefined ? Number(p["filter.price_level.max"]) : undefined;
    const minRating = p["filter.properties.business_rating.min"] !== undefined ? Number(p["filter.properties.business_rating.min"]) : undefined;
    rows = rows.filter((r) => {
      const ids = (r.tags ?? []).map((t) => t.id);
      if (inc.length && !inc.some((t) => ids.includes(t))) return false;
      if (exc.some((t) => ids.includes(t))) return false;
      const props = r.properties as any;
      if (maxPrice !== undefined && props.price_level > maxPrice) return false;
      if (minRating !== undefined && props.business_rating < minRating) return false;
      return true;
    });
    if (!(p["feature.explainability"] === true || p["feature.explainability"] === "true")) {
      rows = rows.map((r) => { const { explainability, ...q } = r.query as any; return { ...r, query: q }; });
    }
    return rows.sort((a, b) => b.query.affinity - a.query.affinity).slice(0, take);
  }
}
