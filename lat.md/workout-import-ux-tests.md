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

Create-and-return appends the saved workout to the current personal day using its latest revision, navigates to its private occurrence, preserves session date and notes, resets score/scaling, and never submits a result.

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

## Fresh source session

Reading a source again safely cancels its prior session and begins a fresh import at revision zero, matching the backend's immutable-source contract.

## Cancellation is not revocation

A source-expired socket close prompts a fresh source session; an access-required close revokes the UI's active AI controls. Safe cancellation must not falsely mark destination access as denied.

## Personal attachment retry

A lost composition-save response can retry the import receipt without appending a duplicate personal occurrence or logging a result.

## Personal attachment conflict

A rejected composition save retains the current score and notes, does not navigate, and never submits a result.

## Legacy log handoff

Workout-only logging links still redirect to Training for explicit session composition and do not create a session or result while loading.

## Expired session restoration

Restoring an expired session clears its destination storage entry and server snapshot. Reopening can begin a fresh source read without manual browser-storage cleanup or a false access lock.

## Denied session restoration

A revoked or unowned stored session still locks AI actions and cannot start new generation through the expiry recovery path.

## Cancel pending source operations

Cancelling during session creation, socket readiness, or upload prevents a later inference call and safely cancels any session returned after the user's cancellation.

## Duplicate read request identity

Repeated clicks before rendering dispatch only one read or revision and preserve its request ID so the resulting proposal remains reviewable.

## Invalid image replacement

An invalid replacement clears the active image and preview instead of silently submitting the previous screenshot.

## Transient access recovery

A failed background access check retains the last confirmed result, reports a connection error, and recovers on the next check; a definitive denial still removes access.

## Initial access retry

An initial network failure offers a retry without opening an agent or presenting it as an entitlement denial.

## Access check failure blocks operations

A failed access recheck blocks session allocation and inference without falsely marking the previously entitled destination as revoked.

## Subscriber track action

Subscribed tracks without current owner-team management permission hide both manual and AI add-workout entry points.

## Track management capability

Track reads check management permission against the current owner team, preserve read-only access on denial, and propagate unexpected failures rather than reporting false permission results.

## Managed track append

The managed CrossFit source track hides explicit order and AI creation, submitting existing-workout additions through its server-assigned append contract.
