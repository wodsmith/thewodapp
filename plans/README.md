# Track Experience Plans

This focused Improve and Impeccable pass specifies the track reader, personal following, gym-library subscription, site administration, and daily Training flow. Plan 001 is implemented and verified on a local branch; it has not been deployed.

## Execution order and status

Implement the single plan in its ordered slices, starting with reader/admin separation and finishing with daily integration and provenance.

| Plan | Title | Priority | Effort | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| [001](001-track-experience.md) | Make tracks understandable from discovery through daily Training | P1 | L | None | DONE — implemented and independently verified; awaiting release |

## Decision record

The user requested clearly labeled admin sections and a coherent viewing, subscription, and daily-view experience. Personal Follow plus a separate gym-library action was selected; the user explicitly approved the plan and implementation on September 6, 2026.

## Findings considered and rejected

Automatic creation of gym training sessions from provider imports is not proposed: it would blur provider publication and coach ownership. Rich CrossFit workouts must not be flattened into the simpler coached-block format. Removing old records or apparent duplicates is a separate data-cleanup decision.

The existing server-side admin and gym permission checks are intentional. The confusing interface is not evidence that those checks are absent. Global-admin status must not grant silent gym-coach access.

## Coverage and limits

Implementation covers the named track routes, importer administration, following and gym-library access, daily provider reads, composition/scoring snapshots, direct tests, and architecture documentation. Screenshots supplied by the user established the mobile problem; actual component fixtures supported desktop/mobile review. Work is isolated in `/tmp/wodsmith-track-experience` on `codex/track-experience`. No production writes, billing policy changes, or data cleanup occurred.
