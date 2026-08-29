---
lat:
  require-code-mention: true
---

# Workout-result Adapter Characterization

These tests freeze context-specific competition write semantics while adapters move through the shared workout-result module.

## Video ignores declared CAP below threshold

Video score entry derives CAP from the encoded time and ignores a client CAP declaration when a single-round result is below the configured threshold.

## Video single-round CAP clamp

A video result at or above the time cap is clamped to the cap and stores a valid non-negative secondary reps value.

## Video multi-round CAP inference

Multi-round video entry preserves the aggregate while deriving per-round CAP statuses and parent CAP from the configured threshold.

## Video strict score validation

Video entry rejects invalid primary, round, and tiebreak score formats instead of silently persisting partial or null encodings.

## Video persistence stays non-transactional

Video score upsert, exact nullable-division lookup, and round replacement preserve their historical operation order without introducing a transaction around the video lifecycle.

## Athlete explicit CAP contract

Athlete self-entry trusts an explicit CAP declaration, clamps the primary value, and persists valid secondary and tiebreak encodings even when the entered time is below the cap.

## Athlete invalid tiebreak compatibility

Athlete self-entry currently accepts an invalid tiebreak and persists its null encoding rather than rejecting the submission.

## Verification direct override retains stale rounds

A verification adjustment without new round inputs preserves existing round rows, retains their CAP count for sorting, and does not clamp an explicit CAP direct override.

## Manual entry explicit CAP and audit transaction

Reviewer manual entry trusts explicit single-round CAP, silently discards an invalid tiebreak, and atomically writes the score, audit record, and video review update.

## Mobile score HTTP auth and validation

The mobile score route retains bearer-or-cookie authentication plus its exact invalid JSON, invalid request, and registration error envelopes.

## Mobile score nullable-division readback

The mobile score route stores the registration division, while a null division currently leaves its post-upsert score-id readback unscoped by division.

## Mobile score explicit CAP and tiebreak

Mobile score entry trusts explicit CAP, clamps time-with-cap values, accepts non-negative secondary reps, and stores a null encoding for an invalid tiebreak.

## Mobile score non-transactional response

Mobile score entry upserts before reading the score id without a transaction and returns the established success envelope.

## Mobile video HTTP auth validation and registration

The mobile video route retains bearer-or-cookie authentication, request validation, and its missing or ambiguous registration responses.

## Mobile video score compatibility

Mobile video entry preserves explicit below-threshold CAP, ignores secondary reps in that case, stores invalid tiebreak as null, and carries a null division.

## Mobile video lifecycle precedes score validation

The mobile video lifecycle persists before optional score validation, so an invalid claimed score can return an error after the video write succeeds.

## Mobile video non-atomic response

Mobile video and optional score writes remain ordered and non-transactional while the route preserves its success response shape.

## Judge HTTP auth authorization and validation

The judge route retains bearer-or-cookie authentication, supplied-team membership authorization, site-admin bypass, and request error envelopes.

## Judge trusts workout and athlete targets

Judge entry trusts supplied workout metadata and athlete targeting, maps inactive statuses, and reads null-division scores with an exact null predicate.

## Judge multi-round CAP and tiebreak

Judge entry aggregates rounds, derives parent and per-round CAP status, rejects partial invalid rounds, and preserves compatible tiebreak encoding.

## Judge score-round transaction and stale rounds

Judge entry atomically upserts and reads the score before replacing supplied rounds, but leaves existing rounds untouched when no rounds are supplied.
