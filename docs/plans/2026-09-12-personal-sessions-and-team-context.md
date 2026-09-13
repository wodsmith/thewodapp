# Personal sessions and team context

Proposed implementation plan, September 12, 2026. This records the requested direction after integrating PR #699; the ownership, team-context, and date-picker redesign described here has not yet shipped.

## Product model

The navbar selects the team whose programming, library, and community the athlete browses. The athlete owns one session for each calendar day, containing workouts from any accessible source.

Switching teams changes the available programming and team comparisons. It never changes the athlete's selected date, planned workouts, recorded results, or personal progress. A workout retains its source team, track, publication, and programmed date independently of the date on which the athlete plans to perform it.

For example, add Cindy from Team A to Tuesday, switch the navbar to Team B, and add strength work to Tuesday. Tuesday contains both workouts. Each card identifies its source and opens the appropriate team's leaderboard when access permits.

## Findings in the current implementation

The initial main-branch findings below explain the reported behavior. PR #699 subsequently supplies direct scoring, optional composition state, shared SessionWorkoutActions, and transactional append/Undo handling; the follow-on work should extend those foundations.

| Area | Current implementation | Implication |
| --- | --- | --- |
| Navbar | `NavTeamSwitcher` saves the active team and invalidates the router. | The shared team-selection mechanism already exists. |
| Training | `AthleteTraining` initializes local team state from the URL before the active team, with a first-team fallback. `getTrainingContext` also substitutes the first eligible team. | A page can disagree with the navbar even after its selector is removed. |
| Workout library and detail | Loaders prioritize URL `teamId`; the library renders its own team selector and page-wide destination date. | Browsing context and session destination are coupled. |
| Personal sessions | `personal_training_sessions` is unique on `(userId, teamId, trainingDate)`; reads, writes, history, and result authorization depend on that team. | A real ownership/API migration is necessary. |
| Default programming | `teams.defaultTrackId` already exists. Personal-day resolution uses an athlete/team preference, then the first eligible track. | The team default must be wired into Training explicitly. |
| Add actions | PR #699 gives library and detail a shared immediate Add command for the page-selected day; older links still open a second Training confirmation. | Extend the shared command with a contextual date dialog and migrate the remaining navigation handoffs. |
| Team results | Training renders its Team view around a published coached session. Provider-day display does not provide the same path. | Team-associated provider workouts need comparable occurrence support. |
| Library leaderboard | An existing component/server function reads legacy scheduled instances; the current detail route does not mount it. | Mounting it alone would not cover new training and provider results. |

Evidence comes from the integrated source, server/database tests, browser fixtures, and supplied screenshot. The authenticated production page could not be inspected with the web reader. The local GitNexus index was rebuilt during stack integration.

## Navigation and page behavior

Use the navbar active team as the sole browsing context, while keeping personal training visible independently of team eligibility.

- Remove “Training for” from Training and “Gym or coaching group” from Workout library. Use the team name as a small source label only where it clarifies content.
- Derive team data from the shared authenticated active-team state. Remove local selected-team state and URL overrides from Training, the library, and workout detail. Audit coach programming and links into it for the same invariant.
- Normalize old `teamId` query parameters without changing the navbar. Preserve valid date, view, and accessible track intent. If an old link names another team, explain that the page is showing the navbar team; do not silently show another team's data.
- A foreign private workout deep link gets an access/context message, not a substitute workout or an automatic team switch. A public workout remains readable without implying a relationship to the active team.
- On navbar changes, reload team programming and library filters, clear team-specific track/tag/movement selections and pagination, retain search text and generic workout type, and reject stale responses. Keep the selected personal date and personal session intact.
- If the active team lacks training access or is an event team, show the appropriate team-content empty state. Do not silently fall back to a different gym. Personal sessions and owned history remain available under the athlete's personal access rules.
- Preserve existing coach draft-navigation protection when changing the global team from a programming screen.

## Training layout and weekly planning

Make the personal day the stable center of Training, with team programming presented as an explicit source of suggested work.

Use a “Training” page title, a week strip, and the selected day's “My session.” Keep “Team leaderboard” and “My progress” discoverable alongside it. Personal progress spans all the athlete's sources by default.

The week strip shows planned workout counts and completion state. Team publication/rest indicators belong to the programming section; a team's rest day must not label an athlete's independently planned day as rest.

Below the personal session, show “Programming from [active team]” with that team's track selector and published workouts for the selected date. When the personal day is empty, offer “Add today's programming” and individual add actions. Merely viewing programming must not silently put it into My session. This deliberately replaces the current unsaved projection that makes a team day look like an owned personal session.

Existing personal items remain visible while source programming loads or fails. A suggested workout already present shows “In your session.” Coach republishing changes suggestions but never rewrites an athlete's saved prescription.

Use one stable athlete timezone to compute Today, initialized from an existing personal setting where available, otherwise captured from the browser on first explicit use. Never compute personal Today from whichever team happens to be selected. Persist calendar labels without UTC date shifting. Team programming retains its source timezone and programmed date; show both dates when the performed day differs.

## Add to my session interaction

Every athlete-facing add action opens the same date-aware dialog, with a bottom sheet on mobile, while preserving the page and scroll position.

The overlay contains:

1. The workout title and a concise source summary.
2. A destination date, defaulting to Today for ordinary library/detail browsing. A deliberate “Add workout” journey launched from a selected Training day seeds that day instead.
3. Today, Tomorrow, a week strip, and a calendar for any other valid day.
4. A brief preview of that day's existing session, including count and workout names. An empty date says that adding will start the day's session.
5. One final button with a specific date, such as “Add to Tuesday, Sep 15.” There is no team selector.

Successful submission closes the overlay and shows “Cindy added to Tuesday, Sep 15” with an optional “View session” action. It does not navigate automatically. This lets the athlete add several workouts across the week without leaving the library.

Cancellation and opening the overlay write nothing. Disable duplicate submission, preserve date and selection after errors, and return focus to the invoking action. Make the date and final button visible together at mobile sizes. Long names, keyboard use, loading, retry, and empty-day states must work.

If the same source workout is already present, show it and offer “View session”; an intentional “Add another” is explicit. Use an idempotency key so network retries never produce that second copy accidentally. Multiple selected provider components append atomically in their original order.

Remove “Add to session on” from the library. Reuse the interaction in library rows/cards/detail, Training suggestions, provider readers, and legacy dashboard/scheduled-workout entry points. Keep coach “Add to track” separate because it edits programming rather than an athlete's session. Old schedule/log-import bookmarks should open this same review interaction and never write on navigation.

## Ownership and service changes

Move the personal aggregate to `(authenticated userId, trainingDate)` and attach source authorization and provenance to each item.

- Personal day/session APIs take a date or an owner-checked session ID, not a destination team. A first explicit add or direct log creates the personal day; browsing never does. Direct logging must atomically associate the performed item with that day, so a logged workout is always visible in My session.
- Split personal day/history reads from team programming reads. Keep existing team sessions, tracks, and publication rules team-owned.
- Store server-resolved source team identity on every relevant item, alongside exact occurrence/version, track, workout identity, full scoring definition, programmed date, and snapshot. A source team is not inferred from the navbar during later scoring.
- Validate access to each new source independently. A session can contain Team A, Team B, public provider, and personal items. Client-provided snapshots and source claims are never authoritative.
- Reading an owned composition or recorded snapshot should not depend on remaining a member of its original gym. Preserve owned history after membership loss; deny new imports, current source reads, team comparisons, and sharing when source access is gone. Define personal feature entitlement independently of the active gym and test that boundary.
- Extend PR #699's transactional append command and SessionWorkoutActions using expected revision, stable item IDs, and idempotency. A conflict refreshes the destination preview and permits retry without overwriting another tab's additions. Reuse its direct-scoring and performed-snapshot behavior rather than reimplementing it.
- Keep full scoring metadata, scaling definitions, rounds, caps, tiebreaks, private notes, and historical snapshots. Do not flatten library workouts into generic blocks.
- Where legacy score storage still requires a team, use explicit source context or the athlete's owned personal workspace as a compatibility adapter. It must not restore team ownership of the session or make private scores visible in older readers.
- Keep reordering/removal owner-scoped. Moving unlogged work to another day updates source/performed-date distinctions; logged items retain their performed history and use a separate explicit history-correction flow.

The main implementation boundary is `packages/wodsmith-db/src/schemas/training-personal.ts`, `lib/training/personal-types.ts`, the personal validation/server/server-function modules, and `AthletePersonalSession`. Session-ID consumers and legacy score/link/edit readers need an audit before the storage change.

## Team leaderboards and default tracks

Show a leaderboard entry point on every workout with a verified team relationship, whether or not the viewer has completed it or anyone has submitted a score.

“Team leaderboard · [team]” opens the relevant board from Training cards, team library rows/cards, workout details, and sourced personal-session items. Render a clear “No shared scores yet” state instead of hiding the feature. A public workout merely visible in a team's catalog does not automatically become owned by that team.

Use the existing `teams.defaultTrackId` for the initial team-programming and Team leaderboard view. Validate that it remains eligible. An explicit track selection changes browsing only. Preserve existing athlete track preferences as personal browsing preferences, clearly separated from the team default; they must not silently select a different community board. If the default is unavailable, show that state and let the athlete browse another eligible track without rewriting the default. If no default exists, show the only eligible track when unambiguous, otherwise request a track choice and expose configuration to authorized coaches.

Unify the leaderboard read model while retaining distinct comparison identities:

| Workout context | Board identity and behavior |
| --- | --- |
| Published coached workout | Source team + session/block + published version; preserve existing comparable-score rules. |
| Provider workout available through a team track | Consuming team + published provider occurrence/component/version, even if no coached session exists. Followers in different gyms must not share a board accidentally. |
| Legacy scheduled workout | Team + scheduled instance, adapted into the same presentation contract. |
| Team-owned library workout with no scheduled occurrence | A clearly labeled workout-history board for that team and compatible definition/version, with date filtering. Do not present it as today's prescribed workout. |
| Personal/remixed workout without comparable team provenance | No fabricated team ranking. Show personal results; retain a source link if relevant. |

Private stays private. Adding a workout never opts the athlete into sharing. When a logged item is eligible, offer “Share with [source team]” in the score form and bind sharing to its exact comparison identity. Share an eligible result association, not the entire session or notes. Revoking sharing removes it from every team view.

A workout performed on a different date stays in the chosen personal day. It does not automatically enter the originally scheduled day's board. The separate team workout-history scope may accept an explicit eligible share. Changed prescriptions and remixes never enter the original Rx ranking; scaling and non-comparable results are labeled appropriately.

Reuse the rich Training normalization/comparison rules for caps, rounds, units, and tiebreaks. Replace the legacy leaderboard's simple score-only ordering where needed. Batch board summaries for library lists and load full entries on demand. Enforce live membership, sharing, and privacy at the server boundary, including legacy adapters.

## Existing data migration

Merging existing athlete/team/day sessions is the highest-risk part and must preserve every performed item and result.

1. Audit counts of users with multiple sessions on one date, colliding item IDs, source-result-only days, legacy score links, missing sources, and combined days over the current 40-item limit.
2. Add the new ownership/provenance representation and a durable old-session-to-canonical-session mapping before changing readers. Use a resumable, idempotent migration with a dry-run report and verified backups.
3. Group existing personal sessions by user/date. Keep original date labels, concatenate items in a deterministic documented order while preserving each session's internal ordering, and carry forward original source teams. Never deduplicate by workout title or workout ID: two performances can be intentional.
4. Remap personal result/session/item references transactionally, including removed-item result snapshots, legacy score associations, and old edit URLs. Preserve score IDs, notes, sharing choices, publication identities, and entered round details. Remap colliding item IDs explicitly. Do not discard results that have no current composition item.
5. Retain all items if a merged day exceeds 40; grandfather its existing contents and prohibit further append until within the configured limit. Never truncate during migration.
6. Include unchanged source results that previously existed without personal rows in personal day/history reads. Backfill performed references from those result snapshots where necessary; do not backfill every published workout as a personal plan.
7. Introduce compatible readers/adapters, then coordinate the final write cutover so old writers cannot recreate per-team duplicates. Enforce the new unique user/date key only after reconciliation. Retire the old destination-team dependency after all consumers migrate.
8. Validate counts and checksums of items, results, notes, round data, and legacy links before and after; exercise retry and rollback on a disposable database. Keep provenance/mapping until old links and rollout rollback no longer depend on it.

## Delivery sequence

Implement this as a coordinated ownership and interaction change, with checkpoints small enough to review independently.

| Phase | Deliverable | Completion gate |
| --- | --- | --- |
| 1. Active-team consistency | Remove duplicate selectors and URL precedence, fix active-team fallback and reload behavior. | Navbar switches update Training/library/detail; no silent other-team fallback. |
| 2. Personal ownership | New aggregate, source-aware APIs, global history, timezone rule, migration and old-link adapters. | Two teams append to one date; history and private results survive migration and access changes. |
| 3. Add interaction and Training layout | Shared dialog/sheet, contextual date choice, inline success, stable personal day, separate team suggestions and weekly counts. | Athlete plans a week across teams without navigation hops or an external destination picker. |
| 4. Team comparisons | Team default integration, shared leaderboard presentation/read contract, provider and library coverage, explicit score sharing. | Every eligible team workout exposes a board before logging; scores remain comparable and private by default. |
| 5. Rollout | Database rehearsal, end-to-end verification, monitored cutover, documentation updates. | No lost or duplicated work, no privacy regression, no old team-specific session writers. |

Prototype the dialog independently, but ship its production append behavior against the new personal ownership contract. A cosmetic selector-only patch is not completion of the requested experience.

## Verification

Use focused component and database tests plus browser verification of the entire planning journey on desktop and mobile.

- Navbar Team A → Team B updates programming, library, and leaderboard context while Tuesday's personal session and selected date remain unchanged. Old query parameters and delayed responses cannot restore Team A.
- Add Cindy to Tuesday from the library, strength to Thursday from detail, and Team B programming to Tuesday. Stay on the initiating page after each add and find all items on the expected days.
- Cancel, failed save, double click, network retry, concurrent first adds from two teams, stale revision, full day, and multi-component import preserve exact contents and ordering.
- Today and calendar selection remain stable across team timezones, DST boundaries, browser/server timezone differences, and week boundaries.
- An empty personal day is distinct from unpublished programming or a source-team rest day. Source errors do not hide the personal plan.
- Migration preserves multi-team same-day sessions, duplicate workout performances, colliding item IDs, removed-item history, old links, days above capacity, and private legacy rounds/notes.
- Every supported team source exposes empty, populated, loading, and error leaderboard states without requiring the viewer to log first. Default-track changes affect team suggestions/boards without editing personal plans.
- Private, moved, remixed, republished, scaled, capped, multi-round, and tiebreak results enter only eligible comparison scopes. Revoked membership and sharing cannot expose private history or notes.
- No application code needs workout-authoring changes for the date picker. If implementation does touch definition controls, reuse `workout-definition-fields.tsx`, inspect Compete's existing forms, extend the scoped boundary/adapter tests, and verify both programming and Compete consumers on mobile.
- Before editing symbols, refresh GitNexus and report impact for each changed symbol; inspect changed flows before committing. Update the existing Training and Personal Training documentation when behavior ships, then run `lat check`.

The recommended defaults are one session per day, stable athlete-local dates, and opt-in sharing. These choices make weekly planning predictable while preserving each team's programming and comparison boundaries.
