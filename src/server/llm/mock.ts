import { planNext } from "../agent/planner.js";
import type { RunState } from "../agent/state.js";
import type { CompleteResult, LlmProvider } from "./provider.js";

let counter = 0;

/** Deterministic planner behind the provider interface. Needs no key, never fails. */
export class MockProvider implements LlmProvider {
  readonly name = "mock";
  readonly model = "planner";
  constructor(private getState: () => RunState) {}
  async complete(): Promise<CompleteResult> {
    const next = planNext(this.getState());
    const call = next ?? { name: "finish", input: {} };
    return { toolCalls: [{ id: `mock_${++counter}`, name: call.name, input: call.input }], usage: { input_tokens: 0, output_tokens: 0 } };
  }
}
