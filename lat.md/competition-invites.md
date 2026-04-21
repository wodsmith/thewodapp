# Competition Invites

ADR-0011 ships a qualification-source → roster → invite-round system for championship competitions. Organizers declare where invitees come from, see a unified roster from those sources, and — later — send email-locked invites in waves.

Phase 1 is read-only: declarative sources, a roster table that joins source leaderboards with invite-state columns set to null, and the organizer route shell. Schema lives in [[apps/wodsmith-start/src/db/schemas/competition-invites.ts]]. ADR reference: `docs/adr/0011-competition-invites.md`.

## Sources schema

A qualification source attached to a championship competition. Each row references either a single competition or a series (never both); allocation and division-mapping columns describe how many invitees the source contributes.

Defined by [[apps/wodsmith-start/src/db/schemas/competition-invites.ts#competitionInviteSourcesTable]] with three indexes — `(championshipCompetitionId, sortOrder)` drives the Sources tab list, `(sourceCompetitionId)` lets us find every championship a given source competition feeds, and `(sourceGroupId)` does the same for series. ULID primary keys generated via [[apps/wodsmith-start/src/db/schemas/common.ts#createCompetitionInviteSourceId]]. No FKs (PlanetScale convention).

## Sources helpers

Server-side CRUD helpers for the sources table live in [[apps/wodsmith-start/src/server/competition-invites/sources.ts]]. `listSourcesForChampionship`, `createSource`, `updateSource`, `deleteSource`, and `getSourceById` compose the CRUD surface.

The write-time constraint "exactly one of `sourceCompetitionId` / `sourceGroupId`" is enforced in [[apps/wodsmith-start/src/server/competition-invites/sources.ts#assertSourceReferenceValid]], not at the DB, because PlanetScale has no check constraints and a typed `InviteSourceValidationError` from one boundary is cleaner than mixing DB and validation errors. `updateSource` re-runs the validator against the post-patch shape so a partial update that breaks the rule fails before reaching the DB.

## Source server fns

The organizer endpoints live in [[apps/wodsmith-start/src/server-fns/competition-invite-fns.ts]] — `listInviteSourcesFn`, `createInviteSourceFn`, `updateInviteSourceFn`, `deleteInviteSourceFn` — gated by `MANAGE_COMPETITIONS` on the championship's organizing team.

When a source references another competition or series, [[apps/wodsmith-start/src/server-fns/competition-invite-fns.ts#requireSourcePermissions]] also requires `MANAGE_COMPETITIONS` on that source's organizing team. Per ADR Open Question 6 (same-org only for MVP) the two organizing teams must currently match; cross-org references throw. The policy lives in the server fn so a future phase can relax it by deleting a single check. Each fn wraps its handler in `withRequestContext` so `logEntityCreated` / `logEntityUpdated` / `logEntityDeleted` calls carry correlation IDs.

## Roster computation

`getChampionshipRoster({ championshipId, divisionId })` in [[apps/wodsmith-start/src/server/competition-invites/roster.ts]] returns an ordered `RosterRow[]` for a championship + division. Invite-state columns are `null` in Phase 1.

The function loads all sources, delegates to [[apps/wodsmith-start/src/server/competition-leaderboard.ts#getCompetitionLeaderboard]] for single-comp sources and [[apps/wodsmith-start/src/server/series-leaderboard.ts#getSeriesLeaderboard]] for series sources, resolves each source's division mapping, and flags rows below each source's spot allocation as `belowCutoff`. Pure helpers (`parseDivisionMappings`, `resolveSourceDivisionId`, `resolveSpotsForDivision`, `aggregateQualifyingRows`) are extracted and unit-tested directly so the cutoff + skip-already-qualified logic can be exercised without mocking the leaderboard stack. The server fn `getChampionshipRosterFn` gates this with `MANAGE_COMPETITIONS` on the championship.

## Organizer route shell

The Phase-1 organizer route is [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/invites/index.tsx]]. It renders five tabs — Roster, Sources, Round History, Email Templates, Series Global — with Roster and Sources live and the others placeholders for later phases.

The loader loads sources, divisions, and the first division's roster in parallel via `Promise.all` and passes them to child components. The sidebar ([[apps/wodsmith-start/src/components/competition-sidebar.tsx]]) gains an "Invites" entry under the Athletes section. Series sources within the Sources tab render per-comp tabs plus a series-global tab via [[apps/wodsmith-start/src/components/organizer/invites/series-source-sub-tabs.tsx]] — Phase 1 is read-only, so the component receives data from the loader rather than fetching its own, and invite pills are deliberately omitted until Phase 2.
