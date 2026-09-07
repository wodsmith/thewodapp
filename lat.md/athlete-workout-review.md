# Athlete Workout Review

Personal sessions support complete workout authoring alongside instructions and completion sections. Score summaries describe the prescription, while entry forms explain how to record results.

The personal session delegates canonical fields to [[apps/wodsmith-start/src/components/training/personal-workout-definition.tsx#PersonalWorkoutDefinition]], which loads athlete catalogs and renders the shared workout-definition component. The consumer regression guard verifies both relationships.

## Authoring and Score Clarity

Athletes can select movements and permitted scaling groups using a training-authorized catalog. Failed catalog reads preserve edits and offer retry; new unscored sections remain private and are created only when saved.

Canonical workout schemes cover time, load, and reps without creating new legacy scored sections. Existing legacy blocks retain their score format. First and last aggregation have readable labels; summary cap durations omit entry instructions. Missing capped reps are caught before a network save and focus the required field, including when the valid count is zero.

## Verification

Focused athlete component regressions cover preserved capabilities, readable metadata, catalog recovery, and pre-submit validation.

### Readable score summaries

Session cards display first or last recorded score labels and a cap duration without prompting completed athletes to enter a result; dialogs use the same aggregation labels.

### Capped reps validate before saving

An empty capped rep count stops submission and focuses that field. Entering zero records a valid capped result.

### Unscored sections remain available

Athletes can create instructions or completion sections without saving a personal composition until they explicitly submit the section.

### Athletes assign catalogs with recovery

A catalog failure preserves typed workout details, retry loads the athlete's gym options, and saving persists the chosen movement and scaling group.

## Reviewed Import Compatibility

Personal sessions offer reviewed import alongside canonical manual creation and unscored sections. Imported workouts require explicit composition confirmation, preserving the chosen gym, date and track context.

An open import participates in the session navigation guard; stale or cancelled handoffs cannot add to another day. Standalone component previews show an unavailable import action because they do not connect to the authenticated service. Production import behavior is covered by [[workout-import-ux-tests#Workout Import UX Tests#Personal session import confirmation]].
