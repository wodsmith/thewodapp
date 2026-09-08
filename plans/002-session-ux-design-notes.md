# Plan 002: Give My session a clear home and log any accessible workout directly

This plan makes performing and logging the selected track primary, preserves in-place track switching, and offers optional personal session building with reusable scored and unscored sections.

## Status

- Priority: P1
- Effort: L — several coordinated implementation slices, including database and browser verification.
- Risk: MED overall; access-policy and atomic scoring changes require particular review.
- Category: UX, direction, correctness, access control, tests.
- Depends on: Plan 001 track experience, already represented in the inspected main revision, and ownership PR #691 (`zac/training-access-boundaries`, implementation head `aecbb2790e598bcf26b066e1fbc82209f86cd6b8`) or its merged equivalent.
- Planned on: September 7, 2026.
- Implementation baseline: cached `origin/main`, `0d36543dd0a5c7ad2958f8fcf2b1328998e31c15`.
- Advisor workspace HEAD: `b85db5823`. It predates the session implementation. **Do not implement against this older checkout.**
- Status: TODO. This document is a handoff, not an implemented change.

## Executor instructions and drift check

Read the entire plan, establish a separate implementation checkout containing the baseline above, and bring only this plan and its index reconciliation into it. Preserve the operator's existing worktree and uncommitted training study/import documents. Do not merge, push, deploy, change remote data, or apply production migrations without operator authorization.

Run `git merge-base --is-ancestor 0d36543dd HEAD` in the implementation checkout; expect exit 0. Run `git diff --stat 0d36543dd..HEAD -- apps/wodsmith-start/src apps/wodsmith-start/test apps/wodsmith-start/e2e packages/wodsmith-db/src/schemas/training-personal.ts lat.md plans`. Compare every changed in-scope file against the excerpts below. If the workflow has materially changed, stop and reconcile the plan before implementing.

The main revision was available locally; no fetch or authenticated production walkthrough established that it is the deployed revision. The earlier `zac/athlete-session-composition` branch was useful reconnaissance but is superseded by this baseline. In particular, preserve the newer provider reader, personal following, workout import, and canonical rich-score work.

Coordination update, September 7: ownership PR #691 supersedes the unguarded-reader findings below. Its head was inspected read-only. Reuse `src/server/training-access.ts` (`workoutVisibilityCondition`, `requireTrackRead`, `requireTrackWrite`) and preserve its server-resolved management capabilities. A public track never grants access to private child workouts; private reads require active, unexpired membership in the workout's owner team. Public templates remain readable/remixable into authorized destinations, without permission to edit their source. Coordinate any overlapping source edits with ownership thread `01a07ded-0ee9-79f0-bf78-e19933ca0008`; triage thread `01a07dff-e59b-72c1-8e71-24d8468e8dd6` supplied this dependency. Do not reimplement or weaken that boundary as part of the UX work. Confirm the PR's merged equivalent or incorporate it through the operator's normal branch workflow before editing shared readers.

Ownership follow-up (resolved before implementation): the owner completed the indirect read and membership boundary fixes at `aecbb2790e598bcf26b066e1fbc82209f86cd6b8`. Plan 002 incorporated that exact reviewed head and passed its 41 real-DB access tests. Earlier references below record the discovery baseline; they do not supersede the final implementation head or the separate integration hold documented in Plan 003. Personal score writes remain this plan's responsibility.

Before modifying an existing symbol, run GitNexus upstream impact analysis and report its direct callers, affected processes, and risk. Warn before HIGH/CRITICAL changes. The advisor's worktree is not indexed, so this audit could not obtain a trustworthy graph impact report. Establish the index for the correct implementation checkout rather than using an unrelated same-named repository. Run change detection before any authorized commit.

## Why this matters

The athlete wants to browse several programming tracks, log what they actually do without owning or remixing the workout, and optionally combine workouts into a daily session. Today the same panel represents both a browsed track and a saved personal composition. Library actions navigate to a second identically named confirmation, and the visible workout detail has no direct score action. This makes the destination and relationship between following, viewing, composing, and logging unclear.

## Product contract

The primary experience is **choose a subscribed track, perform its session, and log results directly there**. Preserve the existing Training screen and in-place track switcher. **My session is optional advanced customization**, for modifying a track's day, building a session from scratch, or combining selected sections from several sessions. Once composed, My session also defaults to a performance view, not an editor. Keep the existing results/progress and contextual gym Team views. Workout library remains available for reusable content.

User clarification, September 7: **do not send the athlete to track pages to switch tracks they already follow.** This supersedes the earlier proposed Browse tracks destination. Track discovery/following pages remain available for finding new tracks, but are not part of the normal subscribed-track/session loop.

Recommended hierarchy within the shared date/workspace header: `Track: [Everyday ▾]`, the day's session and its Log score/Mark done actions, then a secondary **Customize session** action. Keep a quiet My session entry available; show its count when the athlete has explicitly built one, without an empty builder panel competing with the workout. Selecting My session opens its performance surface, labeled `My session · [date]`; **Edit session** explicitly enters the builder. Remember the last viewed track, date, and scroll position when returning. Fresh entry retains the existing default-track behavior. This clarification supersedes any earlier interpretation that My session is a required starting point for logging.

### My session

`/training` hosts both source-track and personal surfaces. **My session** has its own heading and ordered contents when selected, with performed date and workspace visible. Its button/summary remains visible while a source track is selected. Do not put someone else's track programming under the My session heading or make the personal list appear to change when the track selector changes.

- With no saved composition, the normal screen shows the selected/default track's published session. Customize session opens a draft based on the **currently viewed** track/date, explicitly labeled `Based on [track] · [date]`; Start empty is an alternative. Merely opening or cancelling the builder writes nothing. Provider publication remains a provider reference, not a generated coached session.
- With a saved composition, show its ordered items from every source, plus saved scores and per-item Log score / Edit score actions. A different browsed track must not change the session's heading, membership, order, date, or default preference.
- In performance mode show prescriptions, guidance, Log score/Edit score for scored sections, and Mark done where the section supports completion. Add/remove/reorder/prescription-edit controls live behind Customize session/Edit session. Saving closes the builder and returns to performance mode. Removing the last item leaves an intentionally empty saved session; it must not silently repopulate from the default.
- Rest day, no publication, no default, unavailable default, loading, and failed reads are distinct states. Rest and empty dates still allow adding accessible work.
- Keep the current per-athlete/per-workspace/per-date identity. Default to the owned personal workspace for context-free personal actions when it is eligible; preserve an explicit eligible workspace. Show the destination before any write. Do not merge gym and personal histories into a new global session model.

### Switch subscribed tracks in place

Keep the track switcher inside the Training workspace. Selecting another subscribed track changes the source programming in place, even after a personal session exists. It must not navigate to `/programming`, a track detail page, or a subscription screen. Read the selected source rather than `PersonalTrainingDay.items` when that field contains the saved composition. The My session count/summary stays visible and unchanged until an explicit add/remove/save.

Each scored workout offers **Log score** as its primary action and **Add to My session** as a secondary action. Log directly on track A or B even if a custom session exists, without opening or changing that custom session. Show `In My session` with an Open session action only when that exact item was explicitly included. Keep source track and programmed date visible. Personal following and Make default track remain independent actions; neither is a prerequisite for logging a publicly accessible workout.

Use the existing default preference and Make default track action within the subscribed-track view. Switching tracks never changes that preference. Existing discovery/following flows for new tracks are secondary and outside this refinement; do not introduce a repeated Follow prompt for subscribed tracks or route normal switching through gym management.

### Add to My session

One deliberate confirmation performs the addition. If destination workspace/date is already shown and unambiguous, the button itself is that confirmation. If context is missing or the athlete chooses another date, a compact destination sheet provides the confirmation in place.

After success, keep the athlete on the selected track in the same Training screen. Update the visible My session count/summary and the row state, and announce `Added to My session · [performed date]` with Open session and Undo. Open session selects the personal surface in place and focuses/highlights the inserted item; returning restores the previous track/date/scroll position. The desktop summary may be a side panel; on mobile keep its compact control visible without covering page actions or the keyboard. The same add feedback applies on library/detail pages, whose Open session link can enter Training directly at the personal surface.

Never show success from navigation alone. Failed additions retain their destination and show a retry. Repeated clicks and retries use the same operation/item identity; they must not add duplicates. Undo removes only the item this operation inserted, with revision checks, and becomes unavailable once that item has a score. Intentional repeats require a separately labeled Add another attempt action with a new identity.

For an existing custom session, addition appends only the selected section(s). For Customize session, the initial draft is explicitly based on the currently viewed track's day, not a different default track. For Add to My session when no custom session exists, start with only the explicitly selected section(s); do not silently include an entire track. Any choice to use a whole track day is labeled explicitly. Preserve library workout IDs, full score metadata, exact source occurrence/version, and provider provenance.

### Borrow warm-ups, cooldowns, and other sections

The builder's **Add from another session** picker offers track and source date, then the session's ordered sections. Every accessible section is selectable, including warm-ups, cooldowns, mobility, instructions/checkoffs, strength, and scored workouts. A warm-up or cooldown is not required to have a score scheme or be a standalone library workout.

Example: customize Track A's day, insert Track B's warm-up before its first workout, retain A's strength and conditioning, and insert Track C's cooldown at the end. Preview each section's title, prescription, guidance, and source before adding. Offer insert before/after or move-up/move-down controls; do not infer role or position from a title alone. Preserve source session/block/version/date and the original kind. Reuse existing `TrainingBlock` kinds (`check`, `note`, `load`, `time`, `reps`, `workout`) and source references; warm-up/cooldown are section purposes, not new score schemes.

Unscored instructions display their text without a required numeric score. Existing checkoff sections retain completion behavior. Reordering, removing, or editing a borrowed section affects only the private composition. If a source exposes only undivided prose, keep it readable and allow an explicit user-selected text excerpt through the manual note/checkoff editor with source attribution; do not fabricate structured sections or auto-extract them in this scope. Saving a combined session returns to its ordered performance view.

### Log score

Log score opens the appropriate existing score form at the viewed workout, without a remix, ownership transfer, manual session setup, or intermediate Add confirmation. The form names the performed date, destination workspace, source track/date, scaling, and private-result behavior. Default the performed date to the current My session date, or the destination's local today when no session context was supplied. An explicitly backdated session link remains backdated; the provider's programmed date is separate metadata.

Opening or cancelling writes nothing. For an existing personal item, save to that exact item. For an unchanged current coached occurrence, retain the existing occurrence-linked result behavior without creating a personal composition. For a library/provider workout, **Save score** persists an independent private attempt and its performed snapshot without adding it to the custom session's planned items. Direct scores appear on the viewed track and in results/progress. Only explicit Add/Customize/Edit actions alter the custom session. Internal private-result storage must not cause the UI to label a day customized or open the builder.

After success, close the form, restore focus, and show the saved value in the source row with Edit score and Open session/My results. Scores from unchanged coached occurrences remain visible in My results even when that track is not the day's selected plan. Do not fabricate a composition solely to make this aggregate history work.

Respect existing distinctions between private personal results and opt-in sharing of eligible coached results. A personal attempt on a published competition workout is not an official competition submission. Keep judge, registration, publication, and competition leaderboard rules unchanged.

## Current state and evidence

Unless explicitly identified as PR #691, file/line citations here refer to `0d36543dd`, not the older advisor checkout. Retrieve with `git show 0d36543dd:path/to/file` if necessary. The bare-ID reader evidence in item 5 is historical after PR #691; recheck the composed baseline instead of reporting that finding as still open.

1. `apps/wodsmith-start/src/routes/_protected/workouts/$workoutId/index.tsx:154` has only the personal-add action alongside source editing:

   ```tsx
   <Link to="/training"
     search={{ view: "training", teamId, date, workoutId: workout.id }}>
     <Calendar className="h-4 w-4 mr-2" />
     Add to my session
   </Link>
   ```

2. `apps/wodsmith-start/src/components/training/athlete-personal-session.tsx:351–413` repeats the Add confirmation. Its save path at 187–208 writes the session, rereads the day, and sets local state. The confirmation disappears at 399; there is no explicit added-item result/Undo contract. At 553–578 library entries send the athlete to `/log/new` and display `View saved workout` instead of the score itself.

3. `apps/wodsmith-start/src/server/training-personal.ts:183–214` establishes the key identity distinction:

   ```ts
   // Personal lookup uses userId, teamId, trainingDate; not trackId.
   const items: PersonalTrainingItem[] = personal
     ? (personal.items as PersonalTrainingItem[])
     : (sourceSession?.published?.blocks.map(/* source references */) ?? [])
   ```

   `athlete-training.tsx:394–460` puts Training track above the My session tab; at 598–602 it passes the selected browse `trackId` into `AthletePersonalSession`. The stable saved composition is intentional; presenting the selector as if it controls that composition is the UX defect.

4. `apps/wodsmith-start/src/routes/_protected/log/new/index.tsx:54–78` redirects when no personal session/item IDs exist. Adding a Log score link to that route alone would reproduce the detour.

5. `apps/wodsmith-start/src/server/training-personal.ts:347–368` restricts library scoring access:

   ```ts
   const { userId } = await requireTrainingAccess(data.teamId)
   const teams = await accessibleLibraryTeams(userId)
   // ...workout ID predicate plus:
   or(eq(workouts.scope, "public"), inArray(workouts.teamId, teams))
   ```

   Meanwhile `server-fns/workout-fns.ts:340–364` reads a workout by ID without a visibility predicate; `server-fns/programming-fns.ts:464–479` reads track contents by ID. Consequently “the current detail happened to render it” is not a sufficient authorization policy. Align legitimate viewing and personal logging rather than removing checks from the write path.

6. `components/track-detail-view.tsx:179–184` and `components/crossfit-track-days.tsx:64–69` link to detail without source date/workspace context. Provider addition at `track-detail-view.tsx:95–107` instead supplies the source date as the destination date. Preserve both meanings explicitly.

7. The durable preference, lazy ownership, exact source/version matching, provider publication precedence, private history, and rich-score snapshots already exist. Read `lat.md/training.md`, `lat.md/training-personal.md`, and `plans/001-track-experience.md` on the baseline. Extend these decisions. The old HTML study under `docs/mockups/training-experience` is design evidence, not the live implementation.

8. `src/lib/training/types.ts` defines full `TrainingBlock` objects with title, prescription, scaling/coach guidance, and kinds including `check` and `note`. Source references in `src/lib/training/personal-types.ts` already identify a session/block/publication. Reuse this path for warm-ups and cooldowns rather than limiting the builder to library workout IDs. `packages/wodsmith-db/src/schemas/training-personal.ts` currently makes private results refer to a personal day while session-row presence implies a composition; direct private logging must separate these meanings.

## Architecture and conventions

The main app is React 19/TanStack Start with TanStack Router, TypeScript, Tailwind, Radix/shadcn UI, Zod, Drizzle/PlanetScale, and Cloudflare Workers. Root README contains outdated Next.js/D1 descriptions; current package scripts and architecture docs take precedence for this plan.

Use thin validated server-function wrappers, as in `src/server-fns/training-personal-fns.ts`:

```ts
export const savePersonalTrainingSessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => personalTrainingSaveSchema.parse(data))
  .handler(({ data }) => savePersonalTrainingSession(data))
```

Keep business logic and transactions in `src/server/`, typed view models in `src/lib/training/`, and route navigation in route/components. Use `Button`, `Dialog`/`Sheet`, labels, status announcements, and existing styles. Match the training components' 44px targets, visible focus, cancellation of stale requests, and retained form input after save errors.

Reuse `TrainingWorkoutScoreFields`, `training-result-dialog.tsx`, and the library result form's round/cap support as appropriate. Inspect each payload before adapting: canonical training scores and library score inputs are not interchangeable. Reuse server parsing and result snapshot rules, including capped reps, units, rounds, tiebreaks, and scaling. Do not flatten unsupported scores into time/load/reps.

## Scope

Paths below are relative to `apps/wodsmith-start/` unless prefixed otherwise. New files listed are proposed names, not claims that they already exist.

In scope:

- `src/routes/_protected/training/index.tsx`; `src/routes/_protected/workouts/index.tsx`; `src/routes/_protected/workouts/$workoutId/index.tsx`; `src/routes/_protected/log/new/index.tsx`; `src/routes/_protected/log/$id/edit/index.tsx`; `src/routes/_protected/programming/$trackId/index.tsx`.
- `src/components/training/athlete-training.tsx`, `athlete-personal-session.tsx`, `athlete-session-block.tsx`, `training-result-dialog.tsx`, `training-workout-score-fields.tsx`, `earlier-training-history.tsx`.
- New `src/components/training/my-session-summary.tsx`, `session-workout-actions.tsx`, `direct-workout-score-dialog.tsx`.
- `src/components/track-detail-view.tsx`, `crossfit-track-days.tsx`, `track-follow-actions.tsx`, `nav/main-nav.tsx`, `nav/mobile-nav.tsx`.
- `src/lib/training/personal-types.ts`; new `src/lib/training/session-navigation.ts`.
- `src/server/training-personal.ts`, `training-personal-validation.ts`, `training-personal-scoring.ts`, `training.ts`, and `training-logs/personal.ts`; new `training-session-actions.ts`. Reuse PR #691's `training-access.ts`; coordinate any necessary changes to that shared policy with its ownership thread rather than creating a competing visibility module.
- `src/server-fns/training-personal-fns.ts`, `workout-fns.ts`, `programming-fns.ts`. Restrict the last two to the relevant reader policy and data projection; no unrelated mutation cleanup.
- Tests named below; `e2e/workout.spec.ts`, new `e2e/my-session.spec.ts`, and existing test-only fixtures/seeding under `e2e/fixtures/` and `scripts/seed-e2e.ts` as needed.
- `lat.md/training.md`, `lat.md/training-personal.md`, and the plan index at repository root.
- Minimal additive composition-state field in `packages/wodsmith-db/src/schemas/training-personal.ts` and its generated migration/snapshot, only as described in step 4. Preserve shared schema ownership and verify both consumers.

Out of scope: `apps/crew` source changes, other apps, imports/AI parsing, coach authoring redesign, global styles, billing/entitlements policy, default gym subscriptions, official competition submissions/rankings, production data cleanup, offline sync, recurring jobs, and historical data rewriting. The only planned shared-schema extension distinguishes result-only day storage from an explicit custom composition; any additional schema requirement needs a plan revision. Generate the migration with the canonical package workflow; do not apply remote schema changes during implementation.

## Commands and verification baseline

Run on the implementation checkout with Node 24 and pnpm 9.12.1. These commands are grounded in the baseline package scripts; the advisor did not execute the baseline's application tests in its older worktree.

| Purpose | Command | Expected result |
| --- | --- | --- |
| Dependencies, only if needed by executor | `pnpm install --frozen-lockfile` | Exit 0; unchanged manifest/lockfile |
| App typecheck | `pnpm --filter wodsmith-start type-check` | Exit 0 |
| Focused training UI | `pnpm --filter wodsmith-start exec vitest run test/components/training test/components/track-experience.test.tsx test/components/crossfit-track-days.test.tsx` | All tests pass |
| Access and session regression | `pnpm --filter wodsmith-start exec vitest run src/server/training-personal.test.ts src/server/training.test.ts src/server/training-provider.test.ts src/server/training-workout.test.ts test/server-fns/workout-fns.test.ts` | All applicable tests pass; DB groups must not be silently skipped at final verification |
| Ownership boundary regression | `pnpm --filter wodsmith-start test:db-integration training-access` | PR #691 integration tests pass with the disposable local MySQL integration environment configured |
| New server-action suites | `pnpm --filter wodsmith-start exec vitest run src/server/training-workout-access.test.ts src/server/training-session-actions.test.ts` | All cases pass with the local integration DB configured |
| Lint | `pnpm --filter wodsmith-start lint` | Exit 0, or an explicitly recorded unchanged baseline failure |
| Full app tests | `pnpm --filter wodsmith-start test` | Exit 0, including workout-import runtime suite |
| Browser regression | `pnpm --filter wodsmith-start exec playwright test e2e/workout.spec.ts e2e/my-session.spec.ts` | Desktop and new mobile scenarios pass against isolated local fixtures |
| Build | `pnpm --filter wodsmith-start build` | Exit 0 using the normal local Worker configuration |
| Schema ownership | `pnpm check:schema-ownership` | Exit 0 |
| Documentation | `lat check` | All links and code refs pass |

Set `TRAINING_TEST_DATABASE_URL` through the test environment to a disposable database named `training_test` on localhost/127.0.0.1. Never print its value. `training-personal.test.ts:202–214` skips its database group without that variable and rejects nonlocal databases. A green run with those cases skipped is insufficient. The separate `test:db-integration` script uses `WODSMITH_TEST_MYSQL_*` for `test/integration`; it is not a substitute for the training suite's variable.

## Ordered implementation steps

### 1. Establish baseline and encode the access contract

Record baseline typecheck, focused test, and lint outcomes before editing. Inspect callers of the shared workout/track readers. Add characterization tests for the successful public foreign-workout path, the missing direct-log action, personal-composition persistence across track switches, and the existing default preference.

Integrate PR #691's existing server-side readable-workout policy. Public workouts remain readable; private workouts require current active unexpired membership in the workout's owning team. Public-track membership, following, or a supplied track ID never authorizes private children. Validate actual track/workout association when carrying provenance, but do not treat that association as a visibility grant. Reuse `workoutVisibilityCondition` in library lookup/import and related reads as needed; preserve `requireTrackRead` and the server-resolved edit capability. Do not recreate the already-fixed bare-ID reader issue or add an alternative policy module.

Return separate `canRead`, `canLogPersonalScore`, and `canEditSource` capabilities. A signed-in, tracking-enabled athlete who can legitimately read the prescription can log a private result without owning/following/remixing its track. Preserve server-side result ownership, entitled destination access, publication checks, and narrow anonymous reads. Apply the shared policy to detail and track-reader output as well as library lookup/import. Do not make source edit permission a logging requirement.

**Verify:** focused access/server suites, PR #691 boundary integration tests, and app typecheck above exit 0. Assert public non-owner success including public workouts on foreign tracks; private-child rejection even inside a public/followed track; private-workout success only with current owner-team membership; draft rejection; forged track/workout pairing rejection; revoked/expired access rejection; and unchanged source ownership. Add the positive cases alongside `training-personal.test.ts:412`'s existing private rejection.

### 2. Separate personal and track surfaces within the existing Training screen

In `athlete-training.tsx`, retain the existing subscribed-track selector as the primary context control. Render its session in performance mode with direct Log score/Mark done actions. Keep Customize session and a quiet My session entry secondary. Selecting My session opens its performance surface; only Customize/Edit opens the builder. Render distinct source/personal headings and remember the last source track. Neither surface selection changes the pathname or writes a preference/composition.

Add a validated `surface=session|track` search field to the Training route, alongside the existing `view` for training/team/progress. Preserve `trackId` as the selected source even when `surface=session`. Explicit Open session links target the personal performance surface. Track Log score actions retain `surface=track` and their exact occurrence; they never force the personal surface. Legacy `workoutId/workoutIds` add-preview links retain explicit confirmation compatibility. Keep old `view=training` links compatible and preserve default-track behavior for fresh entry. Restore date/workspace/surface/track and track scroll/focus on return. Do not create a Browse tracks destination or rename global Training/results navigation.

In `training-personal.ts` and its typed contracts, make the distinction explicit between the personal day/default projection and a browsed source. Use existing provider source reads and `getTrainingWeekFn` for browsing; do not use a saved composition to populate a track reader. Unchanged default projection remains lazy. Once composed, source selection cannot replace items. Keep unavailable defaults explicit without silently saving a fallback.

Add a shared read-only My session summary to Training's subscribed-track surface, library, and workout detail. It selects the personal surface in place when already in Training and otherwise links to that explicit surface. Existing track-detail pages may reuse the action, but must not become the route used for subscribed-track switching. Derive counts from the session projection; do not guess from the visible track. Show request failures without discarding already loaded session data.

**Verify:** training UI and track tests plus app typecheck exit 0. Tests switch A → B after composing from A and assert B's source is visible, the pathname remains `/training`, no track/discovery/following navigation occurs, My session still contains A, and no session/default writes occurred. Test B → My session → B restores the source/date/scroll, including after adding a B workout. Test browser history, midnight/timezone boundaries, no default, provider rest/unpublished states, and deliberately empty compositions.

### 3. Add an idempotent append operation and immediate feedback

Introduce `training-session-actions.ts` with an append operation rather than sending a stale complete item array from every reader. Validate destination and source on the server, lock the existing personal day, enforce expected revision, and append selected sections to the persisted custom session. If no explicit custom session exists, Add begins with those selections only. Customize uses the explicitly chosen source day as the draft baseline. Reuse first-save unique day handling and source locks from `savePersonalTrainingSession`.

Extend `ProgrammingPicker` in `athlete-personal-session.tsx` as Add from another session: include every block kind, preview section text/guidance, preserve source references, and support insertion/reordering. Allow source dates different from the target date. Do not filter out unscored `note`/`check` sections or force them through library score conversion. Opening the builder makes only local draft changes; Save persists explicit composition, and Cancel discards the draft. Return to performance mode on Save.

Use one stable operation/item ID per user intent, retained across retry. Recognize an existing identical source occurrence/library selection and return its item, unless the user chose an explicit new attempt. A repeated operation must return the existing item even if the prior response was lost. Return the inserted/existing item identity and updated revision/summary. Partial post-write refresh failure must not be reported as a failed write that invites a duplicate.

Use `session-workout-actions.tsx` from all entry points. Confirm a missing destination in place, then call append exactly once. Update `In My session`, announce success, and supply Open session/Undo. Undo is revision-safe and refuses to remove a scored item. Keep older `workoutId/workoutIds` deep links as read-only previews with a single confirmation; visits, reloads, prefetches, and cancellation must never write.

**Verify:** new server-action suite, training UI suite, typecheck pass. Cover lost response/retry, double click, concurrent first save, stale revision, duplicate existing item, explicit second attempt, late response after workspace/date navigation, failed refresh after successful append, and Undo before/after a score. Add tests combining B's warm-up, A's scored work, and C's cooldown in exact order, with original block kinds/guidance/provenance intact. Test note/check sections, cross-date sections, builder cancel with zero writes, and Save returning to performance mode. Assert source tables and default preference unchanged.

### 4. Support direct score entry with atomic persistence

Add the direct dialog/form and server function using the common capability policy. Carry either exact coached occurrence identity, exact personal item identity, or an accessible library workout plus optional verified track/provider context. Require a stable attempt ID, destination date/workspace, and current revision where a composition exists. Never trust client prescription snapshots, user IDs, or source ownership fields.

For new library/provider attempts, reuse rich score persistence and snapshot associations without appending to `personalTrainingSessions.items`. Introduce an explicit day `compositionState` (`result_only` or `customized`) if the final integrated baseline still infers customization from row presence. Existing rows default to `customized` to preserve intentionally empty and historical compositions; a new day created only to own private results is `result_only` with no planned items. Explicit Add/Save customization transitions it to `customized`; direct logging never makes that transition. A cleared custom composition remains customized. Day readers expose default/source programming for result-only rows rather than treating them as empty custom sessions.

Use a private attempt association with a server-resolved `libraryItem` snapshot, stable attempt/item identity, and the day owner/date. Existing stored-result snapshot readers already support results whose items were removed; adapt that path for independent attempts without reinserting items during edit. Persist the score, rounds, and private association atomically and recognize retries; do not call independently committing append/save APIs. Extract transaction-taking helpers only as necessary. On failure roll back the entire attempt. Source publication provenance remains exact, and same-day coached direct results continue using existing source occurrence storage.

Reuse the existing normalized scoring pipeline. Expose primary Log score actions on library rows/cards, detail, every viewed track's scored work, and custom session items. Retain entry context on cancel/save; show the actual saved value and Edit score on that occurrence and in results/progress. Refresh My session only when its exact included occurrence shares that result; do not add external logged work to its plan. Add a supported direct-entry mode to `/log/new` if using that route; do not just remove its redirect while retaining a loader that requires personal item IDs. Retain old personal-session URLs.

**Verify:** new action suite, existing training-personal/workout suites, rich-result UI tests, and typecheck pass. Include capped zero reps, multiple rounds with mixed cap states, load units, tiebreak, pass/fail, retained input after failure, cancel with zero writes, duplicate submit, and private round/history access. Assert one score and one association, no remix, no official competition result, no auto-follow/default change, no custom planned-item/revision changes when logging another track, and no builder activation. Test result-only → customized transition, existing/cleared empty composition preservation, and direct-attempt edit without reinsertion. If adding the field, generate/check the additive migration and run `pnpm --filter @repo/wodsmith-db type-check` and `pnpm --filter crew type-check` against unchanged consumers.

### 5. Finish source context, default behavior, and visible results

Thread workspace, performed date, source track/date, and exact occurrence through `TrackDetailView`, `CrossFitTrackDays`, detail links, and the shared action component. Keep programmed/performed dates distinct in UI and storage. A source selection should never silently change the target day.

Make the existing default action easy to find and show its success/failure. Browse without persisting; a new day opens the saved default, while an already customized day stays customized. Use existing eligible-track/following checks. If no eligible destination exists, show an inline account/training access explanation and recovery link; do not hide score controls behind Remix or silently redirect away.

Extend existing history reads to show the athlete's results across browsed tracks within the selected workspace, with provenance and bounded pagination. Preserve exact occurrence matching. Show the actual saved score on personal library items instead of only `View saved workout`. Do not infer completion by workout ID alone when it appears twice or on different dates.

**Verify:** focused UI/history tests, access tests, and typecheck pass. Verify default A → browse B → log B → return/reload → default still A; next day projects A; saved day retains its composition. Verify same workout on two dates/tracks does not mark both complete, private notes remain private, and pagination errors retain earlier results.

### 6. Verify the full user journey and update documentation

Extend Playwright using `e2e/workout.spec.ts`'s `loginAsTestUser` and hydration pattern, with disposable test fixtures for a source owner, a non-owner athlete, two accessible tracks, a private inaccessible workout, and an existing composed day. Add desktop and 390px mobile scenarios; include a keyboard-only dialog/save/cancel flow, visible focus restoration, scroll preservation, and sticky-summary overlap checks.

Follow the Vitest convention in `test/components/training/athlete-training.test.tsx`: Testing Library user-visible queries, mocked server-function boundaries for UI, and real local DB suites for permission/concurrency claims. Do not replace DB authorization with mocks in the end-to-end acceptance evidence.

Update `lat.md/training.md` and `lat.md/training-personal.md` for the navigation, explicit default/source/session distinction, atomic direct scoring, capability policy, and new tests. Each heading needs a leading paragraph of at most 250 characters; each test spec needs exactly one adjacent `@lat` comment. Run `lat check` and the final commands in the table. Mark plan DONE only after all required tests, including non-skipped DB cases and browser journey, pass.

**Verify:** browser regression, full app tests, typecheck, lint, build, schema ownership, and `lat check` all pass. Record unrelated baseline failures explicitly and keep the plan blocked if required acceptance cannot be demonstrated. Review `git diff --name-only` against Scope and run GitNexus change detection before an authorized commit.

## Acceptance scenarios

These are required assertions in the named new UI/server/browser tests, not just manual review notes.

| Scenario | Observable result |
| --- | --- |
| Open a visible foreign public-track workout | Log score visible; editing source remains unavailable to the non-owner |
| Submit directly on another track without prior custom session | Result visible on that track and in progress; no planned items or custom-session mode created; no remix/follow/default write |
| Log track B while an unrelated custom session exists | B's score saved and visible; existing custom plan/order/revision unchanged; athlete remains on B |
| Cancel score form | No new composition, preference, item, or score |
| Add while browsing track B after composing track A | B remains visible; session gains exactly the selected item; source A items retained |
| Flip subscribed tracks A → B → My session → B | All surfaces stay in Training; source B programming and personal contents remain distinct; selected day and B scroll position restored; no discovery/subscription navigation |
| Combine warm-up B, workouts A, cooldown C | Selected sections retain exact order, full text/guidance/source references, and original scoring/checkoff/instruction behavior |
| Open and save a custom session | Opens in performance mode; builder controls appear only after Edit; saving the builder returns to performance mode |
| Retry after a lost add/save response | Same item/score, no duplicates |
| Followed default A, browse B, then open tomorrow | Tomorrow projects A without daily inserts/jobs |
| Log historical provider workout today | Original provider date preserved; score recorded on today in selected workspace |
| Attempt a private inaccessible or unpublished workout | Server rejects read/add/log; client-supplied track ID grants nothing |
| Repeated workout on another day or explicit attempt | Independent occurrence/result and unambiguous edit target |
| Save multi-round capped workout | All round values, cap reps, scaling and units preserved in saved view and edit |
| Mobile/keyboard flow | Session destination visible; dialog traps/restores focus; no hidden actions or horizontal overflow |

## Done criteria

- [ ] Every acceptance scenario has a passing named test.
- [ ] Direct score entry requires neither source ownership nor a remix nor a prior Add action.
- [ ] Performing/logging the chosen track is primary; My session building is optional, and source-track logging never modifies an unrelated custom plan.
- [ ] Warm-ups, cooldowns, and other unscored sections can be borrowed, ordered, performed, and retained without inventing numeric scores.
- [ ] Browsing preserves the saved composition and explicit default; read/cancel paths make zero writes.
- [ ] Subscribed-track switching and opening My session happen in place within Training; no detour to track pages or repeated following step.
- [ ] Session summary and inserted/saved item feedback agree with server-confirmed state.
- [ ] Permission, privacy, concurrency, retry, and rich-score tests run against a disposable local DB without skipping.
- [ ] All final commands pass or unresolved required gates are reported as BLOCKED, never DONE.
- [ ] `lat check` passes and changed behavior/test specs are documented.
- [ ] Diff contains only scoped files and the plan index status is updated.

## STOP conditions

Stop and report the concrete mismatch if the implementation checkout predates the baseline; relevant excerpts have materially drifted; authorized track content visibility is ambiguous; rich scoring requires lossy conversion; atomic session/item/result persistence cannot use one transaction; durable retry protection needs an unplanned schema change; or a required verification fails twice after a reasonable fix. Do not widen private source access, disable entitlements, create background daily sessions, or modify official competition result policy as a shortcut.

## Maintenance notes

Reviewers should scrutinize shared reader callers, source-versus-performed identity, the two-step commit/refresh error distinction, explicit attempt identity, and private history after removal. Future provider imports and republishing must preserve performed snapshots. Session previews and summaries must stay read-only. Existing user-owned training study and import plans are separate artifacts and must remain untouched.
