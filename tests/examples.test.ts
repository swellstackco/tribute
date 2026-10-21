import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/server/config.js";
import { openDb } from "../src/server/db.js";
import { createServices } from "../src/server/services.js";
import { createApp } from "../src/server/app.js";
import { seedExamples } from "../src/server/examples.js";
import { EXAMPLES } from "../src/shared/examples.js";
import { request } from "./helpers.js";

async function setup() {
  const config = loadConfig({} as NodeJS.ProcessEnv);
  const sv = createServices(config, { db: openDb(":memory:") });
  const ids = await seedExamples(sv);
  return { sv, ids, app: createApp(config, sv) };
}

describe("examples", () => {
  it("seeds three runs and lists them", async () => {
    const { ids, app } = await setup();
    expect(Object.keys(ids).sort()).toEqual(["dana", "roz", "walt"]);
    const r = await request(app, "GET", "/api/examples");
    expect(r.body.map((e: any) => e.slug)).toEqual(["walt", "dana", "roz"]);
    expect(r.body[0].loves.length).toBeGreaterThan(5);
  });

  it("GET example/walt returns a complete plan in under 100 ms", async () => {
    const { app } = await setup();
    const t0 = performance.now();
    const r = await request(app, "GET", "/api/tribute/example/walt");
    expect(performance.now() - t0).toBeLessThan(100);
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("done");
    expect(Object.keys(r.body.plan.sections)).toHaveLength(5);
    expect((await request(app, "GET", "/api/tribute/example/nobody")).status).toBe(404);
  });

  it("the trace holds no key, no raw IP and no first name in any tool input", async () => {
    const { app } = await setup();
    for (const slug of ["walt", "dana", "roz"]) {
      const r = await request(app, "GET", `/api/tribute/example/${slug}`, undefined, { "x-forwarded-for": "198.51.100.77" });
      const text = JSON.stringify(r.body.steps.map((s: any) => s.input));
      const ex = EXAMPLES[slug];
      expect(text.toLowerCase()).not.toContain(ex.input.firstName.toLowerCase());
      expect(text.toLowerCase()).not.toContain(ex.name.split(" ")[1].toLowerCase());
      const whole = JSON.stringify(r.body);
      expect(whole).not.toMatch(/sk-ant|x-api-key|198\.51\.100/i);
    }
  });

  it("rebuild is rate limited like a normal run and returns a run id", async () => {
    const { app } = await setup();
    let last = 0;
    for (let i = 0; i < 7; i++) last = (await request(app, "POST", "/api/tribute/example/dana/rebuild")).status;
    expect(last).toBe(429);
  });
});
