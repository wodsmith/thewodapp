# Workout Import Workspace

Workout import adds reviewed creation to the library, programming tracks, and result logging while retaining their manual flows. AI access and saving use the destination's dedicated entitlement.

## Review and undo

Immutable proposals require explicit field acceptance. A three-way comparison preserves manual edits made during inference; undo restores only applied fields that have not since been edited.

[[apps/wodsmith-start/src/components/workout-import/review-state.ts#applyReviewedFields]] compares the current editor against the request baseline. The agent's proposal is never changed by local editing or acceptance.

## Destination and source

The import dialog accepts text or one PNG, JPEG, or WebP up to 10 MiB. It displays the server-resolved destination and requires a valid reviewed draft before creating any workout.

[[apps/wodsmith-start/src/components/workout-import/workout-import-workspace.tsx#WorkoutImportWorkspace]] keeps source inspection and editable scoring together. Caps remain seconds; separately recorded scores remain distinct from prescription rounds. Multiple independently scored parts require a new proposal selecting one part. The shared [[apps/wodsmith-start/src/components/workout-form.tsx#WorkoutForm]] accepts an explicit controlled editor without resetting manual edit/remix initialization.

## Access and completion

Access checks resolve the personal team or track owner before allocating sessions or uploads. Every AI completion calls the dedicated entitled save endpoint, including manual corrections and idempotent retries.

Library entry points return to workout detail. Both writable track managers use [[apps/wodsmith-start/src/components/add-workout-to-track-dialog.tsx#AddWorkoutToTrackDialog]] and preserve position and notes for atomic creation. Logging appends the created library workout to the current personal day with the existing composition API, then selects that private occurrence with its session, item, gym, date, and revision. The session date and unsaved notes are retained while score/scaling reset. A fresh day read preserves concurrent additions; the save uses its optimistic revision and retries reuse the same item ID. Legacy workout-only logging links still redirect to Training. Creation never logs a result, schedules a workout, or publishes a track.

## Recovery

An opaque session ID stored per actor and destination permits an authorized snapshot reload when reopening. Images and pasted text are never stored in URLs or browser persistence by the importer.

Access loss unmounts the connection and disables AI reads, revisions, and saves while retaining the local editor. A fresh access check permits reconnecting. Safe cancellation expires the session. Reading a source again creates a fresh session at revision zero; corrections revise the current session. Local edits remain visible throughout. Uncertain saves retry the same reviewed content with the same key. Server authorization remains authoritative at every operation.

## Request recovery boundaries

Only one read or revision can reserve a request ID at a time. Cancellation invalidates pending setup, socket waits, and uploads before inference; late-created sessions are cancelled safely.

Transient access-check failures preserve the last confirmed entitlement but block new operations until a fresh check succeeds. Initial failures offer a retry. Invalid image replacements clear the prior active file. Locked entry buttons grow for wrapped labels. The isolated browser fixture resolves paths relative to its configuration file.

## Track manager visibility

The settings track page shows add-workout actions only when a fresh owner-team management check succeeds. Subscription access alone never grants composition writes; mutations retain their own authorization checks.

## Managed source tracks

The managed CrossFit source track uses its administrator-only manual append contract with server-assigned order. AI creation remains available on ordinary editable tracks and is hidden for this managed source.

## Session creation

Personal and coach session composers offer AI import using the personal team's entitlement. The selected gym, date, and track remain the session destination; importing never logs results or publishes a session.

[[apps/wodsmith-start/src/components/training/athlete-personal-session.tsx#AthletePersonalSession]] queues the saved workout in the existing library preview and requires an explicit **Add to my session**. Composition stores a library reference, preserving caps, separately recorded scores, and tiebreaks. An open manual workout editor keeps its own save/discard flow.

[[apps/wodsmith-start/src/components/training/coach-planner.tsx#CoachDayEditor]] appends a supported imported workout to the unsaved draft through [[apps/wodsmith-start/src/lib/training/library-block.ts#libraryWorkoutToBlock]]. Unsupported scoring is rejected visibly while the saved workout remains in the library. Existing draft content survives import and cancellation, and the 20-section limit still applies.

The shared [[apps/wodsmith-start/src/components/workout-import/workout-import-entry.tsx#WorkoutImportEntry]] reports dialog state so session navigation stays locked during import. Closing or unmounting aborts its handoff signal. Session callbacks also check captured context after asynchronous work, preventing late saves from attaching to a different gym, day, or track. Handoff errors remain visible in the dialog.

## Import wording

Entry buttons and dialog titles say **Import workout**, using an import icon and source-oriented access and error messages. The source input retains its factual disclosure about AI processing of text and images.

The admin entitlement picker displays **Workout import** for existing `ai_workout_import` catalog rows, including grant messages. Machine identifiers, grants, and historical migrations stay stable; fresh seed data uses the same display name.
