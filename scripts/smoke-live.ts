/**
 * One run of each example plus a custom input against a deployed Tribute, streaming SSE.
 * With LLM_PROVIDER=anthropic on the server this makes about 4 real (cheap) model runs.
 * Usage: npx tsx scripts/smoke-live.ts https://tribute.swellstackco.com [--only walt,dana]
 */
import { EXAMPLES } from "../src/shared/examples.js";
import type { RunInput, RunView } from "../src/shared/types.js";

const base = (process.argv[2] ?? "http://127.0.0.1:5117").replace(/\/$/, "");
const onlyIdx = process.argv.indexOf("--only");
const only = onlyIdx > -1 ? process.argv[onlyIdx + 1].split(",") : null;

const custom: RunInput = {
  loves: ["Willie Nelson", "gardening", "peach cobbler", "Casablanca", "Patsy Cline", "fishing"], firstName: "Lee", city: "Austin, TX",
  constraints: { faith: "either", budget: "modest", guests: "mixed" },
};
const jobs: Array<[string, RunInput]> = [...Object.entries(EXAMPLES).map(([k, e]) => [k, { ...e.input, slug: undefined }] as [string, RunInput]), ["custom", custom]];

async function stream(id: string) {
  const t0 = Date.now();
  const res = await fetch(`${base}/api/tribute/${id}/events`);
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "", first = 0, events: string[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!first) first = Date.now() - t0;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) > -1) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      const ev = /event: (\w+)/.exec(block)?.[1];
      if (ev) events.push(ev);
      if (ev === "question") {
        await fetch(`${base}/api/tribute/${id}/answer`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ option: 0 }) });
      }
    }
  }
  return { first, total: Date.now() - t0, events };
}

for (const [name, input] of jobs) {
  if (only && !only.includes(name)) continue;
  const r = await fetch(`${base}/api/tribute`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  const body: any = await r.json();
  if (!r.ok) { console.log(`${name}: HTTP ${r.status} ${body.error}`); continue; }
  const s = await stream(body.id);
  const v = (await (await fetch(`${base}/api/tribute/${body.id}`)).json()) as RunView;
  const by = (src: string) => v.steps.filter((x) => x.source === src).length;
  const picks = v.plan ? Object.values(v.plan.sections).reduce((n, x) => n + x.picks.length, 0) : 0;
  console.log(`${name.padEnd(7)} ${v.status} provider=${v.provider} cached=${body.cached} first-byte=${s.first}ms total=${s.total}ms sse-events=${s.events.length} (step ${s.events.filter((e) => e === "step").length}) steps: model=${by("model")} planner=${by("planner")} critique=${by("critique")} picks=${picks} notice=${v.notice ?? "-"}`);
}
