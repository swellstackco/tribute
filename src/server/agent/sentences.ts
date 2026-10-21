import type { RunState } from "./state.js";
import { allEraItems, cuisineTags, erasFrom, foodItems, listenItems, musicIds, readingItems, screenItems, venueItems } from "./picks.js";
import type { SectionName } from "../tools/index.js";

/**
 * Fixed warm sentences for the planner and for the fallback when a model sentence is too hard to read.
 * "{name}" is replaced with the first name (or "them") when the plan is built.
 * Short words and short sentences keep these at a 4th to 6th grade level.
 */
export function plannerSentence(section: SectionName, s: RunState): string {
  const a = (xs: { name: string }[], i: number) => xs[i]?.name;
  switch (section) {
    case "music": {
      const m = musicIds(s);
      return m.length >= 2 ? `These songs sound like {name}. Start with ${a(m, 0)} and ${a(m, 1)}.` : "These songs sound like {name}. Pick the ones that bring back a smile.";
    }
    case "readings": {
      const r = readingItems(s);
      const l = listenItems(s);
      const base = r.length ? `Words {name} would have loved. Look at ${a(r, 0)} for a short reading.` : "Words {name} would have loved. Pick a short passage that feels right.";
      return l.length ? `${base} ${a(l, 0)} is a good one to hear.` : base;
    }
    case "food": {
      const c = cuisineTags(s)[0];
      const p = foodItems(s).find((i) => i.kind === "entity");
      return c && p ? `Food that tastes like {name}: ${c.name.toLowerCase()}. ${p.name} is close by.` : p ? `Food that tastes like home. ${p.name} is close by.` : "Food that tastes like home.";
    }
    case "venue": {
      const v = venueItems(s)[0];
      return v ? `A warm place to gather in ${s.input.city}. ${v.name} is a good place to start.` : `A warm place to gather in ${s.input.city}.`;
    }
    case "screen": {
      const eras = erasFrom(allEraItems(s));
      const m = screenItems(s)[0];
      const era = eras.length ? `Look for photos from the ${eras.map((e) => `${e}s`).join(", ")}.` : "Look for photos from the happy years.";
      return m ? `${era} ${m.name} is a fun one to show.` : era;
    }
    case "program":
      return "A simple order of service, with the music and readings in place.";
  }
}
