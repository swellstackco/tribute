import type { Item } from "../tools/index.js";
import type { PickWhy } from "../../shared/types.js";
import { resolvedEntities, type RunState } from "../agent/state.js";
import { cuisineLoveText } from "../agent/picks.js";

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
  for (const [id, text] of cuisineLoveText(s)) m.set(id, text);
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

/** One-line "how we chose" per section. Short sentences, plain words. */
export function howWeChose(section: string, s: RunState): string {
  const loves = resolvedEntities(s).slice(0, 2).map((e) => e.name);
  const fans = loves.length ? `Qloo looked at fans of ${list(loves)}.` : "Qloo looked at people with this taste.";
  switch (section) {
    case "music": return `${fans} It found the artists they play most.`;
    case "readings": return `${fans} It found books and shows they also love.`;
    case "food": return `Qloo looked near ${s.input.city.split(",")[0]}. It matched the foods you named.`;
    case "venue": return `Qloo looked near ${s.input.city.split(",")[0]}. It matched your guests and your budget.`;
    case "screen": return `${fans} It found films and shows. Years come from when they were made.`;
    default: return "A simple plan. The chosen music and readings are in place.";
  }
}
