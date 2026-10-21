import type { RunView, Step } from "../shared/types.js";

export interface ExampleCard { slug: string; name: string; age: number; city: string; blurb: string; loves: string[] }

async function j<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((body as any).error ?? "Something went wrong."), { status: res.status });
  return body as T;
}
export const getExamples = () => fetch("/api/examples").then((r) => j<ExampleCard[]>(r));
export const getExample = (slug: string) => fetch(`/api/tribute/example/${slug}`).then((r) => j<RunView>(r));
export const getRun = (id: string) => fetch(`/api/tribute/${id}`).then((r) => j<RunView>(r));
export const startRun = (body: unknown) =>
  fetch("/api/tribute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => j<{ id: string; cached: boolean }>(r));
export const rebuildExample = (slug: string) => fetch(`/api/tribute/example/${slug}/rebuild`, { method: "POST" }).then((r) => j<{ id: string }>(r));
export const answerQuestion = (id: string, option: number) =>
  fetch(`/api/tribute/${id}/answer`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ option }) }).then((r) => j<{ ok: boolean }>(r));

export interface StreamHandlers {
  onStep(s: Step): void;
  onQuestion(q: { text: string; options: string[]; love: string }): void;
  onNotice(m: string): void;
  onDone(): void;
  onError(m: string): void;
}
export function streamRun(id: string, hd: StreamHandlers): () => void {
  const es = new EventSource(`/api/tribute/${id}/events`);
  let finished = false;
  const parse = (e: MessageEvent) => JSON.parse(e.data);
  es.addEventListener("step", (e) => hd.onStep(parse(e as MessageEvent)));
  es.addEventListener("question", (e) => hd.onQuestion(parse(e as MessageEvent)));
  es.addEventListener("notice", (e) => hd.onNotice(parse(e as MessageEvent).message));
  es.addEventListener("done", () => { finished = true; es.close(); hd.onDone(); });
  es.addEventListener("error", (e) => {
    if (finished) return;
    const data = (e as MessageEvent).data;
    if (data) { finished = true; es.close(); hd.onError(parse(e as MessageEvent).message); }
  });
  return () => { finished = true; es.close(); };
}
