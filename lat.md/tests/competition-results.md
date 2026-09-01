---
lat:
  require-code-mention: true
---

# Competition Result Commands

These tests protect the canonical competition-result decision and persistence invariants shared by every competition writer.

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
