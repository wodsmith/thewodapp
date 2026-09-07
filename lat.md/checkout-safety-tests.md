---
lat:
  require-code-mention: true
---
# Checkout Safety Tests

Regression specifications for checkout ownership, confirmation evidence, invitation return state, and competition-timezone parity.

## Cancel only the owned checkout

Cancelling one owned order expires its hosted session and releases its pending lines while preserving other sessions, accounts, competitions, and completed purchases.

## Reject foreign cancellation anchors

Foreign-account, wrong-competition, and missing purchase anchors cannot cancel any pending order or expire a hosted session.

## Cancellation validation and payment race

Missing scope and anonymous requests are rejected, and a Stripe expiration failure leaves reservations intact for payment settlement.

## Reject absent and unsuccessful purchases

Missing, pending, failed, cancelled, or completed purchases without active participation cannot confirm registration.

## Require the entire order

A completed registration mixed with a pending, failed, or cancelled line cannot claim that the entire checkout succeeded.

## Confirm fulfilled registration orders

A completed registration with its completed add-on confirms successfully and returns only its active registration ID.

## Do not substitute unrelated participation

Removed, foreign, other-session, other-competition, and add-on-only evidence cannot confirm this checkout.

## Completion authentication and validation

Completion checks require authentication and nonempty session and competition scope.

## Timeout does not confirm

After 60 unsuccessful polling attempts, the UI offers recovery rather than a success banner.

## Failed order recovery

An unsuccessful checkout shows recovery even when the account already has an unrelated registration.

## Confirmation requires loaded participation

Success requires a confirmed checkout registration to be loaded, and the polling request includes the current competition.

## Alternate success without proof

The alternate success page makes no successful-payment claim when the account has no registration.

## Alternate checkout uses shared confirmation

Alternate hosted-checkout returns redirect to the same session-scoped confirmation page before loading success details.

## Competition timezone boundaries

Display and submission guards agree at opening and closing midnight in Los Angeles and Auckland, including the Los Angeles daylight-saving transition.

## Preserve validated invitation return state

A closed-window authorized invite retains the correct token, division, and purchase anchor in its local cancel URL without query or fragment injection.

## Reject unauthorized invitation checkout

Invitations for a different account, competition, or division fail before creating a hosted checkout.

## Cancellation retry after expiry

An already expired hosted session safely releases its pending order, and subsequent cancellation attempts do not repeat Stripe calls.

## Retry and route changes preserve evidence

Checking again can confirm newly completed participation after a timeout. Switching sessions discards prior success, while a sessionless existing registration remains visible.

## Missing loaded registration stays unconfirmed

The confirmation banner stays hidden until the active registration proved by the checkout is also present in the page's loaded participation.
