# Bug: Invite candidates page silently drops source-comp divisions when athletes aren't placed in heats

- **Issue**: `broadcast-4m8`
- **Affected page**: Organizer → Competition → Invites → Candidates
- **Affected championship in prod**: `comp_if3ptzzxa8jpjrdf6g0rgzhr` ("Invitational")
- **Reported by**: Zac
- **Severity**: P2 — silently incomplete data; organizers cannot see/invite qualified athletes from divisions whose registrants haven't been heat-assigned yet.

## Summary

The Candidates list pulls athletes from each invite source's leaderboard. When a source competition has registrations in a division but **none of those athletes have been assigned to a heat for any track workout**, the entire division disappears from the Candidates list — silently. There is no UI indication that those athletes exist or were dropped.

The user's hypothesis was that "divisions without a price set" were being filtered out. That correlation is incidental — the actual filter is heat assignment, not pricing.

## Reproduction (production data)

Championship `comp_if3ptzzxa8jpjrdf6g0rgzhr` has two configured invite sources, both `kind = "competition"` with `globalSpots = 2`:

| Source | Source comp | Source comp scaling group |
| --- | --- | --- |
| `cisrc_01KQE6XTY95KRV8E6T6SWPWS76` | `comp_mwfc2025` (MWFC 2025) | `sgrp_mwfc2025_divisions` (15 divisions) |
| `cisrc_01KQE8RWYFGCV0Q2V8F8QSHP2G` | `comp_jrt8oaqud9oua0lym0cl6uwu` (test11) | `sgrp_k4a5g4xcosc84rmucqvmfkqu` (6 divisions) |

There are **no** per-division allocation overrides (`competition_invite_source_division_allocations` empty for both sources).

### test11 division registrations (active, from `competition_registrations`)

| Division | Label | Registrations | Shown in Candidates? |
| --- | --- | ---: | --- |
| `slvl_qprrz0fa6jfvxchbt0amrnu9` | Open Male | 4 | ✅ all 4 |
| `slvl_wmu0iiiyzwjxn7evtoh5p7ma` | Money | 6 | ✅ all 6 |
| `slvl_xih269todngq18pej8dtfgv1` | Scaled Male | 2 | ❌ missing |
| `slvl_psixz0iraucnmp8z3gtxdkbk` | Partner | 3 | ❌ missing |
| `slvl_f8aevgh1det91aj5yn5nvvqd` | Open Female | 1 | ❌ missing |

### test11 heat assignments (mixed heats only — `competition_heats.division_id IS NULL`)

The single track workout `trwk_mx6s2x5wo7i98rg6qkt2blv9` has 2 mixed heats. Joining `competition_heat_assignments` to `competition_registrations`:

| Athlete's `division_id` | Label | Assignments |
| --- | --- | ---: |
| `slvl_qprrz0fa6jfvxchbt0amrnu9` | Open Male | 4 |
| `slvl_wmu0iiiyzwjxn7evtoh5p7ma` | Money | 4 |

Exactly the two divisions visible in Candidates. Scaled Male / Partner / Open Female athletes have **no heat assignments** and therefore disappear. (No rows exist in `event_division_mappings` for this comp, so the explicit-mapping path doesn't apply.)

## Root cause

`getChampionshipRoster` (`apps/wodsmith-start/src/server/competition-invites/roster.ts:444`) fans a leaderboard fetch out per `(sourceCompetitionId, divisionId)`:

```ts
const leaderboards = await Promise.all(
  divisionRefs.map((ref) =>
    getCompetitionLeaderboard({
      competitionId: ref.competitionId,
      divisionId: ref.divisionId,
    }).then((lb) => ({ ref, entries: lb.entries })),
  ),
)
```

`getCompetitionLeaderboard` (`apps/wodsmith-start/src/server/competition-leaderboard.ts:393`) then narrows track workouts by division. When `divisionId` is set and there are no rows in `event_division_mappings`, it falls back to **heat-based filtering** (`competition-leaderboard.ts:588`):

```ts
const relevantIds = getRelevantWorkoutIds({
  heats: heatsForWorkouts,
  mixedHeatAssignments,
  divisionId: params.divisionId,
})

if (relevantIds) {
  filteredTrackWorkouts = trackWorkouts.filter(...)

  if (filteredTrackWorkouts.length === 0) {
    return { entries: [], scoringConfig, events: [] }   // ← (1)
  }
}
```

`getRelevantWorkoutIds` (`competition-leaderboard.ts:350`) builds the set from:

1. division-specific heats (`heat.divisionId === params.divisionId`), plus
2. mixed heats that contain at least one assignment for an athlete in `params.divisionId`.

Test11 has only mixed heats and no assignments for Scaled Male / Partner / Open Female, so `relevantIds` is empty for those divisions. The early return at (1) sends back an empty leaderboard, and `getChampionshipRoster` produces zero rows for that `(comp, division)` pair.

The candidates UI never learns that the division existed: there's no zero-state tile, no "no heats yet" hint, no way to send an invite to those athletes.

The same pattern silently affects MWFC for any division whose athletes haven't been assigned to a heat — the bug is general, not test11-specific.

## Why the user's "no price" hypothesis correlates

Pricing isn't read anywhere in the candidates path. The likely reason the user noticed it: divisions added late in the comp setup (after heats were drawn) tend to also be the ones the organizer hadn't yet finished pricing. Both are downstream of "this division was an afterthought." Pricing isn't causal.

## Proposed fix (sketch — not implemented in this PR)

The leaderboard's job in the championship-roster context is "give me the qualifying placements for division X in source comp Y." Heat assignments are an implementation detail of in-person scoring, not a qualifier-eligibility signal. Two options:

1. **Bypass heat-based event filtering when called from the roster path.** Add a flag to `getCompetitionLeaderboard` (e.g. `treatAllEventsAsRelevant: true`) that the roster fan-out passes. Registrations still get filtered by `divisionId` so the leaderboard stays division-correct; we just don't drop the events when no heats reference them yet.
2. **Decouple roster computation from the leaderboard entirely.** For invite candidates, the source of truth is "athletes registered in division X of comp Y, ranked by their best-scored workouts (or just registration order if unscored)." This has the side benefit of not paying the leaderboard's full ranking cost for what is conceptually a registration query.

Either way, the fix should ensure that **a division with registrations always appears in the candidates list**, even if zero events have published results yet. Showing them with placeholder ranks (`#1`, `#2` by registration order) is acceptable; silently omitting them is not.

## Related

- Roster computation: `apps/wodsmith-start/src/server/competition-invites/roster.ts`
- Leaderboard heat filter: `apps/wodsmith-start/src/server/competition-leaderboard.ts:350,588,640`
- Allocations resolver (unaffected — confirmed): `apps/wodsmith-start/src/server/competition-invites/allocations.ts`
- Tests: `apps/wodsmith-start/test/server/competition-invites/roster-allocations.test.ts` does not currently cover the empty-heat-assignment case for a registered division.
