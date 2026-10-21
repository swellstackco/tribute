import type { RunState } from "./state.js";

export type Exec = (call: { name: string; input: Record<string, unknown>; label?: string }, source: "critique", reason: string) => Promise<unknown>;

// Filled in by T7.
export async function critique(_s: RunState, _exec: Exec): Promise<void> {}
