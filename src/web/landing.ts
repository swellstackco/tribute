import { COPY } from "./copy.js";
import { getExamples, getExample } from "./api.js";
import { h } from "./dom.js";

/** The headline with one phrase set in italic rubric. */
function title(text: string, em: string): (Node | string)[] {
  const i = text.indexOf(em);
  if (i < 0) return [text];
  return [text.slice(0, i), h("em", {}, em), text.slice(i + em.length)];
}

export function landing(root: HTMLElement) {
  const L = COPY.landing;
  const list = h("div", { class: "examples" });
  const view = h("div", { class: "page landing" },
    h("section", { class: "hero" },
      h("h1", {}, ...title(L.title, L.titleEm)),
      h("div", { class: "col" },
        h("p", { class: "margin" }, L.privacy),
        h("div", {},
          h("p", { class: "lead" }, L.lead),
          h("p", { class: "promise" }, L.promise),
          h("p", { class: "go" }, h("a", { class: "btn primary", href: "#/new" }, L.startOwn)),
        ),
      ),
    ),
    h("section", { class: "try col", "aria-labelledby": "try-h" },
      h("div", {}, h("h2", { id: "try-h" }, L.tryTitle), h("p", { class: "note" }, L.tryNote)),
      list,
    ),
  );
  root.append(view);
  getExamples().then((examples) => {
    examples.forEach((ex, i) => {
      const open = async (ev: Event) => {
        ev.preventDefault();
        const v = await getExample(ex.slug).catch(() => null);
        if (v) location.hash = `#/t/${v.id}`;
        else list.append(h("p", { class: "error", role: "alert" }, COPY.empty.problem));
      };
      list.append(h("article", { class: "example" },
        h("span", { class: "ex-num", "aria-hidden": "true" }, String(i + 1)),
        h("p", { class: "ex-name" }, ex.name),
        h("p", { class: "ex-meta" }, `${ex.age} · ${ex.city}`),
        h("p", { class: "ex-blurb" }, ex.blurb),
        h("a", { class: "ex-open", href: `#/example/${ex.slug}`, "aria-label": `${L.open}: ${ex.name}`, onclick: open }, L.open),
      ));
    });
  }).catch(() => list.append(h("p", { class: "error", role: "alert" }, COPY.empty.problem)));
}
