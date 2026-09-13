---
lat:
  require-code-mention: true
---
# Organizer Recovery

Organizer saves distinguish committed data from later setup or acknowledgement failures. Shared controls preserve authored URLs, validate integer capacities, and display competition time.

## Custom slugs

Competition and series creation generate slugs only while the URL remains untouched. Subsequent name edits preserve a custom slug; editing an existing competition never silently changes its URL.

## Partial template setup

Competition creation reports which selected template steps failed, continues independent steps, and offers navigation to the created competition for review. Refresh failures cannot turn a committed creation into a failed-creation report.

## Integer capacities

Default division and total competition capacities accept positive integers or blank for unlimited. Fractional values display an accessible field error and cannot reach either organizer or cohost save callbacks.

## Competition heat times

The shared heat publishing card receives the competition timezone from organizer and cohost routes. Scheduled times include the applicable daylight or standard timezone abbreviation regardless of the viewer's timezone.

## Clipboard recovery

Failed cohost invite clipboard writes show a failure message and a retry action for the same link. Successful writes show confirmation only after clipboard completion.

## Draft acknowledgement recovery

After saving AI drafts, the page refreshes even if agent acknowledgement fails and identifies the partial success. A retry reconciles proposal status safely; a failed write never acknowledges proposals as accepted.

## Idempotent proposal persistence

AI draft identities include competition, event, proposal ID and rotation definition. Replays add no duplicates; later runs may reuse short IDs for distinct rotations. Scope, entitlement, roster, lane and overlap checks still apply to new writes.

Retry responses include only the requested proposals, while unrelated saved rotations stay unchanged.
