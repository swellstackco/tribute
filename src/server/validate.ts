import { z } from "zod";
import type { RunInput } from "../shared/types.js";

const clean = (s: string) => s.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim();

export const inputSchema = z.object({
  loves: z.array(z.string().transform(clean)).min(5, "Please add at least 5 things they loved.").max(10, "Please keep it to 10 things."),
  firstName: z.string().max(30, "That name is a bit long.").transform(clean).optional().default(""),
  city: z.string().transform(clean).pipe(z.string().min(2, "Please add a city.").max(60, "That city name is a bit long.")),
  constraints: z.object({
    faith: z.enum(["faith", "secular", "either"]),
    budget: z.enum(["modest", "middle", "open"]),
    guests: z.enum(["older", "mixed", "young"]),
  }),
}).superRefine((v, ctx) => {
  v.loves.forEach((l, i) => {
    if (l.length < 2 || l.length > 60) ctx.addIssue({ code: "custom", path: ["loves", i], message: "Each one should be 2 to 60 letters." });
  });
});

export function parseInput(body: unknown): { ok: true; input: RunInput } | { ok: false; error: string } {
  const r = inputSchema.safeParse(body);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? "Please check the form." };
  return { ok: true, input: r.data as RunInput };
}
