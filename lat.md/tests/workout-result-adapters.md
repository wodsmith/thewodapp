---
lat:
  require-code-mention: true
---

# Workout-result Adapter Characterization

These tests retain behavior that belongs to personal training logs, submission review, or the legacy mobile score route rather than the competition command core.

## Mobile score HTTP auth and validation

The mobile score route retains bearer-or-cookie authentication plus its exact invalid JSON, invalid request, and registration error envelopes.

## Mobile score nullable-division readback

The mobile score route stores the registration division, while a null division currently leaves its post-upsert score-id readback unscoped by division.

## Mobile score explicit CAP and tiebreak

Mobile score entry trusts explicit CAP, clamps time-with-cap values, accepts non-negative secondary reps, and stores a null encoding for an invalid tiebreak.

## Mobile score non-transactional response

Mobile score entry upserts before reading the score id without a transaction and returns the established success envelope.

## Personal padded sort-key storage

Personal normalization emits the shared 38-digit sort-key representation so textual database ordering matches numeric ordering.

## Personal strict round validation

Personal submit and update reject a multi-round result when any supplied round cannot be encoded before persistence begins.

## Review invalidation ordering

Invalidating a reviewed result stores the null-value worst-place sort key so leaderboard fallbacks cannot rank the zeroed score first.

## Review complete round replacement

A review adjustment may replace rounds only with a unique, contiguous, complete restatement of the existing round breakdown.

## Manual review strict score validation

Manual review entry rejects a malformed non-empty primary score, including when the client explicitly declares CAP.
