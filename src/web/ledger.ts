import type { Step } from "../shared/types.js";
import { COPY } from "./copy.js";
import { answerQuestion, streamRun } from "./api.js";
import { h } from "./dom.js";

const trunc = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** What we sent, in words. Loves and parameters only; ids are never shown. */
export function sentText(s: Step): string {
  const i = s.input as Record<string, any>;
  const list = (x: unknown) => (Array.isArray(x) ? x.join(", ") : String(x ?? ""));
  switch (s.tool) {
    case "qloo_describe": return trunc(`loves: ${list(i.entities ?? i.entity)}${i.type ? ` (${i.type})` : ""}`);
    case "qloo_find_tags": return trunc(`words: ${list(i.queries ?? i.query)}`);
    case "qloo_recommend": {
      const where = i.filter_location ? ` near ${i.filter_location}` : "";
      const extra = [i.price_level_max ? `price up to ${"$".repeat(i.price_level_max)}` : "", i.rating_min ? `rating ${i.rating_min}+` : "", i.exclude_tags?.length ? "leaving out some kinds" : ""].filter(Boolean).join(", ");
      return `ask for ${String(i.target_type).replace("urn:entity:", "")}${where}${extra ? `, ${extra}` : ""}`;
    }
    case "qloo_entity_tags": return "the loves you named, as an era and feel";
    case "qloo_audience_demographics": return "the loves you named, as an audience";
    case "write_section": return `section: ${i.section}`;
    case "ask_family": return trunc(String(i.question ?? ""));
    default: return "";
  }
}

export function stepRow(s: Step): HTMLElement {
  const note = s.reason ?? (s.source === "planner" && s.kind === "data" ? "" : "");
  return h("li", { class: `row ${s.source === "critique" ? "revised" : ""}`, "data-n": s.n },
    h("div", { class: "row-top" },
      h("span", { class: "tool" }, s.tool.replace(/_/g, " ")),
      h("span", { class: `pill ${s.status}` }, s.status),
      h("span", { class: "ms" }, `${s.ms} ms`),
    ),
    h("p", { class: "sent" }, sentText(s)),
    h("p", { class: "got" }, s.summary, s.top.length && s.kind === "data" ? ` ${s.top.slice(0, 3).join(" · ")}` : ""),
    note ? h("p", { class: "why-row" }, note) : null,
  );
}

export function staticLedger(steps: Step[]): HTMLElement {
  return h("ol", { class: "ledger" }, ...steps.map(stepRow));
}

export function liveLedger(root: HTMLElement, id: string, onDone: () => void, onFail: (m: string) => void): () => void {
  const list = h("ol", { class: "ledger", "aria-live": "polite", "aria-label": COPY.ledger.steps });
  const progress = h("p", { class: "progress" }, COPY.ledger.working, " 1");
  const notice = h("p", { class: "note", role: "status" });
  const qbox = h("div", { class: "qbox" });
  const details = h("details", { class: "steps", open: !window.matchMedia("(max-width: 600px)").matches },
    h("summary", {}, COPY.ledger.showSteps), list);
  root.append(h("div", { class: "page" }, h("h1", { class: "page-title" }, COPY.ledger.title), h("p", { class: "lead" }, COPY.ledger.lead), progress, notice, qbox, details));
  const rows = new Map<number, HTMLElement>();
  return streamRun(id, {
    onStep(s) {
      const row = stepRow(s);
      const old = rows.get(s.n);
      if (old) old.replaceWith(row); else list.append(row);
      rows.set(s.n, row);
      progress.textContent = `${COPY.ledger.working} ${s.n}: ${s.summary}`;
    },
    onQuestion(q) {
      qbox.replaceChildren(h("section", { class: "card question", "aria-labelledby": "q-h" },
        h("h2", { id: "q-h", class: "label" }, COPY.ledger.waiting),
        h("p", { class: "q-text" }, q.text),
        h("div", { class: "q-opts" }, ...q.options.map((o, i) => h("button", { type: "button", class: "btn", onclick: async () => {
          qbox.querySelectorAll("button").forEach((b) => ((b as HTMLButtonElement).disabled = true));
          await answerQuestion(id, i).catch(() => null);
          qbox.replaceChildren();
        } }, o))),
      ));
      (qbox.querySelector("button") as HTMLElement | null)?.focus();
    },
    onNotice(m) { notice.textContent = m; },
    onDone: onDone,
    onError: onFail,
  });
}
