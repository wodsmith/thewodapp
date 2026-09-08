# Track Experience Plans

This focused Improve and Impeccable pass specifies the track reader, personal following, gym-library subscription, site administration, and daily Training flow. Plan 001 is implemented and verified on a local branch; it has not been deployed.

## Execution order and status

Plan 001 is complete. Plan 002 implements direct track logging, optional session composition, and UI consistency in an isolated worktree based on the verified access-control dependency.

| Plan | Title | Priority | Effort | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| [001](001-track-experience.md) | Make tracks understandable from discovery through daily Training | P1 | L | None | DONE — implemented and independently verified; awaiting release |
| [002](002-my-session-and-direct-scoring.md) | Direct track logging and an optional My session | P1 | L | Plan 001 DONE; PR #691 final verified head incorporated | DONE — independently verified; [PR #699](https://github.com/wodsmith/thewodapp/pull/699) open |
| [003](003-session-review-fixes.md) | Resolve session UX review regressions | P1 | M | Plan 002 implemented; migration integration held | DONE — independently verified; runtime review fixes ready for PR #699 |
| [004](004-session-navigation-and-intents.md) | Preserve session navigation and addition intent | P2 | S | Plan 003 DONE | DONE — independently verified; second-review follow-up |
| [005](005-session-draft-scoring-review.md) | Guard scoring in unsaved session drafts | P2 | S | Plan 004 DONE | DONE — independently verified; draft scoring guard and preview retry follow-up |
| [006](006-session-action-consistency.md) | Complete session action consistency | P2 | S | Plan 005 DONE | DONE — independently verified; delayed review dispositions recorded |
| [007](007-crew-ci-preparation.md) | Verify CI database preparation without a second push | P2 | S | Plan 006 DONE | DONE — independently verified; published CI tracked separately |

PR #699 is not merge-ready. Plans 003–006 address the verified review findings and passed independent checks. Published CI and review output are evaluated separately. The migration waits for PR #691 and the #698/#695 migration dependencies to merge through their own authorized reviews. The migration prototype is disposable and will not be published.

## Decision record

The user requested clearly labeled admin sections and a coherent viewing, subscription, and daily-view experience. Personal Follow plus a separate gym-library action was selected; the user explicitly approved the plan and implementation on September 6, 2026.

## Findings considered and rejected

Automatic creation of gym training sessions from provider imports is not proposed: it would blur provider publication and coach ownership. Rich CrossFit workouts must not be flattened into the simpler coached-block format. Removing old records or apparent duplicates is a separate data-cleanup decision.

The existing server-side admin and gym permission checks are intentional. The confusing interface is not evidence that those checks are absent. Global-admin status must not grant silent gym-coach access.

## Coverage and limits

Implementation covers the named track routes, importer administration, following and gym-library access, daily provider reads, composition/scoring snapshots, direct tests, and architecture documentation. Screenshots supplied by the user established the mobile problem; actual component fixtures supported desktop/mobile review. Work is isolated in `/tmp/wodsmith-track-experience` on `codex/track-experience`. No production writes, billing policy changes, or data cleanup occurred.
