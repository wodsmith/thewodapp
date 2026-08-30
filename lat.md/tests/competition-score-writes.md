---
lat:
  require-code-mention: true
---

# Competition Score Write Characterization

These tests freeze the current Compete organizer score-write contract before the persistence path is refactored.

## Single-round score and tiebreak encoding

A single time result is encoded in milliseconds, while a time tiebreak is encoded independently and included in the persisted sort key.

## Single-round explicit CAP and invalid tiebreak

An explicit single-round time-cap result is clamped to the configured cap with its parent secondary value, while an invalid tiebreak is silently stored as null.

## Multi-round aggregate and inferred CAP

Multi-round results aggregate encoded rounds by score type, infer CAP when a round meets or exceeds the shared cap, and bit-pack the capped-round count into the sort key.

## Unsupported multi-round CAP fields are stripped

The current write schema strips per-round CAP fields and the handler overrides a non-terminal parent CAP declaration when all encoded rounds are below the inferred threshold.

This intentionally characterizes a divergence from ADR-0010, which chose explicit per-round CAP state and rejected inference from encoded time.

## Division-scoped score lookup

After upsert, a non-null division is part of the lookup that resolves the score row whose rounds will be replaced.

## Null-division score lookup

A null division uses `IS NULL` as its own scope rather than acting as a wildcard across an athlete's division-specific scores.

## Atomic score and round replacement

The score upsert, score-id lookup, old-round deletion, and new-round insertion share one transaction, so a round insertion failure rolls the unit back.

## Single-value overwrite retains prior rounds

When an existing multi-round score is saved without `roundScores`, the current path updates the parent score but does not delete the prior round rows.

This is a known characterization for the refactor rather than the desired replacement contract.

## Invalid round rejects the write

If any supplied round fails encoding, the handler rejects before starting the score-and-round transaction rather than persisting a partial aggregate.
