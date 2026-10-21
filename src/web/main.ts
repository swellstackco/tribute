import "./style.css";
import "./print.css";
import { COPY } from "./copy.js";
import { getExample, getRun } from "./api.js";
import { h } from "./dom.js";
import { intake } from "./intake.js";
import { landing } from "./landing.js";
import { liveLedger } from "./ledger.js";
import { renderTribute } from "./program.js";
import { renderWhy } from "./why.js";
import type { RunView } from "../shared/types.js";

const root = document.getElementById("main")!;
let stop: (() => void) | null = null;

function message(text: string) {
  root.replaceChildren(h("div", { class: "page" }, h("p", { class: "lead", role: "alert" }, text), h("p", {}, h("a", { class: "btn", href: "#/" }, COPY.tribute.startOver))));
}

async function loadRun(id: string): Promise<RunView | null> {
  return getRun(id).catch(() => null);
}

async function route() {
  stop?.(); stop = null;
  root.replaceChildren();
  window.scrollTo(0, 0);
  const [, kind, arg] = location.hash.replace(/^#/, "").split("/");
  document.title = "Tribute: a celebration of life that sounds and tastes like them";
  if (!kind) return landing(root);
  if (kind === "new") return intake(root);
  if (kind === "example" && arg) {
    const v = await getExample(arg).catch(() => null);
    if (v) { location.replace(`#/t/${v.id}`); return; }
    return message(COPY.empty.notFound);
  }
  if ((kind === "t" || kind === "why") && arg) {
    const v = await loadRun(arg);
    if (!v) return message(COPY.empty.notFound);
    if (v.status === "error") return message(COPY.empty.problem);
    if (v.status !== "done") {
      stop = liveLedger(root, arg, () => route(), () => message(COPY.empty.problem));
      return;
    }
    if (kind === "why") { document.title = `${COPY.why.title} | Tribute`; return renderWhy(root, v); }
    document.title = `${v.plan?.firstName ? COPY.tribute.forName(v.plan.firstName) : COPY.tribute.generic} | Tribute`;
    return renderTribute(root, v);
  }
  message(COPY.empty.notFound);
}
window.addEventListener("hashchange", route);
void route();
