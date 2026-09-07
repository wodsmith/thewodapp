---
lat:
  require-code-mention: true
---
# Training Display Tests

Training views preserve stored calendar dates and second-based caps, and distinguish remix read failures from an empty result.

## Log date display preserves calendar label

Log history formats the stored UTC calendar label without converting it to the viewer's timezone. A September 7 result remains September 7 west and east of UTC.

## Calendar groups by stored day

The calendar maps UTC date labels into local widget dates for selection and markers. Selecting September 7 shows its results even when UTC midnight falls on September 6 locally.

## Caps display minutes and seconds

Workout detail and row previews convert cap seconds to the scoring library's duration format. Subminute and partial-minute caps remain precise instead of being mislabeled as minutes.

## Workout score dates preserve calendar label

Score cards on workout detail use the same stored calendar label as history and the log editor.

## Remix failure and retry

Expanding remixes triggers one request, immediately opens loading feedback, and displays a retryable error on failure. A successful list remains cached across subsequent toggles.

## New occurrence resets scoring inputs

Switching personal workout occurrences resets scaling to the new prescription, restores Rx, and renders exactly its prescribed round count. Submitting sends only the new occurrence's score values.

## Current cap and round policy

The shared personal-library normalizer rejects finish times above the cap, ambiguous CAP input, and incomplete rounds. Exact-cap finish times and explicit CAP+0 retain distinct scored and capped meanings.

## Library search reaches server pagination

The workout library loader sends search text and pagination to the accessible server query, ensuring search is not restricted to an already loaded page.

## Validated history return destinations

The log editor accepts originating log and training routes while rejecting external, protocol-relative, and disguised redirect targets.

## Legacy scheduling preserves selected day

Old schedule links redirect into training with the original calendar date string. They neither convert local midnight into an ISO timestamp nor perform a scheduling write.
