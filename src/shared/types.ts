export type Mode = "mock" | "live";
export type Faith = "faith" | "secular" | "either";
export type Budget = "modest" | "middle" | "open";
export type Guests = "older" | "mixed" | "young";

export interface Constraints { faith: Faith; budget: Budget; guests: Guests }

export interface RunInput {
  loves: string[];
  firstName: string;
  city: string;
  constraints: Constraints;
  slug?: string; // example profile slug, if any
}

export type StepSource = "model" | "planner" | "critique";
export type StepKind = "data" | "ask" | "write" | "finish";
export type StepStatus = "ok" | "empty" | "needs_input" | "partial" | "degraded" | "error";

/** One ledger row. Never holds raw Qloo bodies; only ids, names and counts. */
export interface Step {
  n: number;
  tool: string;
  kind: StepKind;
  input: Record<string, unknown>; // redacted: loves, ids, parameters
  status: StepStatus;
  summary: string;
  result_count: number;
  top: string[];
  ids: string[];
  ms: number;
  source: StepSource;
  reason?: string;
}

export interface PickWhy { signal: string; contribution?: number }
export interface Pick {
  id: string;
  name: string;
  type: string; // short: artist, book, movie, tv_show, podcast, place, cuisine
  kind: "entity" | "tag";
  affinity?: number;
  detail?: string;
  properties: Record<string, unknown>;
  links: { apple?: string; spotify?: string; map?: string };
  why: PickWhy[];
  tags: Array<{ id: string; name: string }>;
  mentioned: boolean; // typed by the family
  group?: string; // e.g. "listen" for podcasts
}

export interface SectionPlan {
  picks: Pick[];
  sentence: string;
  how: string; // one-line "how we chose"
}

export interface ProgramSlot { label: string; detail?: string; note?: string }
export interface ProgramPlan { slots: ProgramSlot[]; notes: string[]; sentence: string; how: string }

export interface PlanLove {
  text: string;
  resolved: { id: string; name: string; type: string; popularity?: number; kind: "entity" | "tag" } | null;
}

export interface Plan {
  firstName: string;
  city: string;
  constraints: Constraints;
  loves: PlanLove[];
  profile: {
    tags: Array<{ tag_id: string; name: string; subtype?: string; affinity: number }>;
    eras: number[];
    audience: { age: Record<string, number>; gender: { male: number; female: number } } | null;
  };
  sections: { music: SectionPlan; readings: SectionPlan; food: SectionPlan; venue: SectionPlan; screen: SectionPlan };
  program: ProgramPlan;
  notes: string[]; // e.g. "Revised the gathering place: ..."
}

export interface RunView {
  id: string;
  status: "running" | "waiting" | "done" | "error";
  mode: Mode;
  provider: string;
  cached?: boolean;
  question?: { text: string; options: string[]; love: string } | null;
  steps: Step[];
  plan: Plan | null;
  error?: string;
  notice?: string;
}
