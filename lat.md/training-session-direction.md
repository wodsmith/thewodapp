# Personal Session Ownership Proposal

Proposed direction: athletes own one session per date, while the navbar selects team programming and community context. This is a planned replacement, not the current implementation.

The current contracts remain documented in [[training-personal#Personal Training]] and [[training#Training]]. The implementation sequence and migration checklist are in `docs/plans/2026-09-12-personal-sessions-and-team-context.md`.

## Personal Day and Source Context

A personal day is identified by athlete and calendar date. Each workout separately retains source team, track, occurrence, publication, prescription, and programmed date.

Changing the navbar team changes source browsing, never the personal day or owned history. Team programming appears as suggestions until an explicit add or log creates personal ownership. Personal dates use a stable athlete timezone rather than the active team's timezone.

## Contextual Session Addition

Add to my session opens a shared date-selection dialog at the invoking workout. Confirmation appends atomically and leaves the athlete on the original page.

Ordinary library browsing defaults to Today; an explicit journey from a Training day carries that selected date. Browsing and cancellation create no session. Revision checks and idempotency prevent concurrent updates or retries from losing or duplicating planned work.

## Team Comparison Boundaries

Every eligible team-associated workout exposes its leaderboard before completion. The team default track selects initial community programming and comparisons.

Source provenance determines comparison context, independently of personal session ownership. Shared results require explicit consent and compatible occurrence or workout-history identity; private notes, moved occurrences, remixes, and changed prescriptions cannot leak into incompatible rankings.

## Migration Invariants

Existing athlete/team/date sessions must merge without losing order, performed snapshots, results, notes, old links, or intentional repeated workouts.

The migration retains source identities and original calendar labels, remaps session and item references explicitly, preserves over-capacity days, and includes source results recorded without a personal composition. The current team-dependent access model must split personal ownership from live source access.
