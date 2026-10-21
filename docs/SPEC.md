# Tribute — a celebration of life that sounds and tastes like them

Spec v1 · 2026-10-22 (Manila) · Author: Fable (design/architecture) · Builder: Sonnet · Owner: Ben
Hackathon: Qloo Agentic Hackathon ("Agents, but with taste"). Deadline **Oct 30 2026 11:45 pm ET = Oct 31 11:45 am Manila**. Target submit **Oct 29** (full day of buffer).
Judging Nov 2–16; the live site must stay up and free through Nov 16. Prizes $15k / $6k / $4k; Calacanis side investment $25k. Honest odds in §14.

---

## 0. Decisions Ben must make (short; default in bold)

1. **LLM default.** Gemini free tier fails two checks (its terms let Google use inputs and outputs for training with human review, and bar serving EEA/UK users on the unpaid tier; judges may be anywhere). → **Claude Haiku 5.5 (`claude-haiku-5-5`, $0.10 in / $0.50 out per MTok) on a new key in Ben's own Anthropic console, named `tribute`, with a $10 console spend limit.** Expected total under $5 (§9). Gemini stays as an optional adapter below the cut line.
2. **Domain.** → **tribute.swellstackco.com** on the VPS, Cloudflare-proxied DNS → nginx → PM2 app on 127.0.0.1 (no cloudflared tunnel exists on the box; see §10).
3. **Public repo.** → **github.com/swellstackco/tribute**, MIT, created by Ben at submit time (agents never create remotes). License must show in GitHub "About".
4. **Harness use.** Import `@qloo/qloo-harness` as a library, or mirror its nine workflow shapes over raw REST? The library entry points exist (`createDirectQlooWorkflowExecutorFromEnvironment`, `createQlooToolsFromEnvironment`) but are undocumented and pull in a coding-agent runtime. → **Mirror the shapes exactly (names, inputs, result envelope, six statuses) over raw REST; say so in the README. Stretch: a one-file adapter that swaps in the real harness executor.**
5. **Demo people.** Three fictional profiles (§7): Walt Pruitt (Bakersfield, the brief's example), Dana Whitlock (Portland, secular), Rosalind Mayes (Birmingham AL, Baptist). → **OK unless Ben wants other names or cities.**
6. **Voice intake.** Browser `webkitSpeechRecognition` (Chrome only, text box always present, nothing uploaded). → **Yes.**
7. **Video.** Not required. → **Record a 60–90 s muted screen capture on Oct 28 only if T1–T13 are done; Ben narrates or we ship it silent with captions.**
8. **Key status:** Ben submitted the Qloo key form on Oct 22 (Manila) under the project name "Tribute." Remaining errands (Ben, not agents): join Devpost + Discord, post "building Tribute, key pending" in #api-help, save a Devpost draft. → **Do today; keys take "a few business days" and Oct 24–25 is a US weekend, so expect it Oct 23 or Oct 27–28 US time.**

Keys Ben must supply (server `.env` only, never in the repo or browser): `QLOO_API_KEY` (pending), `ANTHROPIC_API_KEY` (Ben's own, not a client's). Cloudflare DNS and VPS SSH already exist in memory.

---

## 1. One-line pitch

**Tell Tribute five to ten things someone loved. It builds a celebration of life that sounds and tastes like them: the music, the readings, the food, a place to gather, the slideshow eras, and a printed program, with every choice traced to Qloo's taste graph, not to a chatbot's guess.**

Audience: a family planning a service in the first days after a loss (primary); funeral homes, hospice social workers and celebrants who plan dozens a year (the B2B buyer; US funeral spend is roughly $20B/yr). The product never says "funeral AI." It says Tribute, celebration of life, service, gathering.

Why it clears the Qloo test ("would it work the same without Qloo?"): a plain LLM, asked for a service for a Merle Haggard fan, produces "Amazing Grace" and a slideshow. Tribute produces the artists Haggard fans actually listen to, the authors they read, a taco caterer near the chapel with a price level that fits the budget, and a line like "people who love Haggard and the Dodgers also lean toward Vin Scully broadcasts; consider playing one." Remove Qloo and every section collapses to generic.

**One-liner for Devpost and the landing page: "AI memorial tools guess. Tribute knows."**

### 1a. Prior art and how we differ

AI memorial tools already exist, so "AI for a celebration of life" is not the idea. Known products: CelebrateAlly (an AI celebration-of-life idea generator), Funeral Folio (AI obituaries and programs), endoflifetools.com (a funeral music planner), MyWishes and My Wonderful Life (end-of-life planning platforms), ZSky (program art). All of them either take the family's list and format it, or ask a language model to guess. None has a taste graph behind the picks.

Tribute differs in three ways, and the product makes each visible:
1. **Grounded, not guessed.** Every pick is an entity or tag returned by Qloo for this family's loves. `write_section` refuses anything else (§5). The planner cannot invent a song, author, or caterer.
2. **Things the family never mentioned.** Cross-domain expansion (artist → book, film, place) surfaces the readings, the films for the slideshow, and the caterer that fit the person's taste, not just the five items typed. That is the "we didn't tell it that, but yes" moment.
3. **A visible why on every pick.** Each card carries its evidence inline: which loves produced it, the Qloo affinity, and the tags; the why page collects them. The evidence is the proof judges look for, so it sits next to the pick, not behind a link.

Devpost copy and the README carry this section almost verbatim (§12).

---

## 2. How the spec maxes each judging criterion

Four equal criteria; ties break on Technological Implementation.

| Criterion | What judges will see | Where in this spec |
|---|---|---|
| **Technological Implementation** (tie-breaker) | Six Qloo surfaces in one flow: `/search`, `/v2/tags`, `/v2/insights` across five entity types, `urn:tag` taste analysis, `urn:demographics`, place insights with location + price + rating filters, and `filter.results.entities` ranking. A real tool-calling loop whose tools mirror the official harness (names, inputs, envelope, statuses). Explainability data on the "why" page. Caching, rate limits, graceful `empty`/`degraded` handling. A probe script. | §4, §5, §6, §8 |
| **Design** | A finished product, not a proof: landing → intake → visible agent ledger → program → print. Stationery look (serif, warm paper), mobile-first, print CSS that produces a real PDF, 4th–6th grade participant text, one-click example. | §3, §11 |
| **Potential Impact** | Specific audience (grieving families; funeral homes and celebrants as buyers), specific job (a service planned in days, personal instead of generic), specific payoff (families report the service "felt like him"; planners save hours). | §1, §12 |
| **Quality of the Idea** | Zero prior entries in 2025 (343 projects) or 2026 (348 repos) touch memorials. Generic AI memorial tools exist outside the hackathon (§1a) and guess; Tribute grounds every pick in the taste graph and shows the affinity behind it. Lateral use of a taste graph: not "what should I buy" but "who was this person, in the language of what they loved." | §1, §1a, brief §3 |

---

## 3. The experience (five screens, two minutes for a judge)

**Screen 1 — Landing.** One sentence, one button: "Try an example" (three cards: Walt, Dana, Rosalind) and "Start your own." No sign-up. A short line about privacy: "We only send the things you type. No names go to Qloo."

**Screen 2 — Intake.** "What did they love?" Ten short text fields (chips), a mic button, a first name (used only in the program text, never sent to Qloo), a city for the gathering, and three choices: *Kind of service* (faith-based / secular / either), *Budget* (modest / middle / open), *Guests* (many older guests or wheelchairs / mixed / mostly young). Then "Build the tribute."

**Screen 3 — The agent at work.** A live ledger. Each row is a step the agent took: tool name, what it sent (redacted to the loves and parameters), status (`ok`, `empty`, `needs_input`, `partial`, `degraded`, `error`), what came back (count + top names), and milliseconds. If a love is ambiguous (two strong matches), the ledger pauses with **one** question: "Did you mean the band or the movie?" with two buttons. At most one question per tribute. Rows arrive over SSE in under 20 s total.

**Screen 4 — The tribute.** Sections, each with 3–8 picks and one warm sentence. **Every pick card shows its evidence inline, always visible** (not behind a toggle): a "Because" line naming the loves that produced it ("Because: Merle Haggard, Johnny Cash"), a small fit bar with the Qloo affinity (0.00–1.00), and up to three tag chips. Picks the family never typed carry a quiet "You didn't mention this" mark; those are the wow moments, so they are visually first in each section after the directly resolved loves. The sections:
1. *Music* — the artists to play, with "Search on Apple Music" and "Search on Spotify" links (search URLs, no API).
2. *Readings* — authors and books their taste neighbors read; the family picks the passage.
3. *Food* — the cuisine, with 3–5 caterers or restaurants near the city, each with address, rating and price level.
4. *A place to gather* — 3–5 venues near the city that fit the guest constraints.
5. *On the screen* — the slideshow eras (decades) and the films and shows to pull stills from.
6. *The program* — order of service: welcome, music, reading, words from family, music, reading, closing, gathering.
7. *Why these choices* — a one-page evidence sheet that collects the inline evidence: for every pick, the Qloo signals that produced it, the affinity score, the explainability contributions when the key returns them, the tags that describe the era and vibe, and the audience shape. Linked from the top of the tribute page ("See why we chose these"), and printed on its own.

Buttons: Print program (PDF via print CSS), Copy playlist links, Share link (plan id, read-only), Start over.

**Screen 5 — Print.** Letter and A4, folded-program layout (cover, order of service, music and readings, "thank you for coming"). The "why" page prints separately.

Tone rules (hard): warm, dignified, hopeful; never "funeral," "death," "corpse," "morbid," "RIP," "deceased." Say "passed," "loved," "remember," "gather." American English. Participant-facing text at a 4th–6th grade reading level (tested, §11). No emoji anywhere. No "AI" in the UI copy except one honest line on the why page: "Tribute uses Qloo's taste data to choose and a language model to write the sentences."

---

## 4. Qloo usage (every recommendation traces to a response)

Base URL `https://hackathon.api.qloo.com`, header `X-Api-Key`, GET only, query strings. Invalid params are ignored silently (empty results, no error), so the client validates param names against an allowlist from the docs before sending.

| Step | Endpoint and params | Response fields we use |
|---|---|---|
| Resolve each love | `GET /search?query=<love>&types=<urn list>&take=5` | flat `results[]`: `name`, `entity_id`, `types[]`, `popularity`, `properties`, `tags[]` (verify on probe) |
| Resolve foods and hobbies as tags | `GET /v2/tags?filter.query=<word>&feature.typo_tolerance=true&take=10` (also `feature.semantic_search=true` as second try) | `results.tags[]` (`id`/`tag_id`, `name`, `type`/`subtype`; verify field names on probe) |
| Era and vibe (taste analysis) | `GET /v2/insights?filter.type=urn:tag&signal.interests.entities=<ids>&filter.tag.types=urn:tag:genre:media,urn:tag:keyword:media,urn:tag:style:qloo&take=25` | `results.tags[]`: `tag_id`, `name`, `subtype`, `types[]`, `query.affinity` |
| Audience shape (sanity check) | `GET /v2/insights?filter.type=urn:demographics&signal.interests.entities=<ids>` | `results.demographics[]`: `entity_id`, `query.age{24_and_younger…55_and_older}`, `query.gender{male,female}` (affinity deltas, positive = over-index) |
| Music | `GET /v2/insights?filter.type=urn:entity:artist&signal.interests.entities=<ids>&take=12&feature.explainability=true` | `results.entities[]`: `name`, `entity_id`, `subtype`, `properties`, `popularity`, `tags[]`, `query.affinity`, `query.explainability` |
| Readings | same with `filter.type=urn:entity:book` (`properties.publication_year`, author in properties) | same |
| Slideshow | `filter.type=urn:entity:movie` and `urn:entity:tv_show` (`properties.release_year`, `properties.image.url`) | same |
| Extra "they also loved" | `filter.type=urn:entity:podcast` and `urn:entity:brand`, take 6 | same |
| Food near the city | `GET /v2/insights?filter.type=urn:entity:place&signal.interests.entities=<ids>&filter.location.query=<city>&filter.tags=<cuisine tag ids>&filter.price_level.max=<budget>&filter.properties.business_rating.min=3.5&take=8` | `properties.address`, `properties.geocode`, `properties.business_rating`, `properties.price_level`, `properties.phone`, `properties.website`, `properties.hours`, `query.affinity` (exact property names verified on probe) |
| A place to gather | `filter.type=urn:entity:place` with `filter.tags` from `find_tags("event venue" / "banquet hall" / "park" / "community center")`, `filter.location.query`, `filter.exclude.tags` for bars and nightclubs when faith-based or many older guests | same |
| Rank a shortlist | `GET /v2/insights?filter.type=<type>&signal.interests.entities=<ids>&filter.results.entities=<candidate ids>` | `query.affinity` per candidate; this is how the harness `rank` works |

Qloo safe-use compliance: we send only the loves the family typed plus a city name; never the person's name, dates, or anything about the family. Demographics describe the *audience of the entities*, never the person; the UI says so. We present every result with its source and limits and keep Qloo results separate from our wording. We ask for clarification when an entity choice would materially change the result. Server-side caching is fine; captured Qloo responses never go in the public repo (the mock fixtures are hand-shaped synthetic JSON).

Data-coverage risk: the hackathon environment "may not have data for every entity or region." Demo cities are mid-size US cities; the probe (§8) checks all three before Oct 27.

---

## 5. The agent (a real tool-calling loop)

**Tools** (mirror the harness; same names, same input fields, same envelope). Each returns `{ status, summary, results, result_count, error? }` with `status ∈ ok | empty | needs_input | partial | degraded | error` and `error = { code, retryable, recovery }`.

| Tool | Input (harness field names) | Backed by |
|---|---|---|
| `qloo_describe` | `{ entity: string, type?: string }` | `/search` (+ `/entities?ids=` when we have an id). Returns `needs_input` with up to 3 candidates when two results are within 0.15 popularity of each other and differ in type. |
| `qloo_find_tags` | `{ query, semantic?, limit? }` | `/v2/tags` |
| `qloo_recommend` | `{ target_type, signals?, signal_tags?, signal_tags_operator?, signal_location?, demographic?, filter_location?, include_tags?, include_tags_operator?, exclude_tags?, exclude_tags_operator?, explain?, limit? }` | `/v2/insights` with `filter.type=target_type` |
| `qloo_rank` | `{ options, option_type, signals?, signal_location?, demographic?, include_tags?, exclude_tags? }` | `/v2/insights` + `filter.results.entities` |
| `qloo_entity_tags` | `{ entities, entity_type?, limit? }` | `/v2/insights?filter.type=urn:tag` |
| `qloo_audience_demographics` | `{ entity, entity_type?, limit? }` | `/v2/insights?filter.type=urn:demographics` |
| `qloo_capabilities` | `{}` | local; reports mode (mock/live), key present, cache size |
| `ask_family` | `{ question, options[2..3] }` | pauses the run; UI answers; **allowed once per run** (server-enforced) |
| `write_section` | `{ section, picks[entity_id or tag_id], sentence }` | validates every pick id exists in this run's Qloo results; rejects otherwise (`error.code = "PICK_NOT_FROM_QLOO"`) |
| `finish` | `{}` | ends the loop |

`where_popular`, `compare_audiences`, `trends` are not used in v1 (listed in README as "not used; the harness exposes nine, we mirror six").

**Loop.** `POST /api/tribute` → run id; `GET /api/tribute/:id/events` streams SSE. The orchestrator calls the LLM provider with the tool list and a phase-aware system prompt; executes tool calls server-side; appends results; repeats. Hard limits: 16 tool calls, 6 LLM turns, 45 s wall clock, one `ask_family`. The orchestrator also enforces a **required-steps checklist** independent of the model (describe every love; entity_tags once; demographics once; recommend artist, book, movie or tv_show, place×2; a write_section for each of the six sections). If the model finishes with gaps, the orchestrator fills them deterministically (same code path the mock provider uses) and marks those rows "filled by planner" in the ledger. This is what makes the demo safe when a cheap model wanders.

**Phases in the system prompt.** (1) Resolve: one `qloo_describe` per love; foods and hobbies also go through `qloo_find_tags`. (2) Clarify: if any `needs_input`, call `ask_family` once with the most important ambiguity; otherwise pick the top candidate and note it. (3) Profile: `qloo_entity_tags` and `qloo_audience_demographics` on the resolved ids. (4) Expand: `qloo_recommend` per section. (5) Plan: `write_section` ×6, choosing only from returned ids, one warm sentence each at a 4th–6th grade level. (6) Critique: re-read against the constraints (faith/secular, budget, guest mobility); if a pick breaks a rule, re-run `qloo_recommend` with filters (`exclude_tags`, price cap, rating floor) and rewrite that section; the ledger shows the revised step. (7) `finish`.

**Mock LLM provider** = a deterministic planner that emits exactly this sequence with fixed wording. It is also the fallback when the real provider errors or the spend cap trips. The demo must run perfectly in mock mode; the real model is upside.

**Trace.** Every run stores `steps[]` (tool, redacted input, status, result_count, top names, duration, source: model|planner) and the final `plan`. The why page and the ledger are both rendered from the trace, so nothing on screen can exist without a Qloo row behind it.

---

## 6. Data model (SQLite, `data/tribute.db`, WAL)

- `runs(id, created_at, input_hash, status: running|waiting|done|error, mode: mock|live, provider, ip_hash, spend_usd, plan json, trace json, answered_question json)`
- `qloo_cache(key = sha256(method+path+sorted query), body json, fetched_at, status_code)` — no TTL during the event; cleared by `npm run cache:clear`.
- `llm_cache(key = sha256(provider+model+messages+tools), body json, usage json, created_at)`
- `spend(id, provider, model, input_tokens, output_tokens, usd, created_at)` — hard cap read on every call (§9).
- `rate(ip_hash, window_start, count)` — per-IP; `ip_hash = HMAC(RATE_SALT, ip)`, never raw IPs.
- `examples(slug, run_id)` — the three demo profiles map to precomputed runs (recomputed by `npm run seed:examples` when the live key lands).

Plan shape (what the UI renders):
```
Plan { firstName, city, constraints{faith, budget, guests}, loves[{ text, resolved:{entity_id|tag_id, name, type, popularity} | null }],
       profile{ tags[{tag_id,name,subtype,affinity}], eras[decade], audience{age{...}, gender{...}} },
       sections{ music, readings, food, venue, screen, program }  // each: { picks[], sentence, evidence[] }
       pick: { id, name, type, affinity, properties{...subset}, links{apple?, spotify?, map?}, why[{signal, contribution?}] } }
```

---

## 7. Demo profiles (all fictional; no real person's data)

1. **Walt Pruitt, 74, Bakersfield, CA** (the brief's example). Loves: Merle Haggard, bass fishing, the Los Angeles Dodgers, carne asada, Johnny Cash, Clint Eastwood westerns, black coffee at the diner. Constraints: either (family: "a short blessing is fine"), budget middle, many older guests (walkers). Wow line to aim for: Vin Scully broadcasts or Buck Owens in the extras.
2. **Dana Whitlock, 58, Portland, OR** (secular). Loves: David Bowie, Patti Smith, Studio Ghibli films, Thai food, pinball, Ursula K. Le Guin, The X-Files, rainy-day record shops. Constraints: secular, budget open, mixed guests. Expect: a brewpub or arcade venue, a sci-fi reading, a 1970s–90s slideshow.
3. **Rosalind "Roz" Mayes, 81, Birmingham, AL** (faith-based). Loves: Mahalia Jackson, Aretha Franklin, her rose garden, The Andy Griffith Show, fried catfish and greens, Maya Angelou, Dolly Parton. Constraints: faith-based (Baptist church service), budget modest, many older guests, no alcohol at the gathering. Expect: a church-hall or community-center venue, soul-food caterer, a gospel-leaning playlist, readings that lean toward Angelou's neighbors.

Each example is a precomputed run (so "Try an example" renders in under one second), plus a "Rebuild live" button that re-runs the agent with the ledger visible.

---

## 8. Mock Qloo client, real client, probe

- `QlooClient` interface: `search(q)`, `tags(q)`, `insights(params)`, `entities(ids)`. Implementations: `RealQlooClient` (fetch, 8 s timeout, 2 bounded retries on 429/5xx with backoff, allowlisted params, cache-through) and `MockQlooClient` (fixtures in `fixtures/qloo/*.json`, keyed by a normalized request signature with wildcard fallbacks so unknown queries still return plausible shapes).
- Fixtures are **synthetic**, hand-shaped from the docs' documented examples (field names above). They must not be real captured responses (kit rule: no Qloo response data in a public repo). They cover the three demo profiles plus generic fallbacks per entity type.
- Switch: `QLOO_MODE=mock|live` in `.env`. Live requires `QLOO_API_KEY`. The server refuses to start in `live` without a key and logs the mode at boot; `/health` reports `{ ok, qloo: "mock"|"live", llm: provider }`.
- `scripts/probe.ts` (run once the key lands; prints a table, never commits output): `/search` for each love of each profile; `/v2/tags` for carne asada, Thai, catfish, event venue; `urn:tag`, `urn:demographics`, and `urn:entity:{artist,book,movie,tv_show,place}` for Walt's ids; place queries for Bakersfield, Portland, Birmingham with price and rating filters; one `filter.results.entities` rank. Reports field names found vs expected so the fixtures and types can be corrected in an hour.

---

## 9. LLM provider, cost cap, abuse controls

- `LlmProvider` interface: `complete({ system, messages, tools, maxTokens }) → { text?, toolCalls[], usage }`. Providers: `mock` (deterministic planner), `anthropic` (`@anthropic-ai/sdk`, model `claude-haiku-5-5`, `thinking` omitted, `output_config.effort: "low"`, `tool_choice: auto`, `max_tokens` 2048 per turn, 20 s timeout, no prefill, parse tool inputs with `JSON.parse` only), `gemini` (optional adapter, below the cut line). Selected by `LLM_PROVIDER`.
- **Per-run cost** (estimate): six turns, about 18k input + 4k output tokens ≈ $0.004 on Haiku 5.5. **Spend cap**: `LLM_SPEND_CAP_USD=4.00`; the ledger sums `usage` × price after each call; at the cap, new runs use the mock planner and the ledger shows "planned without the language model (demo budget reached)". Total exposure through Nov 16 stays under $5 even if every run is live.
- **Rate limits**: per IP 6 runs/hour and 30/day; global 400 runs/day; 429 with a kind message. Example profiles never count (they are cached).
- **Caching**: run cache keyed by `sha256(normalized loves + city + constraints + mode)`; identical inputs replay the stored trace and plan (a judge pressing the button twice costs nothing). Qloo and LLM caches as in §6.
- **Prompt hygiene**: the model never sees the key; tool results are passed as data; the system prompt says every pick must be an id from a tool result; `write_section` rejects anything else.

---

## 10. Hosting and deployment (VPS, nginx, PM2, Cloudflare DNS)

Correction to the brief: the VPS has no cloudflared tunnel (Sept 5 audit: "no cloudflared"). Existing apps are served by **Cloudflare-proxied DNS → nginx on the VPS (UFW 80/443 open to Cloudflare ranges only) → PM2 Node process bound to 127.0.0.1**. Tribute follows the same pattern.

- Port: pick a free non-sequential port (`ss -tlnp`; proposed `5117`), register in `/etc/vps-ports.conf`, bind `127.0.0.1:5117`.
- Process: PM2 app `tribute` (`pm2 start dist/server.js --name tribute`, `pm2 save`); confirm restart count stays 0 after deploy (crash-loop lesson in memory).
- nginx: `sites-available/tribute.swellstackco.com` → `proxy_pass http://127.0.0.1:5117;` with `proxy_buffering off` and `proxy_read_timeout 120s` for SSE; `certbot --nginx -d tribute.swellstackco.com` (nginx authenticator, never standalone); security headers (CSP: self + fonts.googleapis/gstatic; no inline scripts except Vite hashes).
- DNS: Cloudflare API (global key + `ben.jacobs07@gmail.com` per memory) creates the proxied A record for `tribute` → `2.24.203.5`; purge cache after each deploy.
- Health: add `https://tribute.swellstackco.com/health` to `/etc/vps-healthcheck.conf`; logrotate entry for PM2 logs (pm2-logrotate already installed).
- Deploy script `scripts/deploy.sh`: rsync source (excluding `.env`, `data/`, `node_modules`), `npm ci --omit=dev`, `npm run build`, `pm2 restart tribute`, curl `/health`, purge Cloudflare. `.env` on the box is chmod 600; keys are pasted by Ben once.
- Backups: `data/tribute.db` is disposable (caches + runs); the three example runs are regenerated by `npm run seed:examples`.

---

## 11. Design and front end

- Stack: Vite + vanilla TypeScript (no framework), one CSS file with tokens. Server: Express on Node 22, TypeScript strict, `better-sqlite3`, vitest.
- Visual language: stationery. Paper `#F7F2E8`, ink `#23201C`, muted ink `#6B6258`, rule lines `#D8CFC0`, one accent for links and the ledger status, a deep green `#3B5B48`. Type: display serif "Cormorant Garamond" (or "EB Garamond") for titles and the program; "Source Serif 4" for body; "Inter" only for the ledger's monospace-ish metadata. Minimum 17 px body, 7:1 contrast on paper. Generous margins, hairline rules, small caps for section labels. No gradients, no glass, no emoji, no stock photos. One ornament: a thin horizontal rule with a centered diamond.
- Ledger rows look like a printed receipt: tool name in small caps, status pill, one-line summary, ms right-aligned.
- Print CSS: `@page { size: letter; margin: 0.6in }`; `.program` lays out as a folded booklet (two columns per sheet) with `break-inside: avoid`; hide nav and ledger; the why page prints on its own.
- Mobile: single column, chips wrap, 44 px targets, mic button, the ledger collapses into a progress line with "show steps".
- Reading level: `scripts/readability.ts` runs Flesch-Kincaid over `src/copy/*.ts` and over LLM sentences at runtime; participant strings must score grade ≤ 6; LLM sentences > grade 7 get one rewrite request, then fall back to the planner's sentence.
- Accessibility: focus rings, labels on every field, `aria-live` on the ledger, prefers-reduced-motion respected (the only motion is rows fading in).

---

## 12. README and Devpost description (draft skeleton)

**Title:** Tribute — a celebration of life that sounds and tastes like them.
**Tagline:** AI memorial tools guess. Tribute knows.
**Problem:** Families plan a service in two or three days while grieving; the defaults are generic. Planners (funeral homes, celebrants, hospice social workers) have minutes per family.
**Prior art and how we differ:** §1a, nearly verbatim: name the existing AI memorial tools, state that they format or guess, and that Tribute grounds every pick in Qloo taste data, surfaces things the family never mentioned, and shows the affinity behind each choice on the card itself.
**What it does:** type what they loved → the agent resolves, asks one question, expands across music, books, film, food and places with Qloo, plans six sections, checks them against the family's constraints, and prints a program with a "why these choices" evidence sheet.
**Why it is Qloo-powered:** list the endpoints and the fact that `write_section` refuses any pick without a Qloo id. Include a redacted request-to-result walk-through for Walt (loves → entity ids → tag profile → artist/book/place calls → picks), per the kit's submission guide.
**Agentic:** tool loop mirroring the official harness workflow shapes and statuses; ledger shows each call; one clarifying question (`needs_input` pattern); self-critique pass.
**Responsible use:** only typed loves and a city go to Qloo; no names; demographics describe audiences, not the person; results shown with source and limits.
**Known limitations:** Qloo has artists not songs (families pick songs via the search links); coverage varies by region; readings are authors and books, the family picks the passage; place data may be thin outside large metros; this is not grief counseling.
**Setup from clean clone:** `npm install && npm run seed:examples && npm run dev` (mock mode; no keys); `.env.example` documents `QLOO_MODE`, `QLOO_API_KEY`, `LLM_PROVIDER`, `ANTHROPIC_API_KEY`, `LLM_SPEND_CAP_USD`, `RATE_SALT`, `PORT`.
**License:** MIT.

Devpost fields: repo URL, live URL, description above, 6 screenshots (landing, intake, ledger mid-run, program, why page, print preview), optional video.

---

## 13. Timeline (Manila time)

| Day | Date | Goal | Tasks |
|---|---|---|---|
| 0 | Wed Oct 22 | Key form, Devpost, Discord, spec approved, scaffold | T1, T2 |
| 1 | Thu Oct 23 | Whole agent runs end-to-end in mock mode from the CLI | T3, T4, T5 |
| 2 | Fri Oct 24 | Sections, critique, three examples precomputed | T6, T7, T8 |
| 3 | Sat Oct 25 | Front end: intake, ledger, program, print | T9, T10 |
| 4 | Sun Oct 26 | Design pass, reading-level lint, deploy mock build to the live URL | T11, T12 |
| 5 | Mon Oct 27 | Key expected (US business days Oct 23, 27); probe, swap to live, tune fixtures and filters; if no key: escalate in #api-help and Devpost "Questions?" daily | T13 |
| 6 | Tue Oct 28 | README, Devpost text, screenshots, optional video, clean-clone test | T14 |
| 7 | Wed Oct 29 | Submit with buffer; keep the site up through Nov 16 | — |

Schedule check: if T1–T8 are not done by Oct 25 09:00, apply the cut line in BUILD-PLAN.md. If the key has not arrived by Oct 28 12:00, submit anyway with the live code path in place and a README section stating the key was pending; a mock-only demo is not acceptable under "must integrate the Qloo API," so Ben also emails the hackathon manager that day.

---

## 14. Honest odds and risks

300–500 submissions expected, three cash prizes; a unique, polished entry is maybe a 3–8% shot. Risks: (1) key arrives late → everything is built against the mock and the swap is a config change; (2) Qloo place data thin in Bakersfield or Birmingham → fall back to the metro (`filter.location.query=Los Angeles` is a worse story, so probe early and change the demo city if needed); (3) a judge finds the topic heavy → the tone rules, the "celebration" framing and the warm example copy are the answer; (4) a cheap model drifts → the planner fills gaps and the trace proves provenance; (5) abuse of a public LLM endpoint → cap, rate limit, cache.
