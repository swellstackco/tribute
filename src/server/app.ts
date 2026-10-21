import express from "express";
import fs from "node:fs";
import path from "node:path";
import type { Config } from "./config.js";
import { mountRoutes } from "./routes.js";
import { createServices, type Services } from "./services.js";

export function createApp(config: Config, services?: Services) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");
  app.use(express.json({ limit: "20kb" }));
  app.get("/health", (_req, res) => {
    res.json({ ok: true, qloo: config.qlooMode, llm: config.llmProvider });
  });
  const sv = services ?? createServices(config);
  mountRoutes(app, sv);
  // Production: serve the built web app.
  const web = path.resolve(process.cwd(), "dist/web");
  if (fs.existsSync(web)) {
    app.use(express.static(web));
    app.get(/^\/(?!api|health).*/, (_req, res) => res.sendFile(path.join(web, "index.html")));
  }
  return Object.assign(app, { services: sv });
}
