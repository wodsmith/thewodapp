---
lat:
  require-code-mention: true
---
# Session Review Tests

Regression specifications for validated PR review findings in the optional session builder, direct score identity and private history. Each test reproduces a concrete user-visible or persistence failure.

## Strict personal time inputs

Personal primary and tiebreak time values reject trailing text and malformed separators before normalization, preventing a valid numeric prefix from becoming a stored score.

## Supported personal time formats

Strict validation preserves existing colon, decimal-second, period-delimited and raw-second formats with millisecond precision for primary and tiebreak values.

## Source dates require a track

Every public library or direct-score input rejects a programmed date without its source track, including library items inside composition saves.

## Included occurrences use the planned score identity

Logging an already included occurrence targets its personal session, item and revision, and its saved result supplies the exact edit link instead of an unrelated attempt.

## Legacy provider snapshots remain included

Legacy provider provenance identifies an existing occurrence when occurrence metadata is absent, while an explicitly empty occurrence stays unscoped.

## Uncontrolled destination changes discard stale data

An uncontrolled workout action clears the previous day during a new destination read, preventing writes with stale revisions and misleading saved-score links.

## Customize preserves an existing cross-track composition

Opening Customize from a different source track preserves the existing personal plan; only explicit replacement or Start empty can discard its contents.

## Repeated add-all cannot undo previous work

A repeated Add all action leaves existing items unchanged and does not create an Undo receipt that can remove the earlier composition.

## Planned provider scores save in the browser

A first score for an included provider workout saves through the real form and remains editable from its source occurrence.

## Editing weight units preserves exact stored loads

Notes-only edits and unit conversions preserve the same gram values for every fractional load round.

## Concurrent additions retain both intents

An append that races another row refreshes its revision and retries the same identity without replacing earlier work.

## New workout inputs reset without leaking notes

Changing to another workout or occurrence clears inputs and creates a new attempt identity; recognized import handoffs preserve their notes.

## Composing after logging preserves score identity

Normal Add and Customize reuse a matching owned score identity; explicit repeats remain new and scored work cannot be undone.

## Owned history survives source revocation safely

Workspace members retain their own performed snapshots after source revocation without live source metadata or cheers; other users and revoked workspace members cannot read them.

## Browser Back restores absent training context

Back restores missing track, date and workspace parameters to the current default and gym-local day instead of retaining the departed destination.

## Library retry does not retain an old destination

Changing destination after retry clears the previous day immediately, preventing writes with its stale revision.

## Library row receipts survive parent updates

Rapid additions from separate rows retain both items and their receipts even when committed responses arrive out of order.

## Legacy provider identity persists without rescoping library work

Legacy snapshots deduplicate by provider provenance while new unscoped library items retain an explicit empty occurrence and remain separate.

## History retains explicit occurrence without provider metadata

History retains the saved source date and track identity from an explicit occurrence even without optional provider metadata.

## My session edits a previously performed occurrence

A normally composed item reuses its existing performed score in My session and returns to that performance surface after editing.
