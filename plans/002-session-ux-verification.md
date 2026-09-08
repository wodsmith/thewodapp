# Session UX verification receipt

The isolated training UX patch is stacked on PR #691 (`zac/training-access-boundaries`, `aecbb2790e598bcf26b066e1fbc82209f86cd6b8`). No production data, source workouts, official competition scores, deployment, or merge was changed.

## Checks

Checks used Node 24.15.0 in `/private/tmp/wodsmith-session-ux`. The advisor independently reran final gates after reviewing the production diff and tests.

- `pnpm --filter wodsmith-start type-check`: passed.
- `pnpm --filter crew type-check`: passed.
- `pnpm --filter @repo/wodsmith-db type-check` and `pnpm check:schema-ownership`: passed after the additive canonical schema change.
- From `apps/wodsmith-start`, `pnpm exec vitest run --maxWorkers=2`: 3,558 passed, 140 environment-gated tests skipped. `pnpm test:workout-import-runtime`: 39 passed. These are the two commands in the application's `test` script, with worker count capped for the main suite to avoid local resource contention.
- Disposable local MySQL: serial `vitest run` for `src/server/training-personal.test.ts`, `training.test.ts`, `training-provider.test.ts`, `training-workout.test.ts`, and `test/integration/training-access.test.ts` with `--no-file-parallelism`: 112 passed, no skips. This includes the access dependency's 41 boundary cases. The database was localhost `training_test`, separate from production.
- `pnpm exec playwright test --config test/preview/training/playwright.session.config.ts`: 8 passed. The config cold-starts its own fixture preview on port 8778, with desktop and 390px mobile projects. Fixture tests are outside production E2E discovery.
- `pnpm --filter wodsmith-start build` with the local 12GB Node heap and credential-free Wrangler fixture: passed (client 23.61s, SSR 40.49s).
- `pnpm --filter wodsmith-start lint`: passed with 146 warnings (baseline 144; two local non-null assertions remain in guarded picker lookups).
- `lat check`: all checks passed. `git diff --cached --check`: passed.
- Impeccable detector: one scan of ten affected UI targets returned no findings. The later provider-picker behavior and final edit-input height were covered by the final browser pass; the static scan was not repeated.
- GitNexus final staged change detection: 50 files, 153 symbols, LOW aggregate risk, zero mapped execution flows. The shared session writer's separate upstream analysis reported CRITICAL through its server-function wrapper (one direct caller, 648 upstream symbols, 51 processes); that warning was reviewed and the official scoring path remained unchanged.

## Covered journeys

The browser harness renders production training and new/edit score components with isolated client fixture persistence. Real MySQL tests separately prove authorization and atomic persistence; fixture browser success is not claimed as a database authorization test.

Desktop and mobile journeys cover in-place track/session switching, saving a combined warm-up/scored-work/cooldown composition, keyboard cancellation and focus return, disabled default-context actions during a draft, direct kg round/tiebreak logging and editing without composition, provider selection across dates, and a user-selected attributed instruction note. The independent visual review found no horizontal overflow and confirmed 44px action controls (48px navigation tabs).

Server and component regressions cover result-only days, unchanged custom plans/revisions, concurrent direct retries, private/forged source rejection, actual Rx/unit/notes history, rich rounds/capped zero reps/tiebreak boundaries, append/undo identity, repeated published source dates, scored undo rejection, stale destination loading, late responses, and deduplicated receipts without false Undo.

## Environment adjustments and limits

The ordinary parallel full-suite run encountered coach UI timing failures while multiple suites and indexing ran concurrently. The main suite passed with two workers; no timing assertions were weakened. Three introduced history-label expectations were restored to the unchanged component's existing label.

The first build ran out of Node heap. The local build uses the repository's credential-free generated Wrangler fixture and `NODE_OPTIONS=--max-old-space-size=12288`; `SENTRY_AUTH_TOKEN` is unset to prevent uploads. The generated database migration is solely `composition_state` on personal training sessions; existing rows default to `customized`.

GitNexus MCP transport closed during indexing; its CLI completed the refresh and required change detection. Semantic `lat search` was unavailable because the API host could not resolve; `lat expand`, direct `lat locate`, source intent reading, documentation updates, and `lat check` were completed.

Evidence logs are retained under `/private/tmp/session-ux-parent-*-final.log`, plus `/private/tmp/session-ux-detect-commit.log` and `/private/tmp/session-ux-impeccable-detect.json`. Browser screenshots from the advisor are `/private/tmp/session-ux-session-mobile-final.png` and `/private/tmp/session-ux-session-desktop-final.png`.
