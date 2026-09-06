# Workout import integration acceptance

Integration began from `640e6668562f3ea96150e4c00424f9bb5c025229` on `zac/ai-workout-import-integration`. The infrastructure and UX plans in this directory were copied verbatim from the planning checkout; their research status describes their original authorship, not completed implementation.

## Ownership and order

The entitlement/save implementation owns shared schemas, access policy, provenance and transactional persistence. The backend owns plain Cloudflare Agents, TanStack AI, private sources and transport. The UX owns the review workspace and route adapters. Integration applies their scoped commits in that dependency order and checks the combined behavior.

Before integration, the owners must agree exact schema exports, session ownership, source references, RPC/state envelopes, revisions and provenance, final save inputs and return IDs. No production fixture or alternate save fallback can remain.

## Acceptance matrix

Evidence below distinguishes real browser/database/Worker checks from controlled provider tests and live model evaluation.

| Area | Required evidence | Status |
| --- | --- | --- |
| Personal library | Explicit reviewed save produces a private, fully editable workout | Real MySQL save/edit coverage and real browser review/save/reload pass with an explicitly seeded proposal |
| Track aliases | Both aliases create workout, movements, track row and receipt atomically, retaining owner/order/notes | Real browser settings and admin aliases pass with owner, order and notes checked in MySQL; transaction/rollback tests pass |
| Logging | Create/select retains date/notes without submitting results | Real browser create/select preserves the unsaved date and notes; route handoff regression passes |
| Scoring | Supported fields roundtrip; 15-minute cap = 900 seconds; prescription rounds differ from scores; ambiguity asks | Schema and real MySQL roundtrip/edit tests pass; live model quality remains below acceptance |
| Entitlements | No grant, wrong team, expiry, revocation, missing permission and unavailable lookup fail closed | Database grant/revoke and denied-write tests pass; real browser wrong-team locked UI and direct session 403 pass |
| Agent boundaries | Session/source/socket/RPC/state require current authorization, including after revocation | 19 runtime tests pass with real TanStack adapter and controlled provider binding; real local Worker session/socket/snapshot and revoked snapshot checks pass; deployed runtime verification remains open |
| Persistence | Denial makes zero writes; provenance/revision required; duplicate retry returns same IDs | Real MySQL suite passes; real browser replays the actual save request and receives the same workout, then revocation denies replay without new writes |
| Recovery | Cancel, late completion, reconnect, retry and expiry preserve allowed edits | Runtime and UI regressions pass; rereads create fresh immutable-source sessions; source expiry is distinct from access loss |
| Manual regression | Create/edit/remix, choose existing track workout and ordinary logging remain functional | Existing workout/remix tests pass; manual browser create saved and DB checked; edit roundtrip tested against MySQL |
| Runtime compatibility | Main/Crew scheduler tests, types and Worker builds with pinned stack | Main client/Worker build passes with final pinned tooling and an 8 GB Node heap; 19 runtime tests, main 147 tests and Crew type check/22 scheduler tests pass; normal pre-push all-package type checks pass |
| Browser | Desktop/mobile/keyboard review and save flows | Real local app desktop/390px review/save and all destination flows pass; isolated UX fixture also covers 320px and keyboard save. Full deployed image-source and 200% browser zoom checks remain open |
| Live evaluation | Actual TanStack + Gateway text/vision; human-reviewed corpus quality, latency and usage | Live calls run; scoring mismatch and latency failures keep release gates open. Authored 30-case corpus has not had human review or full live evaluation |

## Integrated verification

The combined integration passed 147 tests across 14 files: 19 real MySQL persistence/edit tests, 49 workout server-function tests, 26 remix tests, 22 scheduler tests, 3 schemas, 2 cleanup tests and 26 UI/route tests. The main client and Worker build and Crew type check/22 scheduler tests pass. The final tooling build exceeded the default Node heap, then passed with `NODE_OPTIONS=--max-old-space-size=8192`; final runtime tests pass all 19 cases. The cleanup tests verify that failed private-storage cleanup cannot invalidate a committed receipt, and denied saves never schedule success cleanup.

The disposable browser environment uses loopback MySQL and a local Worker with synthetic seeded users, grants and proposals. It never connects to a production database. Fixture-seeded proposals test real authorization, review and persistence, not model extraction quality. Browser verification identified a real SDK/runtime mismatch: Agents 0.22 requires named Durable Object IDs, but the prior local workerd predates that support. The pinned main-app Cloudflare Vite plugin 1.32.3 and Wrangler 4.83.0 resolve the failure at the existing compatibility date. The complete local browser script now passes. Compilation and mocked runtime tests alone did not expose the former failure.

The live text call used the actual TanStack 0.53/Cloudflare 0.1 adapter, Workers AI and existing Gateway, with logging/cache disabled. It took 49.4 seconds and returned a scoring mismatch that normalization blocked with a question. An initial synthetic screenshot attempt timed out at 90 seconds after two dispatches. A tuned retry returned a 900-second cap in 51.5 seconds but asked an unnecessary scoring question. These are runtime connectivity observations, not quality or latency gate passes.

The browser runner waits for client hydration before form edits. An initial apparent logging date reset was a test timing error; the hydrated real-router flow retains both date and notes without an application change. The script directly verifies both track aliases and the actual save request replay, including revocation denial. Screenshots were visually reviewed at desktop and 390px; generated screenshot files are local artifacts, not source fixtures committed to the PR.

A forced GitNexus rebuild recovered an internal FTS index error. Comparison against the integration baseline reports 77 changed files and low risk with no indexed affected flows; source review covers the changed shared authoring and entitlement helpers. Local `main` is stale and its comparison includes unrelated prior work, so the integration baseline and GitHub merge-base diff are the relevant scoped checks.

## Current main integration

The PR incorporates main `8f340eec1`, including athlete-owned training sessions. The import migration is now `0004_workout_import_domain.sql`, after main's unchanged `0002_training_personal` and `0003_training_library_history` migrations. The generated snapshot preserves all main tables and adds only the two import tables.

The workout library retains main's gym/date context and training navigation while exposing the entitled private import action. Logging retains main's required personal-session occurrence and server-derived date; creating an imported workout adds a new library occurrence through the existing versioned composition API before selecting it. Existing occurrences remain intact and no result is submitted by this handoff. The merged real-browser run verifies all of these properties and both track aliases. The handoff suite now covers lost-response retry without duplicate occurrences and stale composition failure. Main training/private-log regressions add 83 passing tests; 13 opt-in training database cases remain skipped, separate from the 19 importer MySQL cases that run.

## Baseline and release boundary

Baseline `lat check` passes. Semantic `lat search` could not resolve `api.openai.com`; direct `lat locate` and source reads supplied design context. Initial offline dependency install failed because the package cache was incomplete; a frozen online install succeeded. Tests use Node 24 to match the repository engine requirement.

Baseline main-app type checking passes. The four existing workout, remix and scheduler test files pass all 97 tests. The first baseline build lacked a local Wrangler configuration. After supplying an ignored local-only fixture configuration, baseline client and Worker builds passed; no production resources were provisioned.

No production deployment, entitlement grant or merge is authorized. Database schema/catalog provisioning, private bucket/DO/Gateway deployment, and live model evaluation must be distinguished from local deterministic tests. A draft PR is the review deliverable when GitHub access permits.
