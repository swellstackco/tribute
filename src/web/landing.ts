import { COPY } from "./copy.js";
import { getExamples, getExample } from "./api.js";
import { h, ornament } from "./dom.js";

export function landing(root: HTMLElement) {
  const L = COPY.landing;
  const cards = h("div", { class: "examples" });
  const view = h("div", { class: "page landing" },
    h("section", { class: "hero" },
      h("p", { class: "kicker" }, "A celebration of life"),
      h("h1", {}, L.title),
      ornament(),
      h("p", { class: "lead" }, L.lead),
      h("p", { class: "promise" }, L.promise),
      h("p", {}, h("a", { class: "btn primary", href: "#/new" }, L.startOwn)),
      h("p", { class: "privacy" }, L.privacy),
    ),
    h("section", { class: "try", "aria-labelledby": "try-h" },
      h("h2", { id: "try-h", class: "label" }, L.tryTitle),
      h("p", { class: "note" }, L.tryNote),
      cards,
    ),
  );
  root.append(view);
  getExamples().then((list) => {
    for (const ex of list) {
      const open = async (ev: Event) => {
        ev.preventDefault();
        const v = await getExample(ex.slug).catch(() => null);
        if (v) location.hash = `#/t/${v.id}`;
        else cards.append(h("p", { class: "error", role: "alert" }, COPY.empty.problem));
      };
      cards.append(h("article", { class: "card example" },
        h("p", { class: "ex-name" }, ex.name),
        h("p", { class: "ex-meta" }, `${ex.age} · ${ex.city}`),
        h("p", { class: "ex-blurb" }, ex.blurb),
        h("a", { class: "btn", href: `#/example/${ex.slug}`, "aria-label": `${L.open}: ${ex.name}`, onclick: open }, `${L.open}`),
      ));
    }
  }).catch(() => cards.append(h("p", { class: "error", role: "alert" }, COPY.empty.problem)));
}
