# Personal Training

Athletes choose a durable default track and own a session only after composing their day. Published programming remains shared until an explicit change creates a private composition.

## Default and Ownership

A preference stores the default track per athlete and gym. Browsing creates no rows; direct library scores may create a result-only day without a composition.

Without a saved composition, the day projects the current publication from the explicitly browsed track or durable default. An unavailable default falls back to the first eligible track without rewriting the preference. Each personal session is unique to its athlete, gym, and date, independently of track selection.

## Sources and Remix

Personal compositions contain ordered references to published blocks, library workouts, and athlete-owned sections. A reference preserves its source identity and a server-resolved snapshot without transferring ownership.

First imports validate gym, eligible track, published version, and block membership. Later composition edits retain stored source snapshots after republishing. Only an explicit personal remix receives an editable prescription with source provenance. Already recorded items cannot change prescription under the same identity; removal retains the performed snapshot in personal history.

Library references preserve full workout identity and use the existing rich scoring model. Their snapshots retain full scoring metadata and the resolved scaling group, and result entry uses that performed prescription even if the library later changes. No rich score is flattened to a simple training-block score.

## Access and Concurrency

Personal reads and writes require current, active, unexpired gym membership and workout tracking. Session IDs never confer ownership; only the authenticated athlete can modify or read their personal results.

Composition saves and personal results lock the personal session and validate optimistic revisions. Concurrent first saves resolve through the unique athlete/gym/day key. Source rows are locked in stable order during import so publication cannot race snapshot validation. Private library access uses current database memberships, never client-provided team lists.

Unchanged current source results keep their existing source occurrence and team sharing rules. Frozen or moved source work can be recorded privately against the personal occurrence. Personal additions and remixes remain private and never enter shared team comparisons.

## Library Results

Library result submission atomically writes the score, round details, and a private association containing the complete performed library-item snapshot. Retrying returns the existing association instead of creating another result.

The result snapshot preserves prescription, scoring, and scaling after an item is removed or its library workout changes or is deleted. Historical edits retain the score ID and validate the owner's current session revision; they never re-add the item. Existing links without a result snapshot capture their original session item before removal.

The server derives workout, gym, and date from the locked session. The legacy score date uses the stored calendar label at UTC midnight, matching existing log semantics. Linking an existing score verifies athlete, workout, noncompetition status, and the exact calendar date. Shared legacy score reads exclude linked personal scores for other athletes. Single and batch workout-set readers also require authentication, inspect private associations, and never return another athlete’s linked round values or notes.

## Migration

The additive migration creates training preferences, personal training sessions, and personal training results. Existing programming, workouts, source results, and legacy logs remain unchanged.

Apply `packages/wodsmith-db/mysql-migrations/0002_training_personal.sql` before deploying the new APIs. The follow-up `0003_training_library_history.sql` adds a nullable `library_item` JSON snapshot to personal results and must precede the historical-library fix. The generated snapshot also reflects schema already present on the main branch; the SQL intentionally contains only the three new tables and their index.

## Verification

Pure validation tests and opt-in disposable MySQL tests verify ownership, privacy, source snapshots, concurrency, and rich score persistence. Set `TRAINING_TEST_DATABASE_URL` to a local `training_test` database.

### Composition input boundaries

Reject duplicate item identities and ignore untrusted source snapshots so the server alone determines a referenced prescription.

### Lazy session ownership

Opening shared programming and logging an unchanged source result create no personal session or preference rows.

### Durable default preference

An explicitly saved default survives browsing other tracks, while inaccessible defaults cannot be selected.

### Membership and ownership boundaries

Revoked membership, disabled workout tracking, another athlete's session, and inaccessible private workouts are rejected.

### Publication snapshots and explicit remix

Existing references retain their published snapshot after coach updates, while new stale imports fail and explicit remixes leave original programming untouched.

### Concurrent composition saves

Two racing first saves create only one personal session, and stale revisions cannot overwrite the winning composition.

### Private results preserve history

Personal score snapshots stay private and remain in athlete history after removal; recorded prescriptions cannot change under the same item identity.

### Mixed track result identity

A composed day retrieves unchanged source results from all included tracks using exact publication and block identities.

### Atomic library scoring

Rich round scores and their private association persist together; invalid input or a failed round write leaves no score, and repeated submission creates no duplicate.

### Library score linking boundaries

An athlete cannot attach another athlete's score even when workout identity and calendar date match.

### Remixes remain independent

A saved remix remains editable after its source is republished, and imported work performed on another date records a separate private result.

### Capped result edits preserve scoring

Editing capped and multi-round library results preserves or clears status, secondary reps, and round rows together, retaining the score identity and rejecting finish times above the cap.

### Capped input requires explicit reps

Capped scores require CAP+reps, including zero; ambiguous CAP, negative or fractional reps, and finish times beyond the cap are rejected.

### Round readers require authentication

Single and batch workout-set readers reject unauthenticated requests before accessing scores or round notes.

### Single round reads protect private associations

A private library association prevents another athlete from reading a score's rounds, while its owner can still read all saved set values and notes.

### Batch round reads isolate private associations

Mixed batch reads omit foreign private associations while retaining the caller's own linked scores and ordinary shared scores. Foreign round notes never enter the returned payload.

### Removed library results remain editable

Removing a logged library item and deleting its source workout retains the performed snapshot, scaling options, and private score editing, while stale revisions and other athletes are rejected.

### Earlier library links gain historical snapshots

Linking a score captures the complete library item, and an earlier association with no snapshot preserves its current session item before removal.

### Numeric scores require complete input

Count scores require whole numbers and rounds-reps scores require complete supported syntax. Numeric prefixes with trailing text are rejected in individual and round results, while valid time and load parsing remains unchanged.

### Rich private results retain their performed definition

Private canonical workout results persist every round and entered unit. Removing the workout preserves its performed definition and details in owner-only history without creating a shared source result.

### Multiple component consent

The component test cancels multiple additions without writes and verifies that a failed atomic save keeps the preview, performed date, and ordered component request available for retry.

### Provider snapshot and atomic additions

The real MySQL test persists capped time and multi-round load scores, checks revision and capacity rejection, and retains source identity after unfollowing and workout edits or removal.

Library details retain provider provenance alongside movement IDs, scaling group, and complete scoring metadata.


### Preview personal result persistence

The isolated track preview stores composed personal workouts and their private results together, validates revisions, and keeps history after removal. Rich library logging uses the production log route and real MySQL coverage, not this fixture.

### Preview result normalization

The preview reuses production result normalization for supported personal blocks, preserving completion display and rejecting invalid scores without recording them.

### Direct private attempts

Public workouts from another owner log once under concurrent retry, preserve lazy composition, and remain editable without planned-item insertion.

### Direct scoring preserves custom plans

Direct scores preserve an unrelated custom plan and its revision, reject inaccessible or forged sources, and roll invalid transactions back.

### Atomic section additions and undo

Append recognizes repeated source selections, supports deliberate repeats, rejects stale revisions and prevents undoing scored source work.

### Direct rich score units and tiebreaks

Private direct scores persist kilogram round values, tiebreak values and capped zero reps without official competition entries.

### Session action receipts

An add receipt keeps the inserted item identity after parent state refresh so Undo removes that exact item.

### Session retries preserve intent

A lost add response keeps stable request identity and direct score navigation performs no composition writes.

### Direct occurrence display

A saved score appears only on its exact source date and track, with an edit link to the stored attempt.

### Late additions preserve context

A late add response cannot update another day or leave the newly selected destination busy.

### Existing additions have no false undo

A deduplicated addition from another tab shows the existing item without claiming a new insertion or offering Undo for an unrelated identity.

### Session building browser journey

Desktop and mobile browser tests combine warm-up, scored work and cooldown sections, then switch source and personal surfaces in place without horizontal overflow.

### Keyboard builder cancellation

Cancelling a draft with keyboard leaves the original source intact, writes no composition and restores focus to the Customize trigger.

### Tiebreak input boundaries

Tiebreak scores reject trailing text, fractional reps, negatives and values outside the database integer range while accepting explicit zero.

### Destination loading clears stale revisions

Changing the destination disables Add until the new day is loaded, preventing an old day revision from leaking into a new workspace or date.

### Repeated provider workout occurrences

Appending a reused workout from separate published dates preserves both attributed occurrences. Retrying the same occurrence deduplicates it, and draft provenance rejects the complete mutation.

## Provider Source Snapshots

Confirmed provider additions use the existing rich library snapshot path and one composition revision for all selected components. Browsing and cancelling create no personal session.

Optional provenance contains the published import ID, source track ID/name, source date, and URL. [[apps/wodsmith-start/src/server/training-personal.ts#getTrainingLibraryWorkout]] resolves it from published import membership, never client claims. The performed date belongs to the personal session; the programmed date stays with the snapshot. Existing snapshots survive source changes, removal, and unfollowing within live workspace access rules.

Multiple components remain ordered, with independent full score metadata, caps, round counts, and aggregation. Capacity and optimistic revision checks reject the entire composition rather than adding a subset. Historical result snapshots retain the same provenance after removal from a session.

## Track and Personal Surfaces

Training opens the selected track in performance mode. My session is a separate optional composition; switching tracks never substitutes private items for another track's programming or saves a default.

Customize edits the existing private composition when one exists; otherwise it starts from the displayed day. Start empty, section selection, private editing, repeats, removal and ordering stay local until Save session. Cancel discards the draft; saving returns to the performance surface. Warm-ups, cooldowns and instructions use the original check/note kinds and source snapshots.

Source and personal surfaces retain track, date and workspace context in Training. Library and detail actions identify the destination, append selected work only, show a server-confirmed receipt, and offer Open session and revision-protected Undo. Undo rejects both personal results and exact published source results. Stable item identity protects retries; a separate repeat in the builder creates a new identity.

## Independent Direct Scores

A visible workout can record a private score without a remix, follow, or planned session item. The normal score form creates nothing until submission and preserves source date separately from performed date.

Direct library writes reuse the existing score-and-round transaction, storing a server-resolved performed snapshot and exact optional source occurrence. The day has compositionState=result_only until an explicit composition save. Existing days default to customized, including intentionally empty plans. Direct scores leave an existing custom plan, order and revision unchanged.

The additive generated migration `0007_material_champions.sql` adds composition_state to the canonical personal session table. Apply it before using the new APIs. Rich private scores retain entered weight units, rounds, capped zero reps and tiebreak values. Historical edit uses the saved snapshot without reinserting planned work. Progress includes the athlete's results across tracks and independent library attempts.

## Session UX Verification

Real disposable MySQL regressions cover direct result transactions and session mutations. Component regressions separately verify visible destinations, exact result identity, retries and navigation without claiming to prove database authorization.

### Direct score forms in the browser

The production new and edit forms preserve kg rounds, tiebreaks and notes, cancel without a write, and return to the source track. The isolated browser fixture records private attempts independently of custom composition.

Run `pnpm exec playwright test --config test/preview/training/playwright.session.config.ts` from `apps/wodsmith-start`. The dedicated harness starts an isolated preview on port 8778 and exercises desktop and 390px mobile; fixture tests stay outside production E2E discovery.

### Provider selection and attributed instructions

The builder can select provider workouts from another programmed date and save a user-chosen excerpt as an attributed private note, keeping undivided source prose readable without fabricating sections.

## Reviewed session identity and editing

Composition and scoring share exact occurrence identities without making composition a prerequisite for recording a result.

Normal Add or Customize reuses an owned performed item and its frozen snapshot; deliberate repeats remain separate. Legacy provider snapshots resolve missing occurrence metadata from saved provenance. New unscoped library items persist an explicit empty occurrence so provenance never implicitly scopes them. Stable append retries refresh a stale revision once, and out-of-order responses cannot replace newer day data. Undo receipts include only newly inserted, unscored identities.

Personal score normalization rejects incomplete time prefixes before persistence while retaining raw seconds, colon and period formats. Existing load forms decode to three decimal places and convert units through stored grams, preserving notes-only and unit-only edits. New source/workspace/date occurrences reset fields and attempt identity; recognized import handoffs retain notes. Source-origin planned logs return to their track, while My session logs return to performance mode.

See [[session-review-tests]] for focused reproduction and regression coverage. The migration lineage remains held as recorded in Plan 003; this review changes no canonical schema or migration artifacts.
