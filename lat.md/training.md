# Training

Gym training connects published daily sessions to private athlete history and optional team results, with a weekly programming workflow for coaches.

## Session Model

Each training session belongs to one gym, eligible programming track, and calendar date. Ordered blocks support checkoffs, load, finish time, reps, and instructions.

The `training_sessions` table stores separate draft and published content, an optimistic revision, and a published version. Dates use `YYYY-MM-DD`; each session snapshots an IANA timezone. Published session timezones cannot change. Gym timezone reads `team.settings.timezone`, falling back to UTC.

The additive model uses existing owned or actively subscribed programming tracks, excluding competition and series-template tracks. Existing workout schedules and logs remain available at `/dashboard` and `/log`; no automatic data migration or track-template import occurs.

## Access and Publication

Every training read and write validates current, active, unexpired gym membership and the selected gym's workout-tracking entitlement. Coaching also requires programming permission.

System owners and admins can program; custom roles require `manage_programming`. Session-cookie memberships and global administrator status do not bypass the database check. Athletes receive only published content. Draft saves permit unfinished titles; publishing requires a title, titled blocks with nonempty prescriptions, and either blocks or a rest day.

Saving and publishing use expected revisions and row locks. Publication copies the draft to the published snapshot, clears the draft, and increments its version. Copying creates an independent draft with new block identities and rejects any occupied destination, including concurrent copies.

## Results and Privacy

A result is unique to its session, block, athlete, and published version. Repeated workouts never match by workout identity alone.

Results snapshot their performed block. Time is normalized to milliseconds, load to grams, and reps to integers using existing score parsing. Result writes and publication lock the same session so an outdated score cannot enter a newer version. Earlier versions remain in the athlete's history and own week results, allowing a notice when a coach republishes. Team comparison includes only the current published version. Loads must remain positive after normalization; zero reps are valid.

Notes remain private. Scored results default to private and may be shared with gym members. Checkoffs remain private and never enter rankings. Cheers are unique per result and athlete; changing a score to private removes its cheers. Team reads exclude private notes and results at the server boundary.

## Athlete Interface

`/training` opens the athlete's gym, remembered track, gym-local week, and selected day. Training, Team, and My progress stay close to the day context.

The interface distinguishes loading, failed reads, no track access, rest days, and unpublished days. Score dialogs retain entered data after failed saves and return to the same occurrence. Dismissing the dialog discards unsaved edits; completion and notes saves cannot overlap for the same section. Team comparison selects one section, version, and load unit; only Rx results receive comparable rankings. Progress shows the latest 100 own results, including previous prescriptions.

The selected gym travels to `/training/programming` when an authorized coach follows Program sessions. This local selection does not change the global active-team cookie. Durable offline synchronization, timed publication, class bookings, week templates, and historical score editing remain outside this release.

## Coach Interface

`/training/programming` provides a weekly planner, daily composer, athlete preview, explicit draft saving, release review, and copying into an empty day.

Coaches can reorder or remove sections, add scaling and guidance, and plan rest days. Unsaved navigation requires discarding or staying. Failed writes preserve edits. Publishing requires a saved draft and confirms the gym, track, date, timezone, and next version.

## Verification and Rollout

The MySQL migration adds only training sessions, results, and cheers. It must be applied before deploying the routes; production deployment and remote migration are separate actions.

`apps/wodsmith-start/test/preview/training` renders actual components with labeled browser fixtures for visual verification. It is not an authentication or server integration test and is excluded from app routes. Database tests opt into a disposable local `training_test` database with `TRAINING_TEST_DATABASE_URL`.

## Athlete Interface Tests

These interaction tests protect score context, privacy choices, gym-local dates, and results shown after navigation.

### Failed result saves retain context

A failed score request preserves the entered values, audience, notes, and exact session identity so retrying cannot log against another workout.

### Encoded scores edit in display units

Editing converts normalized scores into time and load inputs without showing raw milliseconds or grams. Reopening and saving a duration preserves its full hours and fractional seconds.

### Section saves are coordinated

Completion and notes writes cannot overlap for the same section. A later successful dialog save clears errors from an earlier completion attempt.

### Dismissed result edits are discarded

Discarding or dismissing a result dialog drops unsaved fields, and reopening uses the latest saved result. Failed saves preserve inputs while the dialog remains open.

### Calendar preserves gym local dates

The initial day follows the gym timezone and calendar navigation keeps its full date across week boundaries.

### Track switching rejects stale responses

An earlier request finishing after a track switch cannot overwrite the newly selected track's sessions.

### Team results isolate comparable scores

Team comparison isolates the selected section, publication version, and compatible result units while cheers call the real mutation contract.

### History preserves earlier prescriptions

Progress shows the performed prescription snapshot for an earlier version rather than replacing it with current programming.

### Default track is explicit

Opening Training uses the saved default track. Browsing another track does not change the preference or create a personal session; Make default track persists the athlete's choice.

### Composition creates personal ownership lazily

Viewing programming, logging an unchanged source workout, and opening customization do not create a session. Removing a workout saves the athlete's ordered composition with an expected revision.

### Remixes preserve references until saved

Published source items remain references until an athlete saves an explicit remix. Failed saves retain edited prescriptions and remix provenance without altering the original programming.

### Library additions require confirmation

A library deep link previews the accessible workout for a selected gym and date. Only confirming Add to my session creates or updates the composition, preserving the workout's original score format.

### Moved workouts log on the performed date

A workout borrowed from another programmed date records a private result against the personal session's date. The original track occurrence and its team results remain unchanged.

## Coach Interface Tests

These interaction tests protect unsaved programming, publication review, copying, and faithful preview content.

### Failed saves preserve edits

A failed save keeps the coach's edits, and changing days requires explicitly discarding unsaved content.

### Publication uses saved revision

Release review uses the revision returned by draft saving and identifies the gym, track, date, and timezone being published.

### Copy protects occupied dates

A rejected copy leaves the source content and destination dialog intact so the coach can choose another date.

### Stale track reads are ignored

A slow response for the previous programming track cannot replace the selected track's week.

### Preview matches programming

The preview includes scoring units, prescriptions, scaling, and coach guidance, and converting to rest requires confirming removal of sections.

## Workout Library

The workout library keeps reusable workout identities, editing, remixes, and earlier history. Athletes choose a gym and date before previewing an addition to their personal session.

Library search runs across the catalog before pagination. Old schedule bookmarks open a personal-session preview without writing a legacy schedule. Coaches can copy supported single-score time, load, or reps workouts into an independent draft section; rounds, caps, tiebreaks, and incompatible ranking semantics are rejected rather than flattened.

### Library Reuse Tests

Library conversion tests reject unsupported scoring metadata so coached sessions never change the meaning of a workout score. Picker tests verify selected-gym search, independent section identity, and recoverable rejection without adding a section.

## Navigation and History

Training is the athlete destination; Workout library supplies reusable content. Older result history stays accessible within My progress and through existing detail URLs.

The old `/team` dashboard redirects to Training. Both competition navigation menus expose Training for signed-in athletes. Main navigation keeps Training and Workout library together; Team and My progress remain within Training. The legacy `/log` page remains an archive, while new library scores use the personal-session result form and return to that day.

My progress reads only the current athlete's non-competition library and earlier scores for the selected gym. Editing from history returns to Training. Linked personal results are excluded from shared workout lists and denied to other users in legacy detail/round readers. Their session date cannot change through the older score editor.

## Library Result Tests

These regressions preserve privacy and occurrence identity when personal sessions reuse existing score storage and editing tools.

### Private scores stay private in older views

Another gym member cannot retrieve the detail or round breakdown of a library score linked to an athlete's personal session.

### Linked results retain their session date

Editing a linked score cannot move its date away from the owning personal session and make calendar history contradict the session.

### Personal library result editing

Linked library edits use the personal session API to preserve workout snapshots, capped rep counts, and individual rounds while keeping the original result ID and session date.
