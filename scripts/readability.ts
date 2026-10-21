/**
 * Fails (exit 1) if any participant string or planner sentence is above grade 6,
 * or contains a banned word. Run: npm run readability
 */
import fs from "node:fs";
import { COPY } from "../src/web/copy.js";
import { gradeLevel } from "../src/server/plan/readability.js";
import { loadConfig } from "../src/server/config.js";
import { openDb } from "../src/server/db.js";
import { createServices } from "../src/server/services.js";
import { EXAMPLES } from "../src/shared/examples.js";
import type { Plan } from "../src/shared/types.js";

const MAX = 6;
const BANNED = /\b(funeral|death|dead|deceased|corpse|morbid|rip|ai-powered|artificial intelligence|chatbot)\b/i;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function* strings(x: unknown, path: string): Generator<[string, string]> {
  if (typeof x === "string") yield [path, x];
  else if (typeof x === "function") yield [`${path}()`, (x as (n: string) => string)("Walt")];
  else if (Array.isArray(x)) for (const [i, v] of x.entries()) yield* strings(v, `${path}[${i}]`);
  else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) yield* strings(v, `${path}.${k}`);
}

const items: Array<[string, string]> = [...strings(COPY, "COPY")];

const sv = createServices(loadConfig({} as NodeJS.ProcessEnv), { db: openDb(":memory:") });
const inputs = [
  ...Object.values(EXAMPLES).map((e) => e.input),
  { loves: ["Zebra Accordion Quartet", "Bluegrass Banjo Revival", "knitting", "lemon cake", "sunrise walks"], firstName: "Pat", city: "Duluth, MN", constraints: { faith: "either", budget: "open", guests: "mixed" } } as const,
];
for (const input of inputs) {
  const v = await sv.orchestrator.finished(sv.orchestrator.start(input as any));
  const plan = v.plan as Plan;
  for (const [k, s] of Object.entries(plan.sections)) items.push([`plan(${input.firstName}).${k}.sentence`, s.sentence], [`plan(${input.firstName}).${k}.how`, s.how]);
  items.push([`plan(${input.firstName}).program.sentence`, plan.program.sentence], ...plan.program.notes.map((n, i): [string, string] => [`plan(${input.firstName}).note${i}`, n]));
  items.push(...plan.notes.map((n, i): [string, string] => [`plan(${input.firstName}).revised${i}`, n]));
}

let bad = 0;
let worst = 0;
for (const [where, text] of items) {
  // Flesch-Kincaid is not meaningful for one to three word labels.
  const g = text.trim().split(/\s+/).length < 4 ? 0 : gradeLevel(text.replace(/celebration of life/gi, "day of love")); // brand phrase from the spec is exempt
  worst = Math.max(worst, g);
  const problems: string[] = [];
  if (g > MAX) problems.push(`grade ${g}`);
  if (BANNED.test(text)) problems.push("banned word");
  if (EMOJI.test(text)) problems.push("emoji");
  if (problems.length) { bad++; console.log(`FAIL ${where}: ${problems.join(", ")}: ${text}`); }
}

// No gradients or emoji in the web source.
for (const f of fs.readdirSync("src/web")) {
  if (!/\.(css|ts|html)$/.test(f)) continue;
  const src = fs.readFileSync(`src/web/${f}`, "utf8");
  if (/gradient\(/i.test(src)) { bad++; console.log(`FAIL src/web/${f}: gradient`); }
  if (EMOJI.test(src)) { bad++; console.log(`FAIL src/web/${f}: emoji`); }
}

console.log(`${items.length} strings checked, worst grade ${worst}, ${bad} problems`);
process.exit(bad ? 1 : 0);
