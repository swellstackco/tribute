import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/server/config.js";
import { openDb } from "../src/server/db.js";
import { createServices } from "../src/server/services.js";
import { EXAMPLES } from "../src/shared/examples.js";
import { BAR_TAG_IDS } from "../src/server/agent/constraintTags.js";
import type { Plan, RunInput } from "../src/shared/types.js";

async function run(input: RunInput) {
  const sv = createServices(loadConfig({} as NodeJS.ProcessEnv), { db: openDb(":memory:") });
  return sv.orchestrator.finished(sv.orchestrator.start(input));
}
const tagIds = (p: Plan["sections"]["venue"]["picks"][number]) => p.tags.map((t) => t.id);

describe("critique and revise", () => {
  it("Rosalind: at least one critique step and a revised venue", async () => {
    const v = await run(EXAMPLES.roz.input);
    const c = v.steps.filter((s) => s.source === "critique");
    expect(c.length).toBeGreaterThanOrEqual(1);
    expect(c.every((s) => s.reason && s.reason.length > 10)).toBe(true);
    const venue = v.plan!.sections.venue;
    expect(venue.picks.length).toBeGreaterThan(0);
    // no bar, brewery or nightclub survives; chips only show 3 tags so re-check by name too
    for (const p of venue.picks) { expect(tagIds(p).some((t) => BAR_TAG_IDS.includes(t))).toBe(false); expect(p.name).not.toMatch(/Brewing|Rooftop/); }
    expect(v.plan!.notes.join(" ")).toMatch(/gathering place/);
  });

  it("Rosalind: food list respects the modest budget and the rating floor", async () => {
    const v = await run(EXAMPLES.roz.input);
    const places = v.plan!.sections.food.picks.filter((p) => p.type === "place");
    expect(places.length).toBeGreaterThan(0);
    for (const p of places) {
      expect(Number(p.properties.price_level)).toBeLessThanOrEqual(2);
      expect(Number(p.properties.business_rating)).toBeGreaterThanOrEqual(3.5);
    }
  });

  it("Dana: zero critique steps", async () => {
    const v = await run(EXAMPLES.dana.input);
    expect(v.steps.filter((s) => s.source === "critique").length).toBe(0);
  });

  it("Walt (older guests): venue has no bar, trail or rooftop, and the program is seated throughout", async () => {
    const v = await run(EXAMPLES.walt.input);
    expect(v.steps.some((s) => s.source === "critique")).toBe(true);
    for (const p of v.plan!.sections.venue.picks) expect(p.name).not.toMatch(/Saloon|Starlite|Ridgeview/);
    expect(v.plan!.program.notes.join(" ")).toMatch(/Seated throughout/);
  });

  it("an over-budget caterer is revised: final food list is price level 2 or lower", async () => {
    const input: RunInput = { loves: ["Merle Haggard", "Johnny Cash", "Clint Eastwood", "Dolly Parton", "Willie Nelson"], firstName: "Lee", city: "Bakersfield, CA", constraints: { faith: "either", budget: "modest", guests: "mixed" } };
    const v = await run(input);
    expect(v.steps.some((s) => s.source === "critique" && /budget/.test(s.reason ?? ""))).toBe(true);
    for (const p of v.plan!.sections.food.picks.filter((x) => x.type === "place")) expect(Number(p.properties.price_level)).toBeLessThanOrEqual(2);
  });

  it("secular plans never contain prayer or blessing slots", async () => {
    const v = await run({ ...EXAMPLES.roz.input, constraints: { faith: "secular", budget: "modest", guests: "older" } });
    expect(v.plan!.program.slots.some((s) => /prayer|blessing/i.test(s.label))).toBe(false);
  });

  it("critique stays within the 16-call limit", async () => {
    const v = await run(EXAMPLES.roz.input);
    expect(v.steps.filter((s) => s.kind === "data" || s.kind === "ask").length).toBeLessThanOrEqual(16);
  });
});
