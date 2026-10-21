import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/server/config.js";
import { openDb } from "../src/server/db.js";
import { createServices } from "../src/server/services.js";
import { EXAMPLES } from "../src/shared/examples.js";
import { gradeLevel } from "../src/server/plan/readability.js";
import { priceSigns } from "../src/shared/format.js";
import type { Plan, RunInput } from "../src/shared/types.js";

async function run(input: RunInput) {
  const sv = createServices(loadConfig({} as NodeJS.ProcessEnv), { db: openDb(":memory:") });
  const v = await sv.orchestrator.finished(sv.orchestrator.start(input));
  return v;
}

describe("plan builder", () => {
  it("Walt: six sections, music with both links, food with $$ price, three eras, evidence everywhere", async () => {
    const v = await run(EXAMPLES.walt.input);
    const plan = v.plan as Plan;
    expect(Object.keys(plan.sections)).toEqual(["music", "readings", "food", "venue", "screen"]);
    expect(plan.program.slots.length).toBeGreaterThanOrEqual(7);
    const music = plan.sections.music.picks;
    expect(music.length).toBeGreaterThanOrEqual(5);
    expect(music.length).toBeLessThanOrEqual(8);
    for (const p of music) { expect(p.links.apple).toContain("music.apple.com"); expect(p.links.spotify).toContain("open.spotify.com"); }
    const places = plan.sections.food.picks.filter((p) => p.type === "place");
    expect(places.length).toBeGreaterThan(0);
    expect(places.length).toBeLessThanOrEqual(5);
    expect(places.some((p) => p.detail?.includes("$$"))).toBe(true);
    expect(places.every((p) => p.links.map?.includes("google.com/maps"))).toBe(true);
    expect(plan.profile.eras.length).toBe(3);
    for (const sec of Object.values(plan.sections)) {
      expect(sec.sentence.length).toBeGreaterThan(5);
      expect(sec.how.length).toBeGreaterThan(10);
      for (const p of sec.picks) expect(p.why.length).toBeGreaterThanOrEqual(1);
    }
    expect(plan.sections.readings.picks.length).toBeLessThanOrEqual(8);
    expect(plan.sections.screen.picks.length).toBeLessThanOrEqual(6);
  });

  it("typed loves come first and unmentioned picks are present in every section", async () => {
    const plan = (await run(EXAMPLES.walt.input)).plan as Plan;
    const music = plan.sections.music.picks;
    const firstUnmentioned = music.findIndex((p) => !p.mentioned);
    expect(music.slice(0, firstUnmentioned).every((p) => p.mentioned)).toBe(true);
    for (const [name, sec] of Object.entries(plan.sections)) {
      expect(sec.picks.some((p) => !p.mentioned), name).toBe(true);
    }
    const rest = music.slice(firstUnmentioned).map((p) => p.affinity ?? 0);
    expect([...rest].sort((a, b) => b - a)).toEqual(rest);
  });

  it("every pick id is in the trace's tool results", async () => {
    const v = await run(EXAMPLES.dana.input);
    const known = new Set(v.steps.flatMap((s) => s.ids));
    for (const sec of Object.values(v.plan!.sections)) for (const p of sec.picks) expect(known.has(p.id)).toBe(true);
  });

  it("faith slots: faith-based has prayer slots, secular has none", async () => {
    const roz = (await run(EXAMPLES.roz.input)).plan as Plan;
    expect(roz.program.slots.map((s) => s.label)).toContain("Opening prayer");
    expect(roz.program.slots.find((s) => s.label === "Opening prayer")!.note).toMatch(/not a recommendation/);
    const dana = (await run(EXAMPLES.dana.input)).plan as Plan;
    const labels = dana.program.slots.map((s) => s.label);
    expect(labels).toContain("Opening words");
    expect(labels.some((l) => /prayer|blessing/i.test(l))).toBe(false);
  });

  it("price signs", () => {
    expect(priceSigns(2)).toBe("$$");
    expect(priceSigns(undefined)).toBe("");
  });
});

describe("readability of planner sentences", () => {
  for (const slug of ["walt", "dana", "roz"] as const) {
    it(`${slug}: all sentences are grade 6 or lower`, async () => {
      const plan = (await run(EXAMPLES[slug].input)).plan as Plan;
      const all = [...Object.values(plan.sections).map((s) => s.sentence), plan.program.sentence];
      for (const t of all) expect(gradeLevel(t), t).toBeLessThanOrEqual(6);
    });
  }
  it("a custom run with unusual loves stays readable", async () => {
    const plan = (await run({ loves: ["Zebra Accordion Quartet", "Bluegrass Banjo Revival", "knitting", "lemon cake", "sunrise walks"], firstName: "Pat", city: "Duluth, MN", constraints: { faith: "either", budget: "open", guests: "mixed" } })).plan as Plan;
    for (const t of [...Object.values(plan.sections).map((s) => s.sentence), plan.program.sentence]) expect(gradeLevel(t), t).toBeLessThanOrEqual(6);
  });
  it("grade function ranks hard text higher", () => {
    expect(gradeLevel("The dog ran home. We sat down.")).toBeLessThan(gradeLevel("Notwithstanding considerable institutional circumstances, deliberations continued indefinitely."));
  });
});
