# Build notes

Log of decisions, deviations from the spec, and things Ben must do.

## Decisions
- Defaults from SPEC section 0 are used everywhere. LLM = mock only during the build (the anthropic provider is written and unit-tested with a stubbed client, never called live). Qloo = mock mode only. No deploy (T12 waits for Ben).
- Live LLM key (decision from Ben, relayed by the coordinator, T2): the live LLM will use Ben's existing demo Anthropic key. On the VPS it is `DEMO_ANTHROPIC_KEY` in `/var/www/intake-concierge/.env.local`. At deploy (T12, done by the coordinator) it is copied into Tribute's server `.env` as `ANTHROPIC_API_KEY`. That workspace also powers Ben's live outreach demos, so the safeguards must be on by default:
  - `LLM_SPEND_CAP_USD` defaults to 4.00 (enforced in code, not only in `.env`).
  - Per-IP rate limit (6/hour, 30/day) and global 400/day are always on.
  - LLM and run caches are always on.
  - Model stays `claude-haiku-5-5` only. No other model is selectable.
  - Nothing here makes a live call during the build.

## Deviations from spec
- Batch tool inputs (T3/T5): `qloo_describe` accepts `entities[]` and `qloo_find_tags` accepts `queries[]` (one row per item). Without batching, Walt alone needs 7+ describe calls and the 16-call limit cannot hold. Single-item inputs still behave like the harness.
- Call limit (T5): the 16-call cap counts data calls and `ask_family`. `write_section` and `finish` are bookkeeping and do not count (Walt: 11 data calls plus 6 writes). Tests assert 10-16 data steps.
- Extra recommend calls (T5): podcast is called in addition to the required five (the Vin Scully line). Podcasts show under Readings as "Also worth a listen". Brands are not called.
- Venue rule (T7): bars, nightclubs and breweries are also removed when guests are older (spec only says faith-based). Needed so Walt's venue list holds no bar.
- Critique LLM turn (T7): skipped (cut line 5). Deterministic rules only.
- Model sentences (T5): a model sentence above grade 7 is replaced by the planner sentence directly, with no rewrite request (saves a paid call).
- Fixture field guesses to verify on probe (T13): explainability shape (list of {entity_id, contribution} or id->score map; both are parsed), `properties.active_since` (synthetic stand-in for an artist's start year), tag ids for venue and bar types.
- Unmatched typed loves stay as "From your own words" cards for cuisine tags (tags carry no affinity); entity picks always show a fit number.
- Readability gate: 1-3 word labels are skipped (Flesch-Kincaid is meaningless there) and the brand phrase "celebration of life" is graded as "day of love" (4 syllables, from the spec).
- T7 and T8 were committed separately. T9 and T10 share one commit because the router imports both.
- Screens: full set (five screens, 375 and 1280 px, plus print PDFs) is in `docs/assets/`; the three requested shots are copied to `docs/screens/`.
- Lighthouse accessibility (desktop): landing 1.00, plan page 1.00. Contrast: all token pairs 7:1 or better (`scripts/contrast.ts`).
- Fonts load from Google Fonts with display=swap. T12 nginx CSP must allow fonts.googleapis.com and fonts.gstatic.com, and `style-src 'self'` works because the bar width uses CSSOM custom properties.

## Ben must do
- Supply `QLOO_API_KEY` when it arrives (server `.env` only).
- T12 deploy and T13 live swap are not part of this build.
- Fable reviews `docs/assets/` screenshots before T12.
- Copy the demo Anthropic key into the server `.env` at T12 (see Decisions). Caps are on by default.

## Deployed (T12, 2026-10-22 Manila)
- Live: https://tribute.swellstackco.com. PM2 app `tribute` on 127.0.0.1:5117, cwd /var/www/tribute, nginx vhost with CSP (fonts.googleapis.com, fonts.gstatic.com). Registered in /etc/vps-ports.conf and /etc/vps-healthcheck.conf.
- The server's default Node is 20 and better-sqlite3 13 needs Node 22. A crash loop (44 restarts in seconds, stopped at once) taught this. Tribute now runs on its own Node 22 in /opt/node22 (extracted tarball, SHA-256 verified; nothing global changed). `scripts/deploy.sh` uses it for `npm ci`, the build and the PM2 interpreter. Do not remove /opt/node22.
- Redeploy: `bash scripts/deploy.sh` (checks free memory, rsync, npm ci, build, prune, pm2 reload, pm2 save, health).
- The `.env` on the box (chmod 600) holds the demo Anthropic key copied over ssh from DEMO_ANTHROPIC_KEY; the value was never printed or committed. Startup seeds the three examples with the free planner when Qloo is mock.

## Live smoke test (mock Qloo, real claude-haiku-5-5)
- Four runs (Walt, Dana, Roz, one custom) completed in 14 to 31 seconds with SSE streaming through Cloudflare and nginx. Two more runs came from the Playwright pass, one of which hit the LLM cache and cost nothing.
- Total model spend recorded in the ledger after all runs: about $0.029 (22 model calls, 190k input and 19k output tokens).
- Rate limit verified live: the 7th run in an hour returned HTTP 429 with the kind message and Retry-After.
- Findings fixed: the model's sentences were all above grade 7 and were replaced by planner sentences, and the model picked only 3 items per section. The prompt now asks for pick counts and a sentence format; a later run wrote 8 music picks. Per-run `spend_usd` was 0 because the cache wrapper hid the meter; fixed (test added).
- Print view: the Walt booklet and the why page render as PDFs from the live site (`docs/assets/live/`).

## Going live with Qloo (T13, when the key arrives)
1. Probe from your machine: `QLOO_API_KEY=... npm run probe`. It hits every request kind for the three demo cities and prints status, counts, top names, field diffs against `types.ts`, the explainability shape and the tag ids. Output is never committed. `--mock` tests the probe itself.
2. Fix `src/server/qloo/types.ts`, `fixtures/qloo` (via `scripts/gen-fixtures.ts`), `src/server/agent/constraintTags.ts` and the venue and cuisine tag words if the probe shows differences. If a demo city comes back empty, change that example's city in `src/shared/examples.ts`.
3. Deploy any fixes: `bash scripts/deploy.sh`.
4. Switch: `printf '%s' "$QLOO_API_KEY" | bash scripts/go-live.sh`. That sets `QLOO_MODE=live` and `QLOO_API_KEY` in the server `.env` (backing it up), runs `pm2 reload tribute --update-env`, re-seeds the three examples with the free planner from live Qloo data, and checks `/health` (should show `"qloo":"live"`). Manual equivalent: edit the two lines in `/var/www/tribute/.env`, then `pm2 reload tribute --update-env`.
5. Roll back: restore the `.env.bak-*` file and `pm2 reload tribute --update-env`.
6. Add the redacted Walt walk-through (ids and names only) to the README.

## T13 results (real Qloo, 2026-10-22)
Probe (`QLOO_API_KEY=... npm run probe`): 63 requests, 0 errors, 0 empty, all three demo cities return places, PASS.
Shape differences found and fixed:
- Insights rows carry `type: "urn:entity"` and `subtype: "urn:entity:artist"`; only /search rows carry `types`. Fixed in the tool layer and types.
- `/entities` takes `entity_ids`, not `ids`.
- Explainability is `{ "signal.interests.entities": [{ entity_id, score }] }`. Parsed (and the older shapes still parse).
- Artists use `properties.start_year` (not our guess `active_since`); fixtures and eras updated. Real rows also carry `query.measurements`, `disambiguation`, `external`, and ids are uppercase.
- `/search` returns albums, games and places for common words (for example "bass fishing" gives video games, "Clint Eastwood" gives an album first). `qloo_describe` now keeps only artist, book, movie, tv_show, podcast, brand, person and author, requires an exact name, treats artist, person and author with one name as one love, and sends weak matches for plain words (pinball) to the tag step.
- Tags: many namespaces share a name. Cuisine filters use `urn:tag:genre:place:restaurant:<x>` (dish tags filter to nothing); venue filters use `urn:tag:category:place:*`. A small dish-to-cuisine hint map (`src/server/tools/clean.ts`) turns "carne asada" into Mexican. "church hall" finds nothing real, so the word is "fellowship hall".
- Bar rules: real place tags are noisy (hotels carry bar amenities). Bars are detected by main category tag or by name, excluded in the query, and also dropped client-side after the re-query.
- Venue results are ranked by main category (banquet hall, community center, wedding venue and so on first; arcades, escape rooms and bowling last).
- Qloo 429s: retries raised to 3 with Retry-After; describe runs three loves at a time and tolerates one failed lookup.
- A latent planner loop (repeated empty entity_tags calls when no love resolved) is fixed.
Live: `go-live.sh` run, `/health` shows `"qloo":"live"`, examples re-seeded from real data. One live Haiku run (custom input, live Qloo) completed in 38 s for $0.0093. Total model spend recorded on the box: $0.038.

## Design pass (2026-10-22)
- Front end reset as an order of service read by candlelight: midnight page (#111a2b), warm-white text, one candle-gold accent, Bodoni Moda display plus Hanken Grotesk text and Courier Prime for the working log; left marginal column with numerals, dotted leaders, typeset ledger; no cards, pills, ornaments or eyebrow labels. Ben rejected the earlier cream-and-red pass as too close to Anthropic's own look. Print forces light tokens (white page, black ink). Tokens re-checked in `scripts/contrast.ts` (text 7:1+, accent and buttons 4.5:1+, hairlines 3:1+). Screens re-shot live with `SKIP_OWN=1`; ledger shot is from the local mock run.
