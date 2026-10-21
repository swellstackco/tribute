import type { Item } from "../tools/index.js";
import type { PickWhy } from "../../shared/types.js";
import { resolvedEntities, type RunState } from "../agent/state.js";

/** Names of the loves that were used as Qloo signals, keyed by entity id. */
export function signalNames(s: RunState): Map<string, string> {
  const m = new Map<string, string>();
  for (const [text, l] of Object.entries(s.love)) if (l.state === "item") m.set(l.item.id, l.item.name || text);
  return m;
}

/** The love texts (as the family typed them) that resolved to a tag, keyed by tag id. */
export function tagLoveText(s: RunState): Map<string, string> {
  const m = new Map<string, string>();
  for (const [text, l] of Object.entries(s.love)) if (l.state === "tag") m.set(l.item.id, text);
  return m;
}

export function whyFor(item: Item, s: RunState): PickWhy[] {
  const names = signalNames(s);
  const typedAsEntity = names.get(item.id);
  if (typedAsEntity) return [{ signal: `You named ${typedAsEntity}` }];
  const loveTag = tagLoveText(s).get(item.id);
  if (loveTag) return [{ signal: `You named "${loveTag}"` }];
  const out: PickWhy[] = [];
  // Explainability contributions, when the key returns them.
  for (const e of item.explain ?? []) {
    const n = names.get(e.id);
    if (n) out.push({ signal: n, contribution: e.contribution });
  }
  if (!out.length) {
    for (const e of resolvedEntities(s).slice(0, 3)) out.push({ signal: e.name });
  }
  // Places also follow the cuisine the family named.
  if (item.type === "urn:entity:place") {
    const cuisine = [...tagLoveText(s).entries()].find(([id]) => id.includes(":cuisine:"));
    if (cuisine && (item.tags ?? []).some((t) => t.id === cuisine[0])) out.unshift({ signal: `You named "${cuisine[1]}"` });
  }
  return out.slice(0, 3);
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(", ")}, and ${xs.at(-1)}`);

/** One-line "how we chose" per section. */
export function howWeChose(section: string, s: RunState): string {
  const loves = resolvedEntities(s).slice(0, 4).map((e) => e.name);
  const base = loves.length ? `Qloo looked at what fans of ${list(loves)} also love` : "Qloo looked at what people with this taste also love";
  switch (section) {
    case "music": return `${base}, then listed the artists they play most.`;
    case "readings": return `${base}, then listed the books and shows to hear.`;
    case "food": return `Qloo looked for places near ${s.input.city} that match the foods you named and the taste of ${list(loves.slice(0, 2)) || "your loved one"}.`;
    case "venue": return `Qloo looked for places near ${s.input.city} that fit the taste and the guests you described.`;
    case "screen": return `${base}, then listed the films and shows. The years come from when they were made.`;
    default: return "The order of service is a simple plan. We put the chosen music and readings in place.";
  }
}
