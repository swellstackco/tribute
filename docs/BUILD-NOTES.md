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
(none yet)

## Ben must do
- Supply `QLOO_API_KEY` when it arrives (server `.env` only).
- T12 deploy and T13 live swap are not part of this build.
