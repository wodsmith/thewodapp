# Session draft scoring review

Prevent score navigation from unsaved session compositions, align preview personal-item retry comparison with validated production inputs, and clarify the portability of local verification diagnostics.

## Baseline and authorization

Written against 621a8e091197df00430e672eb6bf8cdde7c9641a for PR #699 in /private/tmp/wodsmith-session-ux on zac/training-session-ux. The user authorized implementation, UI refinement and PR publication; this is a bounded review follow-up.

Status: DONE. The parent independently approved the complete source, tests, documentation, three review dispositions and affected verification gates. See [the verification receipt](005-session-draft-scoring-verification.md).

Only the executor edits source. Do not commit until parent review approval; do not push, merge, deploy, change the base, apply migrations or edit dependency branches. Option C migration integration remains held. No server implementation, access policy, schema or migration changes are in scope.

## Findings and intended behavior

The latest Cubic review reports three comments. Each requires an evidence-based disposition and independently reproducible regression coverage where behavior changes.

1. Comment 3953745496 is valid. AthletePersonalSession renders draft items when editing, and its library Log score link remains active with an empty personalSessionId before Save. Other block kinds already show a save-first readOnlyMessage. Apply that existing policy to library scoring while editing, including editing an existing session and newly added draft items. Do not implicitly persist drafts or enable logging through a different path. After explicit Save, the ordinary personal-item new/edit score links and return context must remain available. Cancel must write nothing.
2. Comment 3953745499 identifies key-order-sensitive preview comparison. Production inputs pass personalTrainingItemSchema before the writer; the preview bypasses that normalization. Canonicalize personal payloads with the existing schema for the preview comparison rather than inventing ID-only equality or suppressing payload conflicts. Same ID plus equivalent reordered fields must retry cleanly; same ID plus changed prescription must conflict; distinct personal IDs must remain separate intentional entries. Keep library/source occurrence and explicit-repeat behavior intact. Do not change the production writer in this plan; report if actual validated production behavior contradicts this contract.
3. Comment 3953745502 is a valid documentation clarification. Label /private/tmp logs in the Plan 004 receipt as disposable machine-local diagnostics that are not committed or portable evidence. Keep honest observed counts and substantive before-failure descriptions. Identify committed test files and runnable commands as the reproducible verification contract; do not commit raw machine logs.

## Exact scope and current code

Production change is limited to apps/wodsmith-start/src/components/training/athlete-personal-session.tsx. Its library branch at the Log score anchor near line 853 lacks an editing guard; the non-library branch below already uses `editing ? "Save your session to record this section." : ...`.

Preview scope is apps/wodsmith-start/test/preview/training/append-fixture.ts, which currently falls back to `JSON.stringify(old) === JSON.stringify(item)`. Existing personalTrainingItemSchema is in src/server/training-personal-validation.ts. Inspect the normalization and existing sameInput/sameOccurrence contract in training-personal.ts without changing them.

Tests belong in existing athlete-training.test.tsx, session-preview-state.test.ts, and my-session.spec.ts. Use current fixtures and established testing patterns; keep test mock arguments typed. Documentation scope is plans/005-session-draft-scoring-review.md, a Plan 005 receipt, plans/004-session-navigation-verification.md, plans/README.md, and relevant lat.md behavior/test sections. Preserve all prior dispositions and holds.

## Execution and validation

First read the relevant lat sections, run required GitNexus upstream impacts before every modified symbol, and report HIGH/CRITICAL risks before edits. The repo index is wodsmith-session-ux; use CLI if MCP is unavailable and refresh stale indexes. Semantic lat search was run successfully by the parent after a network retry.

Write substantive failing tests before the changes: provider Customize without Save exposes no scoring navigation and makes no writes; an existing session in Edit behaves consistently; explicit Save restores score navigation with persisted item identity. Preview tests must exercise reordered personal fields, changed same-ID payload, distinct IDs, and existing library/source/repeat semantics. Add a native browser case covering provider Customize, save-first state, Cancel with no persisted composition, then explicit Save and score availability. Avoid fragile incidental selectors.

Use Node 24.15.0 at /Users/zacjones/.nvm/versions/node/v24.15.0/bin. Focused gates: `pnpm --filter wodsmith-start exec vitest run test/components/training/athlete-training.test.tsx test/components/training/session-preview-state.test.ts --minWorkers=1 --maxWorkers=2`; full session browser gate: `pnpm --filter wodsmith-start exec playwright test --config test/preview/training/playwright.session.config.ts`; app typecheck and lint via existing package scripts; `lat check`; `git diff --check`.

The parent will independently rerun focused tests, complete session browser coverage, typecheck/lint and any wider checks justified by the change. No database implementation changes are planned, so do not repeat the broad DB or migration experiments unless a new concern requires them. Run GitNexus detect_changes before any approved commit. Confirm packages/wodsmith-db and server implementation diffs against the baseline are empty.

## Completion and maintenance

Return the full diff, before/after results, impact scope, the three dispositions and remaining limitations for parent review. Keep this plan IN PROGRESS until approval. Future builder scoring changes must retain explicit Save as the persistence boundary and must not confuse navigation return context with source provenance.
