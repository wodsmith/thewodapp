---
status: proposed
date: 2026-09-07
decision-makers: [Zac Jones]
---

# ADR-0015: Preserve score submissions and bind reviews to immutable versions

## Status and decision boundary

This is a B-02 proposal for discussion, not authorization for a schema rollout. Verified scores must remain editable. Every accepted score submission, including organizer and API changes without video, needs history. The leaderboard replacement policy remains undecided.

Source baseline: `0d36543dd0a5c7ad2958f8fcf2b1328998e31c15`. B-20/B-25 changes are independent: returning accepted saved values and committing a team's videos and shared score together do not adopt either history alternative.

## Current identities and failure mode

Current tables retain mutable projections, not complete immutable submissions. Existing verification logs cannot reconstruct the score, rounds, evidence, and review context that a reviewer saw.

- `packages/wodsmith-db/src/schemas/scores.ts`: `scoresTable.id` identifies the current result. Competition uniqueness is event (`trackWorkoutId`, not the competition-event row id), athlete user, and null-safe division. `scoreRoundsTable` is unique by score id and round number and is deleted/replaced on writes. Score carries scheme, aggregate mode, cap, status, secondary/tiebreak values, sorting values, benchmark variant, verification and penalty fields.
- `packages/wodsmith-db/src/schemas/video-submissions.ts`: video id is mutable per registration + track workout + video index. URL, notes, submission timestamps, and review summary can be overwritten. A team shares one score across independently identified video slots.
- `packages/wodsmith-db/src/schemas/scores.ts`: `scoreVerificationLogsTable` records actor/time/action and scalar original/new values plus penalty metadata. It does not snapshot complete rounds, workout definition, video URLs, or general athlete submissions. Verified actions can have no before/after scalar values.
- `packages/wodsmith-db/src/schemas/review-notes.ts` and `video-votes.ts`: timestamped notes, movement/no-rep context, and public votes reference mutable video ids. Notes and votes cannot silently follow replacement evidence.
- `lat.md/submission-integrity.md`: current online server-function writes roll back invalid inputs and reset current verification/penalty and video review fields on replacement, retaining verification logs. Invalid scores remain excluded after video-only replacement. This successful reset behavior stays until an accepted migration replaces it; restoring stale verification is not an interim fix.

## Writer inventory and required cutover

History must cover every competition-result writer at the same service boundary; changing only the athlete video form would leave bypasses.

| Path | Current behavior | Required history behavior |
| --- | --- | --- |
| `server-fns/video-submission-fns.ts:submitVideoFn` | Shared result service plus mutable evidence and review reset in transaction; benchmark has separate best-retention branch | Append one complete submission version with all evidence slots; copy unchanged evidence for a slot-only edit; retain old score and evidence facts |
| `server-fns/athlete-score-fns.ts` | Athlete score-only writes through `recordCompetitionResult` | Same history command and ownership/window checks, even without evidence |
| `server-fns/competition-score-fns.ts:saveCompetitionScore`, `saveCompetitionScoresFn` | Organizer score entry and batch/import write through result service; batch currently reports per-item success/failure | Capture actual actor/source/reason per accepted item and preserve current batch failure contract; do not label a partial import atomic |
| `routes/api/compete/scores/judge.ts` | Judge API calls result service | Record authenticated actor and expected version, preserve judge permission scope |
| `routes/api/compete/video/submit.ts` | API transaction writes mutable evidence and result; does not mirror all server-function review resets or team-slot behavior | Use the same revision command; reject unsupported multi-slot payloads explicitly until API supports them |
| `routes/api/compete/scores/submit.ts` | Direct score upsert bypasses canonical result service | Cut over before enforcing history invariants; keep API auth and registration checks |
| `server-fns/submission-verification-fns.ts` | Verify/adjust/invalidate mutate score and add logs; manual score creation uses `insertManualSubmissionWorkoutResult`; deletion paths exist | Append version-bound review decisions with complete adjusted values/rounds and reason; manual creation appends a submission and decision in one transaction |
| `server-fns/cohost/cohost-submission-fns.ts` | Separate cohost review/manual path and logs | Same domain commands with cohost-scoped authorization, no alternate revision semantics |
| `server/benchmark-submissions.ts` | Separate individual best-score retention policy | Record attempted accepted submissions independently of retained-best selection; preserve benchmark policy and variant snapshot |
| `server-fns/demo-competition-fns.ts` | Demo score inserts | Seed baseline revisions or explicitly mark generated demo data; never leave unversioned normal writes |

Paths in the table are relative to `apps/wodsmith-start/src/`. Training/personal log writers also use score-related tables but are a separate domain: do not automatically convert them into competition submissions. If “general history” must include gym and personal training edits, that is a separate scope decision using their existing historical workout snapshots.

Deletion, division transfer, and competition removal must be inventoried during implementation. Ordinary correction/deletion should append a withdrawal or retain a tombstone rather than erase historical facts. Account-erasure/retention policy is a separate explicit product decision; immutable application writes do not imply indefinite retention of personal information.

## Shared immutable contract

A submission version records the complete claim and evidence at acceptance time. A review decision refers to exactly one such version, regardless of later edits.

Proposed fields: stable result id; immutable revision id; monotonic result-local version; previous revision id; registration id; competition/event/athlete/division snapshots; actual actor user id; source (`athlete`, `organizer`, `judge_api`, `import`, `benchmark`, `legacy_baseline`); accepted timestamp; recorded/performed timestamp; reason; idempotency key. Preserve raw input alongside normalized scheme, score type, values, statuses, caps, units, tiebreak, ordered rounds, and definition snapshot/version used for normalization. Never infer historical scoring definitions from today's workout.

Each version contains an evidence set with slot index, URL, notes, and evidence revision id. An unchanged slot may reuse an immutable evidence revision; a changed URL or note creates another. General score submissions may have no evidence. Keeping a URL does not archive the remote video's bytes: external deletion/replacement remains a limitation unless media retention is separately designed.

Review decisions include submission revision id, reviewer, decision time, disposition, reason, penalty type/percentage/no-rep snapshot, exact evidence revision ids reviewed, and complete effective score/round values after adjustment. Decisions append; correction or reversal supersedes a previous decision on that version rather than mutating it. Reviewing revision 4 after revision 5 arrives must not verify revision 5 or silently replace its projection. UI must disclose the stale version and either allow a historical-only decision or return a conflict; choose this UI policy during implementation review.

Optimistic concurrency: accept an expected current revision id, lock the result identity in a MySQL transaction, reject conflicting edits, append facts, and advance current pointers atomically. A retry with the same scoped idempotency key returns the same receipt; the same key with different payload fails. For first writes, enforce null-safe identity uniqueness, including concurrent creation. Transactions encompass rounds, all team evidence, current pointers, and decision/projection updates.

## Alternative A: Dedicated immutable revision tables with current projections

Add append-only submission revisions, revision rounds, evidence revisions/set links, and version-bound review decisions. Keep `scores` and current video rows as explicit read projections during migration.

A stable result identity owns `currentSubmissionRevisionId` and, if chosen, separate `rankedSubmissionRevisionId`/`rankedReviewDecisionId`. New readers join only within those chosen revisions. Current projections are updated synchronously in the same transaction; no queue, replay framework, or generic event bus is needed.

Advantages: preserves existing score ids and most consumers while making history explicit; typed columns and exact keys support checks and pagination. Costs: additional tables and duplicated current values require an invariant test that projections match their pointed revision/decision. This is the proposed engineering direction, pending user/coordinator review, not an accepted decision.

## Alternative B: Versioned score rows and an independent result identity

Move current uniqueness to a new result-identity table and make each score row an immutable submitted version. Rounds and evidence attach directly to that score-version id; reviews target that id and store effective values separately.

Advantages: fewer duplicated score values and direct version ownership of rounds. Costs: every existing caller that assumes `scoreId` is stable must change, including verification logs, notes, votes, leaderboard joins, transfers/deletions, and API payloads. Changing score uniqueness and translating historical foreign references makes cutover and rollback more disruptive. This remains a valid alternative if the team prefers a larger coordinated migration.

Neither alternative is event sourcing. Facts are complete snapshots, current reads use explicit pointers/projections, and normal operation does not replay historical commands.

## Leaderboard choice awaiting user input

Storage supports both policies, but the user must choose which version is ranked while a replacement is pending review.

1. Keep the last verified/effective version ranked until a new decision accepts its replacement. Show both “ranked version” and “new submission pending” to athlete and organizer. Define fallback when no verified version exists, and withdrawal/invalid replacement behavior before rollout.
2. Immediately rank the newest accepted submission as pending and attach only that version's review state. Preserve the old verified version in history. This resembles current online leaderboard eligibility: `server/competition-leaderboard.ts:fetchScores` includes unreviewed scores and excludes invalid scores, while organizer preview can include invalid rows.

In either case, `fetchScores`, round counts, `buildReviewSummary`, per-division scores, series leaderboard reads, public video links, and review badges must select one consistent version. No mixing a ranked old score with a new video's review status. Benchmarks already have best-retention semantics and require explicit compatibility tests rather than silently inheriting online replacement policy.

## Visibility proposal

History should make corrections understandable without exposing account details or private reviewer notes publicly.

Athletes and authorized organizers see version number, who submitted it (display name and actor role, no email), acceptance time, source, changed values/evidence, and correction reason. Require a reason for organizer/manual/import corrections and review adjustments/invalidations; an athlete's initial submission need not require one. Keep operational import identifiers private. Public leaderboards show the selected version, review/penalty state, and whether a newer submission awaits review; full history, actor ids, and internal notes are not public by default. Final author-name and reason visibility remains a reviewable product choice.

## Migration and backfill limits

Additive migration must preserve current rows and logs, and backfill only facts that can be demonstrated from existing data.

The MySQL migration baseline `packages/wodsmith-db/mysql-migrations/0000_benchmark-battery.sql` creates scores, rounds, videos, notes and verification logs with older constraints. Current schema includes the null-safe `competitionDivisionKey`; implementation must inspect actual deployed DDL through an approved migration workflow rather than assume the baseline or generated snapshots represent production. Later checked-in MySQL migrations through 0006 concern training; no immutable competition submission history exists there.

Backfill one `legacy_baseline` per current result, retaining current rounds/evidence/verification fields and recording migration time separately from historical timestamps. Preserve all old logs, notes, and votes. Do not claim their decisions reviewed the baseline's current evidence: old video URLs/rounds may already have been overwritten. Mark unprovable bindings `legacy_unbound`; retain original log ids and expose the limitation. Adjustment scalar logs may support partial historical displays, not fabricated complete submissions. Identify orphan evidence, orphan logs, null-division duplicates, and ambiguous team/registration joins for an exception report before adding constraints.

Rollout: add schema; backfill/checkpoint in bounded batches; route every writer through the shared command while dual-writing projections; compare projection/revision consistency; enable version-aware readers; then enforce non-null bindings for new writes. Avoid a window where legacy clients bypass history. Rollback may disable new readers but must retain appended history; never delete it or overwrite old evidence to return to legacy behavior. No production migration is included in B-20/B-25.

## Implementation and verification plan

Acceptance requires both version preservation and unchanged successful score normalization, authorization, and ranking behavior under the chosen policy.

- Extend `server/competition-results/{domain,service,repository,decision,review}.ts` with actor/source/reason, expected revision and idempotency contract, keeping existing normalization pure. Add schemas/migrations under `packages/wodsmith-db` only after DDL reconciliation.
- Cut over every writer above; reject direct unversioned mutations through a scoped boundary test. For imports, test each accepted row's history and reported partial failures.
- Add real MySQL tests: verified v1 → edited v2 retains all v1 values/rounds/evidence/notes/decision; no decision is inherited; evidence-only team edit snapshots the complete evidence set; failure on a later slot rolls back the entire new version.
- Test reviewer opened v1 while athlete saves v2; result belongs only to v1 and never verifies/replaces v2. Test two edits concurrently, duplicate retries, mismatched idempotency payload, and first-write uniqueness for null division.
- Test manual creation/adjustment/invalidation/reversal with exact original and effective round values and penalty reasons. Retain existing logs without implying evidence provenance.
- Test athlete/captain ownership, organizer/cohost/judge role and competition/division scope on every new history read/write endpoint. Exercise actor/reason visibility and removal of access.
- Test capped single/multiple rounds, tiebreaks, benchmark retained-best, ordinary scores, two divisions for one athlete, public versus organizer invalid visibility, and series readers against the selected version pointer.
- Component/browser coverage: editing verified results remains possible; clear revision/conflict UI; round/evidence comparison on mobile; public score/badge/video refer to the same revision. Update lat.md, run targeted tests/type checks and `lat check` before implementation PR review.

## Remaining decisions

The proposal is deliberately incomplete where user input changes visible behavior.

Await leaderboard replacement policy and its no-verified/invalid/withdrawal fallbacks; confirm actor/reason visibility; choose A or B and migration rollout window. These decisions must be resolved in the ADR before implementing broad schema changes. B-20 and B-25 can ship independently without deleting reviews or selecting leaderboard replacement semantics.
