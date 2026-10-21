import { EXAMPLES } from "../shared/examples.js";
import type { Services } from "./services.js";

/** Runs the three demo profiles through the orchestrator in the current mode and stores run ids. */
export async function seedExamples(sv: Services, only?: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const ex of Object.values(EXAMPLES)) {
    if (only && !only.includes(ex.slug)) continue;
    const id = sv.orchestrator.start(ex.input);
    const view = await sv.orchestrator.finished(id);
    if (view.status !== "done") throw new Error(`Example ${ex.slug} failed`);
    sv.db.prepare("INSERT OR REPLACE INTO examples (slug, run_id) VALUES (?, ?)").run(ex.slug, id);
    out[ex.slug] = id;
  }
  return out;
}

export function missingExamples(sv: Services): string[] {
  const have = new Set((sv.db.prepare("SELECT slug FROM examples").all() as { slug: string }[]).map((r) => r.slug));
  return Object.keys(EXAMPLES).filter((s) => !have.has(s));
}
