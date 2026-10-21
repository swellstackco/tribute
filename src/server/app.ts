import express from "express";
import type { Config } from "./config.js";

export function createApp(config: Config) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "20kb" }));
  app.get("/health", (_req, res) => {
    res.json({ ok: true, qloo: config.qlooMode, llm: config.llmProvider });
  });
  return app;
}
