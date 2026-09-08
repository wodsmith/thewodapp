---
lat:
  require-code-mention: true
---
# Transfer integrity

Regression tests protect registration ownership, division-scoped results, waiver acknowledgements, and truthful recovery instructions during transfers.

## Exact score scope

Accepting a transfer clears the source user's scores and rounds for the competition's track workouts and exact division, including null. Retained scores, rounds, athletes, events and registrations remain intact.

## Scored division moves

Ordinary division changes reject existing results belonging to the registration's captain or teammates in the source division, leaving every related table unchanged.

## Unscored division moves

An unscored registration can move divisions, update its purchase, and clear heat assignments while leaving scores in retained divisions unchanged.

## Typed waiver signature

Acceptance persists the exact typed name with the accepting session user, registration, and timestamp, while preserving the source athlete's acknowledgement.

## Waiver validation boundaries

Blank or overlong names and waivers from another competition are rejected without registration or transfer mutations.

## Required transfer waivers

Required athlete waivers must be signed even when a caller bypasses the browser form.

## Existing recipient acknowledgement

The existing unique waiver/user record stores the latest recipient acknowledgement without duplicates or erasing its existing IP provenance. Replaying completed acceptance cannot change the signature or other registration state.

## Signature status privacy

Both apps' public user-status and authenticated registration-status endpoints exclude typed names, since these endpoints do not authorize access to signature text.

## Transfer registration ownership

Acceptance fails without side effects when the linked registration no longer belongs to the source athlete recorded on the transfer.

## Signature form payload

The transfer form requires a typed name and explicit agreement, and sends that exact name to the acceptance endpoint.

## Neutral invite recovery

The recovery page explains how to reopen the invitation and sign in if needed, without claiming it has verified the current account.

## Signature migration compatibility

The actual additive SQL migration preserves legacy waiver acknowledgements and initializes the new signature text to null.

## Concurrent score wins

A real MySQL writer holding the registration lock blocks a division move after committing a captain, teammate, or null-division result. The move preserves the winning result and source division.

## Concurrent division move wins

A real MySQL division move holding the registration lock causes a waiting score writer to reject the obsolete division, leaving the moved registration with no stale result.

## Stale submission snapshots

Canonical, manual, benchmark, legacy video-only, score API and video API writers reject a winning division move despite a pre-lock REPEATABLE READ snapshot, leaving no scores, rounds or video evidence behind.

## Reused workout competition identity

A canonical result command uses its explicit competition context when a workout is reused, for named and null divisions, preserving results and participation for distinct retained athletes and divisions.

## Ambiguous workout registration lock

An unbound workout linked to multiple competitions rejects instead of choosing an arbitrary registration, without any database mutation.

## Ambiguous shared score ownership

Writes and acceptance reject a shared athlete/workout/division tuple, including null, when another active, removed, historical team or transferred participation may own it. All registrations, scores, rounds and evidence remain unchanged.

## Concurrent first video submissions

Real concurrent API and legacy video submissions wait on the registration mutex, then update the current slot instead of inserting from stale absence. Production unique constraints preserve one score and video, and both calls return the same slot ID.

## Concurrent ambiguous writers

Two real MySQL writers in different competitions reject the same ambiguous named or null-division score tuple. Neither commits a score mutation or deadlocks while trying to select its preferred registration.
