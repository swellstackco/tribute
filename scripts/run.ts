import { loadConfig } from "../src/server/config.js";
import { createServices } from "../src/server/services.js";
import { EXAMPLES } from "../src/shared/examples.js";
import type { RunInput } from "../src/shared/types.js";

function arg(name: string, def?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}

const config = loadConfig();
const sv = createServices(config);
const positional = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && !(i > 0 && all[i - 1].startsWith("--")));
let input: RunInput;
if (positional.length === 1 && EXAMPLES[positional[0]]) input = EXAMPLES[positional[0]].input;
else {
  input = {
    loves: positional, firstName: arg("name", "") as string, city: arg("city", "Springfield") as string,
    constraints: { faith: (arg("faith", "either") as any), budget: (arg("budget", "middle") as any), guests: (arg("guests", "mixed") as any) },
  };
}
const t0 = Date.now();
const id = sv.orchestrator.start(input);
sv.orchestrator.subscribe(id, (e) => {
  if (e.type === "question") {
    console.log(`? ${e.data.text} -> answering option 0 (${e.data.options[0]})`);
    setTimeout(() => sv.orchestrator.answer(id, 0), 10);
  }
});
const view = await sv.orchestrator.finished(id);
console.log("\nLEDGER");
for (const s of view.steps) console.log(`${String(s.n).padStart(2)}  ${s.tool.padEnd(28)} ${s.status.padEnd(11)} ${String(s.result_count).padStart(3)}  ${String(s.ms).padStart(4)}ms  ${s.source.padEnd(8)} ${s.top.join(", ")}`);
console.log(`\n${view.steps.length} steps in ${Date.now() - t0} ms (${view.mode}/${view.provider})\n`);
console.log(JSON.stringify(view.plan, null, 2));
