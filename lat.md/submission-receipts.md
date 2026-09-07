---
lat:
  require-code-mention: true
---
# Submission Receipts

Online submission forms save complete team evidence with one shared score and display the server's accepted result. Validation failures and database errors leave no partial team submission.

[[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#submitVideoFn]] supports complete `videos` batches while retaining legacy single-slot requests. Batch indices must cover exactly the division's team size; ownership, captain, and window checks precede writes. The canonical score service validates every score, cap, round, and tiebreak before evidence writes in the shared transaction.

The returned score is read with its ordered rounds inside the committing transaction and scoped to the exact athlete, event, and division. Benchmark receipts read the retained best result when an attempt does not replace it. Existing review-reset and audit-log retention behavior remains unchanged; immutable general submission history across competition, gym training, and personal results is a separate proposed design in `docs/adr/0015-score-submission-history-proposal.md`.

## Success uses accepted values

The success preview displays server-accepted normalized values, status, secondary score, tiebreak, and rounds instead of reconstructing the persisted result from editable input.

## Team form sends one batch

The team form sends all evidence slots and its shared claim in one request so a later slot cannot fail after an earlier request has already committed.

## Rejected batch retains draft

A rejected team submission displays its error and retains the score and video draft without showing a successful receipt.

## Team validation preserves all state

Invalid URLs, repeated or out-of-range indices, incomplete evidence, malformed rounds, and invalid tiebreaks reject the whole team submission without changing stored evidence, scores, rounds, or reviews.

## Team write failure rolls back

A database failure on the second team video restores the first video, shared score, rounds, and reviews; a valid retry commits every slot and returns the normalized round result.

## Receipt matches persisted cap

A single-round capped submission returns the actual persisted cap, status, secondary score, and tiebreak, with no stale rounds left over from a previous multi-round result.

## Batch authorization boundaries

Anonymous, unregistered, and closed-window batch requests fail before score or evidence writes, using the same authorization checks as individual submissions.

## Validation precedes evidence writes

Malformed tiebreak input is rejected before an evidence update is attempted, even when a database trigger would reject that update.

## Ordinary scores retain values

An ordinary below-cap result keeps its accepted time and status; the receipt and writes remain scoped to its exact division without altering another division's result.

## Benchmark receipt retains best

An accepted worse benchmark attempt returns the retained current best score and preserves its existing score and video review state.
