# Workout Import Runtime

The import runtime uses TanStack AI in a plain Cloudflare Agent. Database sessions bind actors and destinations; the runtime proposes revisions without tools that can save workouts.

## Adapter transport

The actual TanStack Cloudflare adapter is exercised with a mocked AI binding to verify vision input, structured output and private Gateway options. This is transport verification, not a live model quality test.

## Dispatch authorization

Every real provider dispatch, including hidden SDK retries, rechecks access and consumes durable actor/team/session quota. Denial must make zero provider calls; a run allows at most two dispatches.

## Late inference results

Revocation or cancellation prevents completed inference from being published or delivered. Binding transport cannot abort provider work already dispatched; late results are discarded.

## Scoring and catalog validation

Only unique existing catalog matches become movement IDs. Ambiguous movements and incomplete scoring produce questions; a duration cannot silently become a capped-time field.

## Source validation

Sources are byte-sniffed PNG/JPEG/WebP, decoded with Images, limited to 24 million pixels and re-encoded as PNG to remove metadata. Private R2 objects expire after 24 hours and never receive a public domain.

## Body bounds

Upload and JSON request streams enforce actual byte counts independently of Content-Length, preventing unbounded buffered input before parsing or decoding.

## Bounded waiting

An abort race ends local inference waiting after 90 seconds even if Workers AI never returns. The provider may finish later, but its result cannot publish; subsequent retries still consume durable quota.

## Agent authorization

Each browser RPC resolves the authenticated connection actor and checks the current entitled database session. Client state changes are rejected; only server-owned proposals can be published.

## Revoked socket delivery

Automatic Agent state synchronization is disabled. Connect, snapshot and each explicit state delivery recheck current authorization; revoked connections close with 4403 before receiving stored proposals.

## Terminal cancellation

Cancellation is ownership-only and expires the database session under the same row lock as revision publication and saving. Late results cannot become saveable; a subsequent import starts a fresh session.

## Recovery authorization

Managed fibers persist acceptance before RPC acknowledgement. Recovery checks permission and restores a matching completed request, or offers Retry for interrupted work without automatically spending more tokens.

## Durable budget

Native-only budget instances enforce daily actor/team limits across sessions. Each session allows twelve provider dispatches, each bounded to 4096 output tokens; a run allows two dispatches including SDK retries.

Actor/team daily limits are respectively 30/150 sessions and 30/150 dispatches. Quota is conservative: attempts can consume a reservation even when the next authorization or provider step fails. Limits reset at UTC midnight; no source content is retained in budget records.

## Saved source cleanup

Successful-save cleanup removes private R2 images and DO source/job/draft data without changing the database expiry or idempotency receipt. Retrying a lost save response still requires current entitlement.

## HTTP authorization

Session creation and every source, snapshot and socket route verify current access before allocating import objects or model work. HTTP policy uses the same resolved-team entitlement service as saving.

## Origin and namespace isolation

Browser mutations and WebSocket handshakes require an exact same-origin header. Unknown session IDs and agent subpaths cannot allocate objects or reach inherited sub-agent routes.

## HTTP failure diagnostics

Unexpected infrastructure failures return a generic server error and log only fixed stage/code values. Access checks remain fail-closed; raw exceptions, source text, cookies and provider details never enter these diagnostics.

## Private source delivery

Source reads check current access again after loading R2 data and return no-store, same-origin responses. Revoked access cannot deliver previously stored source bytes.

## HTTP cancellation

An authenticated ownership-only cancel endpoint remains available after a revoked WebSocket closes. It returns a JSON acknowledgement and performs terminal cleanup without a new entitlement grant.

## Unknown session isolation

Database ownership and access are resolved before a guessed import ID can reach a Durable Object. Unrelated agent namespaces retain their original routing behavior.

## Configuration and verification

Alchemy provisions the SQLite namespace, private source bucket with a 24-hour lifecycle, Images decoder and a separate Gateway with payload logging/caching disabled. Wrangler generates binding types; runtime date and flags remain unchanged.

The main app pins Cloudflare Vite plugin 1.32.3 and Wrangler 4.83.0, whose April 2026 workerd supports native named Durable Object IDs required by Agents 0.22. The former December 2025 local runtime failed before session creation despite passing mocked tests. Crew keeps its own existing tooling.

A real workerd probe with fresh isolated storage verified `getAgentByName` and native Agent RPC at the unchanged 2025-09-02 compatibility date. Frozen installation, both app type checks, 19 importer tests and 97 existing workout/remix/scheduler tests per app passed after this tooling update.

Run `node scripts/workout-import-local-config.mjs` inside the main app to create an isolated build fixture only if one does not already exist. It does not configure remote AI or deploy resources. Run `pnpm test:workout-import-runtime` for Node binding/transport tests and normal app tests for scheduler regression.

`scripts/workout-import-smoke.worker.ts` is a local-loopback-only synthetic-fixture harness, never exported from the app. Live smoke requires an explicitly configured remote AI binding and Gateway; mocked binding results do not establish live model quality or deployed payload-log suppression.

## Live smoke evidence

Synthetic text and rendered screenshot requests reached the real Workers AI model through the TanStack adapter and an existing Gateway. These bounded samples verify transport only; semantic quality and deployed privacy gates remain open.

On 2026-09-06 UTC, text extraction completed in 49.4 seconds with one dispatch (345 input/3392 output tokens), but produced conflicting time/cap fields that deterministic validation blocked with a question. The first screenshot attempt timed out at 90 seconds after two dispatches.

With `reasoning_effort: low`, the same screenshot completed in 51.5 seconds with one dispatch (626 input/3355 output tokens), correctly reading 100 burpees and converting 15 minutes to 900 seconds. It still asked an unnecessary scoring question. The runtime now requests low reasoning effort within the unchanged 4096-token and 90-second bounds; this is not evidence of consistent latency improvement.

The screenshot was a synthetic printed prescription, not handwriting or a blurred photograph. The remaining representative corpus, human label review, ambiguity accuracy and deployed Gateway log suppression must be evaluated before release. No production deployment or entitlement grant occurred.
