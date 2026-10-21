import type { Plan, SectionPlan } from "../../shared/types.js";
import type { RunState } from "../agent/state.js";

// Minimal version for T5; the full evidence-carrying builder arrives in T6.
export function buildPlan(s: RunState): Plan {
  const sec = (name: "music" | "readings" | "food" | "venue" | "screen"): SectionPlan => ({
    picks: [], sentence: s.ctx.written[name]?.sentence ?? "", how: "",
  });
  return {
    firstName: s.input.firstName, city: s.input.city, constraints: s.input.constraints, loves: [],
    profile: { tags: [], eras: [], audience: null },
    sections: { music: sec("music"), readings: sec("readings"), food: sec("food"), venue: sec("venue"), screen: sec("screen") },
    program: { slots: [], notes: [], sentence: s.ctx.written.program?.sentence ?? "", how: "" }, notes: [],
  };
}
