# Workout Authoring

Compete and training share workout definition controls so a workout keeps the same field language and scoring meaning across authoring contexts.

## Library creation browser flow

New library workouts start with one description field. Jev recognizes the definition before the existing authorized create operation opens the saved workout detail page.

Existing workout editing and controlled import review retain accessible structured controls. New descriptions can include titles, movements, scoring, and named scaling variants. Remix creation seeds the description with the source title and prescription.

## Canonical organizer flow

Compete's event creation dialog supplies the initial definition; the event details editor supplies the fuller editing reference, including descriptions and scoring conditions.

The organizer enters through `/compete/organizer/$competitionId/events`, chooses Create event, and uses [[apps/wodsmith-start/src/components/events/create-event-dialog.tsx#CreateEventDialog]]. Existing events open [[apps/wodsmith-start/src/components/events/event-details-form.tsx#EventDetailsForm]] at `/compete/organizer/$competitionId/events/$eventId`.

The compact dialog is not the entire authoring contract. Reuse must account for the full definition rather than copying whichever fields happen to be visible in an initial step. [[domain#Domain Model#Workouts]] describes the shared content model.

## Shared field boundary

A controlled field group owns workout identity, prescription, and scoring controls. Consumers own the surrounding workflow and adapt values without changing their meaning.

`apps/wodsmith-start/src/components/workouts/workout-definition-fields.tsx` is the production reuse boundary for Compete and training authoring. Shared controls govern labels, options, help and error associations, conditional fields, and displayed units. Time caps retain seconds in the domain even when a control presents minutes.

Consumers retain form submission, dialog state, routing, authorization, and context-specific settings. Competition divisions and points, coach gym/track/date selection, and athlete private ownership remain outside the field group. Shared fields must not create sessions or perform writes merely by rendering or editing local state.

Existing library forms also serve controlled AI import review. Reuse must preserve controlled values, unique field IDs, and import field hooks; see [[workout-import-integration#Workout Import Integration#Review and commit boundary]].

## Scoring fidelity

Shared authoring preserves the complete scoring definition. A context must support its selected scheme end to end or make the unsupported choice unavailable with a clear explanation.

Canonical workout schemes and training completion or instruction sections serve different purposes. Reusing controls must not translate rich rounds, caps, or tiebreaks into a simpler result kind that loses information. Changing presentation does not authorize changing source ownership or the performed result snapshot; see [[training-personal#Personal Training]].

## Consumer regression guard

A scoped source test verifies that the named Compete and training authoring consumers import and render the shared field group, preventing an accidental return to separate field implementations.

The guard covers the library workout form, event creation, event details, the coach workout dialog, and personal workout editing. It also verifies that the coach planner renders the workout dialog. It parses TSX so comments or an unused import do not satisfy the boundary. It permits context-specific controls and does not impose a blanket string ban or full-page snapshot.

This guard protects reuse, not runtime behavior. Consumer interaction tests must still cover values reaching submission, supported scoring choices, and context-specific validation. Shared behavior changes also require checking representative Compete and programming layouts, including mobile.

## Failed event creation retains entries

Organizer, cohost, and series creation failures preserve the open dialog's entered definition for correction and retry. Callers keep their existing toast and propagate the failure to the dialog.

The dialog resets its local definition only after successful creation or explicit dismissal. Tests exercise the real parent callback and dialog together, including cohost mutation overrides, so a swallowed callback error cannot look like a successful save.

### Refresh failure after creation

A failed series refresh after persistence does not turn successful creation into a retryable create failure. The closed dialog resets before the next event is authored, avoiding stale entries and duplicate creation.

## Programmer workflow regressions

Opening the full workout editor preserves existing instructions and scoring. Unsaved field changes block navigation before they enter the session draft, and completed edits retain the section's removal and capacity controls.

Shared-field interaction tests cover cap minute-to-second conversion, scheme defaults, import corrections, accessible movement selection, validation associations, and caller-specific null aggregation support. The coach dialog retains edits after catalog failures and confirms discard.

The local component preview at `/training/programming` includes the programmer editor; `/compete-reference` renders the real Compete creation dialog with illustrative data. Desktop and 390px phone checks verify responsive fields without horizontal overflow. These fixture routes are not production routes.

## Scheme changes use canonical defaults

Changing a workout scheme uses the scoring domain's default aggregation. Selecting Pass/Fail chooses the first recorded score and clears a previous tiebreak and cap before their controls disappear.

The shared-field regression switches a capped multi-score workout to Pass/Fail and verifies the resulting values and visible controls together. Round count remains an explicit authoring choice.

## Existing event scoring choices

Changing a competition event’s scheme preserves an explicit aggregation, defaults an unset aggregation, and still accepts direct score-type changes.

## Accessible authoring and previews

Shared controls expose movement validation and edit behavior accessibly. Coach and athlete previews use the same readable workout summary, including legacy scheme fallbacks.

Movement import errors focus a labeled movement group. Workout edit buttons announce dialogs; instruction editors retain inline expansion semantics. Coach previews display scheme labels and minutes:seconds caps.

## Description inference

New workouts use Jev to select typed scoring values, catalog movements, and source text spans. Uncertain definitions require clarification in the same description field before any save.

[[apps/wodsmith-start/src/server/workout-description-inference.ts#inferWorkoutDescription]] supplies the full scoring scheme set, explicit aggregation and score-count questions, source duration candidates, and per-movement judgments. Prescription rounds differ from separately recorded scores; time caps remain seconds. Titles are selected from source candidates; untitled prescriptions receive a deterministic scheme label.

Competition descriptions first classify the number and boundaries of independently scored parts. A multi-part description becomes one scheduling parent with ordered, independently classified scored sub-events; it is never flattened into rounds of one scoring scheme. Transition text separates adjacent spoken parts, and the full-source scheme judgment disambiguates a time-limited lifting window from a for-time cap.

Scaling descriptions combine shared source instructions with lines explicitly assigned to each existing level. Jev receives all destination level names and IDs; source text cannot invent levels. Single-paragraph named variants are segmented before classification. Requests use bounded batches, bounded retries, and an overall timeout. No API key or raw source text is logged or sent to browser code.

The TypeSafe API guarantees structured types, not semantic correctness. Mocked tests verify the application contract; optional answers with low confidence are ignored when their branch is unused. Live accuracy and latency require a configured `TYPESAFE_API_KEY` and representative workout evaluation. New ordinary creation uses ordinary destination authorization, independently of the separately entitled image/import-session workflow.

## Description creation lifecycle

Library, organizer/cohost events, series templates, coach workouts, and personal workouts share one description form.

An explicit submit recognizes the workout, then invokes the consumer's save or draft operation. Competition multipart results create their scored leaves and group them beneath one parent event.

[[apps/wodsmith-start/src/components/workouts/description-workout-form.tsx#DescriptionWorkoutForm]] renders the shared definition component in description mode. The surrounding consumer retains routing, dialog dismissal, private ownership, track selection, and save behavior. Busy submissions prevent duplicate clicks; failures preserve source text. Save retries reuse the same recognized definition; changing the text or destination invalidates that cached definition.

Crew workout shells remain outside this lifecycle. They are scheduling-only heat groupings with no authored scoring, movements, or scaling contract; [[crew#Workout Shells]] owns that deliberately minimal workflow.

The scoped boundary guard covers the description form and its consumers. Interaction tests cover cap/scoring/movement/scaling adapters, failed recognition, failed saves, and personal session draft semantics. The organizer browser regression creates its event through the description field and verifies all persisted event rows without coupling persistence to a model-selected title. Existing structured edit and import field hooks remain covered separately. Changing a scaling group clears its previous level assignments while retaining the source prescription.

## Authoring access and scaling isolation

Recognition resolves the destination's catalog on the server after authorization. Saving revalidates movement and scaling references so inferred IDs cannot cross team or division boundaries.

[[apps/wodsmith-start/src/server/workout-authoring.ts#getWorkoutAuthoringCatalog]] checks library write permission, personal training access, coach programming access, organizer or cohost event permission, or series programming permission. Competition and series settings supply their division group; training uses the team's stored default group. Foreign or stale group references fail before inference.

Library creation saves scaling descriptions alongside the workout and movements in its transaction. Competition and series creation persist cap seconds and scaling prescriptions with their event. Training stores the same optional scaling prescriptions in its canonical workout snapshot and validates their level membership when saving a draft. Event saves reject a group that no longer matches the destination divisions.
