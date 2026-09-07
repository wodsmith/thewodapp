---
lat:
  require-code-mention: true
---
# Transfer integrity

Regression tests protect registration ownership, division-scoped results, waiver acknowledgements, and truthful recovery instructions during transfers.

## Exact score scope

Accepting a transfer clears only the source user's scores for that competition's track workouts and exact division, including null. Retained divisions, other athletes, other events, personal logs, and retained registrations remain intact.

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

The existing unique waiver/user record stores the latest recipient acknowledgement without duplicate rows. Replaying completed acceptance cannot change the signature or other registration state.

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
