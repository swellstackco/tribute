import express, { type Express, type Request, type Response } from "express";
import { EXAMPLES } from "../shared/examples.js";
import type { Services } from "./services.js";
import { parseInput } from "./validate.js";
import type { RunEvent } from "./agent/orchestrator.js";

const clientIp = (req: Request) =>
  String(req.headers["cf-connecting-ip"] ?? req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();

export function mountRoutes(app: Express, sv: Services) {
  const { orchestrator: orc, limiter } = sv;
  const api = express.Router();
  const withExample = (v: any) => {
    const r = sv.db.prepare("SELECT slug FROM examples WHERE run_id = ?").get(v.id) as { slug: string } | undefined;
    return r ? { ...v, example: r.slug } : v;
  };

  // Rate limit, then start. Identical input replays for free and never counts.
  function startRun(req: Request, res: Response, input: ReturnType<typeof Object>) {
    const cached = orc.findCached(input as any);
    if (cached) return res.json({ id: cached, cached: true });
    const verdict = limiter.take(clientIp(req));
    if (!verdict.ok) {
      res.setHeader("Retry-After", String(verdict.retryAfterSec ?? 60));
      return res.status(429).json({ error: verdict.message });
    }
    const id = orc.start(input as any, limiter.hash(clientIp(req)));
    return res.status(202).json({ id, cached: false });
  }

  api.post("/tribute", (req, res) => {
    const p = parseInput(req.body);
    if (!p.ok) return res.status(400).json({ error: p.error });
    startRun(req, res, p.input);
  });

  api.get("/examples", (_req, res) => {
    res.json(Object.values(EXAMPLES).map((e) => ({ slug: e.slug, name: e.name, age: e.age, city: e.city, blurb: e.blurb, loves: e.input.loves })));
  });

  // Example routes are declared before /tribute/:id so "example" is not read as an id.
  api.get("/tribute/example/:slug", (req, res) => {
    const row = sv.db.prepare("SELECT run_id FROM examples WHERE slug = ?").get(req.params.slug) as { run_id: string } | undefined;
    if (!row) return res.status(404).json({ error: "We could not find that example." });
    const v = orc.view(row.run_id);
    if (!v) return res.status(404).json({ error: "We could not find that example." });
    res.json(withExample(v));
  });

  api.post("/tribute/example/:slug/rebuild", (req, res) => {
    const ex = EXAMPLES[req.params.slug];
    if (!ex) return res.status(404).json({ error: "We could not find that example." });
    const verdict = limiter.take(clientIp(req));
    if (!verdict.ok) {
      res.setHeader("Retry-After", String(verdict.retryAfterSec ?? 60));
      return res.status(429).json({ error: verdict.message });
    }
    const id = orc.start({ ...ex.input, slug: undefined }, limiter.hash(clientIp(req)));
    res.status(202).json({ id, cached: false });
  });

  api.get("/tribute/:id", (req, res) => {
    const v = orc.view(req.params.id);
    if (!v) return res.status(404).json({ error: "We could not find that tribute." });
    res.json(withExample(v));
  });

  api.get("/tribute/:id/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no",
    });
    const send = (e: RunEvent) => res.write(`event: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`);
    const unsub = orc.subscribe(req.params.id, (e) => {
      send(e);
      if (e.type === "done" || e.type === "error") setTimeout(() => res.end(), 20);
    });
    if (!unsub) { send({ type: "error", data: { message: "We could not find that tribute." } }); return res.end(); }
    const hb = setInterval(() => res.write(": heartbeat\n\n"), 10_000);
    req.on("close", () => { clearInterval(hb); unsub(); });
  });

  api.post("/tribute/:id/answer", (req, res) => {
    const idx = Number((req.body ?? {}).option);
    if (!orc.answer(req.params.id, idx)) return res.status(409).json({ error: "There is no question to answer right now." });
    res.json({ ok: true });
  });

  app.use("/api", api);
}
