---
lat:
  require-code-mention: true
---
# Training Correctness Tests

Programming dialogs preserve user intent through failures, refreshes, and paginated library selection.

## Explicit description clearing

Editing a nonempty description to empty submits an explicit empty string. Omitted fields retain their existing values; the server stores the cleared description as null.

## Create failure retains input

Track creation displays a request error and keeps entered values available for correction and retry. Only successful persistence invokes the refresh callback.

## Edit failure retains input

Track editing displays a request error without discarding pending changes, so a failed save cannot appear successful.

## Refreshed track heading

A refreshed track name and description render immediately and become the next editor defaults. Local visibility feedback does not cache the entire track record.

## Successful add cannot repeat

Adding a workout locks the operation synchronously until the success delay closes the dialog. A second click cannot create a duplicate insertion; closing or unmounting cannot leave an obsolete close timer.

## Track picker reaches later pages

The track picker incrementally loads the server's paginated accessible library, allowing a workout beyond the first hundred to be selected while retaining previously loaded options.

## Failed add can retry

A failed track addition releases its submission lock and retains the chosen workout, order, and notes for retry.

## Failed page load can retry

A failed library page displays an error and retries that page while retaining already loaded workouts. A transient read failure does not look like an empty library.
