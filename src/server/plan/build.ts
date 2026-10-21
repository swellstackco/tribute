import type { Plan } from "../../shared/types.js";
import { allEraItems, erasFrom } from "../agent/picks.js";
import type { RunState } from "../agent/state.js";
import { buildLoves, buildProgram, buildSections } from "./sections.js";

export function buildPlan(s: RunState): Plan {
  const sections = buildSections(s);
  const program = buildProgram(s, sections.music, sections.readings, sections.venue, sections.food);
  return {
    firstName: s.input.firstName.trim(), city: s.input.city, constraints: s.input.constraints,
    loves: buildLoves(s),
    profile: {
      tags: (s.tagProfile ?? []).map((t) => ({ tag_id: t.id, name: t.name, subtype: t.type, affinity: t.affinity ?? 0 })),
      eras: erasFrom(allEraItems(s)),
      audience: s.audience,
    },
    sections, program, notes: [...s.notes],
  };
}
