import type { Pick, Plan, RunView } from "../shared/types.js";
import { COPY } from "./copy.js";
import { h, ornament } from "./dom.js";

const W = COPY.why;
const AGE_LABELS: Record<string, string> = {
  "24_and_younger": "24 and younger", "25_to_29": "25 to 29", "30_to_34": "30 to 34", "35_to_44": "35 to 44", "45_to_54": "45 to 54", "55_and_older": "55 and older",
};

function evidenceRow(p: Pick): HTMLElement {
  const why = p.mentioned ? [COPY.tribute.named] : p.why.map((w) => `${w.signal.replace(/^You named /, "")}${w.contribution !== undefined ? ` (${w.contribution.toFixed(2)})` : ""}`);
  return h("tr", {},
    h("th", { scope: "row" }, p.name),
    h("td", {}, why.join(", ")),
    h("td", { class: "num-cell" }, p.affinity !== undefined ? p.affinity.toFixed(2) : "n/a"),
    h("td", {}, p.tags.map((t) => t.name).join(", ")),
  );
}

function audience(plan: Plan): HTMLElement | null {
  const a = plan.profile.audience;
  if (!a) return null;
  const max = Math.max(0.01, ...Object.values(a.age).map((v) => Math.abs(v)));
  return h("div", { class: "aud" },
    h("ul", { class: "age" }, ...Object.entries(a.age).map(([k, v]) => h("li", {},
      h("span", { class: "age-l" }, AGE_LABELS[k] ?? k),
      h("span", { class: "bar" }, h("span", { class: `fill ${v < 0 ? "neg" : ""}`, style: { "--w": `${Math.round((Math.abs(v) / max) * 100)}%` } })),
      h("span", { class: "fit-num" }, `${v > 0 ? "+" : ""}${v.toFixed(2)}`)))),
    h("p", { class: "note" }, W.audienceNote),
  );
}

export function renderWhy(root: HTMLElement, v: RunView) {
  const plan = v.plan!;
  const secs: Array<[string, Pick[]]> = [
    [COPY.tribute.sections.music, plan.sections.music.picks], [COPY.tribute.sections.readings, plan.sections.readings.picks],
    [COPY.tribute.sections.food, plan.sections.food.picks], [COPY.tribute.sections.venue, plan.sections.venue.picks],
    [COPY.tribute.sections.screen, plan.sections.screen.picks],
  ];
  const how: string[] = [plan.sections.music.how, plan.sections.readings.how, plan.sections.food.how, plan.sections.venue.how, plan.sections.screen.how];
  root.append(h("div", { class: "page why" },
    h("p", { class: "no-print" }, h("a", { href: `#/t/${v.id}` }, `← ${W.back}`)),
    h("h1", { class: "page-title" }, W.title), ornament(), h("p", { class: "lead" }, W.lead),
    h("section", { class: "sec" }, h("h2", { class: "label" }, W.loves), h("p", { class: "note" }, W.lovesLead),
      h("ul", { class: "loves" }, ...plan.loves.map((l) => h("li", {}, h("span", { class: "said" }, `“${l.text}”`), h("span", { class: "arrow", "aria-hidden": "true" }, "→"),
        l.resolved ? h("span", {}, `${l.resolved.name} `, h("em", {}, `(${l.resolved.type.replace("_", " ")})`)) : h("span", { class: "note" }, W.notFound))))),
    h("section", { class: "sec" }, h("h2", { class: "label" }, W.vibe),
      h("ul", { class: "tags big" }, ...plan.profile.tags.slice(0, 12).map((t) => h("li", {}, `${t.name} ${t.affinity.toFixed(2)}`))),
      plan.profile.eras.length ? h("p", { class: "note" }, `${COPY.tribute.eras}: ${plan.profile.eras.map((d) => `${d}s`).join(", ")}`) : null),
    h("section", { class: "sec" }, h("h2", { class: "label" }, W.audience), audience(plan)),
    h("section", { class: "sec" }, h("h2", { class: "label" }, W.picks),
      ...secs.map(([title, picks], i) => h("div", { class: "ev-block" },
        h("h3", { class: "sub" }, title), h("p", { class: "note" }, how[i]),
        h("table", { class: "ev" }, h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Pick"), h("th", { scope: "col" }, "Because"), h("th", { scope: "col" }, "Fit"), h("th", { scope: "col" }, "Tags"))),
          h("tbody", {}, ...picks.map(evidenceRow)))))),
    h("p", { class: "honest" }, W.honest),
    h("p", { class: "no-print" }, h("button", { type: "button", class: "btn", onclick: () => window.print() }, W.print)),
  ));
}
