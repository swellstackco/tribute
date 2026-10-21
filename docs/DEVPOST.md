# Devpost submission draft

Fill the Devpost form from the sections below. Replace anything in [brackets] before submitting.

## Project name
Tribute

## Elevator pitch / tagline
AI memorial tools guess. Tribute knows.

## Short description (one sentence)
Tell Tribute what someone loved and it plans a celebration of life that sounds and tastes like them, with every pick traced to Qloo's taste graph.

## Links
- Live demo: https://tribute.swellstackco.com
- Code: https://github.com/swellstackco/tribute (MIT license, shown in the GitHub About box)
- Video: [optional, not recorded yet]

## Built with (tags)
Qloo API, Qloo Insights API, Qloo Search, Qloo Tags, Claude Haiku 5.5 (Anthropic API), TypeScript, Node.js, Express, SQLite (better-sqlite3), Vite, Server-Sent Events, Zod, Vitest, Playwright, nginx, PM2, Cloudflare

## Story

### Inspiration
Families plan a service in two or three days while grieving. The defaults are generic: the same hymn, the same slideshow. Funeral homes, celebrants and hospice social workers have minutes per family. What everyone wants is simple: for the day to feel like the person. A person's taste is the most honest way to describe them, and taste is exactly what Qloo models. We wanted to use a taste graph for something other than "what should I buy": who was this person, in the language of what they loved?

AI memorial tools already exist (CelebrateAlly, Funeral Folio, endoflifetools.com, MyWishes, My Wonderful Life, ZSky). They either format the list a family types or ask a language model to guess. None has a taste graph behind the picks.

### What it does
You type five to ten things they loved: a singer, a food, a hobby, a team, a show. Tribute resolves each one in Qloo, asks at most one question if something is ambiguous, then expands across music, books, film, podcasts and places. It builds six sections: music, readings, food, a place to gather, on the screen (photo eras and films), and a printed order of service.

Every pick card shows its evidence right on the card: a "Because" line naming the loves that produced it, a fit bar with the Qloo affinity score, and tag chips. Picks the family never mentioned carry a "You didn't mention this" mark; those are the moments where a family says "we didn't tell it that, but yes." A "Why we chose these" page collects the proof and prints on its own. A folded two-sheet booklet prints from the browser.

### How we built it
- **Qloo, six surfaces in one flow:** `/search`, `/v2/tags`, and `/v2/insights` for tag analysis (`urn:tag`), audience shape (`urn:demographics`), five entity types (artist, book, movie and tv_show, podcast, place) with `feature.explainability`, place queries with location, price, rating and exclude-tag filters, and `filter.results.entities` for ranking.
- **A real tool-calling agent** whose tools mirror the official Qloo harness: same names, same input fields, the same result envelope and the same six statuses. A language model (Claude Haiku 5.5) drives the loop; a deterministic planner enforces a required-steps checklist and fills any gap, so a wandering model cannot break the demo.
- **Grounding by construction:** `write_section` refuses any id Qloo did not return in this run, so the planner cannot invent a song, author or caterer. The ledger and the why page are rendered from the stored trace.
- **Self-critique:** the agent checks the plan against faith or secular, budget and older-guest constraints and re-queries Qloo with exclude-tag, price and rating filters when a pick breaks a rule. The revision shows in the ledger with its reason.
- **Product:** vanilla TypeScript front end with live Server-Sent Events, print CSS for a folded booklet, 4th to 6th grade text enforced by a readability gate, Lighthouse accessibility 100.
- **Operations:** SQLite caches for Qloo and model calls, a hard model spend cap, per-IP rate limits with hashed IPs, identical inputs replay for free.

### Challenges
- Qloo returns artists, not songs, and books and authors, not passages. We made that a feature: the family picks the song or passage through search links, and Tribute narrows the field to what fits.
- Ambiguity ("Ghost": the band or the film) can change a whole plan. We used the harness's `needs_input` pattern and capped it at one question per run.
- Cheap models drift. The required-steps checklist and the deterministic planner mean the product works even when the model stops early or writes sentences that are too hard to read; those get replaced with a plain default.
- Tone. This is a heavy topic. We wrote the product in warm, plain words (no "funeral", no "AI" in the interface), tested the reading level, and avoided anything morbid.
- Privacy. Only typed loves and a city reach Qloo. No names, no dates. Demographics describe the audience of what they loved, never the person, and the page says so.

### Accomplishments we are proud of
- Every pick has visible evidence next to it, not behind a link.
- The agent's work is visible and traceable: ledger, one question, a revision step.
- A finished product, not a proof: landing, intake, live ledger, program, why page and print, usable on a phone.
- It stays honest and safe: grounded picks, spend cap, rate limit, no captured Qloo data in the repo.

### What we learned
A taste graph is a good way to describe a person. The same cross-domain expansion that powers shopping recommendations can turn "Merle Haggard and the Dodgers" into a reading list, a caterer and a slideshow era. We also learned how much trust comes from showing the work: the evidence on the card did more than any claim could.

### What's next
- Pilot with a funeral home or celebrant, who plan dozens of services a year, as a planner-side tool with a shared link for the family.
- Song-level picks through a music service once artists are chosen.
- Obituary and program wording that uses the same evidence.
- More regions and languages as Qloo's coverage grows.

## Testing instructions for judges
No sign-up, no keys, free.
1. Open https://tribute.swellstackco.com
2. Press "Open this tribute" on any example (Walt, Dana or Rosalind). It opens in about a second.
3. Look at any pick card. It shows the "Because" line, the fit bar with the Qloo affinity, and tags, without any click. Look for "You didn't mention this".
4. Press "See why we chose these" for the evidence page.
5. Press "Print program" to see the folded booklet in the print preview (or save as PDF).
6. Press "Build this one again, live" to watch the agent work step by step.
7. Back on the home page, press "Start your own", type five or more loves (try "Ghost" as one to see the one-question pause), add a city and press "Build the tribute".

All three examples are fictional people. A note on data: [if the live site is still using Qloo mock mode at submit time, say so here and link the README; otherwise delete this line].

## Screenshots to upload (six)
From `docs/assets/`:
1. `landing-desktop.png` (landing)
2. `intake-desktop.png` (intake)
3. `ledger.png` (the agent at work, paused on one question)
4. `program.png` (the tribute with evidence on every card)
5. `why-desktop.png` (the why page)
6. A print preview image of `program-print.pdf` (the folded booklet)

## Qloo endpoints used (for the form)
`/search`, `/v2/tags`, `/v2/insights` with `filter.type` of `urn:tag`, `urn:demographics`, `urn:entity:artist`, `urn:entity:book`, `urn:entity:movie`, `urn:entity:tv_show`, `urn:entity:podcast`, `urn:entity:place`; `feature.explainability`; `filter.location.query`, `filter.tags`, `filter.exclude.tags`, `filter.price_level.max`, `filter.properties.business_rating.min`; `filter.results.entities`.
