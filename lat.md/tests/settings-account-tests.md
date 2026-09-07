---
lat:
  require-code-mention: true
---
# Settings Account Tests

These tests protect settings preferences and team-management affordances while preserving the existing server authorization boundaries.

## Theme survives reload

Selecting either theme persists the canonical local-storage key and SSR cookie. Running the real root startup script with an opposing system preference and remounting Appearance preserves the selection.

## Programming entitlement navigation

Rendering the Settings layout with and without workout-tracking entitlement shows Programming only when entitled, verifying the parent-to-sidebar connection.

## Invitation error recovery

A failed invitation request renders an alert; retrying reloads pending invitations and removes the error. A successful empty response remains a distinct state.

## Granular team action permissions

Invite, change-role, and remove capabilities independently control desktop and mobile actions. Personal teams and owner rows retain their protections, and unauthorized invitation reads are skipped.

## Accessible team navigation and cancellation

Team detail navigation and invitation cancellation expose purpose-specific accessible names, and cancelling still targets the correct invitation.

## Team name guidance

The creation form explains that names can be shared while URLs are unique and provides a named back link.

## Server-derived team capabilities

Team reads derive capabilities from actual custom-role permissions and preserve the site-admin bypass without exposing credit balances. Outsiders remain denied.

## Team mutation authorization remains enforced

Read-only callers cannot invite, change roles, or remove members; rejection precedes any write. Invalid team-read inputs are rejected before querying.
