import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/server/config.js";
import { createApp } from "../src/server/app.js";
import { request } from "./helpers.js";

describe("health", () => {
  it("reports modes", async () => {
    const app = createApp(loadConfig({} as NodeJS.ProcessEnv));
    const r = await request(app, "GET", "/health");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, qloo: "mock", llm: "mock" });
  });
});
