import { COPY } from "./copy.js";
import { startRun } from "./api.js";
import { h, ornament } from "./dom.js";

type Rec = { start(): void; stop(): void; lang: string; interimResults: boolean; continuous: boolean; onresult: (e: any) => void; onend: () => void; onerror: () => void };

export function intake(root: HTMLElement) {
  const C = COPY.intake;
  const inputs: HTMLInputElement[] = [];
  const grid = h("div", { class: "chips" });
  for (let i = 0; i < 10; i++) {
    const inp = h("input", { type: "text", maxlength: 60, autocomplete: "off", "aria-label": `Thing they loved ${i + 1}${i < 5 ? " (needed)" : ""}`, placeholder: C.placeholders[i], class: "chip" });
    inputs.push(inp);
    grid.append(inp);
  }
  const msg = h("p", { class: "msg", role: "alert", "aria-live": "assertive" });
  const name = h("input", { type: "text", id: "fname", maxlength: 30, autocomplete: "off" });
  const city = h("input", { type: "text", id: "city", maxlength: 60, autocomplete: "off", placeholder: "Springfield, IL" });

  const seg = (id: string, legend: string, opts: Record<string, string>, def: string) => {
    const fs = h("fieldset", { class: "seg" }, h("legend", {}, legend));
    for (const [v, label] of Object.entries(opts)) {
      fs.append(h("label", {}, h("input", { type: "radio", name: id, value: v, checked: v === def }), h("span", {}, label)));
    }
    return fs;
  };
  const faith = seg("faith", C.faithLabel, C.faith, "either");
  const budget = seg("budget", C.budgetLabel, C.budget, "middle");
  const guests = seg("guests", C.guestsLabel, C.guests, "mixed");
  const val = (fs: HTMLElement) => (fs.querySelector("input:checked") as HTMLInputElement).value;

  // Voice: only when the browser has it. The text boxes are always there.
  const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  let mic: HTMLElement | null = null;
  if (SR) {
    const rec: Rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false; rec.continuous = true;
    let on = false;
    const btn = h("button", { type: "button", class: "btn mic", "aria-pressed": "false" }, C.micStart);
    const set = (v: boolean) => { on = v; btn.textContent = v ? C.micStop : C.micStart; btn.setAttribute("aria-pressed", String(v)); };
    rec.onresult = (e: any) => {
      const text: string = Array.from(e.results as ArrayLike<any>).slice(e.resultIndex).map((r: any) => r[0].transcript).join(" ");
      for (const part of text.split(/,|\band\b|\bthen\b/i).map((s) => s.trim()).filter(Boolean)) {
        const slot = inputs.find((i) => !i.value);
        if (slot) slot.value = part.slice(0, 60);
      }
    };
    rec.onend = () => set(false);
    rec.onerror = () => set(false);
    btn.addEventListener("click", () => { if (on) rec.stop(); else { try { rec.start(); set(true); } catch { set(false); } } });
    mic = h("div", { class: "mic-row" }, btn, h("span", { class: "hint" }, C.micNote));
  }

  const submit = h("button", { type: "submit", class: "btn primary" }, C.build);
  const form = h("form", { class: "intake", novalidate: true },
    h("fieldset", { class: "loves" }, h("legend", { class: "label" }, C.lovesLabel), grid, mic),
    h("div", { class: "two" },
      h("div", { class: "field" }, h("label", { for: "fname" }, C.nameLabel), name, h("p", { class: "hint" }, C.nameHelp)),
      h("div", { class: "field" }, h("label", { for: "city" }, C.cityLabel), city, h("p", { class: "hint" }, C.cityHelp)),
    ),
    faith, budget, guests, msg, submit,
  );
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    msg.textContent = "";
    const loves = inputs.map((i) => i.value.trim()).filter(Boolean);
    if (loves.length < 5) { msg.textContent = C.needFive; (inputs.find((i) => !i.value) ?? inputs[0]).focus(); return; }
    if (loves.some((l) => l.length < 2 || l.length > 60)) { msg.textContent = C.tooLong; return; }
    if (city.value.trim().length < 2) { msg.textContent = C.needCity; city.focus(); return; }
    submit.disabled = true; submit.textContent = C.building;
    try {
      const r = await startRun({
        loves, firstName: name.value.trim(), city: city.value.trim(),
        constraints: { faith: val(faith), budget: val(budget), guests: val(guests) },
      });
      location.hash = `#/t/${r.id}`;
    } catch (e: any) {
      msg.textContent = e.status === 429 ? e.message : e.status === 400 ? e.message : COPY.empty.problem;
      submit.disabled = false; submit.textContent = C.build;
    }
  });
  root.append(h("div", { class: "page" }, h("h1", { class: "page-title" }, C.title), ornament(), h("p", { class: "lead" }, C.lead), form));
  inputs[0].focus();
}
