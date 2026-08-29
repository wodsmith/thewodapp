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
