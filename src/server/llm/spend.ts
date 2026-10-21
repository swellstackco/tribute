import type { Db } from "../db.js";
import { ProviderError, type CompleteRequest, type CompleteResult, type LlmProvider } from "./provider.js";

// USD per million tokens. Only this model is allowed.
export const PRICES: Record<string, { in: number; out: number }> = {
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
};

export class Spend {
  constructor(private db: Db, public capUsd: number) {}
  total(): number {
    return (this.db.prepare("SELECT COALESCE(SUM(usd),0) AS t FROM spend").get() as { t: number }).t;
  }
  canSpend(): boolean { return this.total() < this.capUsd; }
  cost(model: string, inTok: number, outTok: number) {
    const p = PRICES[model];
    if (!p) throw new Error(`No price for model ${model}`);
    return (inTok * p.in + outTok * p.out) / 1_000_000;
  }
  record(provider: string, model: string, inTok: number, outTok: number): number {
    const usd = this.cost(model, inTok, outTok);
    this.db.prepare("INSERT INTO spend (provider, model, input_tokens, output_tokens, usd, created_at) VALUES (?,?,?,?,?,?)")
      .run(provider, model, inTok, outTok, usd, Date.now());
    return usd;
  }
}

/** Checks the cap before every call and records usage after. Throws spend_cap at the cap. */
export class MeteredProvider implements LlmProvider {
  runUsd = 0;
  constructor(private inner: LlmProvider, private spend: Spend) {}
  get name() { return this.inner.name; }
  get model() { return this.inner.model; }
  async complete(req: CompleteRequest): Promise<CompleteResult> {
    if (!this.spend.canSpend()) throw new ProviderError("spend_cap", "Demo budget reached");
    const r = await this.inner.complete(req);
    this.runUsd += this.spend.record(this.inner.name, this.inner.model, r.usage.input_tokens, r.usage.output_tokens);
    return r;
  }
}
