import type { Pick, Plan, RunView, SectionPlan } from "../shared/types.js";
import { priceSigns } from "../shared/format.js";
import { COPY } from "./copy.js";
import { rebuildExample } from "./api.js";
import { h, ornament } from "./dom.js";
import { staticLedger } from "./ledger.js";

const T = COPY.tribute;
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
const strip = (s: string) => s.replace(/^You named /, "");

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = h("textarea", { "aria-hidden": "true", style: { position: "fixed", opacity: "0" } });
    ta.value = text; document.body.append(ta); ta.select();
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  }
}

export function pickCard(p: Pick): HTMLElement {
  const links = h("p", { class: "links" });
  if (p.links.apple) links.append(h("a", { href: p.links.apple, target: "_blank", rel: "noopener" }, T.apple), h("a", { href: p.links.spotify, target: "_blank", rel: "noopener" }, T.spotify));
  if (p.links.map) links.append(h("a", { href: p.links.map, target: "_blank", rel: "noopener" }, T.map));
  const because = h("p", { class: "because" }, `${T.because}: `, h("b", {}, p.mentioned ? T.named : p.why.map((w) => strip(w.signal)).join(", ")));
  const fit = p.affinity !== undefined
    ? h("span", { class: "fit", role: "img", "aria-label": `${T.fit} ${p.affinity.toFixed(2)} out of 1` },
        h("span", { class: "fit-label" }, T.fit),
        h("span", { class: "bar" }, h("span", { class: "fill", style: { "--w": `${Math.round(p.affinity * 100)}%` } })),
        h("span", { class: "fit-num" }, p.affinity.toFixed(2)))
    : h("span", { class: "fit" }, h("span", { class: "fit-own" }, T.ownWords));
  return h("article", { class: `pick ${p.mentioned ? "typed" : "found"}` },
    h("div", { class: "pick-head" }, h("h3", {}, p.name), h("span", { class: "leader", "aria-hidden": "true" }), fit),
    p.detail ? h("p", { class: "detail" }, p.detail) : null,
    because,
    p.tags.length ? h("ul", { class: "tags", "aria-label": "Tags" }, ...p.tags.map((t) => h("li", {}, t.name))) : null,
    links.childNodes.length ? links : null,
    !p.mentioned ? h("p", { class: "unmentioned" }, T.unmentioned) : null,
  );
}

function section(idx: number, key: keyof typeof T.sections, sec: SectionPlan, extra?: HTMLElement | null): HTMLElement {
  const main = sec.picks.filter((p) => p.group !== "listen");
  const listen = sec.picks.filter((p) => p.group === "listen");
  return h("section", { class: "sec col", id: `s-${key}`, "aria-labelledby": `h-${key}` },
    h("h2", { class: "label", id: `h-${key}` }, h("span", { class: "num" }, ROMAN[idx]), T.sections[key]),
    h("div", { class: "body" },
      sec.sentence ? h("p", { class: "sentence" }, sec.sentence) : null,
      h("p", { class: "note" }, T.sectionLead[key]),
      extra,
      h("div", { class: "picks" }, ...main.map(pickCard)),
      listen.length ? h("div", { class: "listen" }, h("h3", { class: "sub" }, T.listen), h("div", { class: "picks" }, ...listen.map(pickCard))) : null,
      !main.length && !listen.length ? h("p", { class: "note" }, COPY.empty.nothingHere) : null,
    ),
  );
}

export function playlistText(plan: Plan): string {
  return plan.sections.music.picks.map((p) => `${p.name}\nApple Music: ${p.links.apple}\nSpotify: ${p.links.spotify}`).join("\n\n");
}

function programSection(plan: Plan): HTMLElement {
  const pr = plan.program;
  return h("section", { class: "sec col", id: "s-program", "aria-labelledby": "h-program" },
    h("h2", { class: "label", id: "h-program" }, h("span", { class: "num" }, "VI"), T.sections.program),
    h("div", { class: "body" },
      pr.sentence ? h("p", { class: "sentence" }, pr.sentence) : null,
      h("p", { class: "note" }, T.sectionLead.program),
      h("ol", { class: "order" }, ...pr.slots.map((s) => h("li", {},
        h("span", { class: "o-label" }, s.label),
        h("span", { class: "o-dots", "aria-hidden": "true" }),
        h("span", { class: "o-detail" }, s.detail ?? ""),
        s.note ? h("span", { class: "o-note" }, s.note) : null,
      ))),
      ...pr.notes.map((n) => h("p", { class: "note seated" }, n)),
    ),
  );
}

/** Print-only folded booklet: two landscape sheets, two panels each. */
function booklet(plan: Plan): HTMLElement {
  const name = plan.firstName;
  const list = (ps: Pick[], fn: (p: Pick) => (Node | string)[]) => h("ul", { class: "bk-list" }, ...ps.map((p) => h("li", {}, ...fn(p))));
  const music = plan.sections.music.picks.slice(0, 6);
  const reads = plan.sections.readings.picks.filter((p) => p.group !== "listen").slice(0, 4);
  const food = plan.sections.food.picks.filter((p) => p.type === "place").slice(0, 3);
  const venue = plan.sections.venue.picks.slice(0, 2);
  const panel = (cls: string, ...k: (Node | null)[]) => h("div", { class: `panel ${cls}` }, ...k);
  return h("div", { class: "booklet", "aria-hidden": "true" },
    h("div", { class: "sheet" },
      panel("bk-order", h("h3", {}, "Order of service"), ornament(),
        h("ol", { class: "order" }, ...plan.program.slots.map((s) => h("li", {}, h("span", { class: "o-label" }, s.label), h("span", { class: "o-dots" }), h("span", { class: "o-detail" }, s.detail ?? "")))),
        ...plan.program.notes.map((n) => h("p", { class: "bk-note" }, n))),
      panel("bk-cover", h("p", { class: "kicker" }, T.cover), ornament(), h("h1", {}, name || "With love"), h("p", { class: "bk-city" }, plan.city),
        plan.profile.eras.length ? h("p", { class: "bk-eras" }, plan.profile.eras.map((d) => `${d}s`).join("   \u00b7   ")) : null),
    ),
    h("div", { class: "sheet" },
      panel("bk-music", h("h3", {}, "Music"), ornament(),
        list(music, (p) => [h("strong", {}, p.name), h("br"), h("span", { class: "url" }, `Apple Music: ${p.links.apple}`), h("br"), h("span", { class: "url" }, `Spotify: ${p.links.spotify}`)]),
        h("h3", {}, "Readings"), ornament(),
        list(reads, (p) => [h("strong", {}, p.name), p.detail ? ` ${p.detail}` : ""])),
      panel("bk-thanks", h("h3", {}, T.thanks), ornament(), h("p", {}, T.thanksLine),
        h("h3", {}, "Food"), list(food, (p) => [h("strong", {}, p.name), h("br"), p.detail ?? ""]),
        h("h3", {}, "Gathering place"), list(venue, (p) => [h("strong", {}, p.name), h("br"), p.detail ?? ""])),
    ),
  );
}

export function renderTribute(root: HTMLElement, v: RunView) {
  const plan = v.plan!;
  const S = plan.sections;
  const toast = h("span", { class: "toast", role: "status" });
  const flash = (t: string) => { toast.textContent = t; setTimeout(() => (toast.textContent = ""), 2000); };
  const btn = (label: string, fn: () => void, cls = "btn") => h("button", { type: "button", class: cls, onclick: fn }, label);
  const actions = h("div", { class: "actions no-print" },
    btn(T.print, () => window.print(), "btn primary"),
    btn(T.copyLinks, async () => flash((await copyText(playlistText(plan))) ? T.copied : ""), "btn quiet"),
    btn(T.share, async () => flash((await copyText(location.href)) ? T.copied : ""), "btn quiet"),
    h("a", { class: "btn quiet", href: "#/" }, T.startOver),
    v.example ? btn(T.rebuild, async () => { try { const r = await rebuildExample(v.example!); location.hash = `#/t/${r.id}`; } catch (e: any) { flash(e.message); } }, "btn quiet") : null,
    toast,
  );
  const eras = plan.profile.eras.length
    ? h("p", { class: "eras" }, h("span", { class: "eras-label" }, T.eras), ...plan.profile.eras.map((d) => h("span", { class: "era" }, `${d}s`)))
    : null;
  const notes = plan.notes.length
    ? h("aside", { class: "changes" }, h("h2", { class: "label" }, T.notes), h("ul", {}, ...plan.notes.map((n) => h("li", {}, n))))
    : null;
  const page = h("div", { class: "page tribute" },
    h("header", { class: "t-head" },
      plan.firstName ? h("h1", {}, `${T.forPrefix} `, h("span", { class: "who" }, plan.firstName)) : h("h1", {}, T.generic),
      h("div", { class: "col" },
        h("p", { class: "kicker" }, plan.city),
        h("div", {},
          h("p", { class: "whylink no-print" }, h("a", { href: `#/why/${v.id}` }, T.why), h("span", { class: "why-after" }, T.whyAfter)),
          v.notice ? h("p", { class: "note", role: "status" }, v.notice) : null,
          actions,
          notes,
        ),
      ),
    ),
    section(0, "music", S.music),
    section(1, "readings", S.readings),
    section(2, "food", S.food),
    section(3, "venue", S.venue),
    section(4, "screen", S.screen, eras),
    programSection(plan),
    h("details", { class: "made no-print" }, h("summary", {}, COPY.ledger.madeTitle), h("p", { class: "note" }, COPY.ledger.madeNote), staticLedger(v.steps)),
    booklet(plan),
  );
  root.append(page);
}
