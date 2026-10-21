import type { Item, ToolContext } from "../tools/index.js";
import type { RunInput, Step } from "../../shared/types.js";

export type LoveState =
  | { state: "pending" }
  | { state: "item"; item: Item }
  | { state: "ambiguous"; candidates: Item[] }
  | { state: "empty" }
  | { state: "tag"; item: Item };

export interface RunState {
  input: RunInput;
  ctx: ToolContext;
  steps: Step[];
  love: Record<string, LoveState>;
  described: boolean;
  tagsDone: boolean;
  tagLookups: Record<string, Item[]>;
  question: { love: string; candidates: Item[] } | null;
  answered: boolean;
  redescribed: boolean;
  tagProfile: Item[] | null;
  audience: { age: Record<string, number>; gender: { male: number; female: number } } | null;
  recs: Record<string, Item[]>; // keys: artist, book, movie, tv_show, podcast, food, venue
  recAttempted: Set<string>;
  notes: string[];
  critiqued: boolean;
  programNotes: string[];
  tagQueryLove: Record<string, string>;
  cuisineQueries: Record<string, string>; // cuisine word -> the love that pointed to it
  foodRetried: boolean;
}

export function newRunState(input: RunInput, ctx: ToolContext): RunState {
  const love: Record<string, LoveState> = {};
  for (const l of input.loves) love[l] = { state: "pending" };
  return {
    input, ctx, steps: [], love, described: false, tagsDone: false, tagLookups: {}, question: null, answered: false,
    redescribed: false, tagProfile: null, audience: null, recs: {}, recAttempted: new Set(), notes: [], critiqued: false, programNotes: [], tagQueryLove: {}, cuisineQueries: {}, foodRetried: false,
  };
}

export const resolvedEntities = (s: RunState): Item[] =>
  Object.values(s.love).flatMap((l) => (l.state === "item" ? [l.item] : []));
export const resolvedIds = (s: RunState) => resolvedEntities(s).map((i) => i.id);
