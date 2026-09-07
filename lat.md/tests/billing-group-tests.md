---
lat:
  require-code-mention: true
---
# Billing Group Tests

These regression tests ensure grouped invoice status represents every purchase without changing recorded monetary or provider semantics.

## Mixed invoice list

A completed purchase grouped with pending, failed, refunded, or cancelled purchases displays Mixed status in either order, preserves the USD total, and links to a stable representative purchase.

## Status permutations

All 125 three-item combinations of completed, pending, refunded, cancelled, and failed states produce the same aggregate in every permutation. Only homogeneous groups retain an individual state.

## Stable grouping and gross amounts

Session boundaries and standalone purchases remain distinct, links and ordering are deterministic, input arrays stay unchanged, and every recorded amount and provider reference is retained, including zero and refunded values.

## Invoice detail group agreement

Invoice detail returns the aggregate state and individual item states without changing gross totals, fee breakdowns, coupon handling, payment-intent lookup, or receipt information.

## Invoice ownership boundary

Target and sibling queries retain their authenticated-owner filters. Missing or inaccessible targets return no invoice and never query siblings or Stripe; standalone provider failures preserve usable invoice data.

## Detail and PDF status visibility

Invoice detail and PDF content display the aggregate mixed state, each item's actual state, and the unchanged invoice total.
