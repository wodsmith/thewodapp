---
lat:
  require-code-mention: true
---

# Competition Result Commands

These tests protect the canonical competition-result decision and persistence invariants shared by the migrated competition writers.

## Explicit per-round CAP state above threshold

A round above the configured time cap remains scored unless its claim explicitly declares CAP, so encoded time never acts as hidden workflow state.

## Explicit capped round secondary value

An explicitly capped round clamps to the authoritative cap, retains its secondary reps, and makes the parent claim capped from the same round set.

## Complete round claims

A programmed multi-round workout rejects partial round claims before persistence, preventing parent aggregates and round rows from describing different performances.

## Atomic total replacement

Replacing a competition result always deletes the prior round set inside the score transaction, including when the new claim contains no rounds.

## Authoritative programmed workout

The command service derives workout identity, scoring definition, and owner team from the programmed event rather than trusting caller metadata.

## Capped round ranking

Capped performances retain per-round reps and rank higher reps ahead when cap count and time tie; every completed performance still ranks ahead of a capped one.

## Adjudicated totals preserve performance facts

A parent-only review override preserves the existing round facts, aggregate time, and capped-round count instead of becoming a single capped round.

## MySQL rollback and division isolation

Real MySQL tests verify score and round rollback after a later workflow failure, exact open-versus-named division identity, and total replacement without touching sibling divisions.

## Organizer cap editing

Organizer score entry reloads cap status and completed reps, saves changes after leaving the row, and distinguishes a finish exactly at the cap from an unfinished round.
