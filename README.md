# Tribute

**A celebration of life that sounds and tastes like them.**
*AI memorial tools guess. Tribute knows.*

Live demo: https://tribute.swellstackco.com (free, no sign-up) · License: MIT · Built for the Qloo Agentic Hackathon.

Tell Tribute five to ten things someone loved. It builds the music, the readings, the food, a place to gather,
the slideshow eras and a printed program. Every pick is an entity or tag that Qloo's taste graph returned for this
family's loves, and every card shows its evidence: which loves produced it, the Qloo affinity score, and the tags.

Tribute is a planning aid. It is not grief counseling.

## The problem

A family plans a service in two or three days while grieving. The defaults are generic: the same hymn, the same
slideshow. Funeral homes, celebrants and hospice social workers have minutes per family. Everyone wants the day to
feel like the person, and nobody has time to work out what that means.

## Prior art and how Tribute differs

AI memorial tools already exist: CelebrateAlly (an AI celebration-of-life idea generator), Funeral Folio (AI
obituaries and programs), endoflifetools.com (a funeral music planner), MyWishes and My Wonderful Life
(end-of-life planning platforms) and ZSky (program art). They either format the list a family types or ask a
language model to guess. None has a taste graph behind the picks.

Tribute differs in three ways, and the product shows each one:

1. **Grounded, not guessed.** Every pick is an entity or tag returned by Qloo for this family's loves.
   `write_section` refuses any id that Qloo did not return in this run (`PICK_NOT_FROM_QLOO`). The planner cannot
   invent a song, an author or a caterer.
2. **Things the family never mentioned.** Cross-domain expansion (artist to book, film, podcast, place) surfaces
   readings, films for the slideshow and a caterer that fit the person's taste, not just the five items typed.
   Those cards carry a quiet "You didn't mention this" mark.
3. **A visible why on every pick.** The "Because" line, a fit bar with the Qloo affinity, and tag chips sit on the
   card itself, always visible. A "Why we chose these" page collects the evidence and prints on its own.

## What it does

1. **Intake.** Five to ten short text fields (or the browser mic), a first name (used only in the printed program,
   never sent to Qloo), a city, and three choices: kind of service, budget, guests.
2. **The agent works in public.** A live ledger shows each step: tool, what was sent, status, what came back, and
   milliseconds. If a love is ambiguous ("Ghost": the band or the movie) the run pauses and asks exactly one question.
3. **Six sections.** Music, readings, food, a place to gather, on the screen (photo eras and films), and the
   program (order of service).
4. **Self-critique.** The agent checks the plan against the family's constraints (faith-based or secular, budget,
   older guests) and re-queries Qloo with filters when a pick breaks a rule. Revisions appear in the ledger.
5. **Print.** A folded two-sheet booklet (Letter and A4) and the evidence page, both from the browser's print dialog.

Three fictional examples open in under a second. Each has a "build this one again, live" button.

## How it uses Qloo

Base URL `https://hackathon.api.qloo.com`, header `X-Api-Key`, GET only. Parameter names are checked against an
allowlist before sending, because Qloo silently ignores unknown parameters.

| Step | Endpoint | Used for |
|---|---|---|
| Resolve each love | `GET /search` | entity id, type, popularity, tags |
| Foods, hobbies, venue types | `GET /v2/tags` (typo tolerance, then semantic) | cuisine and venue tag ids |
| Era and feel | `GET /v2/insights?filter.type=urn:tag` | tag profile with affinity (the "why" page) |
| Audience shape | `GET /v2/insights?filter.type=urn:demographics` | who else loves these things (never the person) |
| Music | `GET /v2/insights?filter.type=urn:entity:artist` + `feature.explainability` | artists with affinity and contributions |
| Readings | `filter.type=urn:entity:book` | books and authors |
| Slideshow | `filter.type=urn:entity:movie` and `urn:entity:tv_show` | films, shows, release years |
| Also loved | `filter.type=urn:entity:podcast` | extras such as a broadcast to play |
| Food and venue | `filter.type=urn:entity:place` + `filter.location.query`, `filter.tags`, `filter.exclude.tags`, `filter.price_level.max`, `filter.properties.business_rating.min` | caterers and venues near the city |
| Rank a shortlist | `/v2/insights` + `filter.results.entities` | the harness `rank` shape |

Only the loves the family typed and a city name go to Qloo. Never a name, a date, or anything about the family.

### Mirrors the official Qloo harness

The official `@qloo/qloo-harness` has undocumented entry points and pulls in a coding-agent runtime, so Tribute
mirrors its workflow shapes over raw REST instead: the same tool names, the same input field names, the same result
envelope `{ status, summary, results, result_count, error? }` and the same six statuses
(`ok`, `empty`, `needs_input`, `partial`, `degraded`, `error`).

| Tribute tool | Harness shape | Notes |
|---|---|---|
| `qloo_describe` | describe | returns `needs_input` with up to 3 candidates when two strong matches differ in type; accepts a batch (`entities[]`) |
| `qloo_find_tags` | find tags | accepts a batch (`queries[]`) |
| `qloo_recommend` | recommend | plus `price_level_max` and `rating_min` (Tribute extensions) |
| `qloo_rank` | rank | `filter.results.entities` |
| `qloo_entity_tags` | entity tags | tag profile with affinity |
| `qloo_audience_demographics` | audience demographics | age and gender deltas |
| `qloo_capabilities` | capabilities | mode, model, cache size |

Not used: `where_popular`, `compare_audiences`, `trends` (the harness exposes nine shapes; Tribute mirrors six
plus its own `ask_family`, `write_section` and `finish`).

## A real run, redacted (Walt, Bakersfield; live Qloo)

Names and shortened ids only. No response bodies. Seven loves in, eleven Qloo calls, six sections out.

| # | Call | Result (top names) |
|---|---|---|
| 1 | `qloo_describe` (7 loves, batch) | partial, 3 named entities: Merle Haggard `8066100D`, Los Angeles Dodgers `9B8B279C`, Johnny Cash `7750E5CF` |
| 2 | `qloo_find_tags` | the other loves as tags (Bass Fishing, Carne Asada, Diner), plus Mexican and the venue words |
| 3 | `qloo_entity_tags` | era and feel: 25 tags with affinity |
| 4 | `qloo_audience_demographics` | audience leans 55 and older |
| 5 | `qloo_recommend` artist (explain) | Waylon Jennings `7C458A3E`, David Allan Coe, Willie Nelson, George Jones |
| 6-9 | `qloo_recommend` book, movie, tv_show, podcast | A Moveable Feast, In Cold Blood; Walk the Line; Longmire, Justified; The Way I Heard It with Mike Rowe |
| 10 | `qloo_recommend` place + Mexican tag + Bakersfield | Victor's Mexican Grill `CFD7393D` and others |
| 11 | `qloo_recommend` place + venue tags + Bakersfield | Hungry Hunter Steakhouse, Bakersfield Marriott, Party Palace |
| 12 | critique | many older guests: re-query without bars, hiking and rooftop places |

What the Waylon Jennings card shows: affinity 0.97, and the explainability contributions Merle Haggard 0.41, Johnny Cash 0.34, Los Angeles Dodgers 0.25. "Clint Eastwood westerns" found no named match in Qloo, and the why page says so instead of guessing.

## The agent loop

```
 browser ──POST /api/tribute──▶ orchestrator ──▶ LLM provider (claude-haiku-5-5, or the deterministic planner)
    ▲                               │  tool calls, one at a time
    │ SSE: step / question /        ▼
    │ section / done           tool layer (zod inputs, common envelope, per-run "seen ids")
    │                               │
    │                               ▼
    │                       Qloo client: real (fetch, retries, SQLite cache) or mock (synthetic fixtures)
    │
    └── plan + trace ◀── plan builder (sections, evidence, links) ◀── critique pass (filters, rewrite)
```

- Limits: 16 data calls, 6 model turns, 45 seconds, one question per run.
- A required-steps checklist runs independent of the model. If the model stops early or drifts, the deterministic
  planner fills the gaps and the ledger marks those rows "filled by planner". The same planner is the mock model.
- The ledger and the "why" page are rendered from the stored trace, so nothing on screen exists without a Qloo
  result behind it. Raw Qloo bodies are never stored in the trace.
- Cost and abuse controls: a hard spend cap (`LLM_SPEND_CAP_USD`, default 4.00) checked before every model call;
  per-IP limits (6 runs per hour, 30 per day, 400 per day overall; IPs are HMAC-hashed); identical inputs replay
  from cache for free; model and Qloo response caches.

## Setup from a clean clone (no keys needed)

Requires Node 22 or newer.

```
git clone https://github.com/swellstackco/tribute.git
cd tribute
npm install
npm run seed:examples
npm run dev            # API on :5117, web on http://localhost:5173
```

That runs in mock mode: synthetic Qloo fixtures and a deterministic planner in place of a model. `npm test` and
`npm run typecheck` need no keys either.

For production style: `npm run build && npm start` serves the web app and API from one port.

Configuration lives in `.env` (see `.env.example`):

| Variable | Meaning |
|---|---|
| `QLOO_MODE` | `mock` (default) or `live`. The server refuses `live` without a key. |
| `QLOO_API_KEY` | Qloo hackathon key (server only). |
| `LLM_PROVIDER` | `mock` (default) or `anthropic`. |
| `ANTHROPIC_API_KEY` | Only for `anthropic`. The model is fixed to `claude-haiku-5-5`. |
| `LLM_SPEND_CAP_USD` | Hard stop for model spend. Defaults to 4.00. |
| `RATE_SALT` | Secret used to hash IPs. |
| `PORT`, `DB_PATH` | Defaults `5117` and `data/tribute.db`. |

Useful scripts: `npm run cli -- walt` (print a run's ledger and plan), `npm run probe` (check every Qloo request
kind against a real key), `npm run readability` (reading-level gate), `npm run cache:clear`.

## Testing and quality

- 70+ vitest tests: request snapshots for each Qloo request kind, the tool envelope and statuses, the planner,
  the spend cap, rate limiting, caching, the orchestrator, the critique pass, the plan builder and the API.
- Participant text is held to a 4th to 6th grade reading level by `npm run readability`.
- Lighthouse accessibility 100 on the landing and plan pages (desktop). Contrast 7:1 or better.

## Responsible use

- Only typed loves and a city go to Qloo. No names, no dates.
- Demographics describe the audience of what they loved, never the person, and the page says so.
- Every result is shown with its source. Qloo picks; a language model only writes the one-line sentences, and
  Tribute says so on the "why" page.
- Captured Qloo responses are never committed. The mock fixtures are hand-shaped synthetic JSON.

## Known limitations

- Qloo has artists, not songs. Families pick songs through the Apple Music and Spotify search links.
- Readings are books and authors. The family picks the passage.
- Place coverage varies by region. Bakersfield, Portland and Birmingham all return places, but venue results are mixed (Qloo's "event venue" includes arenas and arcades), so Tribute ranks venues by their main category and drops bars, escape rooms and similar when the family's constraints say so.
- Not every named love exists in Qloo (for example, no person record came back for Clint Eastwood). The why page shows those as unmatched.
- Entities the family typed are shown as "From your own words" with no fit score, because Qloo does not recommend a signal back to itself.
- Qloo returns what it knows. Entities or regions it lacks come back empty and the page says so kindly.
- This is a planning aid, not grief counseling.

## License

MIT. See `LICENSE`.
