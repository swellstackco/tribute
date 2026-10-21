import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import type { Config } from "../config.js";
import type { Db } from "../db.js";
import type { QlooClient } from "../qloo/types.js";
import { AnthropicProvider } from "../llm/anthropic.js";
import { CachedProvider, LlmCache } from "../llm/llmCache.js";
import { MockProvider } from "../llm/mock.js";
import { ProviderError, type Block, type LlmProvider, type Message } from "../llm/provider.js";
import { MeteredProvider, Spend } from "../llm/spend.js";
import { callTool, newContext, toolDefinitions, type Item, type ToolResult, type SectionName } from "../tools/index.js";
import type { DescribeRow } from "../tools/describe.js";
import { gradeLevel } from "../plan/readability.js";
import { buildPlan } from "../plan/build.js";
import type { Mode, Plan, RunInput, RunView, Step, StepKind, StepSource, StepStatus } from "../../shared/types.js";
import { absorb, type PlannedCall } from "./absorb.js";
import { critique } from "./critique.js";
import { planNext } from "./planner.js";
import { systemPrompt, taskMessage } from "./prompts.js";
import { plannerSentence } from "./sentences.js";
import { newRunState, type RunState } from "./state.js";

export const LIMITS = { toolCalls: 16, llmTurns: 6, wallMs: 45_000, answerWaitMs: 5 * 60_000 };

export type RunEvent =
  | { type: "step"; data: Step }
  | { type: "question"; data: { text: string; options: string[]; love: string } }
  | { type: "section"; data: { section: string; sentence: string; count: number } }
  | { type: "notice"; data: { message: string } }
  | { type: "done"; data: { status: "done" } }
  | { type: "error"; data: { message: string } };

interface Run {
  id: string;
  input: RunInput;
  state: RunState;
  status: RunView["status"];
  events: RunEvent[];
  bus: EventEmitter;
  steps: Step[];
  dataCalls: number;
  plan: Plan | null;
  question: RunView["question"];
  answerResolve?: (i: number) => void;
  notice?: string;
  error?: string;
  provider: string;
  spendUsd: number;
  waitedMs: number;
}

export interface OrchestratorDeps {
  config: Config;
  db: Db;
  qloo: QlooClient;
  /** Test hook: supply a custom model provider instead of building one from config. */
  makeProvider?: (spend: Spend) => LlmProvider | null;
}

export const inputHash = (i: RunInput, mode: Mode, provider: string) =>
  crypto.createHash("sha256").update(JSON.stringify([
    i.loves.map((l) => l.trim().toLowerCase()), i.firstName.trim().toLowerCase(), i.city.trim().toLowerCase(), i.constraints, mode, provider,
  ])).digest("hex");

const short = (t: string) => t.replace("urn:entity:", "");

function flatItems(r: ToolResult): Item[] {
  const out: Item[] = [];
  for (const x of r.results as any[]) {
    if (x?.items) out.push(...x.items);
    else if (x?.kind) out.push(x);
  }
  return out;
}

function slim(r: ToolResult) {
  const keep = ["address", "price_level", "business_rating", "publication_year", "release_year", "author"];
  const s = (i: Item) => ({
    id: i.id, name: i.name, type: short(i.type), affinity: i.affinity,
    ...Object.fromEntries(Object.entries(i.properties).filter(([k]) => keep.includes(k))),
    tags: i.tags.slice(0, 3).map((t) => t.name),
  });
  const rows = (r.results as any[]).slice(0, 12).map((x) => (x?.items ? { love: x.love ?? x.query, status: x.status, items: (x.items as Item[]).slice(0, 3).map(s) } : x?.kind ? s(x) : x));
  return JSON.stringify({ status: r.status, summary: r.summary, result_count: r.result_count, error: r.error, results: rows });
}

export class Orchestrator {
  private runs = new Map<string, Run>();
  readonly spend: Spend;
  private llmCache: LlmCache;

  constructor(private d: OrchestratorDeps) {
    this.spend = new Spend(d.db, d.config.spendCap);
    this.llmCache = new LlmCache(d.db);
  }

  get providerName() {
    return this.d.config.llmProvider === "anthropic" ? (this.spend.canSpend() ? "anthropic" : "mock") : "mock";
  }

  /** Returns an existing finished run for identical input, or starts a new one. */
  findCached(input: RunInput): string | null {
    const row = this.d.db.prepare("SELECT id FROM runs WHERE input_hash = ? AND status = 'done' ORDER BY created_at DESC LIMIT 1")
      .get(inputHash(input, this.d.qloo.mode, this.providerName)) as { id: string } | undefined;
    return row?.id ?? null;
  }

  start(input: RunInput, ipHash = ""): string {
    const id = crypto.randomBytes(6).toString("hex");
    const ctx = newContext(this.d.qloo, this.providerName);
    const run: Run = {
      id, input, state: newRunState(input, ctx), status: "running", events: [], bus: new EventEmitter(), steps: [], dataCalls: 0,
      plan: null, question: null, provider: this.providerName, spendUsd: 0, waitedMs: 0,
    };
    run.bus.setMaxListeners(50);
    this.runs.set(id, run);
    this.d.db.prepare("INSERT INTO runs (id, created_at, input_hash, status, mode, provider, ip_hash) VALUES (?,?,?,?,?,?,?)")
      .run(id, Date.now(), inputHash(input, this.d.qloo.mode, run.provider), "running", this.d.qloo.mode, run.provider, ipHash);
    void this.execute(run).catch((e) => this.fail(run, (e as Error).message));
    return id;
  }

  /** Resolves when the run is done or has failed. */
  async finished(id: string): Promise<RunView> {
    const run = this.runs.get(id);
    if (run && run.status !== "done" && run.status !== "error") {
      await new Promise<void>((res) => {
        const check = () => { if (run.status === "done" || run.status === "error") { run.bus.off("event", check); res(); } };
        run.bus.on("event", check);
      });
    }
    return this.view(id)!;
  }

  view(id: string): RunView | null {
    const run = this.runs.get(id);
    if (run) {
      return { id, status: run.status, mode: this.d.qloo.mode, provider: run.provider, question: run.question, steps: run.steps, plan: run.plan, error: run.error, notice: run.notice };
    }
    const row = this.d.db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as any;
    if (!row) return null;
    const trace = row.trace ? JSON.parse(row.trace) : { steps: [] };
    return { id, status: row.status, mode: row.mode, provider: row.provider, steps: trace.steps ?? [], plan: row.plan ? JSON.parse(row.plan) : null, question: null, notice: trace.notice, error: trace.error };
  }

  /** Subscribe with replay. Returns an unsubscribe function. */
  subscribe(id: string, fn: (e: RunEvent) => void): (() => void) | null {
    const run = this.runs.get(id);
    if (!run) {
      const v = this.view(id);
      if (!v) return null;
      for (const s of v.steps) fn({ type: "step", data: s });
      if (v.notice) fn({ type: "notice", data: { message: v.notice } });
      fn(v.status === "error" ? { type: "error", data: { message: v.error ?? "Something went wrong." } } : { type: "done", data: { status: "done" } });
      return () => {};
    }
    for (const e of run.events) fn(e);
    const h = (e: RunEvent) => fn(e);
    run.bus.on("event", h);
    return () => run.bus.off("event", h);
  }

  answer(id: string, optionIndex: number): boolean {
    const run = this.runs.get(id);
    if (!run || run.status !== "waiting" || !run.answerResolve) return false;
    const n = run.question?.options.length ?? 0;
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= n) return false;
    run.answerResolve(optionIndex);
    return true;
  }

  // ---- internals ----

  private emit(run: Run, e: RunEvent) {
    run.events.push(e);
    run.bus.emit("event", e);
  }

  private fail(run: Run, message: string) {
    run.status = "error";
    run.error = "We could not finish this one. Please try again in a moment.";
    this.d.db.prepare("UPDATE runs SET status = 'error', trace = ? WHERE id = ?").run(JSON.stringify({ steps: run.steps, error: run.error, detail: message.slice(0, 200) }), run.id);
    this.emit(run, { type: "error", data: { message: run.error } });
  }

  private buildProvider(run: Run): LlmProvider {
    const mock = new MockProvider(() => run.state);
    if (this.d.makeProvider) return this.d.makeProvider(this.spend) ?? mock;
    if (this.d.config.llmProvider !== "anthropic") return mock;
    if (!this.spend.canSpend()) {
      run.notice = "Planned without the language model (demo budget reached).";
      this.emit(run, { type: "notice", data: { message: run.notice } });
      return mock;
    }
    return new CachedProvider(new MeteredProvider(new AnthropicProvider(this.d.config.anthropicKey), this.spend), this.llmCache);
  }

  private async execute(run: Run) {
    const started = Date.now();
    const s = run.state;
    let provider = this.buildProvider(run);
    run.provider = provider.name;
    const isMock = provider.name === "mock";

    const exec = (call: PlannedCall, source: StepSource, reason?: string) => this.exec(run, call, source, reason);

    const messages: Message[] = [{ role: "user", content: taskMessage(run.input) }];
    const system = systemPrompt();
    const tools = toolDefinitions();
    let turns = 0;
    let wantsFinish = false;
    const deadline = () => started + LIMITS.wallMs + run.waitedMs;

    // Main loop: the model drives (or the mock planner, which is the same loop shape).
    while (turns < LIMITS.llmTurns * (isMock ? 8 : 1) && Date.now() < deadline()) {
      turns++;
      let res;
      try {
        res = await provider.complete({ system, messages, tools, maxTokens: 2048 });
      } catch (e) {
        if (e instanceof ProviderError) {
          run.notice = e.kind === "spend_cap" ? "Planned without the language model (demo budget reached)." : "The language model was busy, so the planner finished the job.";
          this.emit(run, { type: "notice", data: { message: run.notice } });
          provider = new MockProvider(() => run.state);
          break;
        }
        throw e;
      }
      if (!res.toolCalls.length) break;
      const assistant: Block[] = [];
      if (res.text) assistant.push({ type: "text", text: res.text });
      const results: Block[] = [];
      for (const tc of res.toolCalls) {
        assistant.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
        if (tc.name === "finish") { wantsFinish = true; results.push({ type: "tool_result", tool_use_id: tc.id, content: JSON.stringify({ status: "ok", summary: "Finishing." }) }); continue; }
        const r = await exec({ name: tc.name, input: tc.input }, isMock ? "planner" : "model");
        results.push({ type: "tool_result", tool_use_id: tc.id, content: slim(r), is_error: r.status === "error" });
      }
      messages.push({ role: "assistant", content: assistant });
      messages.push({ role: "user", content: results });
      // finish is held back: gap filling and the critique pass run first.
      if (wantsFinish) break;
    }

    // Gap filling: the same planner the mock uses.
    for (let guard = 0; guard < 40; guard++) {
      const next = planNext(s);
      if (!next) break;
      if (next.name !== "write_section" && next.name !== "ask_family" && run.dataCalls >= LIMITS.toolCalls) { this.markSkipped(s, next); continue; }
      await exec(next, "planner", isMock ? undefined : "filled by planner");
    }

    // Self-critique and revise.
    await critique(s, (call, source, reason) => exec(call, source, reason));

    if (!s.ctx.finished) await exec({ name: "finish", input: {} }, "planner");

    run.plan = buildPlan(s);
    run.plan.notes = [...s.notes];
    run.status = "done";
    run.spendUsd = (provider as unknown as { runUsd?: number }).runUsd ?? 0;
    this.d.db.prepare("UPDATE runs SET status='done', plan=?, trace=?, spend_usd=?, provider=? WHERE id=?")
      .run(JSON.stringify(run.plan), JSON.stringify({ steps: run.steps, notice: run.notice }), run.spendUsd, run.provider, run.id);
    this.emit(run, { type: "done", data: { status: "done" } });
  }

  private markSkipped(s: RunState, c: PlannedCall) {
    if (c.name === "qloo_describe") s.described = true;
    else if (c.name === "qloo_find_tags") s.tagsDone = true;
    else if (c.label) s.recAttempted.add(c.label);
    else s.recAttempted.add(`__skip_${c.name}`);
    s.recAttempted.add("__tags"); // never loop on a skipped profile call
    if (c.name === "qloo_audience_demographics") s.recAttempted.add("__demo");
  }

  private async exec(run: Run, call: PlannedCall, source: StepSource, reason?: string): Promise<ToolResult> {
    const s = run.state;
    const kind: StepKind = call.name === "write_section" ? "write" : call.name === "ask_family" ? "ask" : call.name === "finish" ? "finish" : "data";
    const t0 = Date.now();

    if (kind === "data" && run.dataCalls >= LIMITS.toolCalls) {
      return { status: "error", summary: "Tool call limit reached.", results: [], result_count: 0, error: { code: "TOOL_INPUT", retryable: false, recovery: "Write the sections with what you have." } };
    }
    // Model sentences must be easy to read; otherwise use the planner's sentence.
    if (call.name === "write_section" && source === "model") {
      const sec = call.input.section as SectionName;
      const sent = String(call.input.sentence ?? "");
      if (gradeLevel(sent.replace(/\{name\}/g, "Sam")) > 7 && ["music", "readings", "food", "venue", "screen", "program"].includes(sec)) {
        call = { ...call, input: { ...call.input, sentence: plannerSentence(sec, s) } };
        reason = "sentence simplified";
      }
    }
    if (kind === "data") run.dataCalls++;

    let r = await callTool(call.name, call.input, s.ctx);
    absorb(s, call, r);

    const n = run.steps.length + 1;
    const step: Step = {
      n, tool: call.name, kind, input: redact(call.input), status: r.status as StepStatus, summary: r.summary, result_count: r.result_count,
      top: topOf(r), ids: idsOf(r), ms: Date.now() - t0, source, ...(reason ? { reason } : {}),
    };
    run.steps.push(step);
    this.emit(run, { type: "step", data: step });

    if (call.name === "write_section" && r.status === "ok") {
      this.emit(run, { type: "section", data: { section: String(call.input.section), sentence: String(call.input.sentence), count: (call.input.picks as string[]).length } });
    }

    if (call.name === "ask_family" && r.status === "needs_input") {
      const options = (r.results as Array<{ option: string }>).map((o) => o.option);
      const amb = Object.entries(s.love).find(([, v]) => v.state === "ambiguous");
      run.question = { text: r.summary, options, love: amb?.[0] ?? "" };
      run.status = "waiting";
      this.emit(run, { type: "question", data: run.question });
      const w0 = Date.now();
      const idx = await new Promise<number>((resolve) => {
        run.answerResolve = resolve;
        setTimeout(() => resolve(0), LIMITS.answerWaitMs).unref?.();
      });
      run.waitedMs += Date.now() - w0;
      run.status = "running";
      run.answerResolve = undefined;
      const picked = options[idx] ?? options[0];
      if (amb) {
        const [love, v] = amb as [string, { candidates: Item[] }];
        const cand = v.candidates[idx] ?? v.candidates[0];
        s.question = { love, candidates: [cand, ...v.candidates.filter((c) => c !== cand)] };
        s.answered = true;
      }
      // Any other doubt: take the most popular candidate and say so.
      for (const [love, v] of Object.entries(s.love)) {
        if (v.state === "ambiguous") {
          s.love[love] = { state: "item", item: v.candidates[0] };
          s.ctx.seen.set(v.candidates[0].id, v.candidates[0]);
          s.notes.push(`We guessed ${v.candidates[0].name} for "${love}".`);
        }
      }
      run.question = null;
      const done: Step = { ...step, status: "ok", summary: `The family chose: ${picked}.`, ms: Date.now() - t0 };
      run.steps[n - 1] = done;
      this.emit(run, { type: "step", data: done });
      r = { ...r, status: "ok", summary: done.summary };
    }
    return r;
  }
}

const SECRET = /key|token|secret/i;
function redact(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (SECRET.test(k)) continue;
    out[k] = Array.isArray(v) ? v.slice(0, 12) : v;
  }
  return out;
}
function topOf(r: ToolResult): string[] {
  const items = flatItems(r);
  if (items.length) return items.slice(0, 3).map((i) => i.name);
  return (r.results as any[]).slice(0, 3).map((x) => x?.option ?? x?.name).filter(Boolean);
}
function idsOf(r: ToolResult): string[] {
  return flatItems(r).map((i) => i.id).concat((r.results as any[]).flatMap((x) => (x?.id && !x?.kind ? [x.id] : [])));
}
export type { DescribeRow };
