# Session Context

## User Prompts

### Prompt 1

Root cause confirmed — it's a data-model bug, not just one submission path

  The issue is structural and affects any view that reads scores by userId.

  The broken invariant

  scoresTable has a unique index on just (competitionEventId, userId) — apps/wodsmith-start/src/db/schemas/scores.ts:122-125. A single user can only have one score row per competition event,
  regardless of division. When an online competition reuses the same trackWorkout across both an individual and a partner divisi...

### Prompt 2

Stop hook feedback:
The codebase has changes (499 lines) but `lat.md/` may not be fully in sync (6 lines changed). Verify `lat.md/` is in sync — run `lat search` to find relevant sections. Run `lat check` at the end.

### Prompt 3

please replicate this scenario on the score-division-unique planetscale branch. use the planetscale mcp. make sure the competition is under the admin@example.com user

### Prompt 4

[Request interrupted by user for tool use]

### Prompt 5

try again

