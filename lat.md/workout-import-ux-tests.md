---
lat:
  require-code-mention: true
---
# Workout Import UX Tests

Focused interaction tests protect reviewed draft application and the user's unsaved work.

## Concurrent edits

Accepting selected proposal fields preserves fields manually edited during inference and leaves the immutable proposal unchanged.

## Undo preserves later edits

Undo restores accepted values only when those fields still match the accepted application, retaining subsequent user edits.

## Explicit asynchronous draft application

The editor accepts a controlled reviewed value after mount and submits workout cap seconds and separately recorded scores without losing movement or scoring fields.

## Manual edit and remix stability

Manual editing and remix initialization remain stable when loader data changes after the user has begun editing.

## Reviewed entitled save retries

A proposal cannot save until explicitly reviewed. Failed saves preserve manual edits and retry the same reviewed content with the same idempotency key.

## Revoked access preserves edits

Access loss disables reading, revisions, and AI creation while retaining the locally edited workout for recovery.

## Multiple scored parts

A source with multiple independent scores cannot be acknowledged into one saved workout; the user must request a proposal for the chosen part.

## Bounded image source

The browser rejects empty, unsupported, and oversize images before upload. Server byte validation remains authoritative.

## Keyboard image inspection

A labeled file picker, full-image link, and remove button make source inspection possible without drag-and-drop; local preview URLs are released on unmount.

## Log date and notes

Create-and-return selects the new workout in the existing log route, preserves date and notes, resets incompatible score inputs, and never calls result submission.

## Track alias placement

Both writable programming manager aliases use the same import adapter, retain the displayed destination, position and notes, and refresh only after creation succeeds without stacking dialogs.

## Locked entry makes no agent requests

A destination without AI access exposes an access-required entry and makes no socket, session, upload, or save request.

## Destination access race

A late entitled response for an old track cannot unlock the currently selected destination.

## Cancelled revision keeps editor

Cancellation expires the session and prevents its save, but keeps the user's manually edited workout and undo accessible while another proposal is requested.

## Selected part focus

Accepting a proposal requiring selection of an independently scored part focuses the correction field that can resolve that question.

## Removed source preview

Removing a restored or uploaded image hides its preview so a text-only source cannot be mistaken for the prior image.

## Save denial classification

Both HTTP/RPC access codes and direct server-save denial messages trigger access-required recovery rather than leaving the AI workspace enabled.
