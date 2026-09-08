# Plan 002: Direct track logging and an optional My session

This execution plan makes training and logging primary, separates source tracks from personal composition, and finishes the affected UI for consistent controls.

## Status and baseline

DONE. Implemented, independently verified, and opened as [PR #699](https://github.com/wodsmith/thewodapp/pull/699) on September 7, 2026, including the UI refinement pass. See 002-session-ux-verification.md for evidence. Not merged or deployed.

Use /private/tmp/wodsmith-session-ux on zac/training-session-ux, based on aecbb2790e598bcf26b066e1fbc82209f86cd6b8 from PR #691. Owner confirmed this final implementation head and passing CI; PR remains open. Plan 001 is DONE. Parent verified main 0d36543dd is an ancestor and inspected dependency changes. PR #691 changes access readers but does not implement personal scoring. Stack our PR on its branch while unmerged and document the dependency.

The original advisor checkout is older and contains unrelated user changes. Never edit or rebase it. Detailed audit evidence and acceptance explanations are preserved in 002-session-ux-design-notes.md; this reconciled execution plan controls sequencing.

## Required behavior

The Training page keeps its subscribed-track selector. Flipping tracks displays each source day in place, with no track/discovery/subscription-page detour. Primary actions are Log score and completion. Keep the explicit default preference; browsing does not change it. Fresh daily entry loads the default.

My session is optional advanced composition with a distinct heading, contents, and count. Keep a quiet visible entry while browsing tracks. Its normal view is performance mode, with prescriptions, completion, and Log/Edit score. Customize session or Edit session explicitly opens the builder. Save returns to performance mode; opening/cancelling writes nothing. Preserve workspace, target date, browsed track, and return focus/scroll.

Customize starts from the currently viewed track/day, with Start empty available. Add to My session with no custom plan adds only explicitly selected sections. Existing custom plans retain other items and order. Removing the final item leaves an intentionally empty composition. Track switching never populates source views with stored personal items.

The builder can borrow ALL accessible session block kinds across tracks and dates: warm-ups, cooldowns, mobility, instructions, checkoffs, strength, and scored work. Preserve prescription, guidance, exact source block/publication/date, and kind. Support explicit ordering and private editing. Unscored blocks require no fabricated numeric score. Undivided prose can remain readable and support a user-chosen attributed note/checkoff excerpt; do not invent extracted sections.

Every legitimately viewable workout offers direct personal logging without ownership, remix, follow, or prior Add/customization. Distinguish canRead, canLogPersonalScore, and canEditSource. Use PR #691 workoutVisibilityCondition/canReadWorkout and track guards. Public/followed tracks do not grant private child access. Fresh active unexpired owner-team membership authorizes private reads; source write and competition rules remain unchanged.

Log on track B even if a custom plan from A exists. Save the private attempt and show the actual value/Edit score on the exact occurrence and in results/progress; never change unrelated custom planned items/order/revision. Opening/cancelling forms writes nothing. Preserve full rich scoring: rounds, caps including zero reps, units, scaling, tiebreaks, pass/fail. Performed date/workspace and source date/track are separate visible context. Retain old personal-item score URLs; direct /log/new must have a genuine direct mode, not a redirect to Add.

Add is one action when destination is visible. Otherwise confirm date/workspace in a compact local sheet. Keep the source displayed, update My session count/In My session, announce success with Open session and Undo. Opening selects the personal performance surface and inserted item. Repeated clicks/lost responses retry with stable identity; explicit Add another attempt creates a new one. Undo removes only the inserted unscored item with revision protection. A failed refresh after a committed write must not invite duplicate writes. Legacy add deep links stay read-only until one confirmation.

## Scope and architecture

Scope: apps/wodsmith-start training components, related track/workout library/detail and log routes/components, training personal/types/scoring server logic and wrappers, source provenance/history readers, their tests/preview fixtures/E2E, relevant lat.md docs, and plans. Add focused local helpers as needed. Preserve shared UI brand; normalize affected controls locally before considering shared primitives.

Canonical schema is packages/wodsmith-db/src/schemas/training-personal.ts; app schemas are shims. A single additive compositionState=result_only|customized field and generated migration is permitted if row presence still implies customization. Existing rows default customized, preserving historical/empty plans. New direct-result day rows are result_only with no planned items; only explicit composition transitions them. No scheduler or new global session identity.

Use thin validated TanStack server functions; server transactions own business logic. Reuse normalized scoring and existing libraryItem snapshot associations, including editing saved attempts whose planned item is absent. Persist score, rounds, and private association atomically. Never trust client prescriptions, ownership, user IDs, or forged track associations.

Before every existing symbol edit run GitNexus upstream impact against this checkout's accurate index; report direct callers/processes/risk and warn HIGH/CRITICAL. Establish a unique alias or use absolute repo path. Run change detection before commit. Run lat expand and lat search before work; if semantic networking is unavailable use lat locate and read intent. Update behavior/test documentation and pass lat check.

## Ordered implementation and verification

1. Establish baseline: install dependencies with Node 24; read training intent/docs and source; characterize current failing UX. Record typecheck, focused tests, lint. Inspect PR #691 helpers and preserve its tested boundaries. Implement capability agreement without competing access policy. Verify foreign public success, private-child rejection, member success, expired/revoked rejection, draft/forged provenance rejection, and unchanged source ownership.

2. Separate track and personal surfaces in /training. Add validated surface=track|session alongside existing view/team/date/track context; preserve legacy links/default behavior. Source readers must ignore custom item lists. Add accurate read-only personal summary and performance mode with secondary builder. Verify A to B to My session to B stays in Training, contents/default unchanged, date and return context preserved. Cover rest/unpublished/unavailable/default and intentionally empty states.

3. Implement explicit draft builder and atomic idempotent append/undo. Reuse all block kinds in Add from another session, across dates, with preview and reorder. Use stable operation/item identity, revision checks, duplicate recognition, explicit new attempt and accurate post-write feedback. Verify cancel zero writes; warm-up B/workouts A/cooldown C preserve order/kind/source; lost response/double click/concurrent first save/stale revision; late response after navigation; refresh failure; Undo before/after score.

4. Implement direct atomic scoring using existing rich pipeline and private snapshots. Preserve exact coached occurrence behavior and exact custom-item edits; independent library/provider attempts must not append planned items. If necessary add compositionState as above. Verify one score/association under retry, rollback, complete rich-score values and edit, no remix/follow/default/source/official competition write, custom plan unchanged, result-only-to-customized transition, and edit without reinsertion.

5. Finish defaults, provenance, feedback and history. Thread source/performed context through detail, track and library actions. Show actual saved values and exact-occurrence edit targets with bounded results reads; no completion by workoutId alone. Validate default A/browse and log B/reload and tomorrow still A; historical source today; repeats and different dates remain independent. Failed reads retain loaded data. No eligible destination should explain recovery inline, not hide logging behind Remix.

6. Run UI refinement after behavior works. Read Impeccable SKILL.md, craft-floor.md and polish.md. Preserve the current visual system. Normalize affected buttons, selects and icon controls to consistent 44px sizing where appropriate, icon scale, spacing, typography, wrapping, focus, hover/loading/disabled/error states. Keep primary/secondary hierarchy obvious. Inspect desktop and 390px mobile together, fix the whole batch, then one confirmation round. Check keyboard form save/cancel and focus restoration, no overlap/overflow. Run Impeccable detect.mjs once on changed UI targets. Do not redesign unrelated pages.

7. Complete regression gates and docs. Add meaningful UI and real local DB tests, plus browser coverage of the user's complete journey. Reuse existing test/preview training fixtures when useful but do not claim mocked fixtures prove DB authorization. Update lat.md/training.md, training-personal.md and focused test specs with leading paragraphs and one adjacent test-code @lat reference per spec. Record exact verification evidence and limitations.

## Commands and acceptance gates

Use pnpm --filter wodsmith-start type-check; focused Vitest training-personal/training/training-provider/training-workout and training UI/track suites plus new action tests; PR #691 boundary integration tests; pnpm --filter wodsmith-start lint; pnpm --filter wodsmith-start test; pnpm --filter wodsmith-start build; pnpm check:schema-ownership; lat check. If schema changes, run pnpm --filter @repo/wodsmith-db type-check and pnpm --filter crew type-check.

Training DB tests require TRAINING_TEST_DATABASE_URL pointing only to disposable localhost/127.0.0.1 training_test; never print secrets. Run non-skipped cases. Existing test:db-integration uses WODSMITH_TEST_MYSQL_* and is a separate harness. Local MySQL binary is /opt/homebrew/opt/mysql/bin/mysqld. Node 24 is /Users/zacjones/.nvm/versions/node/v24.15.0/bin. Owner verification receipt /private/tmp/training-access-verification.md may help setup.

Use actual browser tests with local fixtures for public non-owner direct score, no custom plan side effect, custom A/log B, in-place A/B/session switching, combine warmup/work/cooldown and save performance mode, retry and Undo, default persistence, source/performed dates, rich score edit, and mobile/keyboard usability. Extend e2e/my-session.spec.ts and run the relevant workout regressions, or document an equivalent real-component and server integrated harness.

All acceptance behavior above must be tested. Report unchanged baseline failures precisely; do not claim skipped DB/browser gates passed. Read full diff, test assertions and scoped files before commit. Parent independently reviews and maintains plans/README.md, then publishes the PR the user requested. Executor commits only the isolated feature branch after successful checks and change detection; no merging/deployment/production mutations.

## Stop and reconciliation

Report a concrete blocker if baseline is wrong, visibility becomes ambiguous, rich scoring requires lossy conversion, atomic persistence cannot be achieved, an unplanned schema expansion is required, or a required check fails twice after reasonable fixes. Do not silently weaken scope or safeguards. Parent may reconcile a justified minimal approach or environment workaround while preserving the product contract; clearly record deviations. Mark DONE only with verified behavior and an opened reviewable PR.
