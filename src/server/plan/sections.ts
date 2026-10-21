import type { Item } from "../tools/index.js";
import type { Pick, PlanLove, ProgramPlan, ProgramSlot, SectionPlan } from "../../shared/types.js";
import { priceSigns } from "../../shared/format.js";
import { resolvedEntities, type RunState } from "../agent/state.js";
import { foodItems, listenItems, musicIds, readingItems, screenItems, venueItems } from "../agent/picks.js";
import { howWeChose, whyFor, signalNames, tagLoveText } from "./evidence.js";
import { appleLink, mapLink, spotifyLink } from "./links.js";

const short = (t: string) => t.replace("urn:entity:", "");

function pickType(i: Item): string {
  if (i.kind === "tag") return i.id.includes(":cuisine:") ? "cuisine" : "tag";
  return short(i.type);
}

function detailFor(i: Item): string | undefined {
  const p = i.properties as Record<string, any>;
  switch (pickType(i)) {
    case "book": return [p.author ? `by ${p.author}` : "", p.publication_year ?? ""].filter(Boolean).join(", ");
    case "movie": case "tv_show": return p.release_year ? String(p.release_year) : undefined;
    case "place": return [p.address, priceSigns(p.price_level), p.business_rating ? `${p.business_rating} stars` : ""].filter(Boolean).join(" · ");
    case "artist": return p.active_since ? `Making music since ${p.active_since}` : undefined;
    case "cuisine": return "The kind of food they loved";
    default: return undefined;
  }
}

const SUBSET = ["address", "business_rating", "price_level", "phone", "website", "publication_year", "release_year", "author", "active_since", "image"];

export function toPick(i: Item, s: RunState, extra: { affinity?: number; group?: string } = {}): Pick {
  const names = signalNames(s);
  const tagLoves = tagLoveText(s);
  const p = i.properties as Record<string, any>;
  const props = Object.fromEntries(Object.entries(p).filter(([k]) => SUBSET.includes(k)));
  const type = pickType(i);
  const links: Pick["links"] = {};
  if (type === "artist") { links.apple = appleLink(i.name); links.spotify = spotifyLink(i.name); }
  if (type === "place") links.map = mapLink(i.name, p.address);
  const affinity = i.affinity ?? extra.affinity;
  return {
    id: i.id, name: i.name, type, kind: i.kind, ...(affinity !== undefined ? { affinity } : {}),
    detail: detailFor(i), properties: props, links, why: whyFor(i, s),
    tags: i.tags.filter((t) => !/^(Event venue|Caterer|Restaurant)$/.test(t.name)).slice(0, 3),
    mentioned: names.has(i.id) || tagLoves.has(i.id), ...(extra.group ? { group: extra.group } : {}),
  };
}

/** Affinity for a pick the family typed comes from the recommend lists when Qloo ranked it there. */
function affinityLookup(s: RunState) {
  const m = new Map<string, number>();
  for (const list of Object.values(s.recs)) for (const i of list) if (i.affinity !== undefined) m.set(i.id, i.affinity);
  return m;
}

const fill = (sentence: string, s: RunState) => sentence.replace(/\{name\}/g, s.input.firstName.trim() || "them");

function section(name: "music" | "readings" | "food" | "venue" | "screen", items: Item[], s: RunState, groupFor?: (i: Item) => string | undefined): SectionPlan {
  const aff = affinityLookup(s);
  // Written ids rule: keep only what write_section accepted, in the written order.
  const written = s.ctx.written[name];
  const order = written ? written.picks : items.map((i) => i.id);
  const byId = new Map(items.map((i) => [i.id, i]));
  const chosen = order.map((id) => byId.get(id) ?? s.ctx.seen.get(id)).filter(Boolean) as Item[];
  const picks = chosen.map((i) => toPick(i, s, { affinity: aff.get(i.id), group: groupFor?.(i) }));
  // Typed loves first, then the rest by affinity; stable within each group.
  const typed = picks.filter((p) => p.mentioned);
  const rest = picks.filter((p) => !p.mentioned).sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0));
  // Cuisine tags stay on top of the food list.
  const ordered = name === "food" ? [...typed.filter((p) => p.kind === "tag"), ...typed.filter((p) => p.kind !== "tag"), ...rest] : [...typed, ...rest];
  const finalPicks = ordered.some((p) => p.group) ? [...ordered.filter((p) => !p.group), ...ordered.filter((p) => p.group)] : ordered;
  return { picks: finalPicks, sentence: fill(written?.sentence ?? "", s), how: howWeChose(name, s) };
}

export function buildSections(s: RunState) {
  const podcastIds = new Set(listenItems(s).map((i) => i.id));
  return {
    music: section("music", musicIds(s), s),
    readings: section("readings", [...readingItems(s), ...listenItems(s)], s, (i) => (podcastIds.has(i.id) ? "listen" : undefined)),
    food: section("food", foodItems(s), s),
    venue: section("venue", venueItems(s), s),
    screen: section("screen", screenItems(s), s),
  };
}

export function buildProgram(s: RunState, music: SectionPlan, readings: SectionPlan, venue: SectionPlan, food: SectionPlan): ProgramPlan {
  const faith = s.input.constraints.faith;
  const books = readings.picks.filter((p) => p.group !== "listen");
  const open: ProgramSlot = faith === "faith"
    ? { label: "Opening prayer", detail: "A short prayer from your pastor or a family member", note: "Template slot. This is not a recommendation." }
    : { label: "Opening words", detail: "A welcome from the host" };
  const close: ProgramSlot = faith === "faith"
    ? { label: "Closing blessing", detail: "A blessing to send everyone home", note: "Template slot. This is not a recommendation." }
    : { label: "Closing words", detail: "A thank you from the family" };
  const place = venue.picks[0]?.name;
  const slots: ProgramSlot[] = [
    open,
    { label: "Music", detail: music.picks[0]?.name ? `Listen to ${music.picks[0].name}` : undefined },
    { label: "Reading", detail: books[0] ? `A passage from ${books[0].name}` : "A reading the family picks" },
    { label: "Words from family", detail: "Stories and memories" },
    { label: "Music", detail: music.picks[1]?.name ? `Listen to ${music.picks[1].name}` : undefined },
    { label: "Reading", detail: books[1] ? `A passage from ${books[1].name}` : "A poem or favorite lines" },
    close,
    { label: "Gathering", detail: place ? `Food and stories at ${place}` : "Food and stories together" },
  ];
  void food;
  const notes = [...s.programNotes];
  const written = s.ctx.written.program;
  return { slots, notes, sentence: fill(written?.sentence ?? "", s), how: howWeChose("program", s) };
}

export function buildLoves(s: RunState): PlanLove[] {
  return s.input.loves.map((text) => {
    const l = s.love[text];
    if (l?.state === "item") return { text, resolved: { id: l.item.id, name: l.item.name, type: short(l.item.type), popularity: l.item.popularity, kind: "entity" as const } };
    if (l?.state === "tag") return { text, resolved: { id: l.item.id, name: l.item.name, type: l.item.id.includes(":cuisine:") ? "cuisine" : "tag", kind: "tag" as const } };
    return { text, resolved: null };
  });
}

void resolvedEntities;
