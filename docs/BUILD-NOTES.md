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
