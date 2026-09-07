# Personal Training

Athletes choose a durable default track and own a session only after composing their day. Published programming remains shared until an explicit change creates a private composition.

## Default and Ownership

A preference stores the selected default track per athlete and gym. Browsing a track, opening a day, and recording unchanged programming never create personal session rows.

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

## Provider Source Snapshots

Confirmed provider additions use the existing rich library snapshot path and one composition revision for all selected components. Browsing and cancelling create no personal session.

Optional provenance contains the published import ID, source track ID/name, source date, and URL. [[apps/wodsmith-start/src/server/training-personal.ts#getTrainingLibraryWorkout]] resolves it from published import membership, never client claims. The performed date belongs to the personal session; the programmed date stays with the snapshot. Existing snapshots survive source changes, removal, and unfollowing within live workspace access rules.

Multiple components remain ordered, with independent full score metadata, caps, round counts, and aggregation. Capacity and optimistic revision checks reject the entire composition rather than adding a subset. Historical result snapshots retain the same provenance after removal from a session.
