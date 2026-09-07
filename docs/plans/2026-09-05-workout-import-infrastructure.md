# Workout import agent: infrastructure research and implementation plan

Status: proposed; research only. Researched September 5, 2026 (America/Boise). No application code, dependency, or deployed infrastructure changes are included. Companion: [UX implementation plan](2026-09-05-workout-import-ux.md).

## Recommendation

Upgrade the existing Cloudflare Agents foundation and build a specialized `WorkoutImportAgent` in `apps/wodsmith-start`. Use TanStack AI for model calls, structured extraction, tools and proposal revisions, with Cloudflare Agents for durable sessions and AI Gateway for a vision-capable Workers AI model. Start with a bounded import/revise operation that produces a validated, editable draft. Let the ordinary application save action create the workout after review.

A plain Cloudflare `Agent` fits the existing state/RPC client pattern while TanStack AI owns inference. Use `@tanstack/ai` and `@tanstack/ai-cloudflare` in the importer. Keep the existing scheduler's Vercel AI SDK dependencies until a separate migration replaces its consumers; upgrading them to AI SDK 7 is not a prerequisite. This stack choice follows the user's preference for TanStack AI.

## What already exists

| Area | Evidence in this checkout | Implication |
| --- | --- | --- |
| Runtime | `apps/wodsmith-start/src/agents/judge-scheduler-agent.ts` extends `Agent`, uses `@callable`, Zod tools, `generateText`, `stepCountIs`, state updates and cancellation | Reuse deployment/access patterns, not the judge-specific prompt or 24-step loop |
| Transport | `apps/wodsmith-start/src/server.ts` authenticates the raw request cookie, validates the user suffix in the agent name, uses `getAgentByName`, exports the DO class | Add an explicit namespace route; preserve name initialization needed after hibernation |
| Provisioning | `apps/wodsmith-start/alchemy.run.ts` provisions a SQLite DO, `AI`, and AI Gateway; non-dev gateway has logging enabled and cache TTL zero | Extend Alchemy, not just the checked-in Wrangler sample |
| Dependencies | Main app and `apps/crew` declare agents `^0.12.3`, ai `^6.0.77`, gateway provider `^3.1.3`, Workers AI provider `^3.1.14` | Foundation is recent, but behind current majors; lock resolves agents 0.12.4 and ai 6.0.77 |
| Model | Judge scheduler uses `workers-ai/@cf/moonshotai/kimi-k2.6` through the Gateway unified adapter | A candidate vision model is already referenced; inference transport still needs an image smoke test |
| Other agent stack | Ledger has a Mastra invoice extraction agent in `apps/ledger/src/agents/invoice-analyzer.ts` | Separate application; do not migrate Ledger as a prerequisite |
| Canonical data | `packages/wodsmith-db/src/schemas/workouts.ts`; main-app schema file re-exports shared definitions | Derive allowed enums from owned schema; avoid a parallel AI-only workout model |
| Creation | `src/server-fns/workout-fns.ts#createWorkoutFn` writes only a subset of workout fields and authenticates without checking the requested team | Close field persistence and authorization gaps before import can save |
| Upload storage | Existing R2 upload bucket enables public access through r2.dev or uploads.wodsmith.com | Use a new private source bucket; a random key in the public bucket is not an access policy |

The existing runtime is worth retaining. Some comments are stale (Alchemy references Kimi K2.5 while agent code selects K2.6). The root architecture documentation describes the relevant layering in `lat.md/architecture.md#AI Agents`.

## Verified current package baseline

Public npm `latest` metadata was read directly during this research. Recheck and pin a compatible set during implementation; these observations do not mean the integration has been tested.

| Package | Current importer use | Published latest observed | Role |
| --- | --- | --- | --- |
| `agents` | Existing runtime lock is 0.12.4 | 0.22.0 | Durable session, RPC and draft state; current package declares optional TanStack AI compatibility >=0.10.2 <1 |
| `@tanstack/ai` | New dependency | 0.53.0 | Model calls, structured output and server tools |
| `@tanstack/ai-cloudflare` | New dependency | 0.1.0 | TanStack-maintained adapter; peer requires @tanstack/ai ^0.53.0 |
| `@cloudflare/tanstack-ai` | Alternative, not an additional dependency | 0.2.1 | Cloudflare-maintained community adapter; peer supports @tanstack/ai >=0.28.0 <1 |

Registry references: [agents](https://registry.npmjs.org/agents/latest), [TanStack AI](https://registry.npmjs.org/@tanstack%2Fai/latest), [TanStack Cloudflare adapter](https://registry.npmjs.org/@tanstack%2Fai-cloudflare/latest), [Cloudflare community adapter](https://registry.npmjs.org/@cloudflare%2Ftanstack-ai/latest).

Prefer `@tanstack/ai-cloudflare`: its documented `createCloudflareText(model, { binding: env.AI, gateway: { id, skipCache: true } })` configuration covers our existing Workers AI binding and Gateway. The separately named `@cloudflare/tanstack-ai` uses different factories; do not mix imports or configuration examples between the two packages. [TanStack Cloudflare adapter documentation](https://tanstack.com/ai/latest/docs/adapters/cloudflare).

The existing scheduler retains `ai` 6.0.77, `workers-ai-provider` 3.1.14 and `ai-gateway-provider` 3.1.3 while the importer uses TanStack AI directly. No `generateText`, `Output.object`, Vercel provider adapter, `AIChatAgent` or `useAgentChat` dependency belongs in the new import path. A later scheduler migration can remove unused dependencies after its own regression checks.

Verify image inputs, structured output, tool/result types, usage accounting, abort behavior and Gateway binding transport with a compile/build and real staging call. These TanStack packages are pre-1.0, and the preferred adapter is at 0.1.0: pin versions and treat the compatibility/image spike as a release gate. Audit the production Alchemy-generated compatibility date/flags and generated Env types; the checked-in Wrangler date is 2025-09-02. Treat runtime date changes as a separate tested change.

## Framework and transport choices

Cloudflare Agents and TanStack AI serve separate responsibilities in the proposed design.

| Layer | Choice | Responsibility |
| --- | --- | --- |
| Inference | TanStack AI `chat()` with `outputSchema` and server tools | Extract and revise typed workout proposals |
| Model adapter | `@tanstack/ai-cloudflare` | Workers AI binding and Cloudflare AI Gateway routing |
| Durable runtime | Plain Cloudflare `Agent` | Authorized import sessions, draft revisions, progress, cancellation and recovery |
| Initial UI transport | Existing `agents/react` state/RPC pattern | Invoke import/revise and receive validated draft snapshots |
| Optional conversational UI | TanStack AI client/React integration with an explicitly implemented transport | Follow-up only if a chat interface is needed |
| Long-running batches | Cloudflare Workflows / Queues | Defer until bulk import exists |

Run TanStack AI inside the plain Agent. The app's proposal DTO is the transport boundary; do not forward TanStack stream chunks into Cloudflare's AIChatAgent chat protocol. If token streaming is later required, implement a TanStack-compatible HTTP/SSE or custom connection adapter with explicit authentication, persistence and replay behavior. First release streams factual stage updates and completed draft revisions through Agent state, so it does not require chat protocol integration.

The importer does not need Think, another agent harness, MCP, browser tools, vector search, fine-tuning or runtime sub-agents. Mastra in Ledger remains a separate application concern.

## Proposed architecture and contract

The shared import workspace sends text or an authenticated upload reference to a server-created import session. `WorkoutImportAgent` extracts a candidate, resolves catalog movements, validates scoring, and emits versioned draft state. The user can answer targeted questions or ask for a correction. A final explicit save calls a scoped application service, which revalidates and persists the reviewed fields.

### Specialization in the workout schema

Create browser-safe `src/lib/workout-import/schemas.ts` plus pure normalization/validation helpers. Share the validated write contract with manual creation so preview and save cannot diverge. Separate model output, UI draft, and persistence types; never let model output supply ownership or authorization fields.

Proposed draft envelope:

- `schemaVersion`, `importId`, `revision`, `status`, source reference and extracted source text.
- `workout`: name, description, scheme, scoreType, timeCapSeconds, roundsToScore, repsPerRound, optional tiebreakScheme, resolved movement IDs and permitted scaling references.
- `unresolved[]`: stable question ID, field path, source excerpt, reason and allowed choices; unknown fields remain null until clarified.
- `warnings[]`: unsupported sections, likely transcription issues and assumptions, with source evidence rather than numeric model confidence.
- Save metadata: reviewed revision, deterministic content hash and idempotency key. Server owns user/team/track/scope and resulting workout IDs.

Use TanStack AI `chat()` with `outputSchema` for typed extraction and revision, followed by deterministic cross-field validation. Define any movement lookup or proposal tools with `toolDefinition(...).server(...)`. Verify the selected adapter/model supports the required structured-output and tool combination; allow at most one bounded repair attempt. Structured output alone does not guarantee correct workout semantics. [TanStack structured outputs](https://tanstack.com/ai/latest/docs/structured-outputs/overview).

For a revision, send the source, current reviewed draft, expected revision and requested correction to the same TanStack pipeline. Return a new complete validated proposal and changed-field metadata; do not let the model mutate synchronized state directly. Reject stale revisions server-side and preserve concurrent manual edits in the client.

The schema guide sent to the model should be small, versioned and assembled from app constants plus curated examples. Resolve movement names against existing records; flag unmatched/ambiguous names, preserving original text. No automatic movement creation. Do not build RAG over the whole repository.

### Scoring invariants

The database supports `time`, `time-with-cap`, `pass-fail`, `rounds-reps`, `reps`, `emom`, `load`, `calories`, `meters`, `feet`, and `points`. Score aggregation supports `min`, `max`, `sum`, `average`, `first`, and `last`.

- Workout `timeCap` is stored in seconds; score-library cap values are milliseconds. Make the conversion boundary explicit and test 12:00 -> 720 workout seconds -> 720000 score milliseconds.
- Workout rounds and `roundsToScore` are distinct: five rounds for time normally yields one time score, not five score inputs.
- AMRAP duration belongs in the description unless a suitable existing field applies; do not misuse the time-with-cap field to store any duration.
- A capped time result uses reps at cap; never invent an independent secondary scoring scheme.
- EMOM describes a format and may leave scored quantity ambiguous. Ask for the intended scoring behavior when source text does not specify it.
- Mixed independently scored strength/metcon parts cannot be silently collapsed into one scalar score. First release imports one selected workout/part and preserves remaining source text for another import.
- Preserve loads, units, scaling alternatives and rest in the description where the workout schema has no structured prescription field. Do not confuse prescribed load with a recorded athlete score.
- A generated title is acceptable when visibly editable; guessed scoring, weights, rep counts and caps are not silently accepted.

Reuse the current scoring encoders/decoders and schema helpers for previews. Keep competition-specific scoring configuration outside first-release scope.

### Model selection and source handling

Benchmark Kimi K2.6 first because it is already selected by the scheduler and Cloudflare documents vision, tool calling and structured outputs. Test screenshots through the actual TanStack AI -> Cloudflare adapter -> Gateway -> Workers AI path, not just a playground text prompt. The model requires paid Workers access or Gateway credits. [Cloudflare model documentation](https://developers.cloudflare.com/workers-ai/models/kimi-k2.6/).

Do not select a fallback by reputation alone. If quality/latency fails the fixture suite, evaluate one Gateway-supported hosted vision model using the same dataset and record exact model IDs, availability, latency and cost before choosing it. Text and screenshot paths should share the normalization pipeline.

Proposed initial product limits: one PNG/JPEG/WebP, maximum 10 MiB, decoded pixel limit enforced server-side; text maximum 20,000 characters. These are app policy starting points, not Cloudflare limits. Benchmark legibility before downscaling. No PDF, URL fetching, multi-image batch or document OCR service in v1.

Upload over authenticated HTTP into a new private R2 bucket such as `WORKOUT_IMPORT_SOURCES`. Store only object references in DO/client state, and provide authenticated source preview. Check actual file bytes, size and dimensions; reject SVG/HTML. Strip unnecessary metadata when normalizing. Authorize every source read by session ownership and destination scope. Never put base64 images in synchronized state or logs.

Proposed retention: remove source images/text and abandoned drafts after 24 hours, including cancelled sessions; remove source data after successful save when no longer needed. Keep minimal audit metadata and idempotency receipts under a separately documented retention policy. Configure source-bucket lifecycle and DO cleanup. Since the existing Gateway collects logs, explicitly disable payload logging for import traffic or use a dedicated gateway configuration that does; verify the provider honors it. Keep inference caches off for private imports.

### Required AI workout import entitlement

Create a dedicated `FEATURES.AI_WORKOUT_IMPORT = "ai_workout_import"` feature with display name **Workout import**, category `ai`, and an idempotently provisioned `features` row. This is required for launch, not an optional monetization decision. A rollout flag or rate limit cannot grant access.

Follow the existing team feature entitlement system (`hasFeature`, plan entitlements, manual grants and overrides). Personal imports resolve the authenticated user's personal team; track imports resolve the track's owning team from trusted database records. A user must have access to that exact entitled team and the applicable create/programming permission. Entitlement on another team, basic workout tracking, an admin role alone, AI message credits, `ai_workout_generation`, and `ai_judge_scheduling` do not grant import access. Individual rollout grants can target a user's personal team; a gym-team grant covers its authorized members only in that team context.

Implementation requirements:

- Add the feature constant in `src/config/features.ts`, catalog seed entry in `scripts/seed/seeders/02-billing.ts`, and a production-safe idempotent catalog provisioning step. Seeding the catalog must not grant it to all plans or existing users. Expose the feature through the existing `/admin/entitlements` grant/revoke controls; verify those writes are reflected by the access resolver. Pricing and plan packaging may be decided later.
- Add one server-only `requireWorkoutImportAccess` policy accepting trusted actor and destination scope. Resolve membership, write permission, workout-tracking access and `hasFeature(scope.teamId, FEATURES.AI_WORKOUT_IMPORT)` before returning authorized scope. Missing feature/grant, expired/revoked grant or an unavailable authorization lookup fails closed. DO callers must use explicit authenticated identity and DB checks rather than TanStack Start cookie helpers.
- Enforce the policy on session creation, upload, source/draft reads, socket handshake/reconnect, import, revise, retry/resume and the dedicated AI-workout save operation. Check before allocating a new agent/source or making a model call. Browser controls only reflect server-provided access; they are not enforcement.
- Persist server-owned import provenance and scope. Every library, track and log-return AI save adapter must go through the entitled import-save service, including edited drafts and idempotent save retries. Do not fall back to the ordinary create endpoint when import authorization fails or rely on a removable client `createdWithAI` flag.
- Recheck current authorization before subsequent model steps, publishing a completed revision, and the final database write. A long-lived socket must not preserve a stale entitlement grant. On revocation/expiry, stop new inference and reject further draft/source delivery or saves; an already dispatched inference request may finish at the provider, but its output cannot authorize further use. Allow safe cancellation/cleanup without requiring a new grant.
- Manual creation and previously saved workouts retain their ordinary permissions. This gate controls the AI import workflow; it does not attempt to classify text entered into the manual editor.

Required tests: denied-by-default actor; entitlement on the wrong team; expired/revoked grant; authorized entitled user with and without destination write permission; direct HTTP/RPC and generic state-update attempts; open socket after revocation; retry/recovery after expiry; edited-draft and create-plus-track saves; unavailable entitlement lookup. Denied generation must make zero model calls, and denied saves must insert zero workout, movement-link, track-link or receipt rows. Test grants/revocations through the existing admin mechanism, not only a mocked boolean.

### Authorization, reliability and saving

Authorize session creation, source upload/read, socket connection, every import/revise operation and final save. Derive personal team from the session; for a programming destination verify track ownership and programming permission server-side. Require existing workout tracking access and the new `FEATURES.AI_WORKOUT_IMPORT` (`ai_workout_import`) entitlement. This is a mandatory access requirement, separate from any rollout switch.

Use opaque server-issued session IDs bound to user/team/destination, with exact origin checks on browser mutation/socket requests. Restrict the new namespace before allocating a DO. Treat source text/images as untrusted content, with no tools for arbitrary database queries, external browsing or publishing. Prevent clients from changing authoritative draft/status/access state through generic state synchronization.

Persist run ID, revision and cancellation intent. Allow one active generation per session; discard late results from superseded runs. Use the SDK's managed fibers for durable acceptance and inspection, with explicit recovery policy: completed normalized draft survives; interrupted inference may retry once within a budget or present Retry. A persisted DO does not automatically resume an interrupted model request. [Cloudflare durable execution](https://developers.cloudflare.com/agents/runtime/execution/durable-execution/).

Start with one extraction and at most one repair, bounded output tokens and timeout. Rate-limit by authenticated actor/team; record input/output tokens, model, durations, retries and validation failures through evlog/Gateway, excluding raw source content and reasoning. Keep UI progress to factual stages such as Reading, Checking scoring, Ready.

The model only proposes. Save validates the submitted edited content against the shared contract, rechecks access, and writes all supported fields and movement junctions. Do not trust a browser flag saying validation passed. Use an import-save receipt keyed by actor/import/revision/destination so a lost response or double click returns the same workout ID. Store the receipt and workout writes atomically in PlanetScale; DO state alone cannot make a DB transaction idempotent.

For track destinations, create workout + movement links + track association + receipt in one supported DB transaction. Confirm existing transaction facilities/driver behavior during implementation. Return both IDs; scheduling a date and entering athlete results remain separate explicit actions. Do not silently attach the new workout to the personal team when the destination is a managed track.

## Implementation sequence

1. **Dependency/runtime spike.** Pin `@tanstack/ai` and `@tanstack/ai-cloudflare`, upgrade Cloudflare Agents separately, and prove TanStack structured extraction/revision inside a plain Agent. Keep existing Vercel AI SDK scheduler dependencies while checking both main app and Crew runtime consumers without adding importer UI to Crew. Regenerate environment types. Run scheduler unit tests, type-check and Worker build, then stage Gateway text/tool/image calls, connect/reconnect/cancel and draft persistence. Preserve existing DO class/binding names and migrations.
2. **Entitlement and shared domain/write contract.** Provision the dedicated feature and admin grant/revoke path, implement the shared fail-closed access policy at every import boundary, then extract a reusable Zod contract; implement cross-field validation, explicit unit conversion, movement lookup, permission enforcement and atomic idempotent save. Extend ordinary form/save support for imported scoring metadata. Add tests before exposing saving.
3. **Import backend.** Add private R2 binding, session/upload endpoints, import agent namespace/export, access helper, model adapter, normalized draft state, revisions, rate limits, retention and cancellation/recovery. Pure tools should be independent of the runtime for testing.
4. **Shared UX in parallel.** Build the import/review component against contract fixtures while backend develops. Follow the companion route matrix. Integrate existing `WorkoutForm`, track creation and create-then-return to workout logging.
5. **Evaluation and staged rollout.** Run fixed fixtures and image transport smoke tests, enable for internal workout users, then a small team cohort. Expand only after semantic fidelity and save reliability gates pass. Rollout requires an explicit `ai_workout_import` entitlement grant. An independent kill switch may disable imports for entitled users; it never enables them for unentitled users. Manual creation and already saved workouts retain their ordinary access rules.

Each implementation step requires GitNexus impact analysis before changing existing symbols. This planning task modifies documentation only. Scope-check before a later commit. Do not replace existing scheduler DO classes to add importer behavior; add a new namespace/migration through the actual Alchemy deployment path.

## Acceptance and evaluation

Use a human-labeled corpus of at least 30 text/image pairs covering for-time, capped workouts, rounds/reps AMRAP, variable rep ladders, EMOM, scored intervals, max-load, units, scaling alternatives, handwritten/blurred text and multiple sections. Distinguish extraction correctness, scoring correctness and successful persistence; an attractive preview is insufficient evidence.

Proposed launch gates:

- The required `ai_workout_import` entitlement is provisioned and defaults to denied. Grant/revoke, expiry, wrong-team access, direct agent requests and all AI save destinations pass the entitlement tests above.
- Every saved field round-trips through the DB and score-entry preview without loss; all deterministic authorization/idempotency tests pass.
- At least 95% exact core scoring-field agreement on the clearly specified fixture subset; ambiguous fixtures ask or flag instead of inventing a score model. Review every remaining mismatch before rollout.
- No unresolved blocking field can be saved; no cross-user/team source or session reads; no user-provided instructions can trigger writes or change destination.
- Duplicate submissions/saves, disconnect/reconnect, cancellation, permission revocation, malformed output, provider timeout and expiry leave recoverable UI with no duplicate workout/track rows.
- Existing judge-scheduler tests and manual create/edit flows continue to pass after upgrades. Run targeted main-app/Crew type-checks and Worker builds for changed dependency consumers, then browser checks for all v1 entry points.
- Measure p50/p95 end-to-end latency, cost per accepted import, correction rate and abandonment. A provisional p95 target of 20 seconds is a product target to validate, not a claimed measured capability.

No live model evaluation, staging deployment, runtime test or migration has been performed in this research task. Precise delivery estimates should follow the first compatibility/image spike; the largest unknowns are provider image behavior and closing the shared write-contract gap.

## Research method and limits

Local source, lockfile and lat.md documentation were inspected. `lat search` failed to reach its embedding endpoint because of DNS/network access; direct `lat locate` and source reads supplied context. GitNexus was refreshed for this checkout and queried by absolute path because multiple registered repositories share the same name. Some search snippets showed older release versions; the package table uses fresh public npm registry metadata instead. Official Cloudflare and TanStack AI pages support platform claims; all proposed product limits and acceptance thresholds are explicitly design proposals.
